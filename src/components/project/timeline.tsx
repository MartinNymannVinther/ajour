"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { addDaysIso, diffDays, maxIso, minIso, mondayOf, weekNumber } from "@/core/dates";
import { ZOOM_LEVELS } from "@/modules/projects/constants";
import { cn } from "@/lib/utils";
import { milestoneKeyHandler, taskKeyHandler } from "./timeline-keys";
import { MilestoneRow, TaskBar, type TimelineMilestone, type TimelineTask } from "./timeline-rows";

export type { TimelineMilestone, TimelineTask } from "./timeline-rows";
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
        // A horizontally scrolling region needs to be reachable, or a
        // keyboard user cannot see the half of the plan that is off-screen.
        tabIndex={0}
        role="group"
        aria-label={t("regionLabel")}
        className="border-border bg-card focus-visible:ring-ring overflow-x-auto rounded-xl border select-none focus-visible:ring-2 focus-visible:outline-none"
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
                  <MilestoneRow
                    milestone={milestone}
                    date={milestone ? effMilestone(milestone) : ""}
                    x={milestone ? x(effMilestone(milestone)) : 0}
                    dayWidth={dayWidth}
                    editable={editable}
                    isTarget={isTarget}
                    pending={pendingMilestoneMove?.id === milestone?.id}
                    onClick={onMilestoneClick}
                    onPointerDown={(e, id, date) => startMilestoneDrag(e, id, date)}
                    onKeyDown={onMilestoneKeyDown}
                  />

                  {group.tasks.map((task) => {
                    const eff = effTask(task);
                    const known = Boolean(
                      task.milestoneId && sorted.some((m) => m.id === task.milestoneId),
                    );
                    return (
                      <TaskBar
                        key={task.id}
                        task={task}
                        start={eff.start}
                        end={eff.end}
                        today={today}
                        x={x(eff.start)}
                        dayWidth={dayWidth}
                        editable={editable}
                        compact={compact}
                        drag={drag}
                        onPointerDown={(e, mode) => startTaskDrag(e, task, mode, eff, known)}
                        onKeyDown={onTaskKeyDown}
                      />
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
