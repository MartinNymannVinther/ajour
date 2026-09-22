import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getOrgContext } from "@/core/auth/session";
import { formatDateDa } from "@/core/dates";
import { organizations } from "@/core/db/schema";
import { withOrgContext } from "@/core/db/tenant";
import { redirect } from "@/i18n/navigation";
import { currentRole, listMembers } from "@/modules/export/workspace";
import { DeleteWorkspaceCard } from "./delete-workspace-card";
import { RenameWorkspaceCard } from "./rename-workspace-card";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.workspace");
  return { title: t("title") };
}

/**
 * The workspace itself: who is in it, and the way out. Deletion lives at
 * the bottom, behind the workspace's own name typed by hand, because it
 * takes everything — the projects, the statuses, and the audit rows about
 * them. Dogma three says leaving must be possible; it does not say it
 * should be easy to do by accident.
 */
export default async function WorkspaceSettingsPage() {
  const context = await getOrgContext();
  if (!context) {
    redirect({ href: "/login", locale: await getLocale() });
    return null;
  }

  const t = await getTranslations("settings.workspace");
  const [workspace] = await withOrgContext(context, (tx) =>
    tx
      .select({ name: organizations.name, createdAt: organizations.createdAt })
      .from(organizations)
      .where(eq(organizations.id, context.orgId))
      .limit(1),
  );
  const members = await listMembers(context);
  const role = await currentRole(context);

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-base font-semibold">{t("title")}</h2>
        <p className="text-meta text-[0.78rem] leading-relaxed">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{workspace?.name ?? ""}</CardTitle>
          <CardDescription>
            {workspace
              ? t("createdOn", {
                  date: formatDateDa(workspace.createdAt.toISOString().slice(0, 10)),
                })
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("email")}</TableHead>
                <TableHead>{t("role")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.userId}>
                  <TableCell>{member.name}</TableCell>
                  <TableCell className="text-meta">{member.email}</TableCell>
                  <TableCell>{t(`roles.${member.role}`)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {(role === "owner" || role === "admin") && workspace && (
        <RenameWorkspaceCard workspaceName={workspace.name} />
      )}
      {role === "owner" && workspace && <DeleteWorkspaceCard workspaceName={workspace.name} />}
    </div>
  );
}
