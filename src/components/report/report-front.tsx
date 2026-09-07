import { formatDateDa } from "@/core/dates";
import { economyFigure, ganttFigure, milestoneTrackFigure, INK } from "@/modules/reports/charts";
import { frontPlan, reportSections } from "@/modules/reports/sections";
import type { StatusReport } from "@/modules/reports/status-report";
import type { ReportWords } from "@/modules/reports/words";
import { FigureSvg } from "./figure-svg";
import { Bullets, RagBadge, ReportCard, SectionTitle, Trend } from "./report-bits";

/**
 * The front page: what a steering group reads in two minutes. The
 * assessment first, then what they are asked to do, then the manager's
 * own words; the numbers stand to the right, and the plan at the foot is
 * only what carries the next milestones. Which sections appear is decided
 * in src/modules/reports/sections, the same way every week.
 */
export function ReportFront({
  report,
  words,
  draft,
}: {
  report: StatusReport;
  words: ReportWords;
  draft: boolean;
}) {
  const sections = reportSections(report);
  const plan = frontPlan(report);
  const legend = [
    { colour: INK.soft, label: words.legend.doing },
    { colour: INK.clay, label: words.legend.late },
    { colour: INK.paper, label: words.legend.todo },
  ];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        {/* The title keeps at least half the row; the badge wraps under it
            before the two ever fight over the width. A long single word
            breaks rather than running under the badge. */}
        <div className="min-w-[min(100%,20rem)] flex-1 basis-1/2">
          <p className="text-label text-[11px] font-semibold tracking-[0.08em] uppercase">
            {words.eyebrow(words.week(report.weekKey), formatDateDa(report.today))}
          </p>
          <h2 className="mt-0.5 text-2xl font-semibold tracking-tight break-words hyphens-auto">
            {report.projectName}
          </h2>
          <p className="text-meta mt-0.5 text-[13px]">
            {words.roles(report.ownerName || "–", report.managerName || "–")}
            {report.goal && ` · ${words.goal(report.goal)}`}
          </p>
          <Trend report={report} words={words} />
        </div>
        <RagBadge report={report} words={words} />
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="flex flex-col gap-4">
          <section>
            <SectionTitle>{words.summary}</SectionTitle>
            <p className="text-[13.5px] leading-relaxed whitespace-pre-line">{report.text}</p>
          </section>

          {sections.asks && (
            <ReportCard>
              <SectionTitle>{words.asks}</SectionTitle>
              <ol className="space-y-2">
                {report.managementAsks.map((ask, i) => (
                  <li key={ask.id} className="flex gap-2.5 text-[13px] leading-snug">
                    <span
                      className="bg-success text-primary-foreground mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                    <div>
                      <span className={ask.answered ? "line-through opacity-70" : "font-medium"}>
                        {ask.text}
                      </span>
                      <span className="text-meta ml-1.5 text-xs">
                        {ask.dueDate && words.askDue(ask.dueDate)}
                      </span>
                      {ask.answered ? (
                        <span className="bg-success-tint text-success ml-1.5 rounded-full px-1.5 py-px text-[10px] font-semibold">
                          {words.askAnswered}
                        </span>
                      ) : (
                        ask.carriedFrom && (
                          <span className="bg-warning-tint text-warning ml-1.5 rounded-full px-1.5 py-px text-[10px] font-semibold">
                            {words.askOpenSince(ask.carriedFrom)}
                          </span>
                        )
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </ReportCard>
          )}

          {sections.comment && (
            <section>
              <SectionTitle>{words.comment}</SectionTitle>
              <div className="border-primary border-l-[3px] pl-3">
                <p className="text-[13.5px] leading-relaxed whitespace-pre-line">
                  {report.managerComment}
                </p>
                <p className="text-meta mt-1 text-xs">
                  {words.commentBy(report.managerName || report.approvedByName)}
                </p>
              </div>
            </section>
          )}

          {sections.nextWeek && (
            <section>
              <SectionTitle>{words.nextWeek}</SectionTitle>
              <Bullets lines={report.nextWeek} />
            </section>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {report.milestones.length > 0 && (
            <ReportCard>
              <SectionTitle>{words.milestones}</SectionTitle>
              <FigureSvg
                figure={milestoneTrackFigure(report, 320, words.track)}
                title={words.milestones}
              />
            </ReportCard>
          )}

          {(sections.economy || report.progress.total > 0) && (
            <ReportCard>
              <SectionTitle>{words.economy}</SectionTitle>
              <FigureSvg
                figure={economyFigure(report, 320, words.economyChart)}
                title={words.economy}
              />
            </ReportCard>
          )}

          <ReportCard>
            <SectionTitle>{words.sinceLast}</SectionTitle>
            {sections.sinceLast ? (
              <Bullets lines={report.sinceLast} />
            ) : (
              <p className="text-meta text-[13px]">{words.nothingSince}</p>
            )}
          </ReportCard>

          {sections.obstacles && (
            <ReportCard>
              <SectionTitle>{words.obstacles}</SectionTitle>
              <ul className="space-y-1 text-[13px] leading-snug">
                {report.obstacles.map((o, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-warning font-semibold">{words.obstacleOpen}</span>
                    <span>
                      {o.title} <span className="text-meta">· {words.obstacleSince(o.since)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </ReportCard>
          )}
        </div>
      </div>

      {plan.rows.length > 0 && (
        <section>
          <SectionTitle>{words.planNow}</SectionTitle>
          <FigureSvg figure={ganttFigure(report, plan, 700, words.gantt)} title={words.planNow} />
          <div className="text-meta mt-1.5 flex flex-wrap gap-4 text-[11px]">
            {legend.map((l) => (
              <span key={l.label} className="flex items-center gap-1.5">
                <i
                  className="inline-block h-2 w-3 rounded-[1px]"
                  style={{ background: l.colour }}
                />
                {l.label}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <i
                className="inline-block size-2 rotate-45 rounded-[1px]"
                style={{ background: INK.ink }}
              />
              {words.legend.milestone}
            </span>
            <span className="ml-auto">
              {plan.omitted > 0 ? words.planNote(plan.omitted) : words.planAll}
            </span>
          </div>
        </section>
      )}

      <footer className="border-border text-label flex flex-wrap justify-between gap-2 border-t pt-2 text-[11px]">
        <span>
          {draft
            ? words.draftFooter
            : words.approvedBy(report.approvedByName || report.managerName, report.today)}
          {" · "}
          {words.madeWith(report.engine)}
        </span>
        <span>ajour.haij.dk · {words.pageOf(1, 2)}</span>
      </footer>
    </div>
  );
}
