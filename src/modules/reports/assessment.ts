import { diffDays } from "@/core/dates";
import type { Rag } from "./status-report";

/**
 * The overall assessment, derived rather than felt. Three questions, each
 * answered from the plan: is the next milestone at risk, is anything in
 * the way that nobody is handling, and is the money running ahead of the
 * work. The worst answer sets the colour; the reason names it.
 *
 * Deterministic on purpose. A model may write the words around it, but a
 * colour a steering group acts on should not depend on which model was
 * awake that morning, and the project manager can overrule it anyway: the
 * report then shows both, which is the honest picture.
 */

export type AssessmentInput = {
  today: string;
  /** Days since the project was created; a plan younger than a week is "early". */
  ageDays: number;
  nextMilestone: { title: string; date: string; taskCount: number; openCount: number } | null;
  overdueTasks: number;
  /** The first late task by name, so the reason can point at it. */
  overdueExample: string;
  /** Overdue by more than a week: the ones that will move the milestone. */
  badlyOverdueTasks: number;
  openObstacles: number;
  progress: { done: number; total: number };
  economy: { budget: number | null; incurredTotal: number; plannedTotal: number } | null;
};

export type AssessmentReason =
  | { key: "early" }
  | { key: "onTrack" }
  | { key: "milestoneAtRisk"; title: string; date: string; days: number; open: number }
  | { key: "milestoneMissed"; title: string; date: string; days: number }
  | { key: "overdue"; count: number; example: string }
  | { key: "obstacles"; count: number }
  | { key: "overBudget"; percent: number }
  | { key: "spendAhead"; spendPercent: number; workPercent: number };

export type Assessment = { rag: Rag; reasons: AssessmentReason[] };

const ORDER: Rag[] = ["early", "green", "yellow", "red"];
const worse = (a: Rag, b: Rag): Rag => (ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b);

export function assessProject(input: AssessmentInput): Assessment {
  if (input.ageDays < 7 && input.progress.done === 0) {
    return { rag: "early", reasons: [{ key: "early" }] };
  }

  let rag: Rag = "green";
  const reasons: AssessmentReason[] = [];

  // The next milestone: missed is red; open work with under two weeks to
  // go, or anything badly overdue beneath it, is yellow.
  if (input.nextMilestone) {
    const days = diffDays(input.today, input.nextMilestone.date);
    if (days < 0) {
      rag = worse(rag, "red");
      reasons.push({
        key: "milestoneMissed",
        title: input.nextMilestone.title,
        date: input.nextMilestone.date,
        days: -days,
      });
    } else if (
      (days <= 14 && input.nextMilestone.openCount > 0 && input.overdueTasks > 0) ||
      input.badlyOverdueTasks > 0
    ) {
      rag = worse(rag, "yellow");
      reasons.push({
        key: "milestoneAtRisk",
        title: input.nextMilestone.title,
        date: input.nextMilestone.date,
        days,
        open: input.nextMilestone.openCount,
      });
    }
  }

  if (input.overdueTasks >= 3) {
    rag = worse(rag, "red");
    reasons.push({ key: "overdue", count: input.overdueTasks, example: input.overdueExample });
  } else if (input.overdueTasks > 0 && !reasons.some((r) => r.key === "milestoneAtRisk")) {
    rag = worse(rag, "yellow");
    reasons.push({ key: "overdue", count: input.overdueTasks, example: input.overdueExample });
  }

  if (input.openObstacles > 0) {
    rag = worse(rag, "yellow");
    reasons.push({ key: "obstacles", count: input.openObstacles });
  }

  if (input.economy?.budget) {
    const { budget, incurredTotal, plannedTotal } = input.economy;
    const spendPercent = Math.round((incurredTotal / budget) * 100);
    const workPercent =
      input.progress.total > 0 ? Math.round((input.progress.done / input.progress.total) * 100) : 0;
    if (plannedTotal > budget) {
      rag = worse(rag, "red");
      reasons.push({ key: "overBudget", percent: Math.round((plannedTotal / budget) * 100) });
    } else if (spendPercent - workPercent >= 25 && spendPercent >= 50) {
      rag = worse(rag, "yellow");
      reasons.push({ key: "spendAhead", spendPercent, workPercent });
    }
  }

  if (reasons.length === 0) reasons.push({ key: "onTrack" });
  return { rag, reasons };
}
