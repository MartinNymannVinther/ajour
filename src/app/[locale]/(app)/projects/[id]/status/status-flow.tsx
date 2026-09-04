"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import { weekNumberFromKey } from "@/core/dates";
import { Button } from "@/components/ui/button";
import { StatusReportView } from "@/components/report/status-report-view";
import { approveStatusAction, draftStatusAction } from "@/modules/reports/actions";
import type { StatusDraftResult } from "@/modules/reports/actions";
import type { StatusReport } from "@/modules/reports/status-report";
import { StatusFieldsForm, type StatusFields } from "./status-fields";

/**
 * Ugen: the engine reads what happened, assesses it and drafts the words;
 * the person confirms the colour, says what management must do, adds
 * their own comment and approves. The report on the right is the report:
 * the PDF renders from the same data, so what you see is what is sent.
 */
export function StatusFlow({
  projectId,
  projectName,
  weekLabel,
}: {
  projectId: string;
  projectName: string;
  weekLabel: string;
}) {
  const t = useTranslations("status");
  const common = useTranslations("common");
  const weekOf = (key: string) => common("week", { number: weekNumberFromKey(key) });
  const router = useRouter();
  const [draft, setDraft] = useState<StatusDraftResult | null>(null);
  const [fields, setFields] = useState<StatusFields | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfPending, setPdfPending] = useState(false);
  const [approving, startApprove] = useTransition();
  const started = useRef(false);

  const load = () => {
    setLoading(true);
    void draftStatusAction({ projectId }).then((result) => {
      if (!result.ok) {
        toast.error(result.error === "conflict" ? t("rateLimited") : t("draftFailed"));
      } else {
        const d = result.data;
        setDraft(d);
        setFields({
          rag: d.rag,
          ragReason: d.reason,
          text: d.draft.text,
          managerComment: d.previousComment,
          managementAsks: d.carriedAsks,
          nextWeek: d.draft.nextWeek.join("\n"),
          answers: {},
        });
      }
      setLoading(false);
    });
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    load();
    // Once, on arrival: the draft is the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finalText = (f: StatusFields, questions: string[]) => {
    const answered = questions
      .map((question, i) => ({ question, answer: (f.answers[i] ?? "").trim() }))
      .filter((x) => x.answer);
    return answered.length > 0
      ? `${f.text.trim()}\n\n${answered.map((x) => `${x.question}\n– ${x.answer}`).join("\n\n")}`
      : f.text.trim();
  };

  const authored = useMemo(() => {
    if (!draft || !fields) return null;
    return {
      projectId,
      text: finalText(fields, draft.draft.questions),
      rag: fields.rag,
      ragSuggested: draft.rag,
      ragReason: fields.ragReason.trim(),
      managerComment: fields.managerComment.trim(),
      managementAsks: fields.managementAsks.filter((a) => a.text.trim()),
      nextWeek: fields.nextWeek
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 6),
      questions: draft.draft.questions,
      engine: draft.engine,
    };
  }, [draft, fields, projectId]);

  // The preview is the base report with the person's words laid over it.
  const live: StatusReport | null = useMemo(() => {
    if (!draft || !authored) return null;
    const trend = [...draft.base.trend];
    trend[trend.length - 1] = { ...trend[trend.length - 1]!, rag: authored.rag };
    return {
      ...draft.base,
      text: authored.text,
      rag: authored.rag,
      ragSuggested: authored.ragSuggested,
      ragReason: authored.ragReason,
      managerComment: authored.managerComment,
      managementAsks: authored.managementAsks,
      nextWeek: authored.nextWeek,
      trend,
    };
  }, [draft, authored]);

  const approve = () => {
    if (!authored) return;
    startApprove(async () => {
      const result = await approveStatusAction(authored);
      if (!result.ok) {
        toast.error(t("approveFailed"));
        return;
      }
      router.push(`/projects/${projectId}`);
    });
  };

  const downloadPdf = async () => {
    if (!authored) return;
    setPdfPending(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/status/draft-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authored),
      });
      if (!response.ok) throw new Error(String(response.status));
      const url = URL.createObjectURL(await response.blob());
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast.error(t("pdfFailed"));
    } finally {
      setPdfPending(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-meta text-sm">{projectName}</p>
        <h1 className="font-heading text-2xl font-semibold">{t("title", { week: weekLabel })}</h1>
        <p className="text-meta mt-1 text-sm">{t("subtitle")}</p>
      </div>

      {loading || !draft || !fields || !live ? (
        <div className="border-border bg-card rounded-xl border p-6" aria-live="polite">
          <p className="text-meta animate-pulse text-sm">{t("drafting")}</p>
        </div>
      ) : (
        <>
          {draft.fallback && (
            <div className="border-chart-4 bg-warning-tint rounded-xl border p-3 text-sm">
              {t("fallbackNote")}
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-[minmax(320px,440px)_1fr]">
            <div className="flex flex-col gap-4">
              <StatusFieldsForm
                fields={fields}
                suggested={draft.rag}
                questions={draft.draft.questions}
                suggestions={draft.draft.suggestedAsks}
                weekLabel={weekOf}
                onChange={(patch) => setFields((f) => (f ? { ...f, ...patch } : f))}
              />
              <div className="flex flex-wrap items-center gap-3 pb-8">
                <Button
                  type="button"
                  size="lg"
                  onClick={approve}
                  disabled={approving || !fields.text.trim()}
                >
                  {approving ? t("approving") : t("approve")}
                </Button>
                <Button type="button" variant="outline" onClick={downloadPdf} disabled={pdfPending}>
                  <FileDown data-slot="icon" />
                  {pdfPending ? t("pdfPending") : t("pdfDraft")}
                </Button>
                <Button type="button" variant="ghost" onClick={load}>
                  {t("redraft")}
                </Button>
                <Link
                  href={`/projects/${projectId}`}
                  className="text-meta hover:text-foreground ml-auto text-sm"
                >
                  {t("cancel")}
                </Link>
              </div>
            </div>

            <div className="min-w-0" aria-label={t("previewLabel")}>
              <p className="text-label mb-2 text-xs font-semibold tracking-wide uppercase">
                {t("previewLabel")}
              </p>
              <StatusReportView report={live} draft />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
