import { eq } from "drizzle-orm";
import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireOrgContext } from "@/core/auth/guard";
import { formatDateDa } from "@/core/dates";
import { organizations } from "@/core/db/schema";
import { withOrgContext } from "@/core/db/tenant";
import { HEALTH_ORDER } from "@/modules/projects/health";
import { listProjects } from "@/modules/projects/read";
import { RAG_COLOR } from "@/modules/reports/charts";
import { PasskeyPrompt } from "./passkey-prompt";
import { healthLine } from "./health-line";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app.projects");
  return { title: t("title") };
}

/**
 * The home of the app: every project in the active workspace, the ones
 * that need attention first. Each card carries a colour worked out from
 * the plan today (health.ts) and the reasons behind it, then how far the
 * tasks have come and when the next milestone falls — the weekly round
 * for somebody with ten projects, without opening any of them.
 */
const toRag = (level: "red" | "yellow" | "green" | "new") => (level === "new" ? "early" : level);

export default async function ProjectsPage() {
  const t = await getTranslations("app.projects");
  const context = await requireOrgContext();
  const [workspace] = context
    ? await withOrgContext(context, (tx) =>
        tx
          .select({ name: organizations.name })
          .from(organizations)
          .where(eq(organizations.id, context.orgId))
          .limit(1),
      )
    : [];
  const projects = (context ? await listProjects(context) : []).sort(
    (a, b) => HEALTH_ORDER[a.health.level] - HEALTH_ORDER[b.health.level],
  );
  const health = await getTranslations("app.projects.health");

  return (
    <div className="flex flex-col gap-[26px]">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle", { workspace: workspace?.name ?? "" })}
        actions={
          <Link href="/projects/new" className={buttonVariants({ size: "sm" })}>
            {t("new")}
          </Link>
        }
      />
      <PasskeyPrompt />

      {projects.length === 0 ? (
        <EmptyState title={t("emptyTitle")} hint={t("emptyBody")} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const share = project.taskCount
              ? Math.round((project.doneCount / project.taskCount) * 100)
              : 0;
            return (
              <li key={project.id}>
                <Link
                  href={`/projects/${project.id}`}
                  className="border-border bg-card hover:border-primary/40 focus-visible:ring-ring block h-full rounded-xl border p-4 shadow-[var(--surface-shadow)] transition focus-visible:ring-2 focus-visible:outline-none"
                >
                  <div className="flex items-start gap-2">
                    <span
                      className="mt-1.5 inline-block size-3 shrink-0 rounded-full"
                      style={{ background: RAG_COLOR[toRag(project.health.level)].dot }}
                      role="img"
                      aria-label={health(`level.${project.health.level}`)}
                    />
                    <h2 className="font-heading min-w-0 flex-1 truncate text-base font-semibold">
                      {project.name}
                    </h2>
                  </div>
                  <p
                    className={
                      project.health.level === "red"
                        ? "text-destructive mt-1 text-xs font-medium"
                        : "text-meta mt-1 text-xs"
                    }
                  >
                    {healthLine(project.health, health)}
                  </p>
                  {project.goal && (
                    <p className="text-meta mt-1 line-clamp-2 text-sm">{project.goal}</p>
                  )}
                  <p className="text-meta mt-3 text-xs">
                    {t("progress", {
                      done: project.doneCount,
                      total: project.taskCount,
                    })}
                  </p>
                  <div className="bg-muted mt-1.5 h-1 overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full rounded-full"
                      style={{ width: `${share}%` }}
                    />
                  </div>
                  <p className="text-meta mt-2 text-xs">
                    {project.nextMilestone
                      ? t("nextMilestone", {
                          title: project.nextMilestone.title,
                          date: formatDateDa(project.nextMilestone.date),
                        })
                      : t("noOpenMilestones")}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
