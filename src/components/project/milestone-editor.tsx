"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PEOPLE_LIST_ID } from "@/modules/projects/constants";
import type { MilestoneView } from "@/modules/projects/types";
import { ConfirmButton } from "./confirm-button";

/**
 * The form for one milestone. It owns its own draft, filled from the
 * milestone the moment it mounts, so it reads the same whether it was
 * opened from the list, the timeline or a link: the list used to fill
 * the fields only on its own click, and a diamond on the timeline opened
 * an empty form that refused to save.
 */
export function MilestoneEditor({
  milestone,
  onSave,
  onClose,
  onDelete,
}: {
  milestone: MilestoneView;
  onSave: (input: {
    milestoneId: string;
    title: string;
    date: string;
    owner: string;
    criterion: string;
    fixed: boolean;
    expectedUpdatedAt: string;
  }) => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("projects.milestones");
  const [draft, setDraft] = useState({
    title: milestone.title,
    date: milestone.date,
    owner: milestone.ownerName,
    criterion: milestone.criterion,
    fixed: milestone.fixed,
  });
  const ready = draft.title.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(draft.date);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return;
        onSave({
          milestoneId: milestone.id,
          title: draft.title.trim(),
          date: draft.date,
          owner: draft.owner.trim(),
          criterion: draft.criterion.trim(),
          fixed: draft.fixed,
          expectedUpdatedAt: milestone.updatedAt.toISOString(),
        });
      }}
      className="bg-secondary mt-2 space-y-2 rounded-lg p-3"
    >
      <div className="flex flex-wrap gap-2">
        <Input
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          placeholder={t("namePlaceholder")}
          aria-label={t("namePlaceholder")}
          className="min-w-52 flex-1"
        />
        <Input
          type="date"
          value={draft.date}
          onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
          aria-label={t("dateLabel")}
          aria-invalid={!draft.date}
        />
        <Input
          value={draft.owner}
          onChange={(e) => setDraft((d) => ({ ...d, owner: e.target.value }))}
          list={PEOPLE_LIST_ID}
          placeholder={t("ownerPlaceholder")}
          aria-label={t("ownerPlaceholder")}
          className="w-36"
        />
      </div>
      <Input
        value={draft.criterion}
        onChange={(e) => setDraft((d) => ({ ...d, criterion: e.target.value }))}
        placeholder={t("criterionPlaceholder")}
        aria-label={t("criterionPlaceholder")}
      />
      <label className="flex cursor-pointer items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={draft.fixed}
          onChange={(e) => setDraft((d) => ({ ...d, fixed: e.target.checked }))}
          className="mt-1"
        />
        <span>
          {t("fixed")}
          <span className="text-meta block text-xs">{t("fixedHint")}</span>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={!ready}>
          {t("save")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          {t("close")}
        </Button>
        <ConfirmButton
          className="ml-auto"
          label={t("delete")}
          question={t("deleteQuestion", { title: milestone.title })}
          onConfirm={() => {
            onClose();
            onDelete();
          }}
        />
      </div>
      <p className="text-meta text-xs">{ready ? t("dateNote") : t("needsTitleAndDate")}</p>
    </form>
  );
}
