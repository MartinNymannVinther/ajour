"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmButton } from "./confirm-button";
import { cn } from "@/lib/utils";

/**
 * One budget line: the title and the amount on the first row, how much of
 * it is paid as a bar and a sentence on the second. The bar is the same
 * figure the status report draws, so the card and the document agree.
 * Editing the paid amount opens under the line rather than beside it,
 * because a narrow card has no room beside anything.
 */
export function ExpenseRow({
  title,
  taskTitle,
  amount,
  spent,
  formatMoney,
  onSetSpent,
  onRemove,
}: {
  title: string;
  taskTitle?: string;
  amount: number;
  spent: number;
  formatMoney: (n: number) => string;
  onSetSpent: (spent: number) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("projects.economy");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  // "10.000 af 30.000 kr.": the currency once, on the amount.
  const short = (n: number) => formatMoney(n).replace(/\s*kr\.?$/i, "");
  const state = spent <= 0 ? "none" : spent > amount ? "over" : spent === amount ? "all" : "part";
  const share = amount > 0 ? Math.min(100, Math.round((spent / amount) * 100)) : 0;
  const sentence =
    state === "none"
      ? t("spend.none")
      : state === "all"
        ? t("spend.all")
        : state === "over"
          ? t("spend.over", { by: formatMoney(spent - amount) })
          : t("spend.part", { spent: short(spent), amount: formatMoney(amount) });

  const commit = (value: number) => {
    onSetSpent(Math.max(0, Math.round(value)));
    setEditing(false);
    setDraft("");
  };

  return (
    <li className="border-hairline border-b py-2 last:border-b-0">
      <div className="flex items-center gap-2 text-sm">
        <span className="min-w-0 flex-1 truncate">
          {title}
          {taskTitle && <span className="text-meta ml-1 text-[11px]">· {taskTitle}</span>}
        </span>
        <span className="shrink-0 text-xs tabular-nums">{formatMoney(amount)}</span>
        <ConfirmButton
          label="✕"
          question={t("removeQuestion", { title, amount: formatMoney(amount) })}
          confirmLabel={t("remove")}
          onConfirm={onRemove}
          className="h-6 shrink-0 px-1.5"
        />
      </div>

      <button
        type="button"
        onClick={() => setEditing((e) => !e)}
        aria-expanded={editing}
        aria-label={t("spend.editLabel", { title })}
        className="hover:bg-muted/60 focus-visible:ring-ring -mx-1 mt-1 flex w-[calc(100%+0.5rem)] items-center gap-2 rounded-md px-1 py-0.5 text-left focus-visible:ring-2 focus-visible:outline-none"
      >
        <span
          className="bg-muted h-1.5 w-20 shrink-0 overflow-hidden rounded-full"
          role="progressbar"
          aria-valuenow={share}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span
            className={cn(
              "block h-full rounded-full",
              state === "over" ? "bg-destructive" : state === "all" ? "bg-success" : "bg-primary",
            )}
            style={{ width: `${share}%` }}
          />
        </span>
        <span
          className={cn(
            "min-w-0 flex-1 text-[11px] leading-tight",
            state === "over" ? "text-destructive" : state === "none" ? "text-label" : "text-meta",
          )}
        >
          {sentence}
        </span>
        <span className="text-primary shrink-0 text-[11px] font-medium">{t("spend.edit")}</span>
      </button>

      {editing && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(draft.replace(/[^\d]/g, ""));
            if (draft.trim() && Number.isFinite(n)) commit(n);
          }}
          className="bg-card border-border mt-1.5 flex flex-col gap-2 rounded-lg border p-2.5"
        >
          <label htmlFor={`spend-${title}`} className="text-xs font-medium">
            {t("spend.prompt", { amount: formatMoney(amount) })}
          </label>
          <div className="flex gap-2">
            <Input
              id={`spend-${title}`}
              inputMode="numeric"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={String(spent)}
              className="h-9 text-sm"
            />
            <Button type="submit" size="sm" disabled={!draft.trim()}>
              {t("spend.save")}
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button type="button" size="xs" variant="outline" onClick={() => commit(amount)}>
              {t("spend.markAll")}
            </Button>
            <Button type="button" size="xs" variant="outline" onClick={() => commit(0)}>
              {t("spend.markNone")}
            </Button>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              className="ml-auto"
              onClick={() => setEditing(false)}
            >
              {t("spend.close")}
            </Button>
          </div>
        </form>
      )}
    </li>
  );
}
