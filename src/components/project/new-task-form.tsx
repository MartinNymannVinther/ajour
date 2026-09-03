"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { addDaysIso } from "@/core/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PEOPLE_LIST_ID } from "@/modules/projects/constants";
import type { MilestoneView } from "@/modules/projects/types";

/**
 * One line for a new task: what, under which milestone, who and when. It
 * stays folded until asked for, so the plan is what the page is about.
 */
export function NewTaskForm({
  today,
  milestones,
  defaultMilestoneId = null,
  onCreate,
}: {
  today: string;
  milestones: MilestoneView[];
  defaultMilestoneId?: string | null;
  onCreate: (input: {
    title: string;
    milestoneId: string | null;
    owner: string;
    startDate: string;
    endDate: string;
  }) => Promise<boolean>;
}) {
  const t = useTranslations("projects.newTask");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => ({
    title: "",
    milestoneId: defaultMilestoneId ?? "",
    owner: "",
    startDate: today,
    endDate: addDaysIso(today, 7),
  }));

  if (!open) {
    return (
      <div className="border-hairline mt-3 border-t pt-3">
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          {t("open")}
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!draft.title.trim()) return;
        const done = await onCreate({
          title: draft.title.trim(),
          milestoneId: draft.milestoneId || null,
          owner: draft.owner.trim(),
          startDate: draft.startDate,
          endDate: draft.endDate,
        });
        if (!done) return;
        setDraft((d) => ({ ...d, title: "", owner: "" }));
        setOpen(false);
      }}
      className="border-hairline mt-3 space-y-2 border-t pt-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Input
          autoFocus
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          placeholder={t("titlePlaceholder")}
          aria-label={t("titlePlaceholder")}
          className="min-w-56 flex-1"
        />
        <select
          value={draft.milestoneId}
          onChange={(e) => setDraft((d) => ({ ...d, milestoneId: e.target.value }))}
          aria-label={t("milestoneLabel")}
          className="border-input bg-card focus-visible:ring-ring max-w-56 rounded-lg border px-2 py-2 text-sm outline-none focus-visible:ring-2"
        >
          <option value="">{t("noMilestone")}</option>
          {milestones.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={draft.owner}
          onChange={(e) => setDraft((d) => ({ ...d, owner: e.target.value }))}
          list={PEOPLE_LIST_ID}
          placeholder={t("ownerPlaceholder")}
          aria-label={t("ownerPlaceholder")}
          className="w-40"
        />
        <Input
          type="date"
          value={draft.startDate}
          onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))}
          aria-label={t("startLabel")}
          className="w-auto"
        />
        <span className="text-label text-xs">{t("to")}</span>
        <Input
          type="date"
          value={draft.endDate}
          onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value }))}
          aria-label={t("endLabel")}
          className="w-auto"
        />
        <Button type="submit" size="sm">
          {t("create")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          {t("close")}
        </Button>
      </div>
    </form>
  );
}
