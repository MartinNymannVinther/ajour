import type { KeyboardEvent } from "react";
import { addDaysIso } from "@/core/dates";
import { LOOSE } from "./use-timeline-drag";

/**
 * The timeline without a pointer. Wave three asks that every core action
 * be reachable without drag-and-drop, and this is where the timeline
 * keeps that promise: arrows move a bar by a day, shift resizes it, alt
 * moves it to the milestone above or below, enter opens it.
 *
 * Each move reports what it did through `announce`. The bar's own
 * aria-label does change with the dates, but a label that changes on an
 * element that already has focus is not re-read by most screen readers:
 * without this, pressing the right arrow five times says nothing at all
 * and the person has no idea where the bar has got to.
 */

type TaskLike = { id: string; milestoneId: string | null };

export function taskKeyHandler({
  editable,
  milestoneIds,
  effective,
  onTaskMove,
  onTaskRelink,
  onTaskClick,
  announceMove,
  announceRelink,
}: {
  editable: boolean;
  milestoneIds: string[];
  effective: (task: TaskLike) => { start: string; end: string };
  onTaskMove?: (id: string, newStart: string, newEnd: string) => void;
  onTaskRelink?: (id: string, milestoneId: string | null, newStart: string, newEnd: string) => void;
  onTaskClick?: (id: string) => void;
  announceMove?: (id: string, start: string, end: string) => void;
  announceRelink?: (id: string, milestoneId: string | null) => void;
}) {
  return (e: KeyboardEvent, task: TaskLike) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onTaskClick?.(task.id);
      return;
    }
    if (!editable || !e.key.startsWith("Arrow")) return;
    e.preventDefault();
    const eff = effective(task);
    if (e.altKey && onTaskRelink) {
      const order = [...milestoneIds, LOOSE];
      const current =
        task.milestoneId && order.includes(task.milestoneId) ? task.milestoneId : LOOSE;
      const step = e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 1;
      const next = order[Math.min(order.length - 1, Math.max(0, order.indexOf(current) + step))]!;
      if (next !== current) {
        onTaskRelink(task.id, next === LOOSE ? null : next, eff.start, eff.end);
        announceRelink?.(task.id, next === LOOSE ? null : next);
      }
      return;
    }
    const step = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1;
    if (e.shiftKey) {
      const end = addDaysIso(eff.end, step);
      if (end >= eff.start) {
        onTaskMove?.(task.id, eff.start, end);
        announceMove?.(task.id, eff.start, end);
      }
      return;
    }
    const start = addDaysIso(eff.start, step);
    const end = addDaysIso(eff.end, step);
    onTaskMove?.(task.id, start, end);
    announceMove?.(task.id, start, end);
  };
}

export function milestoneKeyHandler({
  editable,
  effectiveDate,
  onMilestoneMove,
  onMilestoneClick,
  announceMove,
}: {
  editable: boolean;
  effectiveDate: (m: { id: string; date: string }) => string;
  onMilestoneMove?: (id: string, newDate: string) => void;
  onMilestoneClick?: (id: string) => void;
  announceMove?: (id: string, date: string) => void;
}) {
  return (e: KeyboardEvent, milestone: { id: string; date: string; doneAt: Date | null }) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onMilestoneClick?.(milestone.id);
      return;
    }
    if (!editable || milestone.doneAt) return;
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const date = addDaysIso(effectiveDate(milestone), e.key === "ArrowLeft" ? -1 : 1);
    onMilestoneMove?.(milestone.id, date);
    announceMove?.(milestone.id, date);
  };
}
