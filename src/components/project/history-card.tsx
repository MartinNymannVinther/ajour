"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { formatDateDa } from "@/core/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FUNCTION_ACCENT, SECTION_IDS } from "@/modules/projects/constants";
import { FunctionSection } from "./function-card";

/**
 * Copies of the plan. One is taken before every replan, every deletion
 * and every AI change, so nothing in the tool is a one-way door.
 */

export function HistoryCard({
  projectId,
  snapshots,
  onCreate,
}: {
  projectId: string;
  snapshots: Array<{ id: string; label: string; reason: string; createdAt: Date }>;
  onCreate: (label: string) => void;
}) {
  const t = useTranslations("projects.history");
  const [draft, setDraft] = useState("");
  return (
    <FunctionSection
      id={SECTION_IDS.history}
      accent={FUNCTION_ACCENT.history}
      title={t("title")}
      count={snapshots.length}
      defaultOpen={false}
    >
      <div className="bg-secondary space-y-2 rounded-lg p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onCreate(draft.trim() || t("defaultLabel"));
            setDraft("");
          }}
          className="flex gap-2"
        >
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("labelPlaceholder")}
            aria-label={t("labelPlaceholder")}
          />
          <Button type="submit" size="sm" className="shrink-0">
            {t("save")}
          </Button>
        </form>
        <ul className="space-y-1">
          {snapshots.length === 0 && <li className="text-meta text-sm">{t("empty")}</li>}
          {snapshots.map((snapshot) => (
            <li key={snapshot.id}>
              <Link
                href={`/projects/${projectId}/history/${snapshot.id}`}
                className="hover:bg-muted block rounded-lg px-2 py-1 text-sm"
              >
                {snapshot.label}
                <span className="text-meta text-xs">
                  {" "}
                  · {formatDateDa(snapshot.createdAt.toISOString().slice(0, 10))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </FunctionSection>
  );
}
