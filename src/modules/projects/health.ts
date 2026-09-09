import { diffDays } from "@/core/dates";

/**
 * How a project is doing right now, from the data and nothing else: the
 * same signals the daily tip is built from, boiled down to one colour and
 * the reasons behind it, so a front page with ten projects reads as a
 * weekly round rather than a list. The manager's own assessment lives on
 * the status; this is what the plan says today.
 */
export type HealthLevel = "red" | "yellow" | "green" | "new";

export type HealthReason =
  | { kind: "overdueTasks"; count: number }
  | { kind: "passedMilestones"; count: number }
  | { kind: "milestoneSoon"; title: string; days: number; open: number }
  | { kind: "openObstacles"; count: number }
  | { kind: "overBudget"; planned: number; budget: number }
  | { kind: "noStatus"; days: number | null }
  | { kind: "noOwner"; count: number };

export type ProjectHealth = { level: HealthLevel; reasons: HealthReason[] };

export type HealthInput = {
  today: string;
  tasks: Array<{ state: string; endDate: string; milestoneId: string | null; hasOwner: boolean }>;
  milestones: Array<{ id: string; title: string; date: string; done: boolean }>;
  openObstacles: number;
  budget: number | null;
  plannedTotal: number;
  latestStatusAt: Date | null;
  createdAt: Date;
};

export function projectHealth(input: HealthInput): ProjectHealth {
  const { today } = input;
  const open = input.tasks.filter((t) => t.state !== "done");
  const reasons: HealthReason[] = [];

  const overdue = open.filter((t) => t.endDate < today).length;
  if (overdue > 0) reasons.push({ kind: "overdueTasks", count: overdue });

  const passed = input.milestones.filter((m) => !m.done && m.date < today).length;
  if (passed > 0) reasons.push({ kind: "passedMilestones", count: passed });

  const soon = input.milestones
    .filter((m) => !m.done && m.date >= today && diffDays(today, m.date) <= 7)
    .map((m) => ({ m, open: open.filter((t) => t.milestoneId === m.id).length }))
    .find((x) => x.open > 0);
  if (soon)
    reasons.push({
      kind: "milestoneSoon",
      title: soon.m.title,
      days: diffDays(today, soon.m.date),
      open: soon.open,
    });

  if (input.openObstacles > 0) reasons.push({ kind: "openObstacles", count: input.openObstacles });

  if (input.budget !== null && input.plannedTotal > input.budget)
    reasons.push({ kind: "overBudget", planned: input.plannedTotal, budget: input.budget });

  const statusAge = input.latestStatusAt
    ? diffDays(input.latestStatusAt.toISOString().slice(0, 10), today)
    : null;
  const ageDays = diffDays(input.createdAt.toISOString().slice(0, 10), today);
  if (statusAge === null ? ageDays >= 7 : statusAge >= 10)
    reasons.push({ kind: "noStatus", days: statusAge });

  const noOwner = open.filter((t) => !t.hasOwner).length;
  if (noOwner > 0 && noOwner >= Math.ceil(open.length / 2))
    reasons.push({ kind: "noOwner", count: noOwner });

  // New: nothing has happened yet and nothing is late; too early to judge.
  const isNew = ageDays < 7 && input.tasks.every((t) => t.state === "todo") && overdue === 0;
  const level: HealthLevel =
    overdue > 0 || passed > 0 || reasons.some((r) => r.kind === "overBudget")
      ? "red"
      : reasons.length > 0
        ? "yellow"
        : isNew
          ? "new"
          : "green";
  return { level, reasons };
}

/** Red before yellow before green before new, so the round starts where it hurts. */
export const HEALTH_ORDER: Record<HealthLevel, number> = { red: 0, yellow: 1, green: 2, new: 3 };
