"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PEOPLE_LIST_ID } from "@/modules/projects/constants";
import type { Expense, Subtask } from "@/core/db/schema";
import type { MilestoneView, TaskView } from "@/modules/projects/types";
import { cn } from "@/lib/utils";

/**
 * The task opened up: who owns it, who takes part, which milestone it
 * belongs to, its checklist and the money hanging on it. Saving carries
 * the row's own timestamp, so two people editing at once get a conflict
 * rather than one of them silently losing their work.
 */
export function TaskEditor({
  task,
  milestones,
  expenses,
  formatMoney,
  onSavePeople,
  onSaveSubtasks,
  onClose,
  onDelete,
}: {
  task: TaskView;
  milestones: MilestoneView[];
  expenses: Expense[];
  formatMoney: (amount: number) => string;
  onSavePeople: (input: {
    owner: string;
    participants: string[];
    milestoneRelation: "before" | "after";
    milestoneId: string | null;
    expectedUpdatedAt: string;
  }) => void;
  onSaveSubtasks: (subtasks: Subtask[]) => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("projects.taskEditor");
  const [draft, setDraft] = useState({
    owner: task.ownerName,
    participants: task.participants.join(", "),
    relation: task.milestoneRelation === "after" ? ("after" as const) : ("before" as const),
    milestoneId: task.milestoneId ?? "",
  });
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const subtasks = task.subtasks ?? [];
  const taskExpenses = expenses.filter((e) => e.taskId === task.id);

  return (
    <div className="bg-secondary mt-2 space-y-3 rounded-lg p-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSavePeople({
            owner: draft.owner.trim(),
            participants: draft.participants
              .split(",")
              .map((p) => p.trim())
              .filter(Boolean),
            milestoneRelation: draft.relation,
            milestoneId: draft.milestoneId || null,
            expectedUpdatedAt: task.updatedAt.toISOString(),
          });
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <Input
          value={draft.owner}
          onChange={(e) => setDraft((d) => ({ ...d, owner: e.target.value }))}
          list={PEOPLE_LIST_ID}
          placeholder={t("owner")}
          aria-label={t("owner")}
          className="w-44"
        />
        <Input
          value={draft.participants}
          onChange={(e) => setDraft((d) => ({ ...d, participants: e.target.value }))}
          list={PEOPLE_LIST_ID}
          placeholder={t("participants")}
          aria-label={t("participants")}
          className="min-w-52 flex-1"
        />
        <select
          value={draft.milestoneId}
          onChange={(e) => setDraft((d) => ({ ...d, milestoneId: e.target.value }))}
          aria-label={t("milestone")}
          className="border-input bg-card focus-visible:ring-ring max-w-52 rounded-lg border px-2 py-2 text-sm outline-none focus-visible:ring-2"
        >
          <option value="">{t("noMilestone")}</option>
          {milestones.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
        <div className="border-input flex overflow-hidden rounded-lg border">
          {(["before", "after"] as const).map((relation) => (
            <button
              key={relation}
              type="button"
              onClick={() => setDraft((d) => ({ ...d, relation }))}
              aria-pressed={draft.relation === relation}
              className={cn(
                "min-h-[36px] px-2.5 text-xs",
                draft.relation === relation
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-meta hover:bg-muted",
              )}
            >
              {t(relation)}
            </button>
          ))}
        </div>
        <Button type="submit" size="sm">
          {t("save")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          {t("close")}
        </Button>
      </form>

      <div>
        <p className="text-label text-[11px] font-semibold tracking-wide uppercase">
          {t("checklist")}
        </p>
        <ul className="mt-1 space-y-1">
          {subtasks.map((item, i) => (
            <li key={`${item.title}-${i}`} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-[18px] shrink-0"
                checked={item.done}
                aria-label={item.title}
                onChange={() =>
                  onSaveSubtasks(subtasks.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))
                }
              />
              <span className={cn(item.done && "text-label line-through")}>{item.title}</span>
              <button
                type="button"
                onClick={() => onSaveSubtasks(subtasks.filter((_, j) => j !== i))}
                aria-label={t("removeItem", { title: item.title })}
                className="text-label hover:text-destructive ml-auto"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const title = subtaskDraft.trim();
            if (!title) return;
            setSubtaskDraft("");
            onSaveSubtasks([...subtasks, { title, done: false }]);
          }}
          className="mt-1.5 flex gap-2"
        >
          <Input
            value={subtaskDraft}
            onChange={(e) => setSubtaskDraft(e.target.value)}
            placeholder={t("newItem")}
            aria-label={t("newItem")}
          />
          <Button type="submit" variant="outline" size="sm">
            {t("add")}
          </Button>
        </form>
      </div>

      {taskExpenses.length > 0 && (
        <p className="text-meta text-xs">
          {t("expenses", {
            list: taskExpenses.map((e) => `${e.title} (${formatMoney(e.amount)})`).join(", "),
          })}
        </p>
      )}

      <div className="border-border flex justify-end border-t pt-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="text-destructive"
        >
          {t("delete")}
        </Button>
      </div>
    </div>
  );
}
