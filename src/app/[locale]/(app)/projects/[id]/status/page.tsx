import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireOrgContext } from "@/core/auth/guard";
import { todayInCopenhagen, weekKey, weekNumberFromKey } from "@/core/dates";
import { getProjectFull } from "@/modules/projects/read";
import { StatusFlow } from "./status-flow";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("status");
  return { title: t("metaTitle") };
}

export default async function StatusPage({ params }: Params) {
  const context = await requireOrgContext();
  if (!context) redirect("/login");
  const { id } = await params;
  const full = await getProjectFull(context, id);
  if (!full) notFound();
  const common = await getTranslations("common");
  const week = weekKey(todayInCopenhagen());
  // What the team said through the share link since the last approved
  // status: shown to the person before the words, and read by the engine.
  const since = full.statusUpdates.find((s) => s.approvedAt)?.approvedAt?.getTime() ?? 0;
  const replies = full.replies
    .filter((r) => r.createdAt.getTime() > since)
    .map((r) => ({ id: r.id, name: r.personName, about: r.about, text: r.text }));

  return (
    <StatusFlow
      projectId={id}
      projectName={full.project.name}
      weekLabel={common("week", { number: weekNumberFromKey(week) })}
      replies={replies}
    />
  );
}
