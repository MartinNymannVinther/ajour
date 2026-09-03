"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatDateDa } from "@/core/dates";
import type { TaskState } from "@/core/db/schema";
import type { MilestoneView, TaskView } from "@/modules/projects/types";
import { cn } from "@/lib/utils";
import { StateSelect } from "./state-select";

/**
 * The same plan as three columns. Dragging a card is the quick path, but
 * every card also carries the state select, so the board works on a phone
 * and with a keyboard without a single drag.
 */

const COLUMNS: TaskState[] = ["todo", "doing", "done"];

export function KanbanBoard({
  today,
  tasks,
  milestones,
  onStateChange,
  onTaskClick,
}: {
  today: string;
  tasks: TaskView[];
  milestones: MilestoneView[];
  onStateChange: (id: string, state: TaskState) => void;
  onTaskClick: (id: string) => void;
}) {
  const t = useTranslations("projects.board");
  const states = useTranslations("projects.states");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);

  const milestoneTitle = (id: string | null) => milestones.find((m) => m.id === id)?.title ?? null;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {COLUMNS.map((state) => {
        const columnTasks = tasks
          .filter((task) => task.state === state)
          .sort((a, b) => a.endDate.localeCompare(b.endDate));
        return (
          <div
            key={state}
            onDragOver={(e) => {
              e.preventDefault();
              setOverColumn(state);
            }}
            onDragLeave={() => setOverColumn((c) => (c === state ? null : c))}
            onDrop={(e) => {
              e.preventDefault();
              setOverColumn(null);
              const id = e.dataTransfer.getData("text/plain") || dragId;
              if (id) onStateChange(id, state);
              setDragId(null);
            }}
            className={cn(
              "bg-secondary/60 rounded-xl border p-2.5 transition",
              overColumn === state ? "border-primary bg-accent" : "border-border",
            )}
          >
            <div className="flex items-baseline gap-2 px-1 pb-2">
              <h3 className="font-heading text-sm font-semibold">{states(state)}</h3>
              <span className="text-label text-xs">{columnTasks.length}</span>
              <span className="text-label ml-auto text-[10px] tracking-wide uppercase">
                {t(`hint.${state}`)}
              </span>
            </div>
            <div className="space-y-2">
              {columnTasks.length === 0 && (
                <p className="border-border text-meta rounded-xl border border-dashed p-3 text-center text-xs">
                  {t("empty")}
                </p>
              )}
              {columnTasks.map((task) => {
                const overdue = task.state !== "done" && task.endDate < today;
                const milestone = milestoneTitle(task.milestoneId);
                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", task.id);
                      setDragId(task.id);
                    }}
                    onDragEnd={() => setDragId(null)}
                    onClick={() => onTaskClick(task.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onTaskClick(task.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className={cn(
                      "bg-card focus-visible:ring-ring hover:border-primary/40 cursor-pointer rounded-xl border p-3 shadow-[var(--surface-shadow)] transition focus-visible:ring-2 focus-visible:outline-none",
                      overdue ? "border-destructive/50" : "border-border",
                      dragId === task.id && "opacity-50",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <p
                        className={cn(
                          "min-w-0 flex-1 text-sm",
                          task.state === "done" && "text-label line-through",
                        )}
                      >
                        {task.title}
                      </p>
                      <StateSelect value={task.state} onChange={(s) => onStateChange(task.id, s)} />
                    </div>
                    <div className="text-meta mt-1.5 flex items-center gap-2 text-[11px]">
                      {task.ownerName && (
                        <span className="bg-muted rounded-full px-1.5 py-0.5">
                          {task.ownerName}
                          {task.participants.length > 0 ? ` +${task.participants.length}` : ""}
                        </span>
                      )}
                      <span className={cn(overdue && "text-destructive font-medium")}>
                        {formatDateDa(task.endDate)}
                      </span>
                      {milestone && <span className="ml-auto truncate">◆ {milestone}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
