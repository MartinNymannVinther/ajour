"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { PlanProposal } from "@/modules/ai/types";

/**
 * The proposal before it is a project: every field editable, the timeline
 * live underneath. This is where "the AI proposes, the human decides"
 * stops being a slogan and becomes a screen.
 */
export function ProposalEditor({
  proposal,
  fallback,
  creating,
  onChange,
  onCreate,
  renderTimeline,
}: {
  proposal: PlanProposal;
  fallback: boolean;
  creating: boolean;
  onChange: (proposal: PlanProposal) => void;
  onCreate: () => void;
  renderTimeline: (
    proposal: PlanProposal,
    update: (patch: Partial<PlanProposal>) => void,
  ) => ReactNode;
}) {
  const t = useTranslations("projects.start");
  const update = (patch: Partial<PlanProposal>) => onChange({ ...proposal, ...patch });

  return (
    <div className="space-y-4 pb-8">
      {fallback && (
        <div className="border-chart-4 bg-warning-tint rounded-xl border p-3 text-sm">
          {t("fallbackNote")}
        </div>
      )}

      <section className="border-border bg-card space-y-4 rounded-xl border p-4">
        <div>
          <label
            htmlFor="plan-name"
            className="text-label text-xs font-semibold tracking-wide uppercase"
          >
            {t("nameLabel")}
          </label>
          <Input
            id="plan-name"
            value={proposal.name}
            onChange={(e) => update({ name: e.target.value })}
            className="mt-1 font-medium"
          />
        </div>
        <div>
          <label
            htmlFor="plan-goal"
            className="text-label text-xs font-semibold tracking-wide uppercase"
          >
            {t("goalLabel")}
          </label>
          <Textarea
            id="plan-goal"
            value={proposal.goal}
            onChange={(e) => update({ goal: e.target.value })}
            rows={2}
            className="mt-1"
          />
        </div>
        <div>
          <label
            htmlFor="plan-budget"
            className="text-label text-xs font-semibold tracking-wide uppercase"
          >
            {t("budgetLabel")}
          </label>
          <Input
            id="plan-budget"
            value={proposal.budget?.toString() ?? ""}
            onChange={(e) => {
              const raw = e.target.value.replace(/[.\s]/g, "");
              update({ budget: raw === "" ? null : Number(raw) || null });
            }}
            inputMode="numeric"
            placeholder={t("budgetPlaceholder")}
            className="mt-1 w-48"
          />
        </div>
      </section>

      <section className="border-border bg-card rounded-xl border p-4">
        <h2 className="text-label text-xs font-semibold tracking-wide uppercase">
          {t("milestonesLabel")}
        </h2>
        <div className="mt-2 space-y-2">
          {proposal.milestones.map((milestone, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={milestone.title}
                aria-label={t("milestoneTitle", { number: i + 1 })}
                onChange={(e) =>
                  update({
                    milestones: proposal.milestones.map((x, j) =>
                      j === i ? { ...x, title: e.target.value } : x,
                    ),
                  })
                }
              />
              <Input
                type="date"
                value={milestone.date}
                aria-label={t("milestoneDate", { number: i + 1 })}
                onChange={(e) =>
                  update({
                    milestones: proposal.milestones.map((x, j) =>
                      j === i ? { ...x, date: e.target.value } : x,
                    ),
                  })
                }
              />
            </div>
          ))}
        </div>
      </section>

      <section className="border-border bg-card rounded-xl border p-4">
        <h2 className="text-label text-xs font-semibold tracking-wide uppercase">
          {t("tasksLabel")}
        </h2>
        <div className="mt-2 space-y-2">
          {proposal.tasks.map((task, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <Input
                value={task.title}
                aria-label={t("taskTitle", { number: i + 1 })}
                onChange={(e) =>
                  update({
                    tasks: proposal.tasks.map((x, j) =>
                      j === i ? { ...x, title: e.target.value } : x,
                    ),
                  })
                }
                className="min-w-40 flex-1"
              />
              <Input
                value={task.owner}
                placeholder={t("owner")}
                aria-label={t("taskOwner", { number: i + 1 })}
                onChange={(e) =>
                  update({
                    tasks: proposal.tasks.map((x, j) =>
                      j === i ? { ...x, owner: e.target.value } : x,
                    ),
                  })
                }
                className="w-28"
              />
              <Input
                type="date"
                value={task.startDate}
                aria-label={t("taskStart", { number: i + 1 })}
                onChange={(e) =>
                  update({
                    tasks: proposal.tasks.map((x, j) =>
                      j === i ? { ...x, startDate: e.target.value } : x,
                    ),
                  })
                }
              />
              <Input
                type="date"
                value={task.endDate}
                aria-label={t("taskEnd", { number: i + 1 })}
                onChange={(e) =>
                  update({
                    tasks: proposal.tasks.map((x, j) =>
                      j === i ? { ...x, endDate: e.target.value } : x,
                    ),
                  })
                }
              />
              <Button
                type="button"
                variant="destructive"
                size="icon-sm"
                aria-label={t("removeTask", { title: task.title })}
                onClick={() => update({ tasks: proposal.tasks.filter((_, j) => j !== i) })}
              >
                ✕
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="border-border bg-card rounded-xl border p-4">
        <h2 className="text-label mb-2 text-xs font-semibold tracking-wide uppercase">
          {t("previewLabel")}
        </h2>
        {renderTimeline(proposal, update)}
        <p className="text-label mt-2 text-xs">{t("previewHint")}</p>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="lg" onClick={onCreate} disabled={creating}>
          {creating ? t("creating") : t("approve")}
        </Button>
        <span className="text-label text-xs">{t("changeableLater")}</span>
      </div>
    </div>
  );
}
