import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { addDaysIso, diffDays, formatDateDa, maxIso, minIso } from "@/core/dates";
import type { StatusReport } from "./status-report";

/**
 * The week's status as a document that can be sent on: the approved text,
 * the plan as it stood that day, and what was decided and what stands in
 * the way. It renders from the frozen report, so a status reads next year
 * exactly as it did the day it was approved.
 *
 * Rendered on demand rather than written to disk: nothing to back up,
 * nothing to leak, and a workspace that is deleted takes its PDFs with it
 * because they never existed as files.
 */

const COLORS = {
  ink: "#24221e",
  meta: "#8a8479",
  hairline: "#eae5dc",
  accent: "#4a6b53",
  done: "#e4ebe4",
  doneInk: "#31513c",
  warn: "#8c5b3e",
  warnTint: "#f6e8e0",
  soft: "#f0ece5",
};

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 9, color: COLORS.ink },
  title: { fontSize: 16, marginBottom: 4 },
  meta: { fontSize: 9, color: COLORS.meta, marginBottom: 14 },
  heading: { fontSize: 11, marginTop: 16, marginBottom: 6 },
  body: { fontSize: 10, lineHeight: 1.5 },
  row: {
    flexDirection: "row",
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.hairline,
  },
  colWide: { width: "58%" },
  colMid: { width: "24%" },
  colNarrow: { width: "18%", textAlign: "right" },
  chart: { marginTop: 6, borderWidth: 0.5, borderColor: COLORS.hairline, padding: 6 },
  chartRow: { height: 12, marginBottom: 2, position: "relative" },
  bar: { position: "absolute", height: 9, borderRadius: 2, top: 1 },
  barLabel: { fontSize: 7, paddingLeft: 2, paddingTop: 1 },
  milestoneLine: { position: "absolute", top: 0, bottom: 0, width: 1, backgroundColor: COLORS.ink },
  groupHeading: { fontSize: 9, marginTop: 6, marginBottom: 2, color: COLORS.accent },
  note: { fontSize: 8, color: COLORS.meta, marginTop: 8 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 8,
    color: COLORS.meta,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.hairline,
    paddingTop: 6,
  },
});

export type PdfWords = {
  statusFor: (week: string) => string;
  goal: string;
  owner: string;
  manager: string;
  plan: string;
  milestones: string;
  tasks: string;
  obstacles: string;
  decisions: string;
  decisionsSince: (week: string) => string;
  economy: string;
  economyLine: (planned: string, incurred: string, budget: string) => string;
  overBudget: string;
  reached: string;
  open: string;
  criterion: string;
  otherTasks: string;
  none: string;
  since: (date: string) => string;
  states: Record<string, string>;
  madeWith: string;
};

/** The plan as one strip of bars, scaled to the report's own date range. */
function PlanChart({ report }: { report: StatusReport }) {
  const dates = [
    report.today,
    ...report.milestones.map((m) => m.date),
    ...report.tasks.flatMap((task) => [task.start, task.end]),
  ];
  if (dates.length < 2) return null;
  const start = addDaysIso(minIso(dates), -3);
  const end = addDaysIso(maxIso(dates), 3);
  const span = Math.max(1, diffDays(start, end));
  const percent = (iso: string) => (diffDays(start, iso) / span) * 100;

  return (
    <View style={styles.chart}>
      {report.tasks.map((task, i) => {
        const left = percent(task.start);
        const width = Math.max(1.5, percent(task.end) - left);
        const overdue = task.state !== "done" && task.end < report.today;
        return (
          <View key={i} style={styles.chartRow}>
            <View
              style={[
                styles.bar,
                {
                  left: `${left}%`,
                  width: `${width}%`,
                  backgroundColor: overdue
                    ? COLORS.warnTint
                    : task.state === "done"
                      ? COLORS.done
                      : COLORS.soft,
                },
              ]}
            />
            <Text style={[styles.barLabel, { paddingLeft: `${Math.min(left, 70)}%` }]}>
              {task.title}
            </Text>
          </View>
        );
      })}
      {report.milestones.map((milestone, i) => (
        <View
          key={`m${i}`}
          style={[styles.milestoneLine, { left: `${percent(milestone.date)}%` }]}
        />
      ))}
    </View>
  );
}

function StatusDocument({ report, words }: { report: StatusReport; words: PdfWords }) {
  const heading = `${report.projectName} · ${words.statusFor(report.weekKey)}`;
  const economy = report.economy;
  const money = (n: number) => `${n.toLocaleString("da-DK")} kr.`;

  return (
    <Document title={heading} author={report.projectName}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{heading}</Text>
        <Text style={styles.meta}>
          {[
            formatDateDa(report.today),
            report.ownerName ? `${words.owner}: ${report.ownerName}` : "",
            report.managerName ? `${words.manager}: ${report.managerName}` : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>

        {report.goal ? (
          <>
            <Text style={styles.heading}>{words.goal}</Text>
            <Text style={styles.body}>{report.goal}</Text>
          </>
        ) : null}

        <Text style={styles.heading}>{words.statusFor(report.weekKey)}</Text>
        <Text style={styles.body}>{report.text}</Text>

        {economy ? (
          <>
            <Text style={styles.heading}>{words.economy}</Text>
            <Text style={styles.body}>
              {words.economyLine(
                money(economy.plannedTotal),
                money(economy.incurredTotal),
                economy.budget === null ? "–" : money(economy.budget),
              )}
              {economy.budget !== null && economy.plannedTotal > economy.budget
                ? ` ${words.overBudget}`
                : ""}
            </Text>
          </>
        ) : null}

        <Text style={styles.heading}>{words.plan}</Text>
        <PlanChart report={report} />

        <Text style={styles.heading}>{words.milestones}</Text>
        {report.milestones.length === 0 ? (
          <Text style={styles.body}>{words.none}</Text>
        ) : (
          report.milestones.map((milestone, index) => (
            <View key={index} wrap={false}>
              <View style={styles.row}>
                <Text style={styles.colWide}>
                  ◆ {milestone.title}
                  {milestone.criterion ? ` — ${words.criterion}: ${milestone.criterion}` : ""}
                </Text>
                <Text style={styles.colMid}>{milestone.ownerName}</Text>
                <Text style={styles.colNarrow}>
                  {formatDateDa(milestone.date)} · {milestone.done ? words.reached : words.open}
                </Text>
              </View>
              {report.tasks
                .filter((task) => task.milestoneIndex === index)
                .map((task, j) => (
                  <View key={j} style={styles.row}>
                    <Text style={styles.colWide}> {task.title}</Text>
                    <Text style={styles.colMid}>{task.owner}</Text>
                    <Text style={styles.colNarrow}>
                      {formatDateDa(task.start)}–{formatDateDa(task.end)} ·{" "}
                      {words.states[task.state] ?? task.state}
                    </Text>
                  </View>
                ))}
            </View>
          ))
        )}

        {report.tasks.some((task) => task.milestoneIndex === null) && (
          <>
            <Text style={styles.groupHeading}>{words.otherTasks}</Text>
            {report.tasks
              .filter((task) => task.milestoneIndex === null)
              .map((task, j) => (
                <View key={j} style={styles.row}>
                  <Text style={styles.colWide}>{task.title}</Text>
                  <Text style={styles.colMid}>{task.owner}</Text>
                  <Text style={styles.colNarrow}>
                    {formatDateDa(task.start)}–{formatDateDa(task.end)} ·{" "}
                    {words.states[task.state] ?? task.state}
                  </Text>
                </View>
              ))}
          </>
        )}

        <Text style={styles.heading}>{words.obstacles}</Text>
        {report.obstacles.length === 0 ? (
          <Text style={styles.body}>{words.none}</Text>
        ) : (
          report.obstacles.map((obstacle, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.colWide}>{obstacle.title}</Text>
              <Text style={styles.colNarrow}>{words.since(formatDateDa(obstacle.since))}</Text>
            </View>
          ))
        )}

        <Text style={styles.heading}>
          {report.decisionsSince ? words.decisionsSince(report.decisionsSince) : words.decisions}
        </Text>
        {report.decisions.length === 0 ? (
          <Text style={styles.body}>{words.none}</Text>
        ) : (
          report.decisions.map((decision, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.colWide}>
                {decision.title}
                {decision.note ? ` — ${decision.note}` : ""}
              </Text>
              <Text style={styles.colNarrow}>{formatDateDa(decision.date)}</Text>
            </View>
          ))
        )}

        <Text style={styles.footer} fixed>
          {words.madeWith}
        </Text>
      </Page>
    </Document>
  );
}

export function renderStatusPdf(report: StatusReport, words: PdfWords): Promise<Buffer> {
  return renderToBuffer(<StatusDocument report={report} words={words} />);
}
