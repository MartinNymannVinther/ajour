"use client";

import { useTranslations } from "next-intl";
import { formatDateDa } from "@/core/dates";
import { SECTION_IDS } from "@/modules/projects/constants";
import type { ProjectFull } from "@/modules/projects/types";
import { cn } from "@/lib/utils";

/**
 * The five numbers that decide whether a project is fine, each a shortcut
 * to the section it comes from. Nothing here is new information; it is the
 * page's own table of contents, which is why it opens the section rather
 * than duplicating it.
 */
export function OverviewTiles({
  full,
  formatMoney,
  weekLabel,
}: {
  full: ProjectFull;
  formatMoney: (amount: number) => string;
  weekLabel: (weekKey: string) => string;
}) {
  const t = useTranslations("projects.overview");
  const { project, tasks, milestones, obstacles, expenses, statusUpdates } = full;

  const doneCount = tasks.filter((task) => task.state === "done").length;
  const openObstacles = obstacles.filter((o) => o.status !== "resolved");
  const nextMilestone =
    [...milestones].filter((m) => !m.doneAt).sort((a, b) => a.date.localeCompare(b.date))[0] ??
    null;
  const latestStatus = statusUpdates.find((s) => s.approvedAt) ?? null;
  const plannedTotal = expenses.reduce((sum, e) => sum + e.amount, 0);

  const tiles = [
    {
      id: SECTION_IDS.tasks,
      label: t("tasks"),
      value: t("doneOf", { done: doneCount, total: tasks.length }),
      sub: t("finished"),
      bar: tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0,
    },
    {
      id: SECTION_IDS.milestones,
      label: t("nextMilestone"),
      value: nextMilestone ? formatDateDa(nextMilestone.date) : "–",
      sub: nextMilestone ? nextMilestone.title : t("noOpenMilestones"),
    },
    {
      id: SECTION_IDS.obstacles,
      label: t("obstacles"),
      value: String(openObstacles.length),
      sub: t("openCount", { count: openObstacles.length }),
      alert: openObstacles.length > 0,
    },
    {
      id: SECTION_IDS.economy,
      label: t("economy"),
      value:
        project.budget !== null
          ? `${Math.min(999, Math.round((plannedTotal / project.budget) * 100))} %`
          : "–",
      sub:
        project.budget !== null
          ? t("ofBudget", { amount: formatMoney(project.budget) })
          : t("noBudget"),
      alert: project.budget !== null && plannedTotal > project.budget,
    },
    {
      id: SECTION_IDS.statuses,
      label: t("latestStatus"),
      value: latestStatus ? weekLabel(latestStatus.weekKey) : "–",
      sub: latestStatus
        ? formatDateDa(latestStatus.approvedAt!.toISOString().slice(0, 10))
        : t("noneYet"),
    },
  ];

  const jumpTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el instanceof HTMLDetailsElement) el.open = true;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map((tile) => (
        <button
          key={tile.id}
          type="button"
          onClick={() => jumpTo(tile.id)}
          className={cn(
            "bg-card hover:border-primary/40 focus-visible:ring-ring rounded-xl border p-3 text-left transition focus-visible:ring-2 focus-visible:outline-none",
            tile.alert ? "border-destructive/40" : "border-border",
          )}
        >
          <p className="text-label text-[11px] font-semibold tracking-wide uppercase">
            {tile.label}
          </p>
          <p
            className={cn(
              "mt-0.5 truncate text-lg font-semibold",
              tile.alert && "text-destructive",
            )}
          >
            {tile.value}
          </p>
          <p className="text-meta truncate text-xs">{tile.sub}</p>
          {typeof tile.bar === "number" && (
            <div className="bg-muted mt-1.5 h-1 overflow-hidden rounded-full">
              <div className="bg-primary h-full rounded-full" style={{ width: `${tile.bar}%` }} />
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
