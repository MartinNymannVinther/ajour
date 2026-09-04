"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RAG_COLOR } from "@/modules/reports/charts";
import { RAG_VALUES, type ManagementAsk, type Rag } from "@/modules/reports/status-report";
import { AsksEditor } from "./asks-editor";

export type StatusFields = {
  rag: Rag;
  ragReason: string;
  text: string;
  managerComment: string;
  managementAsks: ManagementAsk[];
  nextWeek: string;
  answers: Record<number, string>;
};

/**
 * The fields, in the order the front page reads them: the assessment,
 * the summary, what management is asked to do, the manager's own words
 * and next week. Everything typed here shows up in the preview beside it
 * as it is typed, so there is nothing to imagine.
 */
export function StatusFieldsForm({
  fields,
  suggested,
  questions,
  suggestions,
  weekLabel,
  onChange,
}: {
  fields: StatusFields;
  suggested: Rag;
  questions: string[];
  suggestions: Array<{ text: string; dueDate: string | null }>;
  weekLabel: (key: string) => string;
  onChange: (patch: Partial<StatusFields>) => void;
}) {
  const t = useTranslations("status");
  const r = useTranslations("report.rag");
  const field = "border-border bg-card rounded-xl border p-4 flex flex-col gap-2";

  return (
    <div className="flex flex-col gap-4">
      <div className={field}>
        <Label htmlFor="rag">{t("ragLabel")}</Label>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="rag">
          {RAG_VALUES.map((value) => {
            const active = fields.rag === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange({ rag: value })}
                className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors"
                style={{
                  background: active ? RAG_COLOR[value].tint : undefined,
                  borderColor: active ? RAG_COLOR[value].dot : "var(--border)",
                }}
              >
                <span
                  className="inline-block size-3 rounded-full"
                  style={{ background: RAG_COLOR[value].dot }}
                  aria-hidden
                />
                {r(value)}
                {value === suggested && (
                  <span className="text-meta text-[10px]">{t("ragSuggested")}</span>
                )}
              </button>
            );
          })}
        </div>
        <Textarea
          id="ragReason"
          value={fields.ragReason}
          onChange={(e) => onChange({ ragReason: e.target.value })}
          rows={2}
          aria-label={t("ragReasonLabel")}
          placeholder={t("ragReasonPlaceholder")}
        />
        <p className="text-label text-xs">{t("ragHelp")}</p>
      </div>

      <div className={field}>
        <Label htmlFor="draft">{t("draftLabel")}</Label>
        <Textarea
          id="draft"
          value={fields.text}
          onChange={(e) => onChange({ text: e.target.value })}
          rows={7}
          className="resize-y leading-relaxed"
        />
      </div>

      {questions.length > 0 && (
        <div className={field}>
          <Label>{t("questionsLabel")}</Label>
          {questions.map((question, i) => (
            <div key={i}>
              <label htmlFor={`answer-${i}`} className="text-sm">
                {question}
              </label>
              <Input
                id={`answer-${i}`}
                value={fields.answers[i] ?? ""}
                onChange={(e) => onChange({ answers: { ...fields.answers, [i]: e.target.value } })}
                placeholder={t("answerPlaceholder")}
                className="mt-1"
              />
            </div>
          ))}
          <p className="text-label text-xs">{t("answersNote")}</p>
        </div>
      )}

      <div className={field}>
        <Label>{t("asksLabel")}</Label>
        <p className="text-label text-xs">{t("asksHelp")}</p>
        <AsksEditor
          asks={fields.managementAsks}
          suggestions={suggestions}
          onChange={(managementAsks) => onChange({ managementAsks })}
          weekLabel={weekLabel}
        />
      </div>

      <div className={field}>
        <Label htmlFor="comment">{t("commentLabel")}</Label>
        <Textarea
          id="comment"
          value={fields.managerComment}
          onChange={(e) => onChange({ managerComment: e.target.value })}
          rows={4}
          placeholder={t("commentPlaceholder")}
          className="resize-y leading-relaxed"
        />
        <p className="text-label text-xs">{t("commentHelp")}</p>
      </div>

      <div className={field}>
        <Label htmlFor="nextWeek">{t("nextWeekLabel")}</Label>
        <Textarea
          id="nextWeek"
          value={fields.nextWeek}
          onChange={(e) => onChange({ nextWeek: e.target.value })}
          rows={4}
          placeholder={t("nextWeekPlaceholder")}
        />
        <p className="text-label text-xs">{t("nextWeekHelp")}</p>
      </div>
    </div>
  );
}
