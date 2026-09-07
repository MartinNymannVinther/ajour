"use client";

import { CheckCircle2, Loader2, PlugZap, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { testLlmAction, type LlmTestResult } from "./actions";

/**
 * The button that turns "configured" into "working". The failure detail
 * is shown verbatim rather than translated into a category, because the
 * useful sentence is the specific one: which model the environment asked
 * for, and which models the machine actually has.
 */
export function TestConnection() {
  const t = useTranslations("settings.ai");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<LlmTestResult | null>(null);

  const run = async () => {
    setPending(true);
    setResult(null);
    setResult(await testLlmAction());
    setPending(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button variant="outline" onClick={run} disabled={pending}>
          {pending ? (
            <Loader2 data-slot="icon" className="animate-spin" />
          ) : (
            <PlugZap data-slot="icon" />
          )}
          {pending ? t("testing") : t("test")}
        </Button>
      </div>

      {pending && <p className="text-meta text-sm">{t("testPatience")}</p>}

      <div aria-live="polite">
        {result?.status === "ok" && (
          <div className="border-success bg-success-tint flex items-start gap-2 rounded-lg border p-3 text-sm">
            <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">{t("testOk")}</p>
              <p className="text-meta">
                {t("testOkDetail", {
                  model: result.model,
                  sample: result.sample,
                  seconds: Math.max(1, Math.round(result.ms / 1000)),
                })}
              </p>
            </div>
          </div>
        )}

        {result?.status === "failed" && (
          <div className="border-destructive/40 flex items-start gap-2 rounded-lg border p-3 text-sm">
            <XCircle className="text-destructive mt-0.5 size-4 shrink-0" />
            <div className="min-w-0">
              <p className="font-medium">{t("testFailed")}</p>
              <p className="text-meta">
                {result.reason === "auth"
                  ? t("failAuth")
                  : result.reason === "unreachable"
                    ? t("failUnreachable")
                    : result.reason === "config"
                      ? t("failConfig")
                      : result.reason === "rate_limit"
                        ? t("failRateLimited")
                        : t("failGeneric")}
              </p>
              <p className="text-meta mt-1 font-mono text-xs break-words">{result.detail}</p>
            </div>
          </div>
        )}

        {result?.status === "none" && <p className="text-meta text-sm">{t("noModel")}</p>}
      </div>
    </div>
  );
}
