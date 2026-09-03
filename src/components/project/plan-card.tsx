"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import type { TaskState } from "@/core/db/schema";
import { FUNCTION_ACCENT, SECTION_IDS } from "@/modules/projects/constants";
import type { MilestoneView, TaskView } from "@/modules/projects/types";
import { FunctionCard } from "./function-card";
import { KanbanBoard } from "./kanban-board";
import { Timeline } from "./timeline";
import { cn } from "@/lib/utils";

/**
 * One plan, two ways of looking at it. The choice is remembered per
 * project in the browser, because a person who thinks in boards thinks in
 * boards; it is a convenience, so it fails quietly in a private window.
 */
export function PlanCard({
  projectId,
  today,
  view,
  onViewChange,
  milestones,
  tasks,
  pendingMilestoneMove,
  onTaskMove,
  onTaskRelink,
  onMilestoneMove,
  onTaskClick,
  onMilestoneClick,
  onStateChange,
}: {
  projectId: string;
  today: string;
  view: "timeline" | "board";
  onViewChange: (view: "timeline" | "board") => void;
  milestones: MilestoneView[];
  tasks: TaskView[];
  pendingMilestoneMove: { id: string; newDate: string } | null;
  onTaskMove: (id: string, start: string, end: string) => void;
  onTaskRelink: (id: string, milestoneId: string | null, start: string, end: string) => void;
  onMilestoneMove: (id: string, date: string) => void;
  onTaskClick: (id: string) => void;
  onMilestoneClick: (id: string) => void;
  onStateChange: (id: string, state: TaskState) => void;
}) {
  const t = useTranslations("projects.plan");

  useEffect(() => {
    try {
      if (localStorage.getItem(`ajour-view-${projectId}`) === "board") onViewChange("board");
    } catch {
      // A private window, or storage turned off. The default view is fine.
    }
    // Only on mount: after that the person's choice is in state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const switchView = (next: "timeline" | "board") => {
    onViewChange(next);
    try {
      localStorage.setItem(`ajour-view-${projectId}`, next);
    } catch {
      // Not remembering the choice is not worth an error.
    }
  };

  return (
    <FunctionCard
      id={SECTION_IDS.plan}
      title={t("title")}
      accent={FUNCTION_ACCENT.plan}
      actions={
        <div
          className="border-border bg-card flex gap-1 rounded-lg border p-0.5"
          role="group"
          aria-label={t("viewLabel")}
        >
          {(["timeline", "board"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => switchView(option)}
              aria-pressed={view === option}
              className={cn(
                "min-h-[28px] rounded-md px-3 text-xs font-medium transition",
                view === option ? "bg-primary text-primary-foreground" : "text-meta hover:bg-muted",
              )}
            >
              {t(option)}
            </button>
          ))}
        </div>
      }
    >
      {view === "timeline" ? (
        <>
          <Timeline
            today={today}
            milestones={milestones}
            tasks={tasks}
            editable
            pendingMilestoneMove={pendingMilestoneMove}
            onTaskMove={onTaskMove}
            onTaskRelink={onTaskRelink}
            onMilestoneMove={onMilestoneMove}
            onTaskClick={onTaskClick}
            onMilestoneClick={onMilestoneClick}
          />
          <p className="border-hairline text-meta mt-3 border-t pt-2.5 text-xs">
            {t("timelineHelp")}
          </p>
        </>
      ) : (
        <>
          <KanbanBoard
            today={today}
            tasks={tasks}
            milestones={milestones}
            onStateChange={onStateChange}
            onTaskClick={onTaskClick}
          />
          <p className="border-hairline text-meta mt-3 border-t pt-2.5 text-xs">{t("boardHelp")}</p>
        </>
      )}
    </FunctionCard>
  );
}
