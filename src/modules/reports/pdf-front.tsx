import { Text, View } from "@react-pdf/renderer";
import { formatDateDa } from "@/core/dates";
import { economyFigure, ganttFigure, INK, milestoneTrackFigure, RAG_COLOR } from "./charts";
import { PdfFigure } from "./pdf-figure";
import { CONTENT_W, RIGHT_W, styles } from "./pdf-styles";
import { frontPlan, reportSections } from "./sections";
import type { StatusReport } from "./status-report";
import type { ReportWords } from "./words";

/**
 * Page one of the PDF, section for section the same as the screen's
 * front page (src/components/report/report-front). Every figure sits in
 * a view that refuses to break: a plan cut in two by a page edge is worse
 * than a plan that starts on the next page.
 */

const CARD_INNER = RIGHT_W - 18;
// Drawn a little wider than printed, so labels have room and the type
// lands at about six points.
const GANTT_W = Math.round(CONTENT_W * 1.2);

function Bullets({ lines }: { lines: string[] }) {
  return (
    <View>
      {lines.map((line, i) => (
        <View key={i} style={styles.bullet}>
          <Text style={styles.bulletMark}>·</Text>
          <Text style={[styles.small, { flex: 1 }]}>{line}</Text>
        </View>
      ))}
    </View>
  );
}

export function PdfFront({
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
  const rag = report.rag ?? "early";
  const colour = RAG_COLOR[rag];
  const overridden = report.ragSuggested && report.ragSuggested !== report.rag;
  const first = report.trend[0];
  const last = report.trend[report.trend.length - 1];

  return (
    <>
      <View style={[styles.row, { justifyContent: "space-between", gap: 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>
            {words.eyebrow(words.week(report.weekKey), formatDateDa(report.today))}
          </Text>
          <Text style={styles.title}>{report.projectName}</Text>
          <Text style={styles.meta}>
            {words.roles(report.ownerName || "–", report.managerName || "–")}
            {report.goal ? ` · ${words.goal(report.goal)}` : ""}
          </Text>
          {report.trend.length > 1 && first && last && (
            <View style={[styles.row, { alignItems: "center", marginTop: 5 }]}>
              {report.trend.map((p, i) => (
                <View
                  key={i}
                  style={[
                    styles.trendDot,
                    { backgroundColor: RAG_COLOR[p.rag ?? "early"].dot },
                    i === report.trend.length - 1
                      ? { borderWidth: 1, borderColor: INK.fg, width: 8, height: 8 }
                      : {},
                  ]}
                />
              ))}
              <Text style={[styles.meta, { marginLeft: 3, fontSize: 7 }]}>
                {words.trend(words.week(first.weekKey), words.week(last.weekKey))}
              </Text>
            </View>
          )}
        </View>
        <View style={[styles.rag, { backgroundColor: colour.tint, borderColor: colour.edge }]}>
          <View style={[styles.row, { alignItems: "center" }]}>
            <View style={[styles.dot, { backgroundColor: colour.dot }]} />
            <Text style={styles.ragWord}>{words.rag(report.rag)}</Text>
          </View>
          {report.ragReason ? <Text style={styles.ragReason}>{report.ragReason}</Text> : null}
          {report.rag && report.approvedByName ? (
            <Text style={styles.ragMeta}>
              {overridden
                ? words.suggestedOverridden(
                    words.ragShort(report.ragSuggested!),
                    words.ragShort(report.rag),
                    report.approvedByName,
                  )
                : words.suggestedConfirmed(report.approvedByName)}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.columns}>
        <View style={styles.left}>
          <View>
            <Text style={styles.h2}>{words.summary}</Text>
            <Text style={styles.body}>{report.text}</Text>
          </View>

          {sections.asks && (
            <View style={[styles.card, styles.section]}>
              <Text style={styles.h2}>{words.asks}</Text>
              {report.managementAsks.map((ask, i) => (
                <View key={ask.id} style={[styles.row, { marginBottom: 4 }]}>
                  <Text style={styles.askNumber}>{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.small,
                        ask.answered
                          ? { color: INK.meta, textDecoration: "line-through" }
                          : { fontWeight: 600 },
                      ]}
                    >
                      {ask.text}
                    </Text>
                    <View style={[styles.row, { alignItems: "center", marginTop: 1 }]}>
                      {ask.dueDate ? (
                        <Text style={{ fontSize: 7, color: INK.meta }}>
                          {words.askDue(ask.dueDate)}
                        </Text>
                      ) : null}
                      {ask.answered ? (
                        <Text
                          style={[styles.pill, { backgroundColor: INK.accent, color: INK.ink }]}
                        >
                          {words.askAnswered}
                        </Text>
                      ) : ask.carriedFrom ? (
                        <Text
                          style={[styles.pill, { backgroundColor: INK.redTint, color: INK.warn }]}
                        >
                          {words.askOpenSince(ask.carriedFrom)}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {sections.comment && (
            <View style={styles.section}>
              <Text style={styles.h2}>{words.comment}</Text>
              <View style={styles.quote}>
                <Text style={styles.body}>{report.managerComment}</Text>
                <Text style={[styles.meta, { marginTop: 3 }]}>
                  {words.commentBy(report.managerName || report.approvedByName)}
                </Text>
              </View>
            </View>
          )}

          {sections.nextWeek && (
            <View style={styles.section}>
              <Text style={styles.h2}>{words.nextWeek}</Text>
              <Bullets lines={report.nextWeek} />
            </View>
          )}
        </View>

        <View style={styles.right}>
          {report.milestones.length > 0 && (
            <View style={styles.card} wrap={false}>
              <Text style={styles.h2}>{words.milestones}</Text>
              <PdfFigure
                figure={milestoneTrackFigure(report, CARD_INNER, words.track)}
                width={CARD_INNER}
              />
            </View>
          )}
          {(sections.economy || report.progress.total > 0) && (
            <View style={[styles.card, styles.section]} wrap={false}>
              <Text style={styles.h2}>{words.economy}</Text>
              <PdfFigure
                figure={economyFigure(report, CARD_INNER, words.economyChart)}
                width={CARD_INNER}
              />
            </View>
          )}
          <View style={[styles.card, styles.section]}>
            <Text style={styles.h2}>{words.sinceLast}</Text>
            {sections.sinceLast ? (
              <Bullets lines={report.sinceLast} />
            ) : (
              <Text style={[styles.small, { color: INK.meta }]}>{words.nothingSince}</Text>
            )}
          </View>
          {sections.obstacles && (
            <View style={[styles.card, styles.section]}>
              <Text style={styles.h2}>{words.obstacles}</Text>
              {report.obstacles.map((o, i) => (
                <View key={i} style={[styles.row, { marginBottom: 2 }]}>
                  <Text
                    style={[styles.small, { color: INK.warn, fontWeight: 600, marginRight: 5 }]}
                  >
                    {words.obstacleOpen}
                  </Text>
                  <Text style={[styles.small, { flex: 1 }]}>
                    {o.title}{" "}
                    <Text style={{ color: INK.meta }}>· {words.obstacleSince(o.since)}</Text>
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      {plan.rows.length > 0 && (
        <View style={styles.section} wrap={false}>
          <Text style={styles.h2}>{words.planNow}</Text>
          <PdfFigure figure={ganttFigure(report, plan, GANTT_W, words.gantt)} width={CONTENT_W} />
          <View style={styles.legend}>
            {[
              [INK.soft, words.legend.doing],
              [INK.clay, words.legend.late],
              [INK.paper, words.legend.todo],
            ].map(([c, label]) => (
              <View key={label} style={[styles.row, { alignItems: "center" }]}>
                <View style={[styles.legendSwatch, { backgroundColor: c }]} />
                <Text>{label}</Text>
              </View>
            ))}
            <View style={[styles.row, { alignItems: "center" }]}>
              <View
                style={[styles.legendSwatch, { backgroundColor: INK.ink, width: 6, height: 6 }]}
              />
              <Text>{words.legend.milestone}</Text>
            </View>
            <Text style={{ marginLeft: "auto" }}>
              {plan.omitted > 0 ? words.planNote(plan.omitted) : words.planAll}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.footer} fixed>
        <Text>
          {draft
            ? words.draftFooter
            : words.approvedBy(report.approvedByName || report.managerName, report.today)}
          {" · "}
          {words.madeWith(report.engine)}
        </Text>
        <Text
          render={({ pageNumber, totalPages }) =>
            `ajour.haij.dk · ${words.pageOf(pageNumber, totalPages)}`
          }
        />
      </View>
    </>
  );
}
