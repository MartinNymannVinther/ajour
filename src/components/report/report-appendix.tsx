import { diffDays, formatDateDa } from "@/core/dates";
import { ganttFigure, INK } from "@/modules/reports/charts";
import { fullPlan, reportSections } from "@/modules/reports/sections";
import type { StatusReport } from "@/modules/reports/status-report";
import type { ReportWords } from "@/modules/reports/words";
import { FigureSvg } from "./figure-svg";
import { SectionTitle } from "./report-bits";
import { cn } from "@/lib/utils";

/**
 * The appendix: the whole plan, every task, the decisions and the money
 * lines, for the reader who wants to see under the assessment. It is
 * always attached; it costs nothing and saves the questions afterwards.
 */
export function ReportAppendix({ report, words }: { report: StatusReport; words: ReportWords }) {
  const sections = reportSections(report);
  const plan = fullPlan(report);
  const dot = (state: string, overdue: boolean) =>
    state === "done" ? INK.primary : overdue ? INK.clay : state === "doing" ? INK.soft : INK.paper;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="text-label text-[11px] font-semibold tracking-[0.08em] uppercase">
          {words.eyebrowAppendix(words.week(report.weekKey), formatDateDa(report.today))}
        </p>
        <h2 className="mt-0.5 text-xl font-semibold tracking-tight">{words.appendixTitle}</h2>
        <p className="text-meta mt-0.5 text-[13px]">{words.appendixIntro(report.projectName)}</p>
      </header>

      {plan.rows.length > 0 && (
        <section>
          <SectionTitle>{words.timeline}</SectionTitle>
          <FigureSvg figure={ganttFigure(report, plan, 700, words.gantt)} title={words.timeline} />
        </section>
      )}

      {report.tasks.length > 0 && (
        <section>
          <SectionTitle>{words.tasksTitle}</SectionTitle>
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="text-label text-left text-[10px] font-semibold tracking-[0.06em] uppercase">
                <th className="border-border border-b pb-1.5 pr-2">{words.cols.task}</th>
                <th className="border-border border-b pb-1.5 pr-2">{words.cols.owner}</th>
                <th className="border-border border-b pb-1.5 pr-2">{words.cols.period}</th>
                <th className="border-border border-b pb-1.5">{words.cols.state}</th>
              </tr>
            </thead>
            <tbody>
              {plan.rows.map((row, i) =>
                row.kind === "milestone" ? (
                  <tr key={i}>
                    <td
                      colSpan={4}
                      className="bg-accent text-accent-foreground rounded px-2 py-1.5 font-semibold"
                    >
                      {row.milestone.title} · {formatDateDa(row.milestone.date)}
                      {row.milestone.ownerName && ` · ${row.milestone.ownerName}`}
                    </td>
                  </tr>
                ) : (
                  <TaskRow key={i} task={row.task} today={report.today} words={words} dot={dot} />
                ),
              )}
            </tbody>
          </table>
        </section>
      )}

      {sections.decisions && (
        <section>
          <SectionTitle>{words.decisions(report.decisionsSince)}</SectionTitle>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12.5px]">
            {report.decisions.map((d, i) => (
              <div key={i} className="contents">
                <dt className="font-semibold">{formatDateDa(d.date)}</dt>
                <dd>
                  {d.title}
                  {d.note && <span className="text-meta"> · {d.note}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {sections.economy && report.expenses.length > 0 && (
        <section>
          <SectionTitle>{words.expensesTitle}</SectionTitle>
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="text-label text-left text-[10px] font-semibold tracking-[0.06em] uppercase">
                <th className="border-border border-b pb-1.5 pr-2">{words.expenseCols.post}</th>
                <th className="border-border border-b pb-1.5 pr-2">{words.expenseCols.planned}</th>
                <th className="border-border border-b pb-1.5">{words.expenseCols.incurred}</th>
              </tr>
            </thead>
            <tbody>
              {report.expenses.map((e, i) => (
                <tr key={i} className="border-hairline border-b">
                  <td className="py-1.5 pr-2">{e.title}</td>
                  <td className="py-1.5 pr-2 tabular-nums">{words.money(e.amount)}</td>
                  <td className="py-1.5 tabular-nums">
                    {e.incurred ? (
                      words.money(e.amount)
                    ) : (
                      <span className="text-meta">{words.expected}</span>
                    )}
                  </td>
                </tr>
              ))}
              {report.economy && (
                <tr className="border-border border-t font-semibold">
                  <td className="py-1.5 pr-2">{words.total}</td>
                  <td className="py-1.5 pr-2 tabular-nums">
                    {words.money(report.economy.plannedTotal)}
                  </td>
                  <td className="py-1.5 tabular-nums">
                    {words.money(report.economy.incurredTotal)}
                    {report.economy.budget !== null && (
                      <span className="text-meta ml-2 font-normal">
                        {words.budgetOf(words.money(report.economy.budget))}
                      </span>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      <footer className="border-border text-label flex flex-wrap justify-between gap-2 border-t pt-2 text-[11px]">
        <span>{words.madeWith(report.engine)}</span>
        <span>ajour.haij.dk · {words.pageOf(2, 2)}</span>
      </footer>
    </div>
  );
}

function TaskRow({
  task,
  today,
  words,
  dot,
}: {
  task: StatusReport["tasks"][number];
  today: string;
  words: ReportWords;
  dot: (state: string, overdue: boolean) => string;
}) {
  const overdue = task.state !== "done" && task.end < today;
  return (
    <tr className="border-hairline border-b">
      <td className="py-1.5 pr-2">{task.title}</td>
      <td className="py-1.5 pr-2">
        {task.owner}
        {task.participants > 0 && ` +${task.participants}`}
      </td>
      <td className="py-1.5 pr-2 tabular-nums whitespace-nowrap">
        {formatDateDa(task.start)} – {formatDateDa(task.end)}
      </td>
      <td className={cn("py-1.5 whitespace-nowrap", overdue && "text-warning")}>
        <i
          className="mr-1.5 inline-block size-2 rounded-full align-middle"
          style={{ background: dot(task.state, overdue) }}
        />
        {overdue ? words.late(diffDays(task.end, today)) : words.states[task.state]}
      </td>
    </tr>
  );
}
