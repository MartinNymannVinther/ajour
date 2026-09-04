import { and, asc, eq, gt } from "drizzle-orm";
import { events } from "@/core/db/schema";
import type { AppTransaction } from "@/core/db/tenant";

/**
 * "Since last": what happened to the plan between the previous approved
 * status and now, worked out from the project's own event log so the
 * manager never has to remember it. Condensed rather than listed: five
 * tasks finishing is one line, not five.
 */

export type SinceLastWords = {
  tasksDone: (count: number, example: string) => string;
  tasksMoved: (count: number, example: string) => string;
  milestonesReached: (titles: string) => string;
  milestonesChanged: (titles: string) => string;
  obstaclesAdded: (count: number, example: string) => string;
  obstaclesResolved: (count: number, example: string) => string;
  decisions: (count: number, example: string) => string;
  budgetSet: (amount: number) => string;
  nothing: string;
};

const MAX_LINES = 6;

export async function eventsSince(tx: AppTransaction, projectId: string, since: Date | null) {
  return tx
    .select()
    .from(events)
    .where(
      since
        ? and(eq(events.projectId, projectId), gt(events.createdAt, since))
        : eq(events.projectId, projectId),
    )
    .orderBy(asc(events.createdAt))
    .limit(300);
}

/** Turns the raw events into at most six lines, the important kinds first. */
export function condenseSinceLast(
  rows: Array<{ type: string; payload: Record<string, unknown> }>,
  words: SinceLastWords,
): string[] {
  const titleOf = (row: { payload: Record<string, unknown> }) => String(row.payload.title ?? "");
  const done = rows.filter((r) => r.type === "task.state" && r.payload.state === "done");
  const moved = rows.filter((r) => r.type === "task.moved");
  const reached = rows.filter((r) => r.type === "milestone.done");
  const changed = rows.filter((r) => r.type === "milestone.updated" || r.type === "replan.applied");
  const obstaclesAdded = rows.filter((r) => r.type === "obstacle.added");
  const obstaclesResolved = rows.filter((r) => r.type === "obstacle.resolved");
  const decisions = rows.filter((r) => r.type === "decision.added");
  const budget = rows.filter((r) => r.type === "budget.set").at(-1);

  // Only the last state change per task counts: done then reopened is not done.
  const lastState = new Map<string, string>();
  for (const r of rows.filter((r) => r.type === "task.state")) {
    lastState.set(titleOf(r), String(r.payload.state ?? ""));
  }
  const reallyDone = done.filter((r) => lastState.get(titleOf(r)) === "done");
  const uniqueDone = [...new Set(reallyDone.map(titleOf))];

  const lines: string[] = [];
  if (reached.length > 0) lines.push(words.milestonesReached(reached.map(titleOf).join(", ")));
  if (uniqueDone.length > 0) lines.push(words.tasksDone(uniqueDone.length, uniqueDone[0]!));
  if (obstaclesAdded.length > 0)
    lines.push(words.obstaclesAdded(obstaclesAdded.length, titleOf(obstaclesAdded[0]!)));
  if (obstaclesResolved.length > 0)
    lines.push(words.obstaclesResolved(obstaclesResolved.length, titleOf(obstaclesResolved[0]!)));
  if (changed.length > 0) {
    const titles = [
      ...new Set(changed.map((r) => String(r.payload.title ?? r.payload.milestone ?? ""))),
    ].filter(Boolean);
    if (titles.length > 0) lines.push(words.milestonesChanged(titles.join(", ")));
  }
  if (moved.length > 0) {
    const titles = [...new Set(moved.map(titleOf))];
    lines.push(words.tasksMoved(titles.length, titles[0]!));
  }
  if (decisions.length > 0) lines.push(words.decisions(decisions.length, titleOf(decisions[0]!)));
  if (budget && typeof budget.payload.amount === "number")
    lines.push(words.budgetSet(budget.payload.amount));

  return lines.slice(0, MAX_LINES);
}
