import { diffDays, todayInCopenhagen } from "@/core/dates";
import type { AppTransaction } from "@/core/db/tenant";
import type { ProjectFull } from "@/modules/projects/types";
import { assessProject, type Assessment, type AssessmentReason } from "./assessment";
import { condenseSinceLast, eventsSince, type SinceLastWords } from "./since-last";
import type { ManagementAsk, Rag } from "./status-report";

/**
 * Everything the status page needs before a person types a word: the
 * assessment and its reason, what changed since last week, the asks still
 * open from last time, and last week's comment as a starting point.
 * Computed on the server, in the reader's language, once per draft.
 */

export type StatusWords = {
  reason: (reason: AssessmentReason) => string;
  sinceLast: SinceLastWords;
};

export type PreparedStatus = {
  assessment: Assessment;
  rag: Rag;
  reason: string;
  sinceLast: string[];
  carriedAsks: ManagementAsk[];
  previousComment: string;
  previousWeek: string | null;
};

export function assessmentInputFor(full: ProjectFull, today = todayInCopenhagen()) {
  const { project, tasks, milestones, obstacles, expenses } = full;
  const next =
    milestones
      .filter((m) => !m.doneAt)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((m) => ({
        title: m.title,
        date: m.date,
        taskCount: tasks.filter((t) => t.milestoneId === m.id).length,
        openCount: tasks.filter((t) => t.milestoneId === m.id && t.state !== "done").length,
      }))[0] ?? null;
  const overdue = tasks.filter((t) => t.state !== "done" && t.endDate < today);
  return {
    today,
    ageDays: diffDays(project.createdAt.toISOString().slice(0, 10), today),
    nextMilestone: next,
    overdueTasks: overdue.length,
    overdueExample: overdue[0]?.title ?? "",
    badlyOverdueTasks: overdue.filter((t) => diffDays(t.endDate, today) > 7).length,
    openObstacles: obstacles.filter((o) => o.status !== "resolved").length,
    progress: { done: tasks.filter((t) => t.state === "done").length, total: tasks.length },
    economy:
      project.budget !== null || expenses.length > 0
        ? {
            budget: project.budget,
            plannedTotal: expenses.reduce((sum, e) => sum + e.amount, 0),
            incurredTotal: expenses.filter((e) => e.incurred).reduce((sum, e) => sum + e.amount, 0),
          }
        : null,
  };
}

export async function prepareStatus(
  tx: AppTransaction,
  full: ProjectFull,
  words: StatusWords,
  today = todayInCopenhagen(),
): Promise<PreparedStatus> {
  const assessment = assessProject(assessmentInputFor(full, today));
  const previous = full.statusUpdates.find((s) => s.approvedAt) ?? null;
  const rows = await eventsSince(tx, full.project.id, previous?.approvedAt ?? null);
  const sinceLast = condenseSinceLast(
    // The approval itself is an event too; it is not news.
    rows.filter((r) => r.type !== "status.approved" && r.type !== "snapshot.created"),
    words.sinceLast,
  );
  const carriedAsks = (previous?.managementAsks ?? [])
    .filter((a) => !a.answered)
    .map((a) => ({ ...a, carriedFrom: a.carriedFrom ?? previous!.weekKey }));
  return {
    assessment,
    rag: assessment.rag,
    reason: assessment.reasons.map(words.reason).join(" "),
    sinceLast,
    carriedAsks,
    previousComment: previous?.managerComment ?? "",
    previousWeek: previous?.weekKey ?? null,
  };
}
