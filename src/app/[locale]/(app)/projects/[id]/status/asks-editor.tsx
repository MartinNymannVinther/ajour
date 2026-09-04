"use client";

import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ManagementAsk } from "@/modules/reports/status-report";

/**
 * What management is asked to do. Each line has a date it needs an
 * answer by, and a line carried over from last week can be marked
 * answered, which shows it once more as closed and then retires it.
 */
export function AsksEditor({
  asks,
  suggestions,
  onChange,
  weekLabel,
}: {
  asks: ManagementAsk[];
  suggestions: Array<{ text: string; dueDate: string | null }>;
  onChange: (asks: ManagementAsk[]) => void;
  weekLabel: (key: string) => string;
}) {
  const t = useTranslations("status.asks");
  const update = (id: string, patch: Partial<ManagementAsk>) =>
    onChange(asks.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const add = (text = "", dueDate: string | null = null) =>
    onChange([
      ...asks,
      { id: crypto.randomUUID(), text, dueDate, carriedFrom: null, answered: false },
    ]);
  const unused = suggestions.filter((s) => !asks.some((a) => a.text === s.text));

  return (
    <div className="flex flex-col gap-3">
      {asks.length === 0 && <p className="text-meta text-sm">{t("empty")}</p>}
      {asks.map((ask, i) => (
        <div key={ask.id} className="border-border rounded-lg border p-2.5">
          <div className="flex items-start gap-2">
            <span className="text-meta mt-2 w-4 shrink-0 text-xs tabular-nums">{i + 1}.</span>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Input
                value={ask.text}
                onChange={(e) => update(ask.id, { text: e.target.value })}
                placeholder={t("placeholder")}
                aria-label={t("askLabel", { n: i + 1 })}
              />
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <label className="flex items-center gap-1.5">
                  <span className="text-meta">{t("due")}</span>
                  <Input
                    type="date"
                    value={ask.dueDate ?? ""}
                    onChange={(e) => update(ask.id, { dueDate: e.target.value || null })}
                    className="h-8 w-auto text-xs"
                    aria-label={t("dueLabel", { n: i + 1 })}
                  />
                </label>
                {ask.carriedFrom && (
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={ask.answered}
                      onChange={(e) => update(ask.id, { answered: e.target.checked })}
                      className="accent-primary size-4"
                    />
                    <span>{t("answered", { week: weekLabel(ask.carriedFrom) })}</span>
                  </label>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("remove", { n: i + 1 })}
              onClick={() => onChange(asks.filter((a) => a.id !== ask.id))}
            >
              <X />
            </Button>
          </div>
        </div>
      ))}

      {unused.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-meta text-xs">{t("suggested")}</p>
          {unused.map((s) => (
            <button
              key={s.text}
              type="button"
              onClick={() => add(s.text, s.dueDate)}
              className="border-border bg-secondary hover:border-primary/40 rounded-lg border px-3 py-2 text-left text-sm"
            >
              <Plus className="mr-1.5 inline size-3.5" aria-hidden />
              {s.text}
            </button>
          ))}
        </div>
      )}

      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => add()}>
        <Plus data-slot="icon" />
        {t("add")}
      </Button>
    </div>
  );
}
