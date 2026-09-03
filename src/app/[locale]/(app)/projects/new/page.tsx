import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireOrgContext } from "@/core/auth/guard";
import { todayInCopenhagen } from "@/core/dates";
import { StartFlow } from "./start-flow";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("projects.start");
  return { title: t("title") };
}

/**
 * Start. The page itself is a shell: the flow is a conversation between a
 * person and the model, and none of it is written until the person says
 * yes to a plan they have read.
 */
export default async function NewProjectPage() {
  const context = await requireOrgContext();
  if (!context) redirect("/login");
  const locale = (await getLocale()) as "da" | "en";
  return <StartFlow today={todayInCopenhagen()} locale={locale} />;
}
