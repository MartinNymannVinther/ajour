"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatDateDa } from "@/core/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FunctionCard } from "./function-card";
import { ConfirmButton } from "./confirm-button";
import { FUNCTION_ACCENT, PEOPLE_LIST_ID, SECTION_IDS } from "@/modules/projects/constants";
import type { MilestoneView } from "@/modules/projects/types";
import { cn } from "@/lib/utils";

/**
 * The milestones as a list, with the one thing a milestone is for: the
 * date, and what has to be true for it to count as reached. Changing the
 * date here does not move the tasks; dragging the diamond on the timeline
 * does, and asks first.
 */
export function MilestoneList({
  milestones,
  editingId,
  onEdit,
  onSave,
  onToggleDone,
  onDelete,
  onCreate,
}: {
  milestones: MilestoneView[];
  editingId: string | null;
  onEdit: (id: string | null) => void;
  onSave: (input: {
    milestoneId: string;
    title: string;
    date: string;
    owner: string;
    criterion: string;
    expectedUpdatedAt: string;
  }) => void;
  onToggleDone: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
  onCreate: (title: string, date: string) => void;
}) {
  const t = useTranslations("projects.milestones");
  const [draft, setDraft] = useState({ title: "", date: "", owner: "", criterion: "" });
  const [newDraft, setNewDraft] = useState({ title: "", date: "" });

  const openEditor = (m: MilestoneView) => {
    setDraft({ title: m.title, date: m.date, owner: m.ownerName, criterion: m.criterion });
    onEdit(m.id);
  };

  const sorted = [...milestones].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <FunctionCard
      id={SECTION_IDS.milestones}
      title={t("title")}
      count={milestones.length}
      accent={FUNCTION_ACCENT.plan}
    >
      <ul className="divide-hairline divide-y">
        {sorted.length === 0 && <li className="text-meta py-3 text-sm">{t("empty")}</li>}
        {sorted.map((m) => {
          const isEditing = editingId === m.id;
          const done = Boolean(m.doneAt);
          return (
            <li key={m.id} id={`milestone-${m.id}`} className="py-2.5">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onToggleDone(m.id, !done)}
                  aria-pressed={done}
                  className={cn(
                    "min-h-[28px] shrink-0 rounded-full border px-2.5 text-[11px] font-medium",
                    done
                      ? "border-success bg-success-tint text-success"
                      : "border-input bg-card text-meta",
                  )}
                >
                  {done ? t("reached") : t("open")}
                </button>
                <button
                  type="button"
                  onClick={() => (isEditing ? onEdit(null) : openEditor(m))}
                  className={cn(
                    "hover:text-primary min-w-0 truncate text-left text-sm font-medium",
                    done && "text-success",
                  )}
                >
                  ◆ {m.title}
                </button>
                <span className="text-meta ml-auto shrink-0 text-xs">
                  {m.ownerName && <span className="mr-2">{m.ownerName}</span>}
                  {formatDateDa(m.date)}
                </span>
              </div>
              {!isEditing && m.criterion && (
                <p className="text-meta mt-0.5 pl-1 text-xs">
                  {t("criterion", { text: m.criterion })}
                </p>
              )}
              {isEditing && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    onSave({
                      milestoneId: m.id,
                      title: draft.title.trim(),
                      date: draft.date,
                      owner: draft.owner.trim(),
                      criterion: draft.criterion.trim(),
                      expectedUpdatedAt: m.updatedAt.toISOString(),
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
                      className="w-auto"
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
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="submit" size="sm">
                      {t("save")}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(null)}>
                      {t("close")}
                    </Button>
                    <ConfirmButton
                      className="ml-auto"
                      label={t("delete")}
                      question={t("deleteQuestion", { title: m.title })}
                      onConfirm={() => {
                        onEdit(null);
                        onDelete(m.id);
                      }}
                    />
                  </div>
                  <p className="text-meta text-xs">{t("dateNote")}</p>
                </form>
              )}
            </li>
          );
        })}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!newDraft.title.trim() || !newDraft.date) return;
          onCreate(newDraft.title.trim(), newDraft.date);
          setNewDraft({ title: "", date: "" });
        }}
        className="border-hairline mt-3 flex flex-wrap gap-2 border-t pt-3"
      >
        <Input
          value={newDraft.title}
          onChange={(e) => setNewDraft((d) => ({ ...d, title: e.target.value }))}
          placeholder={t("newPlaceholder")}
          aria-label={t("newPlaceholder")}
          className="min-w-52 flex-1"
        />
        <Input
          type="date"
          value={newDraft.date}
          onChange={(e) => setNewDraft((d) => ({ ...d, date: e.target.value }))}
          aria-label={t("dateLabel")}
          className="w-auto"
        />
        <Button type="submit" variant="outline" size="sm">
          {t("add")}
        </Button>
      </form>
    </FunctionCard>
  );
}
