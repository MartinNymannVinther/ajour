import { addDaysIso, diffDays, maxIso, minIso, mondayOf } from "@/core/dates";
import type { ReportMilestone, ReportTask, StatusReport } from "./status-report";

/**
 * The editor: which parts of a report earn their place on the page. A
 * reader with two minutes should see what changes the picture and nothing
 * that does not, and the same rules decide it every week, so a section
 * that is missing is missing because there was nothing in it.
 */

export type ReportSections = {
  economy: boolean;
  obstacles: boolean;
  decisions: boolean;
  sinceLast: boolean;
  asks: boolean;
  comment: boolean;
  nextWeek: boolean;
  /** The appendix with every task; false for a plan too small to need one. */
  appendix: boolean;
};

export function reportSections(report: StatusReport): ReportSections {
  return {
    economy: Boolean(
      report.economy && (report.economy.budget !== null || report.economy.postCount > 0),
    ),
    obstacles: report.obstacles.length > 0,
    decisions: report.decisions.length > 0,
    sinceLast: report.sinceLast.length > 0,
    asks: report.managementAsks.length > 0,
    comment: report.managerComment.trim().length > 0,
    nextWeek: report.nextWeek.length > 0,
    appendix: report.tasks.length > 0,
  };
}

export type PlanRow =
  | { kind: "milestone"; milestone: ReportMilestone; index: number }
  | { kind: "task"; task: ReportTask };

export type PlanSlice = {
  rows: PlanRow[];
  /** Tasks left out of the front page and why, for the one-line note. */
  omitted: number;
  /** Monday of the first week shown and the day after the last one. */
  from: string;
  to: string;
  weeks: number;
};

const FRONT_MAX_TASKS = 6;
const FRONT_MAX_WEEKS = 10;
const APPENDIX_MAX_WEEKS = 16;

/**
 * The plan for the front page: the next two milestones and the tasks
 * beneath them that are still moving. Done tasks stay out unless they
 * are what carried a milestone this week; the appendix has the rest.
 */
export function frontPlan(report: StatusReport): PlanSlice {
  const pending = report.milestones
    .map((m, index) => ({ m, index }))
    .filter(({ m }) => !m.done)
    .slice(0, 2);
  const chosen =
    pending.length > 0
      ? pending
      : report.milestones.slice(-1).map((m) => ({ m, index: report.milestones.length - 1 }));
  const indexes = new Set(chosen.map((c) => c.index));
  const live = report.tasks.filter(
    (t) => t.milestoneIndex !== null && indexes.has(t.milestoneIndex) && t.state !== "done",
  );
  const shown = live.slice(0, FRONT_MAX_TASKS);
  const rows: PlanRow[] = [];
  for (const { m, index } of chosen) {
    rows.push({ kind: "milestone", milestone: m, index });
    for (const task of shown) if (task.milestoneIndex === index) rows.push({ kind: "task", task });
  }
  const omitted = report.tasks.filter((t) => t.state !== "done").length - shown.length;
  return { rows, omitted: Math.max(0, omitted), ...window(report, rows, FRONT_MAX_WEEKS) };
}

/** Every milestone and every task, for the appendix. */
export function fullPlan(report: StatusReport): PlanSlice {
  const rows: PlanRow[] = [];
  report.milestones.forEach((m, index) => {
    rows.push({ kind: "milestone", milestone: m, index });
    for (const task of report.tasks)
      if (task.milestoneIndex === index) rows.push({ kind: "task", task });
  });
  const loose = report.tasks.filter((t) => t.milestoneIndex === null);
  for (const task of loose) rows.push({ kind: "task", task });
  return { rows, omitted: 0, ...window(report, rows, APPENDIX_MAX_WEEKS) };
}

function window(report: StatusReport, rows: PlanRow[], maxWeeks: number) {
  const dates = [report.today];
  for (const row of rows) {
    if (row.kind === "milestone") dates.push(row.milestone.date);
    else dates.push(row.task.start, row.task.end);
  }
  let from = mondayOf(minIso([addDaysIso(report.today, -7), ...dates]));
  const last = maxIso(dates);
  let weeks = Math.max(4, Math.ceil((diffDays(from, last) + 1) / 7) + 1);
  if (weeks > maxWeeks) {
    // Keep today in the picture and let the far future fall off the edge.
    weeks = maxWeeks;
    const todayWeek = Math.floor(diffDays(from, report.today) / 7);
    if (todayWeek >= maxWeeks - 1) from = addDaysIso(from, (todayWeek - 1) * 7);
  }
  return { from, to: addDaysIso(from, weeks * 7), weeks };
}
