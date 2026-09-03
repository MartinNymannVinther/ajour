import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireOrgContext } from "@/core/auth/guard";
import { organizations } from "@/core/db/schema";
import { withOrgContext } from "@/core/db/tenant";
import { PasskeyPrompt } from "./passkey-prompt";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app.projects");
  return { title: t("title") };
}

/**
 * The home of the app: every project in the active workspace. The domain
 * arrives with the next slice; until then the page shows where it will
 * live, through the same tenant-scoped path every real query takes.
 */
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

  return (
    <div className="flex flex-col gap-[26px]">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle", { workspace: workspace?.name ?? "" })}
      />
      <PasskeyPrompt />
      <EmptyState title={t("emptyTitle")} hint={t("emptyBody")} />
    </div>
  );
}
