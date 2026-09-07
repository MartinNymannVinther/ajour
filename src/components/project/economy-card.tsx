"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Expense } from "@/core/db/schema";
import type { TaskView } from "@/modules/projects/types";
import { FUNCTION_ACCENT, SECTION_IDS } from "@/modules/projects/constants";
import { ConfirmButton } from "./confirm-button";
import { ExpenseSpend } from "./expense-spend";
import { FunctionSection } from "./function-card";
import { cn } from "@/lib/utils";

/**
 * The money, in whole kroner and nothing more: a budget, a list of lines,
 * and whether each has been spent yet. Not accounting — the omission is
 * deliberate. None of it is on the public share link, and the card says so.
 */
export function EconomyCard({
  budget,
  expenses,
  tasks,
  formatMoney,
  onSetBudget,
  onAddExpense,
  onSetSpent,
  onRemoveExpense,
}: {
  budget: number | null;
  expenses: Expense[];
  tasks: TaskView[];
  formatMoney: (amount: number) => string;
  onSetBudget: (budget: number | null) => void;
  onAddExpense: (input: {
    title: string;
    amount: number;
    spent: number;
    taskId: string | null;
  }) => Promise<boolean>;
  onSetSpent: (id: string, spent: number) => void;
  onRemoveExpense: (id: string) => void;
}) {
  const t = useTranslations("projects.economy");
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState("");
  const [draft, setDraft] = useState({ title: "", amount: "", spent: "", taskId: "" });

  const plannedTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
  const incurredTotal = expenses.reduce((sum, e) => sum + e.spent, 0);
  const share = budget ? Math.min(999, Math.round((plannedTotal / budget) * 100)) : null;
  const over = budget !== null && plannedTotal > budget;

  return (
    <FunctionSection
      id={SECTION_IDS.economy}
      accent={FUNCTION_ACCENT.economy}
      title={t("title")}
      badge={share !== null ? t("shareOfBudget", { percent: share }) : undefined}
      alert={over}
      defaultOpen={budget !== null || expenses.length > 0}
    >
      <div className="bg-secondary space-y-3 rounded-lg p-3">
        {editingBudget ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const raw = budgetDraft.trim();
              const value = raw === "" ? null : Number(raw.replace(/[.\s]/g, ""));
              setEditingBudget(false);
              if (value === null || Number.isFinite(value)) onSetBudget(value);
            }}
            className="flex gap-2"
          >
            <Input
              autoFocus
              value={budgetDraft}
              onChange={(e) => setBudgetDraft(e.target.value)}
              inputMode="numeric"
              placeholder={t("budgetPlaceholder")}
              aria-label={t("budgetPlaceholder")}
            />
            <Button type="submit" size="sm">
              {t("save")}
            </Button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              setBudgetDraft(budget?.toString() ?? "");
              setEditingBudget(true);
            }}
            className="hover:text-primary inline-flex min-h-[24px] items-center text-sm font-medium"
          >
            {budget !== null ? t("budget", { amount: formatMoney(budget) }) : t("setBudget")}
            <span className="text-primary ml-2 text-xs font-medium">{t("edit")}</span>
          </button>
        )}

        {(budget !== null || expenses.length > 0) && (
          <>
            <p className={cn("text-xs", over ? "text-destructive" : "text-meta")}>
              {t("summary", {
                planned: formatMoney(plannedTotal),
                incurred: formatMoney(incurredTotal),
              })}
              {over ? ` ${t("overBudget")}` : ""}
            </p>
            {budget !== null && budget > 0 && (
              <div
                className="bg-muted h-1.5 overflow-hidden rounded-full"
                role="progressbar"
                aria-valuenow={share ?? 0}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t("title")}
              >
                <div
                  className={cn("h-full rounded-full", over ? "bg-destructive" : "bg-primary")}
                  style={{ width: `${Math.min(100, Math.round((plannedTotal / budget) * 100))}%` }}
                />
              </div>
            )}
          </>
        )}

        <ul className="space-y-1.5">
          {expenses.map((expense) => {
            const task = tasks.find((x) => x.id === expense.taskId);
            return (
              <li key={expense.id} className="flex items-center gap-2 text-sm">
                <ExpenseSpend
                  amount={expense.amount}
                  spent={expense.spent}
                  formatMoney={formatMoney}
                  onChange={(spent) => onSetSpent(expense.id, spent)}
                />
                <span className="min-w-0 truncate">
                  {expense.title}
                  {task && <span className="text-meta ml-1 text-[11px]">· {task.title}</span>}
                </span>
                <span className="text-meta ml-auto shrink-0 text-xs">
                  {formatMoney(expense.amount)}
                </span>
                <ConfirmButton
                  label="✕"
                  question={t("removeQuestion", {
                    title: expense.title,
                    amount: formatMoney(expense.amount),
                  })}
                  confirmLabel={t("remove")}
                  onConfirm={() => onRemoveExpense(expense.id)}
                  className="h-6 shrink-0 px-1.5"
                />
              </li>
            );
          })}
        </ul>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const amount = Number(draft.amount.replace(/[.\s]/g, ""));
            if (!draft.title.trim() || !Number.isFinite(amount) || amount <= 0) return;
            const done = await onAddExpense({
              title: draft.title.trim(),
              amount,
              spent: Number(draft.spent.replace(/[^\d]/g, "")) || 0,
              taskId: draft.taskId || null,
            });
            if (done) setDraft({ title: "", amount: "", spent: "", taskId: "" });
          }}
          className="space-y-2"
        >
          <div className="flex gap-2">
            <Input
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder={t("newLine")}
              aria-label={t("newLine")}
            />
            <Input
              value={draft.amount}
              onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
              inputMode="numeric"
              placeholder={t("amount")}
              aria-label={t("amount")}
              className="w-24"
            />
          </div>
          <select
            value={draft.taskId}
            onChange={(e) => setDraft((d) => ({ ...d, taskId: e.target.value }))}
            aria-label={t("linkedTask")}
            className="border-input bg-card focus-visible:ring-ring w-full rounded-lg border px-2 py-2 text-sm outline-none focus-visible:ring-2"
          >
            <option value="">{t("noTask")}</option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <Input
              inputMode="numeric"
              value={draft.spent}
              onChange={(e) => setDraft((d) => ({ ...d, spent: e.target.value }))}
              placeholder={t("spentSoFar")}
              aria-label={t("spentSoFar")}
              className="w-40"
            />
            <Button type="submit" variant="outline" size="sm" className="ml-auto">
              {t("add")}
            </Button>
          </div>
        </form>
        <p className="text-meta text-xs">{t("notShared")}</p>
      </div>
    </FunctionSection>
  );
}
