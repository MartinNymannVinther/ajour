import { and, eq, isNotNull } from "drizzle-orm";
import {
  events,
  participantReplies,
  people,
  statusUpdates,
  taskParticipants,
  tasks,
  TASK_STATES,
  type TaskState,
} from "@/core/db/schema";
import { appDb } from "@/core/db/client";
import type { AppTransaction } from "@/core/db/tenant";
import { resolveShareLink, type ResolvedLink } from "./service";

/**
 * The share link as an answer channel (docs/adr/0011). A holder who has
 * picked a name from the project's people can do three things, and only
 * those: mark a task they are on, leave a note on a task they are on, and
 * answer a question the latest approved status asked. Nothing else on the
 * project is reachable from here, and every write records who said it.
 *
 * The workspace is set from the link, so RLS holds as for the read; the
 * narrowing to the holder's own tasks is done here, in code, and proven
 * in tests/share/answers.test.ts.
 */

export type ShareWriteError =
  "noLink" | "readOnly" | "unknownPerson" | "notYourTask" | "invalid" | "noSuchQuestion";

export type ShareWriteResult<T = undefined> =
  { ok: true; data: T } | { ok: false; error: ShareWriteError };

const MAX_TEXT = 600;

function cleanText(raw: unknown): string {
  return typeof raw === "string"
    ? raw
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
        .trim()
        .slice(0, MAX_TEXT)
    : "";
}

/** Opens a link for writing; a read-only link is refused before anything else. */
async function openForWriting(
  tx: AppTransaction,
  token: string,
): Promise<ShareWriteResult<ResolvedLink>> {
  const link = await resolveShareLink(tx, token);
  if (!link) return { ok: false, error: "noLink" };
  if (!link.canAnswer) return { ok: false, error: "readOnly" };
  return { ok: true, data: link };
}

/** The person exists in the workspace; the name is what the event will say. */
async function personName(tx: AppTransaction, personId: string): Promise<string | null> {
  const [row] = await tx
    .select({ name: people.name })
    .from(people)
    .where(eq(people.id, personId))
    .limit(1);
  return row?.name ?? null;
}

/** The task is in the link's project and the person is its owner or a participant. */
async function ownTask(
  tx: AppTransaction,
  link: ResolvedLink,
  personId: string,
  taskId: string,
): Promise<{ id: string; title: string; state: string } | null> {
  const [task] = await tx
    .select({
      id: tasks.id,
      title: tasks.title,
      state: tasks.state,
      ownerPersonId: tasks.ownerPersonId,
    })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.projectId, link.projectId)))
    .limit(1);
  if (!task) return null;
  if (task.ownerPersonId === personId) return task;
  const [row] = await tx
    .select({ taskId: taskParticipants.taskId })
    .from(taskParticipants)
    .where(and(eq(taskParticipants.taskId, taskId), eq(taskParticipants.personId, personId)))
    .limit(1);
  return row ? task : null;
}

/**
 * Events written through a link have no user behind them; the actor is
 * the participant, named in the payload, and the kind says how it came in.
 */
async function recordParticipantEvent(
  tx: AppTransaction,
  link: ResolvedLink,
  type: string,
  payload: Record<string, unknown>,
) {
  await tx.insert(events).values({
    orgId: link.orgId,
    projectId: link.projectId,
    type,
    payload,
    actorKind: "participant",
    actorUserId: null,
  });
}

/** Is this person one the link may speak as? Only people on the project's tasks. */
export async function personOnProject(
  tx: AppTransaction,
  link: ResolvedLink,
  personId: string,
): Promise<string | null> {
  const owned = await tx
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.projectId, link.projectId), eq(tasks.ownerPersonId, personId)))
    .limit(1);
  if (owned.length === 0) {
    const [participating] = await tx
      .select({ taskId: taskParticipants.taskId })
      .from(taskParticipants)
      .innerJoin(tasks, eq(tasks.id, taskParticipants.taskId))
      .where(and(eq(tasks.projectId, link.projectId), eq(taskParticipants.personId, personId)))
      .limit(1);
    if (!participating) return null;
  }
  return personName(tx, personId);
}

/** Confirms a name the holder picked belongs to someone on the project. */
export async function identifyViaShare(
  token: string,
  personId: string,
): Promise<ShareWriteResult<{ name: string }>> {
  return appDb.transaction(async (tx) => {
    const opened = await openForWriting(tx, token);
    if (!opened.ok) return opened;
    const name = await personOnProject(tx, opened.data, personId);
    if (!name) return { ok: false, error: "unknownPerson" };
    return { ok: true, data: { name } };
  });
}

export async function setOwnTaskStateViaShare(
  token: string,
  personId: string,
  taskId: string,
  state: string,
): Promise<ShareWriteResult> {
  if (!TASK_STATES.includes(state as TaskState)) return { ok: false, error: "invalid" };
  return appDb.transaction(async (tx) => {
    const opened = await openForWriting(tx, token);
    if (!opened.ok) return opened;
    const link = opened.data;
    const name = await personOnProject(tx, link, personId);
    if (!name) return { ok: false, error: "unknownPerson" };
    const task = await ownTask(tx, link, personId, taskId);
    if (!task) return { ok: false, error: "notYourTask" };
    if (task.state !== state) {
      await tx.update(tasks).set({ state }).where(eq(tasks.id, task.id));
      await recordParticipantEvent(tx, link, "reply.state", { by: name, title: task.title, state });
    }
    return { ok: true, data: undefined };
  });
}

export async function addOwnTaskNoteViaShare(
  token: string,
  personId: string,
  taskId: string,
  rawText: string,
): Promise<ShareWriteResult<{ id: string }>> {
  const text = cleanText(rawText);
  if (!text) return { ok: false, error: "invalid" };
  return appDb.transaction(async (tx) => {
    const opened = await openForWriting(tx, token);
    if (!opened.ok) return opened;
    const link = opened.data;
    const name = await personOnProject(tx, link, personId);
    if (!name) return { ok: false, error: "unknownPerson" };
    const task = await ownTask(tx, link, personId, taskId);
    if (!task) return { ok: false, error: "notYourTask" };
    const [row] = await tx
      .insert(participantReplies)
      .values({
        orgId: link.orgId,
        projectId: link.projectId,
        shareLinkId: link.id,
        personId,
        kind: "note",
        taskId: task.id,
        text,
      })
      .returning({ id: participantReplies.id });
    await recordParticipantEvent(tx, link, "reply.note", { by: name, task: task.title, text });
    return { ok: true, data: { id: row!.id } };
  });
}

export async function answerQuestionViaShare(
  token: string,
  personId: string,
  statusUpdateId: string,
  questionIndex: number,
  rawText: string,
): Promise<ShareWriteResult<{ id: string }>> {
  const text = cleanText(rawText);
  if (!text || !Number.isInteger(questionIndex) || questionIndex < 0)
    return { ok: false, error: "invalid" };
  return appDb.transaction(async (tx) => {
    const opened = await openForWriting(tx, token);
    if (!opened.ok) return opened;
    const link = opened.data;
    const name = await personOnProject(tx, link, personId);
    if (!name) return { ok: false, error: "unknownPerson" };
    // Only an approved status in this project has questions anyone may see.
    const [status] = await tx
      .select({ id: statusUpdates.id, questions: statusUpdates.questions })
      .from(statusUpdates)
      .where(
        and(
          eq(statusUpdates.id, statusUpdateId),
          eq(statusUpdates.projectId, link.projectId),
          isNotNull(statusUpdates.approvedAt),
        ),
      )
      .limit(1);
    const question = status?.questions[questionIndex];
    if (!status || !question) return { ok: false, error: "noSuchQuestion" };
    const [row] = await tx
      .insert(participantReplies)
      .values({
        orgId: link.orgId,
        projectId: link.projectId,
        shareLinkId: link.id,
        personId,
        kind: "answer",
        statusUpdateId: status.id,
        questionIndex,
        question,
        text,
      })
      .returning({ id: participantReplies.id });
    await recordParticipantEvent(tx, link, "reply.answer", { by: name, question, text });
    return { ok: true, data: { id: row!.id } };
  });
}
