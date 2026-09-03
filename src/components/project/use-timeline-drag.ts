"use client";

import { useMemo, useRef, useState } from "react";
import { addDaysIso } from "@/core/dates";

/**
 * Dragging on the timeline, kept apart from drawing it. Three gestures
 * live here: move a task, resize it, and move a milestone. While a drag is
 * running the bar follows the pointer from local state, so the plan feels
 * immediate; the server is told once, on release, and the local override
 * is dropped as soon as the server's data agrees.
 */

export const LOOSE = "__loose__";

export type DragState = (
  | {
      kind: "task";
      id: string;
      mode: "move" | "resize";
      startX: number;
      startY: number;
      origStart: string;
      origEnd: string;
      origGroup: string;
      dy: number;
      targetGroup: string | null;
    }
  | { kind: "milestone"; id: string; startX: number; origDate: string }
) & { moved?: boolean };

type Handlers = {
  onTaskMove?: (id: string, newStart: string, newEnd: string) => void;
  onTaskRelink?: (id: string, milestoneId: string | null, newStart: string, newEnd: string) => void;
  onMilestoneMove?: (id: string, newDate: string) => void;
  onTaskClick?: (id: string) => void;
  onMilestoneClick?: (id: string) => void;
};

export function useTimelineDrag(
  dayWidth: number,
  tasks: Array<{ id: string; startDate: string; endDate: string }>,
  handlers: Handlers,
) {
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [drag, setDrag] = useState<DragState | null>(null);
  const [taskOverride, setTaskOverride] = useState<Record<string, { start: string; end: string }>>(
    {},
  );
  const [milestoneOverride, setMilestoneOverride] = useState<Record<string, string>>({});

  /**
   * An override is only live while it disagrees with the server. Deriving
   * that during render rather than clearing it in an effect keeps the two
   * from chasing each other through a second render.
   */
  const liveOverrides = useMemo(() => {
    const live: Record<string, { start: string; end: string }> = {};
    for (const task of tasks) {
      const o = taskOverride[task.id];
      if (o && !(o.start === task.startDate && o.end === task.endDate)) live[task.id] = o;
    }
    return live;
  }, [tasks, taskOverride]);

  const clearTaskOverride = (id: string) =>
    setTaskOverride((p) => {
      const next = { ...p };
      delete next[id];
      return next;
    });

  const groupAtY = (clientY: number): string | null => {
    for (const [key, el] of Object.entries(groupRefs.current)) {
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (clientY >= rect.top && clientY < rect.bottom) return key;
    }
    return null;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const movedNow =
      drag.moved ||
      Math.abs(e.clientX - drag.startX) > 4 ||
      (drag.kind === "task" && drag.mode === "move" && Math.abs(e.clientY - drag.startY) > 6);
    const deltaDays = Math.round((e.clientX - drag.startX) / dayWidth);
    if (drag.kind === "task") {
      if (drag.mode === "move") {
        const over = handlers.onTaskRelink ? groupAtY(e.clientY) : null;
        setDrag({
          ...drag,
          moved: movedNow,
          dy: e.clientY - drag.startY,
          targetGroup: over && over !== drag.origGroup ? over : null,
        });
        setTaskOverride((p) => ({
          ...p,
          [drag.id]: {
            start: addDaysIso(drag.origStart, deltaDays),
            end: addDaysIso(drag.origEnd, deltaDays),
          },
        }));
        return;
      }
      const newEnd = addDaysIso(drag.origEnd, deltaDays);
      setTaskOverride((p) => ({
        ...p,
        [drag.id]: {
          start: drag.origStart,
          end: newEnd < drag.origStart ? drag.origStart : newEnd,
        },
      }));
    } else {
      setMilestoneOverride((p) => ({ ...p, [drag.id]: addDaysIso(drag.origDate, deltaDays) }));
    }
    if (movedNow !== drag.moved) setDrag({ ...drag, moved: movedNow });
  };

  const onPointerUp = () => {
    if (!drag) return;
    if (drag.kind === "task") {
      const override = taskOverride[drag.id];
      if (!drag.moved) {
        clearTaskOverride(drag.id);
        handlers.onTaskClick?.(drag.id);
      } else if (drag.mode === "move" && drag.targetGroup && handlers.onTaskRelink) {
        const eff = override ?? { start: drag.origStart, end: drag.origEnd };
        handlers.onTaskRelink(
          drag.id,
          drag.targetGroup === LOOSE ? null : drag.targetGroup,
          eff.start,
          eff.end,
        );
      } else if (override && (override.start !== drag.origStart || override.end !== drag.origEnd)) {
        handlers.onTaskMove?.(drag.id, override.start, override.end);
      } else {
        clearTaskOverride(drag.id);
      }
    } else {
      const newDate = milestoneOverride[drag.id];
      setMilestoneOverride((p) => {
        const next = { ...p };
        delete next[drag.id];
        return next;
      });
      if (!drag.moved) handlers.onMilestoneClick?.(drag.id);
      else if (newDate && newDate !== drag.origDate) handlers.onMilestoneMove?.(drag.id, newDate);
    }
    setDrag(null);
  };

  const startTaskDrag = (
    e: React.PointerEvent,
    task: { id: string; milestoneId: string | null },
    mode: "move" | "resize",
    effective: { start: string; end: string },
    knownMilestone: boolean,
  ) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({
      kind: "task",
      id: task.id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origStart: effective.start,
      origEnd: effective.end,
      origGroup: knownMilestone && task.milestoneId ? task.milestoneId : LOOSE,
      dy: 0,
      targetGroup: null,
    });
  };

  const startMilestoneDrag = (e: React.PointerEvent, id: string, date: string) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ kind: "milestone", id, startX: e.clientX, origDate: date });
  };

  return {
    drag,
    groupRefs,
    taskOverride: liveOverrides,
    milestoneOverride,
    onPointerMove,
    onPointerUp,
    startTaskDrag,
    startMilestoneDrag,
  };
}
