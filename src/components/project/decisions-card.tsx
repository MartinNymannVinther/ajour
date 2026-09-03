"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatDateDa } from "@/core/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Decision } from "@/core/db/schema";
import { FUNCTION_ACCENT, SECTION_IDS } from "@/modules/projects/constants";
import { FunctionSection } from "./function-card";

/**
 * What was decided, and why. Two lines written down today save the same
 * argument from being had twice in three months.
 */

export function DecisionsCard({
  decisions,
  onAdd,
}: {
  decisions: Decision[];
  onAdd: (title: string, note: string) => Promise<boolean>;
}) {
  const t = useTranslations("projects.decisions");
  const [draft, setDraft] = useState({ title: "", note: "" });
  return (
    <FunctionSection
      id={SECTION_IDS.decisions}
      accent={FUNCTION_ACCENT.decisions}
      title={t("title")}
      count={decisions.length}
    >
      <ul className="space-y-2">
        {decisions.length === 0 && <li className="text-meta text-sm">{t("empty")}</li>}
        {decisions.map((decision) => (
          <li key={decision.id} className="bg-secondary rounded-lg p-3">
            <p className="text-sm font-medium">{decision.title}</p>
            {decision.note && <p className="text-meta mt-0.5 text-xs">{decision.note}</p>}
            <p className="text-meta mt-1 text-xs">
              {formatDateDa(decision.createdAt.toISOString().slice(0, 10))}
              {decision.source === "ai" ? ` · ${t("byAi")}` : ""}
            </p>
          </li>
        ))}
      </ul>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!draft.title.trim()) return;
          if (await onAdd(draft.title.trim(), draft.note.trim())) setDraft({ title: "", note: "" });
        }}
        className="mt-2 space-y-1.5"
      >
        <Input
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          placeholder={t("newPlaceholder")}
          aria-label={t("newPlaceholder")}
        />
        <div className="flex gap-2">
          <Input
            value={draft.note}
            onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
            placeholder={t("notePlaceholder")}
            aria-label={t("notePlaceholder")}
          />
          <Button type="submit" variant="outline" size="sm">
            {t("add")}
          </Button>
        </div>
        <p className="text-meta text-xs">{t("hint")}</p>
      </form>
    </FunctionSection>
  );
}
