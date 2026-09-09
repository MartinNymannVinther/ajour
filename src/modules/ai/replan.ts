import { addDaysIso, diffDays } from "@/core/dates";
import type { ReplanInput, ReplanProposal, ReplanTask } from "./types";

/**
 * The arithmetic of a replan (docs/adr/0014). Deterministic on purpose:
 * a person dragging a milestone should get the same answer twice. The
 * moved milestone takes its open tasks with it, before and after; later
 * milestones are pushed the same distance when the move is later and the
 * person wants the ripple, and each of those takes its tasks along too.
 * A milestone marked fixed stays where it is and says so; a finished task
 * stays where it was done. Afterwards every owner is checked for days
 * with more than two open tasks, and the proposal names them.
 */

export const OVERLOAD_AT = 3;

type Move = ReplanProposal["taskMoves"][number];

function shift(task: ReplanTask, days: number): Move {
  return {
    id: task.id,
    title: task.title,
    oldStart: task.startDate,
    oldEnd: task.endDate,
    newStart: addDaysIso(task.startDate, days),
    newEnd: addDaysIso(task.endDate, days),
  };
}

export function computeReplan(input: ReplanInput): Omit<ReplanProposal, "summary"> {
  const d = input.deltaDays;
  const kept: ReplanProposal["kept"] = [];
  const taskMoves: Move[] = [];
  const milestoneMoves: ReplanProposal["milestoneMoves"] = [];

  for (const t of input.affectedTasks) {
    if (t.state === "done") kept.push({ kind: "task", id: t.id, title: t.title, reason: "done" });
    else taskMoves.push(shift(t, d));
  }

  const rippling = d > 0 && input.ripple;
  for (const m of input.laterMilestones) {
    if (d <= 0) {
      kept.push({ kind: "milestone", id: m.id, title: m.title, reason: "earlier" });
      continue;
    }
    if (!rippling) {
      kept.push({ kind: "milestone", id: m.id, title: m.title, reason: "noRipple" });
      continue;
    }
    if (m.fixed) {
      kept.push({ kind: "milestone", id: m.id, title: m.title, reason: "fixed" });
      continue;
    }
    milestoneMoves.push({
      id: m.id,
      title: m.title,
      oldDate: m.date,
      newDate: addDaysIso(m.date, d),
    });
    for (const t of m.tasks) {
      if (t.state === "done") kept.push({ kind: "task", id: t.id, title: t.title, reason: "done" });
      else taskMoves.push(shift(t, d));
    }
  }

  return { milestoneMoves, taskMoves, kept, overloads: overloads(input, taskMoves) };
}

/**
 * Who ends up with too much at once. Every open task with an owner, as it
 * would be after the move, counted per person per day; a run of days
 * over the limit is one warning with its span.
 */
export function overloads(input: ReplanInput, moves: Move[]): ReplanProposal["overloads"] {
  const moved = new Map(moves.map((m) => [m.id, m]));
  const all = [
    ...input.affectedTasks,
    ...input.laterMilestones.flatMap((m) => m.tasks),
    ...input.otherTasks,
  ];
  const seen = new Set<string>();
  const byOwner = new Map<string, Array<{ start: string; end: string }>>();
  for (const t of all) {
    if (seen.has(t.id) || t.state === "done" || !t.owner) continue;
    seen.add(t.id);
    const m = moved.get(t.id);
    const span = m ? { start: m.newStart, end: m.newEnd } : { start: t.startDate, end: t.endDate };
    byOwner.set(t.owner, [...(byOwner.get(t.owner) ?? []), span]);
  }
  const out: ReplanProposal["overloads"] = [];
  for (const [name, spans] of byOwner) {
    if (spans.length < OVERLOAD_AT) continue;
    const first = spans.map((s) => s.start).sort()[0]!;
    const last = spans
      .map((s) => s.end)
      .sort()
      .at(-1)!;
    let run: { from: string; to: string; count: number } | null = null;
    for (let day = first; day <= last; day = addDaysIso(day, 1)) {
      const count = spans.filter((s) => s.start <= day && day <= s.end).length;
      if (count >= OVERLOAD_AT) {
        if (run && diffDays(run.to, day) === 1) {
          run.to = day;
          run.count = Math.max(run.count, count);
        } else {
          if (run) out.push({ name, ...run });
          run = { from: day, to: day, count };
        }
      }
    }
    if (run) out.push({ name, ...run });
  }
  return out;
}
