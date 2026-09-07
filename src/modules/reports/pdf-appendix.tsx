import { Text, View } from "@react-pdf/renderer";
import { diffDays, formatDateDa } from "@/core/dates";
import { ganttFigure, INK } from "./charts";
import { PdfFigure } from "./pdf-figure";
import { CONTENT_W, styles } from "./pdf-styles";
import { fullPlan, reportSections } from "./sections";
import type { StatusReport } from "./status-report";
import type { ReportWords } from "./words";

/** Page two onwards: the whole plan, every task, decisions and money lines. */

const COLS = [0.46, 0.2, 0.18, 0.16];

function Th({ words }: { words: ReportWords }) {
  return (
    <View style={styles.row} fixed>
      {[words.cols.task, words.cols.owner, words.cols.period, words.cols.state].map((label, i) => (
        <Text key={label} style={[styles.th, { width: CONTENT_W * COLS[i]! }]}>
          {label}
        </Text>
      ))}
    </View>
  );
}

export function PdfAppendix({ report, words }: { report: StatusReport; words: ReportWords }) {
  const sections = reportSections(report);
  const plan = fullPlan(report);
  const dot = (state: string, overdue: boolean) =>
    state === "done" ? INK.primary : overdue ? INK.clay : state === "doing" ? INK.soft : INK.paper;

  return (
    <>
      <View>
        <Text style={styles.eyebrow}>
          {words.eyebrowAppendix(words.week(report.weekKey), formatDateDa(report.today))}
        </Text>
        <Text style={styles.titleSmall}>{words.appendixTitle}</Text>
        <Text style={styles.meta}>{words.appendixIntro(report.projectName)}</Text>
      </View>

      {plan.rows.length > 0 && (
        <View style={[styles.section, { marginTop: 14 }]} wrap={false}>
          <Text style={styles.h2}>{words.timeline}</Text>
          <PdfFigure
            figure={ganttFigure(report, plan, Math.round(CONTENT_W * 1.2), words.gantt)}
            width={CONTENT_W}
          />
        </View>
      )}

      {report.tasks.length > 0 && (
        <View style={[styles.section, { marginTop: 14 }]}>
          <Text style={styles.h2}>{words.tasksTitle}</Text>
          <Th words={words} />
          {plan.rows.map((row, i) => {
            if (row.kind === "milestone") {
              return (
                <Text key={i} style={styles.tdMilestone} wrap={false}>
                  {row.milestone.title} · {formatDateDa(row.milestone.date)}
                  {row.milestone.ownerName ? ` · ${row.milestone.ownerName}` : ""}
                </Text>
              );
            }
            const t = row.task;
            const overdue = t.state !== "done" && t.end < report.today;
            return (
              <View key={i} style={styles.row} wrap={false}>
                <Text style={[styles.td, { width: CONTENT_W * COLS[0]! }]}>{t.title}</Text>
                <Text style={[styles.td, { width: CONTENT_W * COLS[1]! }]}>
                  {t.owner}
                  {t.participants > 0 ? ` +${t.participants}` : ""}
                </Text>
                <Text style={[styles.td, { width: CONTENT_W * COLS[2]! }]}>
                  {formatDateDa(t.start)} – {formatDateDa(t.end)}
                </Text>
                <View
                  style={[
                    styles.row,
                    styles.td,
                    { width: CONTENT_W * COLS[3]!, alignItems: "center" },
                  ]}
                >
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: dot(t.state, overdue),
                      marginRight: 4,
                    }}
                  />
                  <Text style={[styles.small, overdue ? { color: INK.warn } : {}]}>
                    {overdue ? words.late(diffDays(t.end, report.today)) : words.states[t.state]}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {sections.decisions && (
        <View style={[styles.section, { marginTop: 14 }]}>
          <Text style={styles.h2}>{words.decisions(report.decisionsSince)}</Text>
          {report.decisions.map((d, i) => (
            <View key={i} style={[styles.row, { marginBottom: 3 }]} wrap={false}>
              <Text style={[styles.small, { width: 52, fontWeight: 600 }]}>
                {formatDateDa(d.date)}
              </Text>
              <Text style={[styles.small, { flex: 1 }]}>
                {d.title}
                {d.note ? <Text style={{ color: INK.meta }}> · {d.note}</Text> : null}
              </Text>
            </View>
          ))}
        </View>
      )}

      {sections.economy && report.expenses.length > 0 && report.economy && (
        <View style={[styles.section, { marginTop: 14 }]}>
          <Text style={styles.h2}>{words.expensesTitle}</Text>
          <View style={styles.row} fixed>
            <Text style={[styles.th, { width: CONTENT_W * 0.56 }]}>{words.expenseCols.post}</Text>
            <Text style={[styles.th, { width: CONTENT_W * 0.22 }]}>
              {words.expenseCols.planned}
            </Text>
            <Text style={[styles.th, { width: CONTENT_W * 0.22 }]}>
              {words.expenseCols.incurred}
            </Text>
          </View>
          {report.expenses.map((e, i) => (
            <View key={i} style={styles.row} wrap={false}>
              <Text style={[styles.td, { width: CONTENT_W * 0.56 }]}>{e.title}</Text>
              <Text style={[styles.td, { width: CONTENT_W * 0.22 }]}>{words.money(e.amount)}</Text>
              <Text
                style={[
                  styles.td,
                  { width: CONTENT_W * 0.22 },
                  e.spent > 0 ? {} : { color: INK.meta },
                ]}
              >
                {e.spent > 0 ? words.money(e.spent) : words.expected}
                {e.spent > 0 && e.spent < e.amount ? (
                  <Text style={{ color: INK.meta }}> {words.ofAmount(words.money(e.amount))}</Text>
                ) : null}
              </Text>
            </View>
          ))}
          <View
            style={[styles.row, { borderTopWidth: 0.75, borderTopColor: INK.hairline }]}
            wrap={false}
          >
            <Text style={[styles.td, { width: CONTENT_W * 0.56, fontWeight: 600 }]}>
              {words.total}
            </Text>
            <Text style={[styles.td, { width: CONTENT_W * 0.22, fontWeight: 600 }]}>
              {words.money(report.economy.plannedTotal)}
            </Text>
            <Text style={[styles.td, { width: CONTENT_W * 0.22, fontWeight: 600 }]}>
              {words.money(report.economy.incurredTotal)}
              {report.economy.budget !== null ? (
                <Text style={{ color: INK.meta, fontWeight: 400 }}>
                  {"  "}
                  {words.budgetOf(words.money(report.economy.budget))}
                </Text>
              ) : null}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.footer} fixed>
        <Text>{words.madeWith(report.engine)}</Text>
        <Text
          render={({ pageNumber, totalPages }) =>
            `ajour.haij.dk · ${words.pageOf(pageNumber, totalPages)}`
          }
        />
      </View>
    </>
  );
}
