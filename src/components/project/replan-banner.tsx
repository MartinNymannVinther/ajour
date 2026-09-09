"use client";

import { useTranslations } from "next-intl";
import { formatDateDa } from "@/core/dates";
import { Button } from "@/components/ui/button";
import type { ReplanProposal } from "@/modules/ai/types";

/**
 * Skred: a milestone was dragged, and this is what would follow. Nothing
 * has moved yet — the timeline shows the new date in amber and the plan
 * still holds the old one until a person says yes.
 */
export type PendingReplan = {
  milestone: { id: string; title: string; oldDate: string; newDate: string };
  proposal: ReplanProposal | null;
  loading: boolean;
  /** Push later milestones along; the person can switch it off and see the difference. */
  ripple: boolean;
};

export function ReplanBanner({
  pending,
  onApprove,
  onCancel,
  onRipple,
}: {
  pending: PendingReplan;
  onApprove: () => void;
  onCancel: () => void;
  onRipple: (ripple: boolean) => void;
}) {
  const t = useTranslations("projects.replan");
  const { milestone, proposal, loading, ripple } = pending;
  const later = milestone.newDate > milestone.oldDate;
  const nothingToMove =
    proposal && proposal.taskMoves.length === 0 && proposal.milestoneMoves.length === 0;

  return (
    <section className="border-chart-4 bg-warning-tint rounded-xl border p-4" aria-live="polite">
      <p className="text-sm font-semibold">
        {t("heading", {
          title: milestone.title,
          from: formatDateDa(milestone.oldDate),
          to: formatDateDa(milestone.newDate),
        })}
      </p>
      {loading ? (
        <p className="text-meta mt-2 animate-pulse text-sm">{t("thinking")}</p>
      ) : (
        proposal && (
          <div className="mt-2 space-y-2 text-sm">
            <p>{proposal.summary}</p>
            {nothingToMove ? (
              <p className="text-meta text-[13px]">{t("nothingElse")}</p>
            ) : (
              <ul className="space-y-0.5 text-[13px]">
                {proposal.taskMoves.map((move) => (
                  <li key={move.id}>
                    ·{" "}
                    {t("taskMove", {
                      title: move.title,
                      oldFrom: formatDateDa(move.oldStart),
                      oldTo: formatDateDa(move.oldEnd),
                      newFrom: formatDateDa(move.newStart),
                      newTo: formatDateDa(move.newEnd),
                    })}
                  </li>
                ))}
                {proposal.milestoneMoves.map((move) => (
                  <li key={move.id}>
                    ·{" "}
                    {t("milestoneMove", {
                      title: move.title,
                      from: formatDateDa(move.oldDate),
                      to: formatDateDa(move.newDate),
                    })}
                  </li>
                ))}
              </ul>
            )}
            {proposal.overloads.length > 0 && (
              <div className="border-destructive/40 bg-card rounded-lg border p-2 text-[13px]">
                <p className="text-destructive font-semibold">{t("overloadTitle")}</p>
                <ul>
                  {proposal.overloads.map((o, i) => (
                    <li key={i}>
                      ·{" "}
                      {t("overload", {
                        name: o.name,
                        count: o.count,
                        from: formatDateDa(o.from),
                        to: formatDateDa(o.to),
                      })}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {proposal.kept.length > 0 && (
              <details className="text-[13px]">
                <summary className="text-meta cursor-pointer">
                  {t("keptTitle")} ({proposal.kept.length})
                </summary>
                <ul className="mt-1 space-y-0.5">
                  {proposal.kept.map((k) => (
                    <li key={`${k.kind}-${k.id}`} className="text-meta">
                      · {t(`kept.${k.reason}`, { title: k.title })}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {later && (
              <label className="flex cursor-pointer items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={ripple}
                  onChange={(e) => onRipple(e.target.checked)}
                />
                {t("ripple")}
              </label>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="button" size="sm" onClick={onApprove}>
                {t("approve")}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={onCancel}>
                {t("cancel")}
              </Button>
            </div>
          </div>
        )
      )}
    </section>
  );
}
