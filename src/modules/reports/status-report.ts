import { eq } from "drizzle-orm";
import { statusUpdates } from "@/core/db/schema";
import { todayInCopenhagen, weekKey } from "@/core/dates";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";
import { recordEvent } from "@/modules/projects/events";
import type { ProjectFull } from "@/modules/projects/types";

/**
 * The weekly status report: the approved text plus the state of the plan
 * on the day, frozen as one document. The PDF and the share page render
 * from this, so a report says next year what it said the day it was
 * shared, whatever the plan did since.
 */
export type StatusReport = {
  version: 1;
  today: string;
  weekKey: string;
  projectName: string;
  goal: string;
  ownerName: string;
  managerName: string;
  text: string;
  economy: {
    budget: number | null;
    plannedTotal: number;
    incurredTotal: number;
    postCount: number;
  } | null;
  milestones: Array<{
    title: string;
    date: string;
    done: boolean;
    ownerName: string;
    criterion: string;
  }>;
  tasks: Array<{
    title: string;
    start: string;
    end: string;
    state: string;
    owner: string;
    milestoneIndex: number | null;
  }>;
  obstacles: Array<{ title: string; since: string }>;
  decisions: Array<{ title: string; note: string; date: string }>;
  /** ISO week key of the previous approved status, when decisions are "since" it. */
  decisionsSince: string | null;
};

export function buildStatusReport(
  full: ProjectFull,
  text: string,
  today = todayInCopenhagen(),
): StatusReport {
  const {
    project,
    milestones,
    tasks,
    expenses,
    obstacles,
    decisions,
    statusUpdates: statuses,
  } = full;
  const sorted = [...milestones].sort((a, b) => a.date.localeCompare(b.date));
  const index = new Map(sorted.map((m, i) => [m.id, i]));
  const previous = statuses.find((s) => s.approvedAt) ?? null;
  const since = previous?.approvedAt ?? null;
  return {
    version: 1,
    today,
    weekKey: weekKey(today),
    projectName: project.name,
    goal: project.goal,
    ownerName: project.ownerName,
    managerName: project.managerName,
    text,
    economy:
      project.budget !== null || expenses.length > 0
        ? {
            budget: project.budget,
            plannedTotal: expenses.reduce((sum, e) => sum + e.amount, 0),
            incurredTotal: expenses.filter((e) => e.incurred).reduce((sum, e) => sum + e.amount, 0),
            postCount: expenses.length,
          }
        : null,
    milestones: sorted.map((m) => ({
      title: m.title,
      date: m.date,
      done: Boolean(m.doneAt),
      ownerName: m.ownerName,
      criterion: m.criterion,
    })),
    tasks: [...tasks]
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .map((t) => ({
        title: t.title,
        start: t.startDate,
        end: t.endDate,
        state: t.state,
        owner: t.ownerName,
        milestoneIndex:
          t.milestoneId !== null && index.has(t.milestoneId) ? index.get(t.milestoneId)! : null,
      })),
    obstacles: obstacles
      .filter((o) => o.status !== "resolved")
      .map((o) => ({ title: o.title, since: o.createdAt.toISOString().slice(0, 10) })),
    decisions: decisions
      .filter((d) => !since || d.createdAt > since)
      .map((d) => ({ title: d.title, note: d.note, date: d.createdAt.toISOString().slice(0, 10) })),
    decisionsSince: previous?.weekKey ?? null,
  };
}

export function parseStatusReport(raw: unknown): StatusReport | null {
  const r = raw as StatusReport | null;
  return r && r.version === 1 && Array.isArray(r.milestones) && Array.isArray(r.tasks) ? r : null;
}

/** Approves a status: the text and the frozen report become one row. */
export async function approveStatus(
  tx: AppTransaction,
  ctx: OrgContext,
  full: ProjectFull,
  text: string,
  questions: string[],
  engine: string,
): Promise<string> {
  const report = buildStatusReport(full, text);
  const [row] = await tx
    .insert(statusUpdates)
    .values({
      orgId: ctx.orgId,
      projectId: full.project.id,
      weekKey: report.weekKey,
      text,
      questions,
      details: report,
      engine,
      approvedAt: new Date(),
      approvedBy: ctx.userId,
    })
    .returning({ id: statusUpdates.id });
  await recordEvent(tx, ctx, full.project.id, "status.approved", { week: report.weekKey });
  return row!.id;
}

export async function getStatus(tx: AppTransaction, statusId: string) {
  const [row] = await tx
    .select()
    .from(statusUpdates)
    .where(eq(statusUpdates.id, statusId))
    .limit(1);
  return row ?? null;
}
