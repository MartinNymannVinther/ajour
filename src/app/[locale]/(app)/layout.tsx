import { eq } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { ownerAccessSummary } from "@/core/access/summary";
import { getOrgContext, getSession } from "@/core/auth/session";
import { organizations } from "@/core/db/schema";
import { withOrgContext } from "@/core/db/tenant";
import { redirect } from "@/i18n/navigation";
import { AppSidebar } from "./app-sidebar";
import { MobileHeader } from "./mobile-header";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const locale = await getLocale();
  if (!session) {
    redirect({ href: "/login", locale });
    return null;
  }
  if (!session.session.activeOrganizationId) {
    redirect({ href: "/onboarding", locale });
    return null;
  }

  // Named in the sidebar lockup, so the tenant is visible on every screen.
  const context = await getOrgContext();
  const [organization] = context
    ? await withOrgContext(context, (tx) =>
        tx
          .select({ name: organizations.name })
          .from(organizations)
          .where(eq(organizations.id, context.orgId))
          .limit(1),
      )
    : [];

  // The owner sees how many people are waiting at the door; nobody else
  // is told there is a door.
  const attention = (await ownerAccessSummary())?.pending ?? 0;
  const t = await getTranslations("app.nav");

  return (
    <div className="flex min-h-svh">
      {/* Tabbing into a page should not mean tabbing through the whole
          sidebar first, every time. */}
      <a
        href="#main"
        className="bg-card text-foreground focus:ring-ring sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:px-4 focus:py-2 focus:ring-2"
      >
        {t("skipToContent")}
      </a>
      <AppSidebar
        userName={session.user.name}
        userEmail={session.user.email}
        organization={organization?.name ?? ""}
        attention={attention}
      />
      <div className="border-border flex min-w-0 flex-1 flex-col lg:border-l">
        <MobileHeader
          userName={session.user.name}
          userEmail={session.user.email}
          organization={organization?.name ?? ""}
          attention={attention}
        />
        <main
          id="main"
          tabIndex={-1}
          className="@container mx-auto w-full max-w-6xl flex-1 px-5 py-6 sm:px-7 lg:px-8 lg:py-[30px]"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
