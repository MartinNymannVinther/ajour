"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TaskProposal } from "@/modules/ai/types";
import {
  applyMilestoneTasksAction,
  proposeMilestoneTasksAction,
} from "@/modules/projects/actions-breakdown";
import { PEOPLE_LIST_ID } from "@/modules/projects/constants";

/**
 * The engine's breakdown of a milestone, as a list the person edits and
 * ticks. Nothing exists until "create" is pressed, and then a snapshot
 * exists first, so the whole set can be taken back from the history.
 */
export function BreakdownPanel({
  milestoneId,
  onClose,
  onApplied,
}: {
  milestoneId: string;
  onClose: () => void;
  onApplied: () => void;
}) {
  const t = useTranslations("projects.breakdown");
  // Null until the engine has answered; the panel is one request, one answer.
  const [proposal, setProposal] = useState<{
    rows: Array<TaskProposal & { keep: boolean }>;
    fallback: boolean;
  } | null>(null);
  const [applying, startApply] = useTransition();
  const rows = proposal?.rows ?? [];
  const loading = proposal === null;
  const fallback = proposal?.fallback ?? false;

  useEffect(() => {
    let cancelled = false;
    void proposeMilestoneTasksAction({ milestoneId })
      .catch((error) => {
        console.error("breakdown proposal failed", error);
        return { ok: false, error: "generic" } as const;
      })
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          toast.error(result.error === "conflict" ? t("rateLimited") : t("failed"));
          onClose();
          return;
        }
        setProposal({
          rows: result.data.tasks.map((task) => ({ ...task, keep: true })),
          fallback: result.data.fallback,
        });
      });
    return () => {
      cancelled = true;
    };
    // The milestone is the whole input; the callbacks are stable enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [milestoneId]);

  const update = (i: number, patch: Partial<TaskProposal & { keep: boolean }>) =>
    setProposal((p) =>
      p ? { ...p, rows: p.rows.map((row, j) => (j === i ? { ...row, ...patch } : row)) } : p,
    );

  const apply = () => {
    const tasks = rows.filter((r) => r.keep && r.title.trim());
    if (tasks.length === 0) return;
    startApply(async () => {
      const result = await applyMilestoneTasksAction({
        milestoneId,
        tasks: tasks.map((task) => ({
          title: task.title,
          owner: task.owner,
          startDate: task.startDate,
          endDate: task.endDate,
        })),
      });
      if (!result.ok) {
        toast.error(t("failed"));
        return;
      }
      toast.success(t("created", { count: tasks.length }));
      onApplied();
    });
  };

  return (
    <div className="border-primary/25 bg-accent/40 mt-2 rounded-lg border p-3" aria-live="polite">
      <div className="flex items-center gap-2">
        <Sparkles className="text-primary size-4" aria-hidden />
        <p className="text-sm font-semibold">{t("title")}</p>
      </div>
      {loading ? (
        <p className="text-meta mt-2 animate-pulse text-sm">{t("thinking")}</p>
      ) : (
        <>
          {fallback && <p className="text-warning mt-1 text-xs">{t("fallback")}</p>}
          <p className="text-meta mt-1 text-xs">{t("help")}</p>
          <ul className="mt-2 space-y-2">
            {rows.map((row, i) => (
              <li
                key={i}
                className="flex flex-wrap items-center gap-2 sm:grid sm:grid-cols-[auto_minmax(0,1fr)_7.5rem_8.6rem_8.6rem]"
              >
                <input
                  type="checkbox"
                  checked={row.keep}
                  onChange={(e) => update(i, { keep: e.target.checked })}
                  aria-label={t("keep", { title: row.title })}
                  className="accent-primary size-4"
                />
                <Input
                  value={row.title}
                  onChange={(e) => update(i, { title: e.target.value })}
                  aria-label={t("taskTitle", { n: i + 1 })}
                  className="h-9 min-w-0 flex-1 text-sm"
                />
                <Input
                  value={row.owner}
                  onChange={(e) => update(i, { owner: e.target.value })}
                  list={PEOPLE_LIST_ID}
                  placeholder={t("owner")}
                  aria-label={t("ownerFor", { n: i + 1 })}
                  className="h-9 w-full text-sm"
                />
                <Input
                  type="date"
                  value={row.startDate}
                  onChange={(e) => update(i, { startDate: e.target.value })}
                  aria-label={t("startFor", { n: i + 1 })}
                  className="h-9 w-full text-sm"
                />
                <Input
                  type="date"
                  value={row.endDate}
                  onChange={(e) => update(i, { endDate: e.target.value })}
                  aria-label={t("endFor", { n: i + 1 })}
                  className="h-9 w-full text-sm"
                />
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={apply}
              disabled={applying || rows.every((r) => !r.keep)}
            >
              {applying ? t("creating") : t("create", { count: rows.filter((r) => r.keep).length })}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              {t("close")}
            </Button>
            <p className="text-meta ml-auto text-xs">{t("undoNote")}</p>
          </div>
        </>
      )}
    </div>
  );
}
