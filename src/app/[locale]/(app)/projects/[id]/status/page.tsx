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

  return (
    <StatusFlow
      projectId={id}
      projectName={full.project.name}
      weekLabel={common("week", { number: weekNumberFromKey(week) })}
    />
  );
}
