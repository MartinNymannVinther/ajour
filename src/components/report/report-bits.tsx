import { RAG_COLOR } from "@/modules/reports/charts";
import type { Rag, StatusReport } from "@/modules/reports/status-report";
import type { ReportWords } from "@/modules/reports/words";
import { cn } from "@/lib/utils";

/** The small parts the front page is built from. */

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-label mb-1.5 text-[11px] font-semibold tracking-[0.08em] uppercase">
      {children}
    </h3>
  );
}

export function ReportCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("bg-card border-border rounded-[10px] border px-4 py-3.5", className)}>
      {children}
    </section>
  );
}

export function RagBadge({ report, words }: { report: StatusReport; words: ReportWords }) {
  const rag: Rag = report.rag ?? "early";
  const colour = RAG_COLOR[rag];
  const overridden = report.ragSuggested && report.ragSuggested !== report.rag;
  return (
    <div
      // Bounded on both sides: wide enough to read, never so wide that it
      // pushes the title into a sliver next to it. Below that it takes a
      // full row of its own.
      className="w-full rounded-[10px] border px-4 py-3 sm:w-auto sm:max-w-[380px] sm:min-w-[260px]"
      style={{ background: colour.tint, borderColor: colour.edge }}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="inline-block size-4 shrink-0 rounded-full"
          style={{ background: colour.dot }}
          aria-hidden
        />
        <span className="text-base font-semibold">{words.rag(report.rag)}</span>
      </div>
      {report.ragReason && <p className="mt-1.5 text-[13px] leading-snug">{report.ragReason}</p>}
      {report.rag && report.approvedByName && (
        <p className="text-meta mt-1 text-xs">
          {overridden
            ? words.suggestedOverridden(
                words.ragShort(report.ragSuggested!),
                words.ragShort(report.rag),
                report.approvedByName,
              )
            : words.suggestedConfirmed(report.approvedByName)}
        </p>
      )}
    </div>
  );
}

export function Trend({ report, words }: { report: StatusReport; words: ReportWords }) {
  if (report.trend.length < 2) return null;
  const first = report.trend[0]!;
  const last = report.trend[report.trend.length - 1]!;
  // A row of coloured dots and nothing else is a row of nothing to
  // somebody who cannot see it: `title` on a plain span is not reliably
  // read aloud and does not exist at all on a touch screen. The same
  // widget in statuses-card.tsx has always named each dot; this one
  // matches it now, and the list roles keep the sequence audible as a
  // sequence rather than as loose words.
  return (
    <div className="mt-2 flex items-center gap-1.5">
      <span role="list" className="flex items-center gap-1.5">
        {report.trend.map((point, i) => (
          <span
            key={point.weekKey + i}
            role="listitem"
            aria-label={`${words.week(point.weekKey)}: ${words.rag(point.rag)}`}
            title={`${words.week(point.weekKey)}: ${words.rag(point.rag)}`}
            className={cn(
              "inline-block size-2.5 rounded-full",
              i === report.trend.length - 1 && "ring-foreground ring-1 ring-offset-1",
            )}
            style={{ background: RAG_COLOR[point.rag ?? "early"].dot }}
          />
        ))}
      </span>
      <span className="text-meta ml-1 text-[11px]">
        {words.trend(words.week(first.weekKey), words.week(last.weekKey))}
      </span>
    </div>
  );
}

export function Bullets({ lines }: { lines: string[] }) {
  return (
    <ul className="space-y-1 text-[13px] leading-snug">
      {lines.map((line, i) => (
        <li key={i} className="flex gap-2">
          <span className="text-primary font-bold" aria-hidden>
            ·
          </span>
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}
