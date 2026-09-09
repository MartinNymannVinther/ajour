import { createHash, randomBytes } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  milestones,
  participantReplies,
  people,
  projects,
  shareLinks,
  statusUpdates,
  taskParticipants,
  tasks,
  type ReplyKind,
} from "@/core/db/schema";
import { appDb } from "@/core/db/client";
import { withOrgContext, type AppTransaction, type OrgContext } from "@/core/db/tenant";
import { env } from "@/core/env";
import { parseStatusReport, type StatusReport } from "@/modules/reports/status-report";
export { SHARE_TTL_OPTIONS } from "./constants";

/**
 * Share links: a token in a URL that opens one project's status page for
 * anyone who has it, no login. Stored as a hash, revocable, optionally
 * expiring. What the page shows is decided by one minimal query here and
 * never by the ordinary project read: no budget, no obstacles, no drafts,
 * no chat.
 */

/** How coarse "last used" is allowed to be. See resolveShareLink. */
const LAST_USED_RESOLUTION_MS = 5 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function shareUrl(token: string, locale: "da" | "en"): string {
  const url = new URL(locale === "da" ? `/s/${token}` : `/en/s/${token}`, env.BETTER_AUTH_URL);
  return url.toString();
}

export async function createShareLink(
  ctx: OrgContext,
  projectId: string,
  label: string,
  ttlDays: number | null,
  canAnswer = false,
): Promise<{ id: string; token: string; expiresAt: Date | null } | null> {
  const token = randomBytes(18).toString("base64url");
  const expiresAt = ttlDays ? new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000) : null;
  return withOrgContext(ctx, async (tx) => {
    const [project] = await tx
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    if (!project) return null;
    const [row] = await tx
      .insert(shareLinks)
      .values({
        orgId: ctx.orgId,
        projectId,
        tokenHash: hashToken(token),
        label: label.trim().slice(0, 80),
        canAnswer,
        createdBy: ctx.userId,
        expiresAt,
      })
      .returning({ id: shareLinks.id });
    return { id: row!.id, token, expiresAt };
  });
}

export async function revokeShareLink(ctx: OrgContext, linkId: string): Promise<boolean> {
  return withOrgContext(ctx, async (tx) => {
    const rows = await tx
      .update(shareLinks)
      .set({ revokedAt: new Date() })
      .where(and(eq(shareLinks.id, linkId), isNull(shareLinks.revokedAt)))
      .returning({ id: shareLinks.id });
    return rows.length > 0;
  });
}

/**
 * What a shared report may say.
 *
 * The frozen report holds the money, the obstacles and the management
 * conversation too, because the workspace's own PDF needs them. The
 * public page must not, so they are cut here rather than at the template.
 *
 * This is written as an allow-list, and that is the whole point of it. It
 * used to be a deny-list — spread the report, blank four fields — and the
 * report schema then grew three fields it did not know about: `ragReason`
 * quotes the budget, `sinceLast` prints sentences like "the budget was
 * set to 400,000 kr.", and `decisions` carries the notes behind them. All
 * three walked straight onto the public PDF. A deny-list is a list you
 * have to remember to update; an allow-list fails the other way, and a
 * new field stays private until somebody decides otherwise.
 *
 * Deliberately withheld, and why:
 * - economy, expenses: the budget. The first reason share links exist.
 * - obstacles: named problems, often about people.
 * - managementAsks: what the manager is asking the steering group for.
 * - ragReason, sinceLast: free text written about the money.
 * - decisions, decisionsSince: the reasoning behind choices, which is
 *   internal even when the choice itself is visible in the plan.
 * - ragSuggested: that the manager overruled the engine is a workspace
 *   matter; the assessment in force is what a reader needs.
 *
 * Proven in tests/share/share-links.test.ts, which asserts on the exact
 * key set rather than on the four fields somebody happened to think of.
 */
function publicReport(raw: unknown): StatusReport | null {
  const report = parseStatusReport(raw);
  if (!report) return null;
  return {
    version: 2,
    today: report.today,
    weekKey: report.weekKey,
    projectName: report.projectName,
    goal: report.goal,
    ownerName: report.ownerName,
    managerName: report.managerName,
    approvedByName: report.approvedByName,
    rag: report.rag,
    text: report.text,
    managerComment: report.managerComment,
    nextWeek: report.nextWeek,
    trend: report.trend,
    progress: report.progress,
    milestones: report.milestones,
    tasks: report.tasks,
    engine: report.engine,
    // Withheld. Written out rather than omitted so the type checker
    // fails a new field into view instead of letting it default.
    ragSuggested: null,
    ragReason: "",
    sinceLast: [],
    economy: null,
    expenses: [],
    obstacles: [],
    managementAsks: [],
    decisions: [],
    decisionsSince: null,
    redacted: true,
  };
}

export type SharedReply = {
  id: string;
  kind: ReplyKind;
  personName: string;
  statusUpdateId: string | null;
  questionIndex: number | null;
  question: string;
  taskId: string | null;
  text: string;
  createdAt: Date;
};

export type SharedProject = {
  name: string;
  goal: string;
  today: string;
  /** True for a link that may answer; then people and personIds are filled. */
  canAnswer: boolean;
  people: Array<{ id: string; name: string }>;
  milestones: Array<{ id: string; title: string; date: string; done: boolean }>;
  tasks: Array<{
    id: string;
    title: string;
    state: string;
    startDate: string;
    endDate: string;
    milestoneId: string | null;
    /** Owner first, then participants; empty on a read-only link. */
    personIds: string[];
  }>;
  statuses: Array<{
    id: string;
    weekKey: string;
    text: string;
    /** The questions the status asked; empty on a read-only link. */
    questions: string[];
    approvedAt: Date;
    report: StatusReport | null;
  }>;
  replies: SharedReply[];
};

export type ResolvedLink = {
  id: string;
  orgId: string;
  projectId: string;
  canAnswer: boolean;
};

/**
 * Finds the link a token names and sets the workspace it belongs to for
 * the rest of the transaction. Until the token matches something the
 * connection can see nothing at all; a revoked or expired link is a
 * miss, not an error, because the page behind it is simply gone.
 */
export async function resolveShareLink(
  tx: AppTransaction,
  token: string,
): Promise<ResolvedLink | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const hash = hashToken(token);
  await tx.execute(sql`select set_config('app.share_hash', ${hash}, true)`);
  const [link] = await tx
    .select()
    .from(shareLinks)
    .where(and(eq(shareLinks.tokenHash, hash), isNull(shareLinks.revokedAt)))
    .limit(1);
  if (!link) return null;
  if (link.expiresAt && link.expiresAt.getTime() < Date.now()) return null;
  await tx.execute(sql`select set_config('app.org_id', ${link.orgId}, true)`);
  // "Last used" to the minute is plenty, and writing it on every read
  // would mean an audit row per page view on a public URL: a link on a
  // steering group's intranet would fill the audit log with the fact that
  // somebody looked at it. Written at most once per LAST_USED_RESOLUTION_MS.
  const now = Date.now();
  if (!link.lastUsedAt || now - link.lastUsedAt.getTime() > LAST_USED_RESOLUTION_MS) {
    await tx
      .update(shareLinks)
      .set({ lastUsedAt: new Date(now) })
      .where(eq(shareLinks.id, link.id));
  }
  return { id: link.id, orgId: link.orgId, projectId: link.projectId, canAnswer: link.canAnswer };
}

/**
 * The public read. Runs on the application role without a session: the
 * token hash is the only context until the link row is found, then the
 * workspace it belongs to is set for the rest of the transaction.
 *
 * A link that may answer also carries who is on which task and what the
 * latest status asked, so the holder can pick their name and reply; a
 * read-only link carries none of that, so the page cannot offer it.
 */
export async function readSharedProject(
  token: string,
  today: string,
): Promise<SharedProject | null> {
  return appDb.transaction(async (tx) => {
    const link = await resolveShareLink(tx, token);
    if (!link) return null;
    const [project] = await tx
      .select({ name: projects.name, goal: projects.goal })
      .from(projects)
      .where(eq(projects.id, link.projectId))
      .limit(1);
    if (!project) return null;
    const ms = await tx
      .select({
        id: milestones.id,
        title: milestones.title,
        date: milestones.date,
        doneAt: milestones.doneAt,
      })
      .from(milestones)
      .where(eq(milestones.projectId, link.projectId))
      .orderBy(asc(milestones.date));
    const ts = await tx
      .select({
        id: tasks.id,
        title: tasks.title,
        state: tasks.state,
        startDate: tasks.startDate,
        endDate: tasks.endDate,
        milestoneId: tasks.milestoneId,
        ownerPersonId: tasks.ownerPersonId,
      })
      .from(tasks)
      .where(eq(tasks.projectId, link.projectId))
      .orderBy(asc(tasks.startDate));
    const st = await tx
      .select({
        id: statusUpdates.id,
        weekKey: statusUpdates.weekKey,
        text: statusUpdates.text,
        questions: statusUpdates.questions,
        approvedAt: statusUpdates.approvedAt,
        details: statusUpdates.details,
      })
      .from(statusUpdates)
      .where(eq(statusUpdates.projectId, link.projectId))
      .orderBy(desc(statusUpdates.approvedAt));
    const answering = link.canAnswer ? await readAnswering(tx, link.projectId, ts) : null;
    return {
      name: project.name,
      goal: project.goal,
      today,
      canAnswer: link.canAnswer,
      people: answering?.people ?? [],
      milestones: ms.map((m) => ({
        id: m.id,
        title: m.title,
        date: m.date,
        done: Boolean(m.doneAt),
      })),
      tasks: ts.map((t) => ({
        id: t.id,
        title: t.title,
        state: t.state,
        startDate: t.startDate,
        endDate: t.endDate,
        milestoneId: t.milestoneId,
        personIds: answering?.personIdsByTask.get(t.id) ?? [],
      })),
      statuses: st
        .filter((s) => s.approvedAt)
        .map((s) => ({
          id: s.id,
          weekKey: s.weekKey,
          text: s.text,
          questions: link.canAnswer ? s.questions : [],
          approvedAt: s.approvedAt!,
          report: publicReport(s.details),
        })),
      replies: answering?.replies ?? [],
    };
  });
}

/**
 * The extra a link that may answer needs: the people on the project's
 * tasks (owner or participant, nobody else), which of them is on which
 * task, and what has already been said through the link.
 */
async function readAnswering(
  tx: AppTransaction,
  projectId: string,
  ts: Array<{ id: string; ownerPersonId: string | null }>,
) {
  const participantRows =
    ts.length === 0
      ? []
      : await tx
          .select({ taskId: taskParticipants.taskId, personId: taskParticipants.personId })
          .from(taskParticipants)
          .where(
            inArray(
              taskParticipants.taskId,
              ts.map((t) => t.id),
            ),
          );
  const personIdsByTask = new Map<string, string[]>();
  for (const t of ts) personIdsByTask.set(t.id, t.ownerPersonId ? [t.ownerPersonId] : []);
  for (const row of participantRows)
    personIdsByTask.set(row.taskId, [...(personIdsByTask.get(row.taskId) ?? []), row.personId]);
  const ids = [...new Set([...personIdsByTask.values()].flat())];
  const peopleRows =
    ids.length === 0
      ? []
      : await tx
          .select({ id: people.id, name: people.name })
          .from(people)
          .where(inArray(people.id, ids))
          .orderBy(asc(people.name));
  const names = new Map(peopleRows.map((p) => [p.id, p.name]));
  const replyRows = await tx
    .select()
    .from(participantReplies)
    .where(eq(participantReplies.projectId, projectId))
    .orderBy(desc(participantReplies.createdAt))
    .limit(100);
  return {
    people: peopleRows,
    personIdsByTask,
    replies: replyRows.map((r) => ({
      id: r.id,
      kind: r.kind as ReplyKind,
      personName: names.get(r.personId) ?? "",
      statusUpdateId: r.statusUpdateId,
      questionIndex: r.questionIndex,
      question: r.question,
      taskId: r.taskId,
      text: r.text,
      createdAt: r.createdAt,
    })),
  };
}
