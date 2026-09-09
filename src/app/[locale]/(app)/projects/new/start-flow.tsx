"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Timeline } from "@/components/project/timeline";
import { MAX_DESCRIPTION_CHARS } from "@/modules/ai/limits";
import type { PlanProposal } from "@/modules/ai/types";
import {
  createProjectAction,
  proposePlanAction,
  proposeTemplateAction,
} from "@/modules/projects/actions-project";
import { PROJECT_TEMPLATES } from "@/modules/projects/templates";
import { ProposalEditor } from "./proposal-editor";
import { cn } from "@/lib/utils";

/**
 * Start: from nothing to a plan a person has approved. A template gives a
 * finished plan straight away; a description asks the model for one. In
 * both cases what is created is the proposal on screen, edited by hand —
 * the AI never creates a project on its own.
 */
export function StartFlow({ today, locale }: { today: string; locale: "da" | "en" }) {
  const t = useTranslations("projects.start");
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [proposal, setProposal] = useState<PlanProposal | null>(null);
  const [templateKey, setTemplateKey] = useState<string | null>(null);
  const [fallback, setFallback] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creating, startCreate] = useTransition();

  const applyTemplate = (id: string) => {
    void proposeTemplateAction(id)
      .catch((error) => {
        console.error("template proposal failed", error);
        return { ok: false, error: "generic" } as const;
      })
      .then((result) => {
        if (!result.ok) {
          toast.error(t("templateFailed"));
          return;
        }
        const template = PROJECT_TEMPLATES.find((x) => x.id === id);
        setTemplateKey(id);
        setProposal(result.data);
        setDescription(template ? template.description[locale] : "");
        setFallback(false);
      });
  };

  const generate = () => {
    if (description.trim().length < 10) return;
    setLoading(true);
    setProposal(null);
    void proposePlanAction(description)
      .catch((error) => {
        console.error("plan proposal failed", error);
        return { ok: false, error: "generic" } as const;
      })
      .then((result) => {
        if (!result.ok) {
          toast.error(result.error === "conflict" ? t("rateLimited") : t("proposalFailed"));
        } else {
          setProposal(result.data.proposal);
          setFallback(result.data.fallback);
          setTemplateKey(null);
        }
        setLoading(false);
      });
  };

  const create = () => {
    if (!proposal) return;
    startCreate(async () => {
      const result = await createProjectAction({ proposal, description, templateKey });
      if (!result.ok) {
        toast.error(t("createFailed"));
        return;
      }
      router.push(`/projects/${result.data}`);
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">{t("title")}</h1>
        <p className="text-meta mt-1 text-sm">{t("subtitle")}</p>
      </div>

      <section>
        <h2 className="text-label text-xs font-semibold tracking-wide uppercase">
          {t("templatesTitle")}
        </h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {PROJECT_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => applyTemplate(template.id)}
              className={cn(
                "focus-visible:ring-ring rounded-xl border p-3 text-left transition focus-visible:ring-2 focus-visible:outline-none",
                templateKey === template.id
                  ? "border-primary bg-accent"
                  : "border-border bg-card hover:border-primary/40",
              )}
            >
              <p className="text-sm font-semibold">{template.name[locale]}</p>
              <p className="text-meta mt-0.5 text-xs">{template.tagline[locale]}</p>
            </button>
          ))}
        </div>
        <p className="text-label mt-1.5 text-xs">{t("templatesHint")}</p>
      </section>

      <section className="border-border bg-card rounded-xl border p-4">
        <label
          htmlFor="description"
          className="text-label text-xs font-semibold tracking-wide uppercase"
        >
          {t("describeLabel")}
        </label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION_CHARS))}
          rows={6}
          placeholder={t("describePlaceholder")}
          className="mt-2 resize-y"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={generate}
            disabled={loading || description.trim().length < 10}
          >
            {loading ? t("proposing") : proposal ? t("proposeAgain") : t("propose")}
          </Button>
          {loading && <span className="text-meta animate-pulse text-sm">{t("modelWorking")}</span>}
        </div>
      </section>

      {proposal && (
        <ProposalEditor
          proposal={proposal}
          fallback={fallback}
          creating={creating}
          onChange={setProposal}
          onCreate={create}
          renderTimeline={(current, update) => (
            <Timeline
              today={today}
              editable
              milestones={current.milestones.map((m, i) => ({
                id: `m${i}`,
                title: m.title,
                date: m.date,
                doneAt: null,
              }))}
              tasks={current.tasks.map((task, i) => ({
                id: `t${i}`,
                title: task.title,
                ownerName: task.owner,
                state: "todo",
                startDate: task.startDate,
                endDate: task.endDate,
                milestoneId: task.milestoneIndex === null ? null : `m${task.milestoneIndex}`,
                participants: [],
              }))}
              onTaskMove={(id, newStart, newEnd) => {
                const index = Number(id.slice(1));
                update({
                  tasks: current.tasks.map((task, j) =>
                    j === index ? { ...task, startDate: newStart, endDate: newEnd } : task,
                  ),
                });
              }}
              onMilestoneMove={(id, newDate) => {
                const index = Number(id.slice(1));
                update({
                  milestones: current.milestones.map((m, j) =>
                    j === index ? { ...m, date: newDate } : m,
                  ),
                });
              }}
            />
          )}
        />
      )}
    </div>
  );
}
