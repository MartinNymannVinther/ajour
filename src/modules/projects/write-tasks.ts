import { and, eq } from "drizzle-orm";
import {
  milestones,
  taskParticipants,
  tasks,
  type Subtask,
  type TaskState,
} from "@/core/db/schema";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";
import { recordEvent, type ActorKind } from "./events";
import { namesForIds, personIdForName, personIdsForNames } from "./people";
import { takeSnapshot } from "./snapshots";
import { orderedDates } from "./validation";

/**
 * Task mutations, one transaction each when called from an action and
 * composable inside a larger one (the AI applies a whole reply in one).
 * Every function resolves the task inside the active workspace first; a
 * task id from another workspace is simply not found.
 */

export class Conflict extends Error {
  constructor() {
    super("conflict");
    this.name = "Conflict";
  }
}

async function taskInProject(tx: AppTransaction, taskId: string) {
  const [row] = await tx.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  return row ?? null;
}

/** The milestone if it belongs to the project, else null (never another project's). */
async function milestoneInProject(
  tx: AppTransaction,
  projectId: string,
  milestoneId: string | null,
) {
  if (!milestoneId) return null;
  const [row] = await tx
    .select({ id: milestones.id, title: milestones.title })
    .from(milestones)
    .where(and(eq(milestones.id, milestoneId), eq(milestones.projectId, projectId)))
    .limit(1);
  return row ?? null;
}

/** Optimistic lock: the row must be the one the caller looked at. */
function assertFresh(row: { updatedAt: Date }, expectedUpdatedAt?: string) {
  if (expectedUpdatedAt && row.updatedAt.toISOString() !== expectedUpdatedAt) throw new Conflict();
}

export async function createTask(
  tx: AppTransaction,
  ctx: OrgContext,
  input: {
    projectId: string;
    title: string;
    milestoneId: string | null;
    owner: string;
    startDate: string;
    endDate: string;
    participants?: string[];
    state?: TaskState;
    subtasks?: Subtask[];
    milestoneRelation?: string;
  },
  actor: ActorKind = "user",
): Promise<string> {
  const [startDate, endDate] = orderedDates(input.startDate, input.endDate);
  const milestone = await milestoneInProject(tx, input.projectId, input.milestoneId);
  const ownerPersonId = await personIdForName(tx, ctx, input.owner);
  const [row] = await tx
    .insert(tasks)
    .values({
      orgId: ctx.orgId,
      projectId: input.projectId,
      milestoneId: milestone?.id ?? null,
      title: input.title,
      ownerPersonId,
      state: input.state ?? "todo",
      startDate,
      endDate,
      subtasks: input.subtasks ?? [],
      milestoneRelation: input.milestoneRelation ?? "before",
    })
    .returning({ id: tasks.id });
  const taskId = row!.id;
  if (input.participants?.length) {
    const ids = await personIdsForNames(tx, ctx, input.participants);
    if (ids.length)
      await tx
        .insert(taskParticipants)
        .values(ids.map((personId) => ({ orgId: ctx.orgId, taskId, personId })));
  }
  await recordEvent(
    tx,
    ctx,
    input.projectId,
    "task.created",
    { title: input.title, start: startDate, end: endDate },
    actor,
  );
  return taskId;
}

export async function setTaskState(
  tx: AppTransaction,
  ctx: OrgContext,
  taskId: string,
  state: TaskState,
  actor: ActorKind = "user",
) {
  const task = await taskInProject(tx, taskId);
  if (!task) return null;
  if (task.state !== state) {
    await tx.update(tasks).set({ state }).where(eq(tasks.id, taskId));
    await recordEvent(tx, ctx, task.projectId, "task.state", { title: task.title, state }, actor);
  }
  return task;
}

export async function moveTask(
  tx: AppTransaction,
  ctx: OrgContext,
  taskId: string,
  start: string,
  end: string,
  actor: ActorKind = "user",
) {
  const task = await taskInProject(tx, taskId);
  if (!task) return null;
  const [startDate, endDate] = orderedDates(start, end);
  await tx.update(tasks).set({ startDate, endDate }).where(eq(tasks.id, taskId));
  await recordEvent(
    tx,
    ctx,
    task.projectId,
    "task.moved",
    { title: task.title, start: startDate, end: endDate },
    actor,
  );
  return task;
}

/** Dragged to another milestone on the timeline; the dates from the same drag come along. */
export async function relinkTask(
  tx: AppTransaction,
  ctx: OrgContext,
  taskId: string,
  milestoneId: string | null,
  start: string,
  end: string,
  actor: ActorKind = "user",
) {
  const task = await taskInProject(tx, taskId);
  if (!task) return null;
  const target = await milestoneInProject(tx, task.projectId, milestoneId);
  if (milestoneId && !target) return null;
  const [startDate, endDate] = orderedDates(start, end);
  await tx
    .update(tasks)
    .set({ milestoneId: target?.id ?? null, startDate, endDate })
    .where(eq(tasks.id, taskId));
  await recordEvent(
    tx,
    ctx,
    task.projectId,
    "task.relinked",
    { title: task.title, milestone: target?.title ?? "" },
    actor,
  );
  return task;
}

export async function updateTaskPeople(
  tx: AppTransaction,
  ctx: OrgContext,
  input: {
    taskId: string;
    owner: string;
    participants: string[];
    milestoneRelation?: string;
    milestoneId?: string | null;
    expectedUpdatedAt?: string;
  },
  actor: ActorKind = "user",
) {
  const task = await taskInProject(tx, input.taskId);
  if (!task) return null;
  assertFresh(task, input.expectedUpdatedAt);
  const ownerPersonId = await personIdForName(tx, ctx, input.owner);
  const participantIds = (await personIdsForNames(tx, ctx, input.participants)).filter(
    (pid) => pid !== ownerPersonId,
  );
  const target =
    input.milestoneId === undefined
      ? { id: task.milestoneId }
      : await milestoneInProject(tx, task.projectId, input.milestoneId);
  await tx
    .update(tasks)
    .set({
      ownerPersonId,
      milestoneRelation: input.milestoneRelation ?? task.milestoneRelation,
      milestoneId: input.milestoneId === undefined ? task.milestoneId : (target?.id ?? null),
    })
    .where(eq(tasks.id, task.id));
  await tx.delete(taskParticipants).where(eq(taskParticipants.taskId, task.id));
  if (participantIds.length)
    await tx
      .insert(taskParticipants)
      .values(participantIds.map((personId) => ({ orgId: ctx.orgId, taskId: task.id, personId })));
  const names = await namesForIds(tx, [ownerPersonId, ...participantIds]);
  await recordEvent(
    tx,
    ctx,
    task.projectId,
    "task.people",
    {
      title: task.title,
      owner: ownerPersonId ? (names.get(ownerPersonId) ?? "") : "",
      participants: participantIds.map((pid) => names.get(pid) ?? "").filter(Boolean),
    },
    actor,
  );
  return task;
}

export async function renameTask(
  tx: AppTransaction,
  ctx: OrgContext,
  taskId: string,
  title: string,
  expectedUpdatedAt?: string,
) {
  const task = await taskInProject(tx, taskId);
  if (!task) return null;
  assertFresh(task, expectedUpdatedAt);
  await tx.update(tasks).set({ title }).where(eq(tasks.id, taskId));
  return task;
}

export async function updateSubtasks(
  tx: AppTransaction,
  ctx: OrgContext,
  taskId: string,
  subtasks: Subtask[],
  actor: ActorKind = "user",
) {
  const task = await taskInProject(tx, taskId);
  if (!task) return null;
  await tx.update(tasks).set({ subtasks }).where(eq(tasks.id, taskId));
  await recordEvent(
    tx,
    ctx,
    task.projectId,
    "task.subtasks",
    { title: task.title, count: subtasks.length },
    actor,
  );
  return task;
}

/** Deleting takes a copy first, so a slip is a click away from undone. */
export async function deleteTask(tx: AppTransaction, ctx: OrgContext, taskId: string) {
  const task = await taskInProject(tx, taskId);
  if (!task) return null;
  await takeSnapshot(tx, ctx, task.projectId, `Before deleting "${task.title}"`, "system");
  await tx.delete(tasks).where(eq(tasks.id, taskId));
  await recordEvent(tx, ctx, task.projectId, "task.deleted", { title: task.title });
  return task;
}
