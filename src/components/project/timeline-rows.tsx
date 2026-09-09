"use client";

import type { KeyboardEvent, PointerEvent } from "react";
import { useTranslations } from "next-intl";
import { diffDays, formatDateDa } from "@/core/dates";
import { cn } from "@/lib/utils";
import type { DragState } from "./use-timeline-drag";

/**
 * The two rows the timeline is made of: a milestone with its diamond, and
 * a task as a bar. They draw; the gestures and the keyboard path are
 * decided by the parent and handed in.
 */

export type TimelineMilestone = { id: string; title: string; date: string; doneAt: Date | null };
export type TimelineTask = {
  id: string;
  title: string;
  ownerName: string;
  state: string;
  startDate: string;
  endDate: string;
  milestoneId: string | null;
  participants: string[];
};

export const ROW_H = 36;

type MilestoneRowProps = {
  milestone: TimelineMilestone | null;
  date: string;
  x: number;
  dayWidth: number;
  editable: boolean;
  isTarget: boolean;
  pending: boolean;
  onClick?: (id: string) => void;
  onPointerDown: (e: PointerEvent, id: string, date: string) => void;
  onKeyDown: (e: KeyboardEvent, milestone: TimelineMilestone) => void;
};

export function MilestoneRow({
  milestone,
  date,
  x,
  dayWidth,
  editable,
  isTarget,
  pending,
  onClick,
  onPointerDown,
  onKeyDown,
}: MilestoneRowProps) {
  const t = useTranslations("projects.timeline");
  const draggable = editable && milestone !== null && !milestone.doneAt;
  return (
    <div className="border-border bg-card/60 relative flex h-9 items-center border-t">
      <div className="from-card via-card sticky left-0 z-20 flex max-w-[60%] items-center gap-2 bg-gradient-to-r to-transparent pr-6 pl-2 text-[13px] font-semibold">
        {milestone ? (
          <>
            <button
              type="button"
              onClick={() => onClick?.(milestone.id)}
              className={cn(
                "hover:text-primary min-h-[24px] truncate text-left hover:underline",
                milestone.doneAt && "text-success",
              )}
            >
              {milestone.doneAt ? "✓ " : ""}
              {milestone.title}
            </button>
            <span className="text-label font-normal whitespace-nowrap">{formatDateDa(date)}</span>
          </>
        ) : (
          <span className="text-meta">{t("otherTasks")}</span>
        )}
        {isTarget && (
          <span className="bg-primary text-primary-foreground rounded px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap">
            {t("dropHere")}
          </span>
        )}
      </div>
      {milestone && (
        <>
          {/* The diamond is 16px, its hit area 28: small enough to read as
              a marker, big enough to hit. */}
          <button
            type="button"
            data-slot="timeline-milestone"
            onPointerDown={(e) => draggable && onPointerDown(e, milestone.id, date)}
            onKeyDown={(e) => onKeyDown(e, milestone)}
            aria-label={t("milestoneHandle", { title: milestone.title, date: formatDateDa(date) })}
            className={cn(
              "focus-visible:ring-ring absolute z-10 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded focus-visible:ring-2",
              draggable && "cursor-grab touch-none active:cursor-grabbing",
            )}
            style={{ left: x + dayWidth / 2 }}
          >
            <span
              aria-hidden
              className={cn(
                "h-4 w-4 rotate-45 rounded-[3px] border-2",
                milestone.doneAt
                  ? "border-success bg-success/60"
                  : pending
                    ? "border-chart-4 bg-chart-4"
                    : "border-foreground bg-foreground",
              )}
            />
          </button>
          <div
            className="border-border absolute top-0 bottom-0 w-px border-l border-dashed"
            style={{ left: x + dayWidth / 2 }}
            aria-hidden
          />
        </>
      )}
    </div>
  );
}

type TaskBarProps = {
  task: TimelineTask;
  start: string;
  end: string;
  today: string;
  x: number;
  dayWidth: number;
  editable: boolean;
  compact: boolean;
  drag: DragState | null;
  onPointerDown: (e: PointerEvent, mode: "move" | "resize") => void;
  onKeyDown: (e: KeyboardEvent, task: TimelineTask) => void;
};

export function TaskBar({
  task,
  start,
  end,
  today,
  x,
  dayWidth,
  editable,
  compact,
  drag,
  onPointerDown,
  onKeyDown,
}: TaskBarProps) {
  const t = useTranslations("projects.timeline");
  const width = (diffDays(start, end) + 1) * dayWidth;
  const dragging = drag?.kind === "task" && drag.id === task.id;
  const barClass =
    task.state === "done"
      ? "bg-success-tint border-success text-success"
      : end < today
        ? "bg-warning-tint border-destructive text-destructive"
        : task.state === "doing"
          ? "bg-primary border-primary text-primary-foreground"
          : "bg-muted border-input text-foreground";
  return (
    <div className="border-hairline relative border-t" style={{ height: ROW_H }}>
      <button
        type="button"
        data-slot="timeline-task"
        onPointerDown={(e) => editable && onPointerDown(e, "move")}
        onKeyDown={(e) => onKeyDown(e, task)}
        aria-label={t("taskHandle", {
          title: task.title,
          owner: task.ownerName || t("noOwner"),
          from: formatDateDa(start),
          to: formatDateDa(end),
        })}
        className={cn(
          "focus-visible:ring-ring absolute top-1.5 flex h-[24px] items-center rounded-md border px-2 text-[12px] focus-visible:ring-2",
          barClass,
          editable && "cursor-grab touch-none active:cursor-grabbing",
          dragging && "ring-primary/30 z-20 shadow-md ring-2",
        )}
        style={{
          left: x,
          width: Math.max(width, dayWidth),
          transform:
            dragging && drag.mode === "move" && drag.moved ? `translateY(${drag.dy}px)` : undefined,
        }}
      >
        <span className="truncate">{task.title}</span>
        {/* Full opacity: at 10px on the green bar, the dimmed version fell
            under AA (3.5:1). */}
        {task.ownerName && !compact && width > 120 && (
          <span className="ml-auto pl-2 text-[10px] opacity-90">
            {task.ownerName}
            {task.participants.length > 0 ? ` +${task.participants.length}` : ""}
          </span>
        )}
        {editable && (
          <span
            onPointerDown={(e) => {
              e.stopPropagation();
              onPointerDown(e, "resize");
            }}
            className="absolute top-0 -right-1 h-full w-3 cursor-ew-resize touch-none"
            aria-hidden
          />
        )}
      </button>
    </div>
  );
}
