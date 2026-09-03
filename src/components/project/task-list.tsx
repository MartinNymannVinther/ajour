"use client";

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
  }) => void;
}) {
  const t = useTranslations("projects.tasks");
  const selected = editingId ? tasks.find((task) => task.id === editingId) : undefined;

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
      count={boardMode ? undefined : tasks.length}
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
        <ul className="divide-hairline divide-y">
          {tasks.length === 0 && <li className="text-meta py-3 text-sm">{t("empty")}</li>}
          {tasks.map((task) => {
            const isEditing = editingId === task.id;
            const overdue = task.state !== "done" && task.endDate < today;
            return (
              <li key={task.id} id={`task-${task.id}`} className="py-2.5">
                <div className="flex flex-wrap items-center gap-3">
                  <StateSelect value={task.state} onChange={(s) => onStateChange(task.id, s)} />
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-sm",
                      task.state === "done" && "text-label line-through",
                    )}
                  >
                    {task.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => onEdit(isEditing ? null : task.id)}
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
      )}
      <NewTaskForm today={today} milestones={milestones} onCreate={onCreate} />
    </FunctionCard>
  );
}
