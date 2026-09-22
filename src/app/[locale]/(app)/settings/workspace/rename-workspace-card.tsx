"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { renameWorkspaceAction } from "@/modules/export/actions";

/**
 * The workspace's name, editable in place. The page is refreshed after a
 * save so the sidebar lockup, which names the tenant on every screen,
 * shows the new name at once.
 */
export function RenameWorkspaceCard({ workspaceName }: { workspaceName: string }) {
  const t = useTranslations("settings.workspace.rename");
  const router = useRouter();
  const [name, setName] = useState(workspaceName);
  const [pending, startTransition] = useTransition();
  const trimmed = name.trim();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("body")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!trimmed || trimmed === workspaceName.trim()) return;
            startTransition(async () => {
              const result = await renameWorkspaceAction({ name: trimmed });
              if (!result.ok || result.data === "failed") {
                toast.error(t("failed"));
                return;
              }
              if (result.data === "notAllowed") {
                toast.error(t("notAllowed"));
                return;
              }
              toast.success(t("renamed", { name: trimmed }));
              router.refresh();
            });
          }}
          className="flex flex-wrap items-end gap-2"
        >
          <label htmlFor="workspace-name" className="sr-only">
            {t("label")}
          </label>
          <Input
            id="workspace-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            autoComplete="organization"
            className="min-w-56 flex-1"
          />
          <Button type="submit" disabled={pending || !trimmed || trimmed === workspaceName.trim()}>
            {pending ? t("saving") : t("action")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
