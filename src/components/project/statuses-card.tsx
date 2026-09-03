"use client";

import { useTranslations } from "next-intl";
import { formatDateDa } from "@/core/dates";
import type { StatusUpdate } from "@/core/db/schema";
import { FUNCTION_ACCENT, SECTION_IDS } from "@/modules/projects/constants";
import { FunctionSection } from "./function-card";

/**
 * The approved weekly statuses. Each one can be opened as a PDF, rendered
 * from the report frozen with it rather than from the plan as it stands
 * today.
 */

export function StatusesCard({
  projectId,
  statuses,
  weekLabel,
}: {
  projectId: string;
  statuses: StatusUpdate[];
  weekLabel: (weekKey: string) => string;
}) {
  const t = useTranslations("projects.statuses");
  const approved = statuses.filter((s) => s.approvedAt);
  return (
    <FunctionSection
      id={SECTION_IDS.statuses}
      accent={FUNCTION_ACCENT.statuses}
      title={t("title")}
      count={approved.length}
      defaultOpen={false}
    >
      <ul className="space-y-2">
        {approved.length === 0 && <li className="text-meta text-sm">{t("empty")}</li>}
        {approved.map((status) => (
          <li key={status.id} className="bg-secondary rounded-lg p-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{weekLabel(status.weekKey)}</p>
              <a
                href={`/api/projects/${projectId}/status/${status.id}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="border-input bg-card text-primary hover:bg-secondary ml-auto rounded-sm border px-2.5 py-1 text-xs font-medium"
              >
                {t("openPdf")}
              </a>
            </div>
            <p className="text-meta mt-0.5 line-clamp-3 text-xs">{status.text}</p>
            <p className="text-meta mt-1 text-xs">
              {formatDateDa(status.approvedAt!.toISOString().slice(0, 10))}
            </p>
          </li>
        ))}
      </ul>
    </FunctionSection>
  );
}
