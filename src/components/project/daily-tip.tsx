"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { dailyTipAction, dismissTipAction, sendChatAction } from "@/modules/ai/actions";
import type { DailyTip as TipData } from "@/modules/ai/tips";
import { renderEvent } from "@/modules/projects/events";
import type { AppliedLine } from "@/modules/ai/apply";
import { cn } from "@/lib/utils";

/**
 * One stripe under the overview: the AI has read the whole project and
 * points at a single thing worth doing today. The tip is cached per day,
 * so opening the page does not cost a model call; "look again" does.
 */
export function DailyTip({ projectId }: { projectId: string }) {
  const t = useTranslations("tip");
  const eventText = useTranslations("events");
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [tip, setTip] = useState<TipData | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState<{
    lines: AppliedLine[];
    snapshotId: string | null;
    reply: string;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    dailyTipAction({ projectId })
      .then((result) => alive && setTip(result.ok ? result.data : null))
      .catch(() => alive && setTip(null));
    return () => {
      alive = false;
    };
  }, [projectId]);

  if (tip === null || (tip && tip.dismissed)) return null;

  const reload = () => {
    setTip(undefined);
    setApplied(null);
    dailyTipAction({ projectId, force: true })
      .then((result) => setTip(result.ok ? result.data : null))
      .catch(() => setTip(null));
  };

  const run = () => {
    if (!tip?.action || busy) return;
    setBusy(true);
    void (async () => {
      const result = await sendChatAction({ projectId, message: tip.action! });
      if (result.ok) {
        setApplied({
          lines: result.data.applied?.lines ?? [],
          snapshotId: result.data.applied?.snapshotId ?? null,
          reply: result.data.reply,
        });
        router.refresh();
      }
      setBusy(false);
    })();
  };

  const dismiss = () => {
    if (!tip) return;
    setTip({ ...tip, dismissed: true });
    startTransition(async () => {
      await dismissTipAction({ tipId: tip.id, projectId });
    });
  };

  return (
    <section className="border-chart-4/40 bg-warning-tint/70 flex flex-wrap items-start gap-3 rounded-xl border px-4 py-3 shadow-[var(--surface-shadow)]">
      <span
        className="bg-chart-4 text-primary-foreground mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
        aria-hidden
      >
        !
      </span>
      <div className="min-w-0 flex-1" aria-live="polite">
        <p className="text-warning text-[11px] font-semibold tracking-wide uppercase">
          {t("label")}
        </p>
        {tip === undefined ? (
          <p className="text-meta mt-0.5 animate-pulse text-sm">{t("loading")}</p>
        ) : (
          <>
            <p className="mt-0.5 text-sm font-semibold">{tip.title}</p>
            <p className="mt-0.5 text-sm">{tip.text}</p>
            {/* What the button will do, in words, before it is pressed. A
                button that acts on the project must say what it acts on;
                the tooltip alone is not saying it. */}
            {tip.action && !applied && (
              <p className="text-meta mt-1.5 text-[13px]">
                <span className="font-semibold">{t("runExplainer")}</span> „{tip.action}“
                <span className="text-label"> · {t("runNote")}</span>
              </p>
            )}
            {applied && (
              <div className="border-success bg-success-tint text-success mt-2 rounded-lg border p-2.5 text-[13px]">
                <p className="font-semibold">
                  {applied.lines.length > 0 ? t("applied") : t("answer")}
                </p>
                {applied.lines.length > 0 ? (
                  <ul className="mt-0.5 space-y-0.5">
                    {applied.lines.map((line, i) => (
                      <li key={i}>· {renderEvent(eventText, line)}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-0.5">{applied.reply}</p>
                )}
                <p className="mt-1 text-xs">{t("undoHint")}</p>
              </div>
            )}
            {tip.fallback && <p className="text-warning mt-1 text-[11px]">{t("fallback")}</p>}
          </>
        )}
      </div>
      {tip && (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {tip.action && !applied && (
            <Button type="button" size="xs" onClick={run} disabled={busy} title={tip.action}>
              {busy ? t("running") : t("run")}
            </Button>
          )}
          <Button type="button" variant="outline" size="xs" onClick={reload}>
            {t("again")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={dismiss}
            className={cn("text-meta")}
          >
            {t("dismiss")}
          </Button>
        </div>
      )}
    </section>
  );
}
