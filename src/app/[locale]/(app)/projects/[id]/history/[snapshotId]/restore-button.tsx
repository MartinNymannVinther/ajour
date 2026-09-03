"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/project/confirm-button";
import { restoreSnapshotAction } from "@/modules/projects/actions-project";

/**
 * Restoring is not destructive, but it is surprising, so it asks. What it
 * puts back is only what the copy knows about: rows made since are left
 * where they are, and a copy of the current plan is taken first.
 */
export function RestoreButton({
  projectId,
  snapshotId,
}: {
  projectId: string;
  snapshotId: string;
}) {
  const t = useTranslations("projects.history");
  const router = useRouter();
  const [, startTransition] = useTransition();

  return (
    <ConfirmButton
      label={t("restore")}
      question={t("restoreQuestion")}
      detail={t("restoreNote")}
      confirmLabel={t("restore")}
      onConfirm={() =>
        startTransition(async () => {
          const result = await restoreSnapshotAction({ projectId, snapshotId });
          if (!result.ok) {
            toast.error(t("restoreFailed"));
            return;
          }
          router.push(`/projects/${projectId}`);
        })
      }
    />
  );
}
