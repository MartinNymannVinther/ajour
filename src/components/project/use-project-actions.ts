"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { Result } from "@/modules/projects/types";

/**
 * Every write the project page makes, in one place. Each call reports the
 * outcome in words the person can act on: a conflict means somebody else
 * changed the row, which is not the same as an error, and the page
 * reloads so they see what it actually says now.
 *
 * It answers with whether the write landed, so a form can clear itself on
 * success and keep what was typed when it did not. Losing a sentence
 * somebody wrote because the network blinked is the kind of small
 * betrayal that makes a tool untrustworthy.
 */
export type Run = <T>(
  action: () => Promise<Result<T>>,
  onDone?: (data: T) => void,
) => Promise<boolean>;

export function useProjectActions(): { run: Run; pending: boolean } {
  const router = useRouter();
  const t = useTranslations("projects.errors");
  const [pending, startTransition] = useTransition();

  const run: Run = async (action, onDone) => {
    // A server action can reject rather than return: the network blinked,
    // the container restarted mid-deploy. Without this the promise
    // rejects into nothing — callers use `run` fire-and-forget — and the
    // person gets no toast at all, which is the exact failure the note
    // above says this file exists to prevent.
    let result: Awaited<ReturnType<typeof action>>;
    try {
      result = await action();
    } catch (error) {
      console.error("project action failed", error);
      toast.error(t("generic"));
      return false;
    }
    if (result.ok) {
      onDone?.(result.data);
      startTransition(() => router.refresh());
      return true;
    }
    if (result.error === "conflict") {
      toast.error(t("conflict"));
      startTransition(() => router.refresh());
      return false;
    }
    toast.error(t(result.error));
    return false;
  };

  return { run, pending };
}
