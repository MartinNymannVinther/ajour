"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatDateDa } from "@/core/dates";
import type { Expense, Subtask, TaskState } from "@/core/db/schema";
import type { MilestoneView, TaskView } from "@/modules/projects/types";
import { FunctionCard } from "./function-card";
import { NewTaskForm } from "./new-task-form";
import { StateSelect } from "./state-select";
import { TaskEditor } from "./task-editor";
import { FUNCTION_ACCENT, SECTION_IDS } from "@/modules/projects/constants";
import { cn } from "@/lib/utils";

/**
 * The tasks as a list. On the board the same card shows only the task the
 * person picked, because a board plus a list of everything is two answers
 * to the same question.
 */
export function TaskList({
  today,
  boardMode,
  tasks,
  milestones,
  expenses,
  editingId,
  formatMoney,
  onEdit,
  onStateChange,
  onSavePeople,
  onSaveSubtasks,
  onDelete,
  onCreate,
}: {
  today: string;
  boardMode: boolean;
  tasks: TaskView[];
  milestones: MilestoneView[];
  expenses: Expense[];
  editingId: string | null;
  formatMoney: (amount: number) => string;
  onEdit: (id: string | null) => void;
  onStateChange: (id: string, state: TaskState) => void;
  onSavePeople: (
    taskId: string,
    input: {
      owner: string;
      participants: string[];
      milestoneRelation: "before" | "after";
      milestoneId: string | null;
      expectedUpdatedAt: string;
      dates: { startDate: string; endDate: string } | null;
    },
  ) => void;
  onSaveSubtasks: (taskId: string, subtasks: Subtask[]) => void;
  onDelete: (taskId: string) => void;
  onCreate: (input: {
    title: string;
    milestoneId: string | null;
    owner: string;
    startDate: string;
    endDate: string;
  }) => Promise<boolean>;
}) {
  const t = useTranslations("projects.tasks");
  const selected = editingId ? tasks.find((task) => task.id === editingId) : undefined;
  // "all", a milestone id, or "none" for tasks under no milestone.
  const [filter, setFilter] = useState<string>("all");
  const sortedMilestones = [...milestones].sort((a, b) => a.date.localeCompare(b.date));
  const loose = tasks.some((task) => task.milestoneId === null);
  const shown =
    filter === "all"
      ? tasks
      : filter === "none"
        ? tasks.filter((task) => task.milestoneId === null)
        : tasks.filter((task) => task.milestoneId === filter);
  const countUnder = (id: string | null) => tasks.filter((task) => task.milestoneId === id).length;
  const chip = (active: boolean) =>
    cn(
      "min-h-[28px] max-w-[14rem] truncate rounded-full border px-2.5 text-[11px] font-medium transition-colors",
      active
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border bg-secondary text-meta hover:border-primary/40",
    );

  const editorFor = (task: TaskView) => (
    <TaskEditor
      task={task}
      milestones={milestones}
      expenses={expenses}
      formatMoney={formatMoney}
      onSavePeople={(input) => onSavePeople(task.id, input)}
      onSaveSubtasks={(subtasks) => onSaveSubtasks(task.id, subtasks)}
      onClose={() => onEdit(null)}
      onDelete={() => onDelete(task.id)}
    />
  );

  return (
    <FunctionCard
      id={SECTION_IDS.tasks}
      title={boardMode ? t("selectedTitle") : t("title")}
      count={boardMode ? undefined : shown.length}
      accent={FUNCTION_ACCENT.plan}
    >
      {boardMode ? (
        selected ? (
          <div id={`task-${selected.id}`} className="bg-secondary rounded-lg p-3">
            <p className="text-sm font-medium">{selected.title}</p>
            {editorFor(selected)}
          </div>
        ) : (
          <p className="border-border text-meta rounded-xl border border-dashed p-6 text-center text-sm">
            {t("pickOnBoard")}
          </p>
        )
      ) : (
        <>
          {/* One chip per milestone: the plan is read milestone by
              milestone, and a list of everything answers a different
              question than "what carries the next one". */}
          {tasks.length > 0 && sortedMilestones.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label={t("filterLabel")}>
              <button
                type="button"
                onClick={() => setFilter("all")}
                aria-pressed={filter === "all"}
                className={chip(filter === "all")}
              >
                {t("filterAll", { count: tasks.length })}
              </button>
              {sortedMilestones.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setFilter(filter === m.id ? "all" : m.id)}
                  aria-pressed={filter === m.id}
                  title={m.title}
                  className={chip(filter === m.id)}
                >
                  <span aria-hidden>◆</span> {m.title} · {countUnder(m.id)}
                </button>
              ))}
              {loose && (
                <button
                  type="button"
                  onClick={() => setFilter(filter === "none" ? "all" : "none")}
                  aria-pressed={filter === "none"}
                  className={chip(filter === "none")}
                >
                  {t("filterNone", { count: countUnder(null) })}
                </button>
              )}
            </div>
          )}
          <ul className="divide-hairline divide-y">
            {tasks.length === 0 && <li className="text-meta py-3 text-sm">{t("empty")}</li>}
            {tasks.length > 0 && shown.length === 0 && (
              <li className="text-meta py-3 text-sm">{t("filterEmpty")}</li>
            )}
            {shown.map((task) => {
              const isEditing = editingId === task.id;
              const overdue = task.state !== "done" && task.endDate < today;
              return (
                <li key={task.id} id={`task-${task.id}`} className="py-2.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <StateSelect value={task.state} onChange={(s) => onStateChange(task.id, s)} />
                    {/* The name is the obvious thing to click, so it is the
                      thing that opens the task. The chip stays clickable
                      too: somebody who learned that path keeps it. */}
                    <button
                      type="button"
                      onClick={() => onEdit(isEditing ? null : task.id)}
                      aria-expanded={isEditing}
                      className={cn(
                        "hover:text-primary focus-visible:ring-ring min-h-[24px] min-w-[10rem] flex-1 truncate text-left text-sm focus-visible:ring-2 focus-visible:outline-none",
                        task.state === "done" && "text-label line-through",
                      )}
                    >
                      {task.title}
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(isEditing ? null : task.id)}
                      tabIndex={-1}
                      className="border-border bg-secondary text-meta hover:border-primary/40 min-h-[28px] shrink-0 rounded-full border px-2 text-[11px]"
                    >
                      {task.ownerName || t("noOwner")}
                      {task.participants.length > 0 ? ` +${task.participants.length}` : ""}
                    </button>
                    <span
                      className={cn("shrink-0 text-xs", overdue ? "text-destructive" : "text-meta")}
                    >
                      {formatDateDa(task.startDate)} – {formatDateDa(task.endDate)}
                    </span>
                  </div>
                  {isEditing && editorFor(task)}
                </li>
              );
            })}
          </ul>
        </>
      )}
      {/* Keyed on the filter so a new task lands under the milestone in
          view, which is where somebody looking at that milestone means it. */}
      <NewTaskForm
        key={filter}
        today={today}
        milestones={milestones}
        defaultMilestoneId={filter === "all" || filter === "none" ? null : filter}
        onCreate={onCreate}
      />
    </FunctionCard>
  );
}
