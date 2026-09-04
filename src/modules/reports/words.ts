import { formatDateDa } from "@/core/dates";
import type { EconomyWords, GanttWords, TrackWords } from "./charts";
import type { Rag } from "./status-report";

/**
 * Every sentence the report speaks, built once from a translator so the
 * browser preview (next-intl on the client) and the PDF (next-intl on the
 * server) say exactly the same thing. The report's own text is frozen;
 * the labels around it follow the reader's language.
 */

type Translate = (key: string, values?: Record<string, string | number | Date>) => string;

export type ReportWords = {
  eyebrow: (week: string, date: string) => string;
  eyebrowAppendix: (week: string, date: string) => string;
  roles: (owner: string, manager: string) => string;
  goal: (goal: string) => string;
  rag: (rag: Rag | null) => string;
  ragShort: (rag: Rag) => string;
  suggestedConfirmed: (name: string) => string;
  suggestedOverridden: (suggested: string, chosen: string, name: string) => string;
  trend: (from: string, to: string) => string;
  summary: string;
  asks: string;
  askDue: (date: string) => string;
  askOpenSince: (week: string) => string;
  askAnswered: string;
  comment: string;
  commentBy: (name: string) => string;
  nextWeek: string;
  planNow: string;
  planNote: (count: number) => string;
  planAll: string;
  milestones: string;
  economy: string;
  sinceLast: string;
  nothingSince: string;
  obstacles: string;
  obstacleOpen: string;
  obstacleSince: (date: string) => string;
  decisions: (sinceWeek: string | null) => string;
  appendixTitle: string;
  appendixIntro: (project: string) => string;
  timeline: string;
  tasksTitle: string;
  noMilestone: string;
  cols: { task: string; owner: string; period: string; state: string };
  late: (days: number) => string;
  states: Record<string, string>;
  expensesTitle: string;
  expenseCols: { post: string; planned: string; incurred: string };
  incurred: string;
  expected: string;
  total: string;
  budgetOf: (amount: string) => string;
  approvedBy: (name: string, date: string) => string;
  draftFooter: string;
  madeWith: (engine: string) => string;
  pageOf: (page: number, total: number) => string;
  legend: Record<"done" | "doing" | "late" | "todo" | "milestone", string>;
  week: (key: string) => string;
  money: (n: number) => string;
  gantt: GanttWords;
  track: TrackWords;
  economyChart: EconomyWords;
};

export function reportWords(
  t: Translate,
  week: (key: string) => string,
  states: Record<string, string>,
  money: (n: number) => string,
): ReportWords {
  const legend = {
    done: t("legend.done"),
    doing: t("legend.doing"),
    late: t("legend.late"),
    todo: t("legend.todo"),
    milestone: t("legend.milestone"),
  };
  return {
    eyebrow: (w, date) => t("eyebrow", { week: w, date }),
    eyebrowAppendix: (w, date) => t("eyebrowAppendix", { week: w, date }),
    roles: (owner, manager) => t("roles", { owner, manager }),
    goal: (goal) => t("goal", { goal }),
    rag: (rag) => t(`rag.${rag ?? "none"}`),
    ragShort: (rag) => t(`ragShort.${rag}`),
    suggestedConfirmed: (name) => t("suggestedConfirmed", { name }),
    suggestedOverridden: (suggested, chosen, name) =>
      t("suggestedOverridden", { suggested, chosen, name }),
    trend: (from, to) => t("trend", { from, to }),
    summary: t("summary"),
    asks: t("asks"),
    askDue: (date) => t("askDue", { date: formatDateDa(date) }),
    askOpenSince: (w) => t("askOpenSince", { week: week(w) }),
    askAnswered: t("askAnswered"),
    comment: t("comment"),
    commentBy: (name) => t("commentBy", { name }),
    nextWeek: t("nextWeek"),
    planNow: t("planNow"),
    planNote: (count) => t("planNote", { count }),
    planAll: t("planAll"),
    milestones: t("milestones"),
    economy: t("economy"),
    sinceLast: t("sinceLast"),
    nothingSince: t("nothingSince"),
    obstacles: t("obstacles"),
    obstacleOpen: t("obstacleOpen"),
    obstacleSince: (date) => t("obstacleSince", { date: formatDateDa(date) }),
    decisions: (since) => (since ? t("decisions") : t("decisionsAll")),
    appendixTitle: t("appendixTitle"),
    appendixIntro: (project) => t("appendixIntro", { project }),
    timeline: t("timeline"),
    tasksTitle: t("tasksTitle"),
    noMilestone: t("noMilestone"),
    cols: {
      task: t("colTask"),
      owner: t("colOwner"),
      period: t("colPeriod"),
      state: t("colState"),
    },
    late: (days) => t("late", { days }),
    states,
    expensesTitle: t("expensesTitle"),
    expenseCols: { post: t("colPost"), planned: t("colPlanned"), incurred: t("colIncurred") },
    incurred: t("incurred"),
    expected: t("expected"),
    total: t("total"),
    budgetOf: (amount) => t("budgetOf", { amount }),
    approvedBy: (name, date) => t("approvedBy", { name, date: formatDateDa(date) }),
    draftFooter: t("draftFooter"),
    madeWith: (engine) => (engine === "rules" ? t("madeWithRules") : t("madeWith")),
    pageOf: (page, total) => t("pageOf", { page, total }),
    legend,
    week,
    money,
    gantt: {
      today: t("chart.today"),
      week: t("chart.week"),
      daysLate: (days) => t("chart.daysLate", { days }),
      states,
    },
    track: { start: t("chart.start"), daysTo: (days) => t("chart.daysTo", { days }) },
    economyChart: {
      spend: t("chart.spend"),
      ofBudget: (incurred, budget) => t("chart.ofBudget", { incurred, budget }),
      breakdown: (spent, planned) => t("chart.breakdown", { spent, planned }),
      noBudget: (incurred, planned) => t("chart.noBudget", { incurred, planned }),
      progress: t("chart.progress"),
      ofTasks: (done, total) => t("chart.ofTasks", { done, total }),
      ahead: (points) => t("chart.ahead", { points }),
      money,
    },
  };
}
