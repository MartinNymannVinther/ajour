import { and, eq } from "drizzle-orm";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Timeline } from "@/components/project/timeline";
import { requireOrgContext } from "@/core/auth/guard";
import { formatDateDa, todayInCopenhagen } from "@/core/dates";
import { snapshots } from "@/core/db/schema";
import { withOrgContext } from "@/core/db/tenant";
import { parseSnapshot } from "@/modules/projects/snapshots";
import { RestoreButton } from "./restore-button";

type Params = { params: Promise<{ id: string; snapshotId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("projects.history");
  return { title: t("title") };
}

/**
 * A copy of the plan as it stood, drawn on the same timeline as the live
 * one. Nothing here changes anything until the restore is pressed, and
 * that too takes a copy first, so a restore can be undone.
 */
export default async function SnapshotPage({ params }: Params) {
  const context = await requireOrgContext();
  if (!context) redirect("/login");
  const { id, snapshotId } = await params;
  const t = await getTranslations("projects.history");

  const row = await withOrgContext(context, async (tx) => {
    const [found] = await tx
      .select()
      .from(snapshots)
      .where(and(eq(snapshots.id, snapshotId), eq(snapshots.projectId, id)))
      .limit(1);
    return found ?? null;
  });
  if (!row) notFound();
  const data = parseSnapshot(row.data);
  if (!data) notFound();

  const names = new Map(data.people.map((person) => [person.id, person.name]));

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/projects/${id}`} className="text-meta hover:text-foreground text-sm">
          ← {t("back", { name: data.project.name })}
        </Link>
        <h1 className="font-heading mt-1 text-2xl font-semibold">{row.label}</h1>
        <p className="text-meta mt-1 text-sm">
          {t("takenOn", { date: formatDateDa(row.createdAt.toISOString().slice(0, 10)) })}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <RestoreButton projectId={id} snapshotId={snapshotId} />
          <span className="text-meta text-xs">{t("restoreNote")}</span>
        </div>
      </div>
      <Timeline
        today={todayInCopenhagen()}
        milestones={data.milestones.map((m) => ({
          id: m.id,
          title: m.title,
          date: m.date,
          doneAt: m.doneAt ? new Date(m.doneAt) : null,
        }))}
        tasks={data.tasks.map((task) => ({
          id: task.id,
          title: task.title,
          ownerName: task.ownerPersonId ? (names.get(task.ownerPersonId) ?? "") : "",
          state: task.state,
          startDate: task.startDate,
          endDate: task.endDate,
          milestoneId: task.milestoneId,
          participants: task.participantIds.map((pid) => names.get(pid) ?? "").filter(Boolean),
        }))}
      />
    </div>
  );
}
