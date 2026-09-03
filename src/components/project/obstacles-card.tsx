"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Obstacle } from "@/core/db/schema";
import { FUNCTION_ACCENT, SECTION_IDS } from "@/modules/projects/constants";
import { FunctionSection } from "./function-card";

/**
 * What is in the way. A list a person adds a line to the day they see the
 * problem, and one the AI may also write to from the chat.
 */

export function ObstaclesCard({
  obstacles,
  onAdd,
  onResolve,
}: {
  obstacles: Obstacle[];
  onAdd: (title: string) => Promise<boolean>;
  onResolve: (id: string) => void;
}) {
  const t = useTranslations("projects.obstacles");
  const [draft, setDraft] = useState("");
  const open = obstacles.filter((o) => o.status !== "resolved");
  return (
    <FunctionSection
      id={SECTION_IDS.obstacles}
      accent={FUNCTION_ACCENT.obstacles}
      title={t("title")}
      count={open.length}
      alert={open.length > 0}
    >
      <div className="space-y-2">
        {open.length === 0 && <p className="text-meta text-sm">{t("empty")}</p>}
        {open.map((obstacle) => (
          <div key={obstacle.id} className="bg-secondary rounded-lg p-3">
            <p className="text-sm">{obstacle.title}</p>
            <Button
              type="button"
              variant="link"
              size="xs"
              className="mt-1 px-0"
              onClick={() => onResolve(obstacle.id)}
            >
              {t("resolve")}
            </Button>
          </div>
        ))}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            if (await onAdd(draft.trim())) setDraft("");
          }}
          className="flex gap-2"
        >
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("newPlaceholder")}
            aria-label={t("newPlaceholder")}
          />
          <Button type="submit" variant="outline" size="sm">
            {t("add")}
          </Button>
        </form>
      </div>
    </FunctionSection>
  );
}
