"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { Result } from "@/modules/projects/types";

/**
 * Every write the project page makes, in one place. Each call reports the
 * outcome in words the person can act on: a conflict means somebody else
 * changed the row, which is not the same as an error, and the page reloads
 * so they see what it actually says now.
 */
export function useProjectActions() {
  const router = useRouter();
  const t = useTranslations("projects.errors");
  const [pending, startTransition] = useTransition();

  const run = <T>(action: () => Promise<Result<T>>, onDone?: (data: T) => void) => {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        onDone?.(result.data);
        router.refresh();
        return;
      }
      if (result.error === "conflict") {
        toast.error(t("conflict"));
        router.refresh();
        return;
      }
      toast.error(t(result.error));
    });
  };

  return { run, pending };
}
