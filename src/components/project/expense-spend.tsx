"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * How much of a line has been paid. The chip says it in one glance —
 * expected, part of it, all of it, or more than planned — and opens a
 * small editor with the two common answers as buttons and a field for
 * the rest, because most lines are paid in full or in one instalment.
 */
export function ExpenseSpend({
  amount,
  spent,
  formatMoney,
  onChange,
}: {
  amount: number;
  spent: number;
  formatMoney: (n: number) => string;
  onChange: (spent: number) => void;
}) {
  const t = useTranslations("projects.economy.spend");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  // The chip sits before the title; the currency is implied there.
  const short = (n: number) => formatMoney(n).replace(/\s*kr\.?$/i, "");
  const state = spent <= 0 ? "none" : spent >= amount ? (spent > amount ? "over" : "all") : "part";
  const label =
    state === "none"
      ? t("none")
      : state === "all"
        ? t("all")
        : state === "over"
          ? t("over", { spent: short(spent) })
          : t("part", { spent: short(spent), amount: short(amount) });

  const commit = (value: number) => {
    onChange(Math.max(0, Math.round(value)));
    setOpen(false);
    setDraft("");
  };

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={t("editLabel", { state: label })}
        className={cn(
          "min-h-[26px] shrink-0 rounded-full border px-2 text-[10px] font-medium",
          state === "all" && "border-success bg-success-tint text-success",
          state === "part" && "border-primary/50 bg-accent text-accent-foreground",
          state === "over" && "border-destructive/50 bg-warning-tint text-warning",
          state === "none" && "border-input bg-card text-meta",
        )}
      >
        {label}
      </button>
      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(draft.replace(/[^\d]/g, ""));
            if (Number.isFinite(n)) commit(n);
          }}
          className="bg-popover border-border absolute top-full left-0 z-20 mt-1 flex w-64 flex-col gap-2 rounded-lg border p-3 shadow-lg"
        >
          <label htmlFor="spend-amount" className="text-xs font-medium">
            {t("prompt", { amount: formatMoney(amount) })}
          </label>
          <Input
            id="spend-amount"
            inputMode="numeric"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={String(spent)}
            className="h-9 text-sm"
          />
          <div className="flex flex-wrap gap-1.5">
            <Button type="submit" size="xs" disabled={!draft.trim()}>
              {t("save")}
            </Button>
            <Button type="button" size="xs" variant="outline" onClick={() => commit(amount)}>
              {t("markAll")}
            </Button>
            <Button type="button" size="xs" variant="outline" onClick={() => commit(0)}>
              {t("markNone")}
            </Button>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              className="ml-auto"
              onClick={() => setOpen(false)}
            >
              {t("close")}
            </Button>
          </div>
        </form>
      )}
    </span>
  );
}
