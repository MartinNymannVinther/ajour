"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  addDaysIso,
  diffDays,
  formatDateDa,
  maxIso,
  minIso,
  mondayOf,
  weekNumber,
} from "@/core/dates";
import { ZOOM_LEVELS } from "@/modules/projects/constants";
import { cn } from "@/lib/utils";
import { milestoneKeyHandler, taskKeyHandler } from "./timeline-keys";
import { LOOSE, useTimelineDrag } from "./use-timeline-drag";

/**
 * The plan as time. Tasks are bars under the milestone they lead to;
 * dragging one moves it, dragging it onto another milestone relinks it,
 * and dragging a milestone asks for a replan.
 *
 * Every one of those is also on the keyboard, because a phone and a
 * screen reader have no drag: a focused bar moves with the arrow keys,
 * resizes with shift, and changes milestone with alt.
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

type Props = {
  today: string;
  milestones: TimelineMilestone[];
  tasks: TimelineTask[];
  editable?: boolean;
  compact?: boolean;
  pendingMilestoneMove?: { id: string; newDate: string } | null;
  onTaskMove?: (id: string, newStart: string, newEnd: string) => void;
  onTaskRelink?: (id: string, milestoneId: string | null, newStart: string, newEnd: string) => void;
  onMilestoneMove?: (id: string, newDate: string) => void;
  onTaskClick?: (id: string) => void;
  onMilestoneClick?: (id: string) => void;
};

const ROW_H = 36;

export function Timeline({
  today,
  milestones,
  tasks,
  editable = false,
  compact = false,
  pendingMilestoneMove = null,
  onTaskMove,
  onTaskRelink,
  onMilestoneMove,
  onTaskClick,
  onMilestoneClick,
}: Props) {
  const t = useTranslations("projects.timeline");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const dayWidth = ZOOM_LEVELS[zoom]!;
  const {
    drag,
    groupRefs,
    taskOverride,
    milestoneOverride,
    onPointerMove,
    onPointerUp,
    startTaskDrag,
    startMilestoneDrag,
  } = useTimelineDrag(dayWidth, tasks, {
    onTaskMove,
    onTaskRelink,
    onMilestoneMove,
    onTaskClick,
    onMilestoneClick,
  });

  const effTask = (task: TimelineTask) => {
    const o = taskOverride[task.id];
    return { start: o?.start ?? task.startDate, end: o?.end ?? task.endDate };
  };
  const effMilestone = (m: TimelineMilestone) =>
    pendingMilestoneMove?.id === m.id
      ? pendingMilestoneMove.newDate
      : (milestoneOverride[m.id] ?? m.date);

  const { rangeStart, totalDays, weeks } = useMemo(() => {
    const dates = [
      today,
      ...milestones.map((m) => m.date),
      ...tasks.flatMap((task) => [task.startDate, task.endDate]),
    ];
    const start = addDaysIso(mondayOf(minIso(dates)), -7);
    const end = addDaysIso(maxIso(dates), 14);
    const weekList: { iso: string; label: string }[] = [];
    for (let d = start; d <= end; d = addDaysIso(d, 7))
      weekList.push({ iso: d, label: t("week", { number: weekNumber(d) }) });
    return { rangeStart: start, totalDays: diffDays(start, end) + 1, weeks: weekList };
  }, [milestones, tasks, today, t]);

  const x = (iso: string) => diffDays(rangeStart, iso) * dayWidth;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = Math.max(0, x(today) - el.clientWidth * 0.3);
    // Only on mount; after that the person's own scrolling is theirs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sorted = [...milestones].sort((a, b) => a.date.localeCompare(b.date));
  const groups: { milestone: TimelineMilestone | null; tasks: TimelineTask[] }[] = sorted.map(
    (m) => ({
      milestone: m as TimelineMilestone | null,
      tasks: tasks.filter((task) => task.milestoneId === m.id),
    }),
  );
  const loose = tasks.filter(
    (task) => !task.milestoneId || !sorted.some((m) => m.id === task.milestoneId),
  );
  if (loose.length > 0 || (drag?.kind === "task" && drag.moved && onTaskRelink))
    groups.push({ milestone: null, tasks: loose });

  const onTaskKeyDown = taskKeyHandler({
    editable,
    milestoneIds: sorted.map((m) => m.id),
    effective: (task) => effTask(task as TimelineTask),
    onTaskMove,
    onTaskRelink,
    onTaskClick,
  });

  const onMilestoneKeyDown = milestoneKeyHandler({
    editable,
    effectiveDate: (m) => effMilestone(m as TimelineMilestone),
    onMilestoneMove,
    onMilestoneClick,
  });

  const barClass = (task: TimelineTask) => {
    if (task.state === "done") return "bg-success-tint border-success text-success";
    if (effTask(task).end < today) return "bg-warning-tint border-destructive text-destructive";
    if (task.state === "doing") return "bg-primary border-primary text-primary-foreground";
    return "bg-muted border-input text-foreground";
  };

  return (
    <div className="relative">
      <div className="border-border bg-card/90 absolute top-1 right-2 z-20 flex items-center gap-1 rounded-lg border px-1 py-0.5 shadow-[var(--surface-shadow)]">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0, z - 1))}
          disabled={zoom === 0}
          aria-label={t("zoomOut")}
          className="text-meta hover:bg-muted h-7 w-7 rounded text-sm disabled:opacity-30"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(ZOOM_LEVELS.length - 1, z + 1))}
          disabled={zoom === ZOOM_LEVELS.length - 1}
          aria-label={t("zoomIn")}
          className="text-meta hover:bg-muted h-7 w-7 rounded text-sm disabled:opacity-30"
        >
          +
        </button>
      </div>
      <div
        ref={scrollRef}
        className="border-border bg-card overflow-x-auto rounded-xl border select-none"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="relative" style={{ width: totalDays * dayWidth }}>
          <div className="border-border bg-secondary text-meta sticky top-0 z-10 flex h-8 border-b text-[11px]">
            {weeks.map((week) => (
              <div
                key={week.iso}
                className="border-border/70 shrink-0 border-r pt-1.5 pl-1.5"
                style={{ width: dayWidth * 7 }}
              >
                {week.label}
              </div>
            ))}
          </div>

          <div className="absolute inset-0 top-8 flex" aria-hidden>
            {weeks.map((week, i) => (
              <div
                key={week.iso}
                className={cn("h-full shrink-0", i % 2 === 1 && "bg-secondary/60")}
                style={{ width: dayWidth * 7 }}
              />
            ))}
          </div>

          {/* Today: the line runs behind the sticky milestone labels so it
              never covers a title, and its tag sits up in the week band. */}
          <div
            className="bg-destructive/70 absolute top-8 bottom-0 z-0 w-px"
            style={{ left: x(today) + dayWidth / 2 }}
            aria-hidden
          />
          <div
            className="bg-destructive text-primary-foreground absolute top-1 z-30 -translate-x-1/2 rounded px-1 text-[9px] font-medium"
            style={{ left: x(today) + dayWidth / 2 }}
            aria-hidden
          >
            {t("today")}
          </div>

          <div className="relative">
            {groups.map((group) => {
              const key = group.milestone?.id ?? LOOSE;
              const isTarget = drag?.kind === "task" && drag.targetGroup === key;
              const milestone = group.milestone;
              return (
                <div
                  key={key}
                  ref={(el) => {
                    groupRefs.current[key] = el;
                  }}
                  className={cn(
                    isTarget &&
                      "bg-accent outline-primary/50 outline-2 -outline-offset-2 outline-dashed",
                  )}
                >
                  <div className="border-border bg-card/60 relative flex h-9 items-center border-t">
                    <div className="from-card via-card sticky left-0 z-20 flex max-w-[60%] items-center gap-2 bg-gradient-to-r to-transparent pr-6 pl-2 text-[13px] font-semibold">
                      {milestone ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onMilestoneClick?.(milestone.id)}
                            className={cn(
                              "hover:text-primary truncate text-left hover:underline",
                              milestone.doneAt && "text-success",
                            )}
                          >
                            {milestone.doneAt ? "✓ " : ""}
                            {milestone.title}
                          </button>
                          <span className="text-label font-normal whitespace-nowrap">
                            {formatDateDa(effMilestone(milestone))}
                          </span>
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
                        <button
                          type="button"
                          onPointerDown={(e) =>
                            editable &&
                            !milestone.doneAt &&
                            startMilestoneDrag(e, milestone.id, effMilestone(milestone))
                          }
                          onKeyDown={(e) => onMilestoneKeyDown(e, milestone)}
                          aria-label={t("milestoneHandle", {
                            title: milestone.title,
                            date: formatDateDa(effMilestone(milestone)),
                          })}
                          className={cn(
                            "focus-visible:ring-ring absolute z-10 h-4 w-4 -translate-x-1/2 rotate-45 rounded-[3px] border-2 focus-visible:ring-2",
                            milestone.doneAt
                              ? "border-success bg-success/60"
                              : pendingMilestoneMove?.id === milestone.id
                                ? "border-chart-4 bg-chart-4"
                                : "border-foreground bg-foreground",
                            editable &&
                              !milestone.doneAt &&
                              "cursor-grab touch-none active:cursor-grabbing",
                          )}
                          style={{ left: x(effMilestone(milestone)) + dayWidth / 2 }}
                        />
                        <div
                          className="border-border absolute top-0 bottom-0 w-px border-l border-dashed"
                          style={{ left: x(effMilestone(milestone)) + dayWidth / 2 }}
                          aria-hidden
                        />
                      </>
                    )}
                  </div>

                  {group.tasks.map((task) => {
                    const eff = effTask(task);
                    const width = (diffDays(eff.start, eff.end) + 1) * dayWidth;
                    const known = Boolean(
                      task.milestoneId && sorted.some((m) => m.id === task.milestoneId),
                    );
                    return (
                      <div
                        key={task.id}
                        className="border-hairline relative border-t"
                        style={{ height: ROW_H }}
                      >
                        <button
                          type="button"
                          onPointerDown={(e) =>
                            editable && startTaskDrag(e, task, "move", eff, known)
                          }
                          onKeyDown={(e) => onTaskKeyDown(e, task)}
                          aria-label={t("taskHandle", {
                            title: task.title,
                            owner: task.ownerName || t("noOwner"),
                            from: formatDateDa(eff.start),
                            to: formatDateDa(eff.end),
                          })}
                          className={cn(
                            "focus-visible:ring-ring absolute top-1.5 flex h-[24px] items-center rounded-md border px-2 text-[12px] focus-visible:ring-2",
                            barClass(task),
                            editable && "cursor-grab touch-none active:cursor-grabbing",
                            drag?.kind === "task" &&
                              drag.id === task.id &&
                              "ring-primary/30 z-20 shadow-md ring-2",
                          )}
                          style={{
                            left: x(eff.start),
                            width: Math.max(width, dayWidth),
                            transform:
                              drag?.kind === "task" &&
                              drag.id === task.id &&
                              drag.mode === "move" &&
                              drag.moved
                                ? `translateY(${drag.dy}px)`
                                : undefined,
                          }}
                        >
                          <span className="truncate">{task.title}</span>
                          {task.ownerName && !compact && width > 120 && (
                            <span className="ml-auto pl-2 text-[10px] opacity-70">
                              {task.ownerName}
                              {task.participants.length > 0 ? ` +${task.participants.length}` : ""}
                            </span>
                          )}
                          {editable && (
                            <span
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                startTaskDrag(e, task, "resize", eff, known);
                              }}
                              className="absolute top-0 -right-1 h-full w-3 cursor-ew-resize touch-none"
                              aria-hidden
                            />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
