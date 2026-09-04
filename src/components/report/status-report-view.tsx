"use client";

import { useLocale, useTranslations } from "next-intl";
import { weekNumberFromKey } from "@/core/dates";
import { formatMoney } from "@/modules/ai/phrases";
import type { StatusReport } from "@/modules/reports/status-report";
import { reportWords } from "@/modules/reports/words";
import { ReportAppendix } from "./report-appendix";
import { ReportFront } from "./report-front";

/**
 * The report on screen, the way the PDF will print it: two pages, same
 * sections, same figures. Used live on the status page while the person
 * writes, and as the read view of an approved status.
 */
export function StatusReportView({
  report,
  draft = false,
  appendix = true,
}: {
  report: StatusReport;
  draft?: boolean;
  appendix?: boolean;
}) {
  const t = useTranslations("report");
  const common = useTranslations("common");
  const states = useTranslations("projects.states");
  const locale = useLocale() as "da" | "en";
  const words = reportWords(
    t,
    (key) => common("week", { number: weekNumberFromKey(key) }),
    { todo: states("todo"), doing: states("doing"), done: states("done") },
    (n) => formatMoney(n, locale),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-background border-border rounded-xl border p-5 shadow-[var(--surface-shadow)] sm:p-7">
        <ReportFront report={report} words={words} draft={draft} />
      </div>
      {appendix && (
        <div className="bg-background border-border rounded-xl border p-5 shadow-[var(--surface-shadow)] sm:p-7">
          <ReportAppendix report={report} words={words} />
        </div>
      )}
    </div>
  );
}
