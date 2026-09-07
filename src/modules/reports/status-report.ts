import { eq } from "drizzle-orm";
import { statusUpdates, type ManagementAsk } from "@/core/db/schema";
import { todayInCopenhagen, weekKey } from "@/core/dates";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";
import { recordEvent } from "@/modules/projects/events";
import type { ProjectFull } from "@/modules/projects/types";

/**
 * The weekly status report: what the project manager approved plus the
 * state of the plan on the day, frozen as one document. The PDF, the
 * preview and the share page render from this, so a report says next year
 * what it said the day it was shared, whatever the plan did since.
 *
 * Version 2 is the management edition: an overall assessment with its
 * reason, the manager's own words, what management is asked to do, what
 * changed since last week and the trend, all frozen with the numbers.
 * Version 1 reports are upgraded on read with those parts empty.
 */

export type Rag = "green" | "yellow" | "red" | "early";
export const RAG_VALUES: Rag[] = ["green", "yellow", "red", "early"];

export type { ManagementAsk };

export type ReportMilestone = {
  title: string;
  date: string;
  done: boolean;
  ownerName: string;
  criterion: string;
};

export type ReportTask = {
  title: string;
  start: string;
  end: string;
  state: string;
  owner: string;
  participants: number;
  milestoneIndex: number | null;
};

export type StatusReport = {
  version: 2;
  today: string;
  weekKey: string;
  projectName: string;
  goal: string;
  ownerName: string;
  managerName: string;
  /** The approver's name, for the foot of the document. */
  approvedByName: string;
  /** The assessment in force, and what the engine proposed. Null on upgraded v1 reports. */
  rag: Rag | null;
  ragSuggested: Rag | null;
  ragReason: string;
  /** The drafted summary as the manager left it. */
  text: string;
  managerComment: string;
  managementAsks: ManagementAsk[];
  nextWeek: string[];
  /** What changed since the previous approved status, as sentences. */
  sinceLast: string[];
  /** The assessment of the last statuses, oldest first, this one last. */
  trend: Array<{ weekKey: string; rag: Rag | null }>;
  progress: { done: number; total: number };
  economy: {
    budget: number | null;
    plannedTotal: number;
    incurredTotal: number;
    postCount: number;
  } | null;
  expenses: Array<{ title: string; amount: number; spent: number; incurred: boolean }>;
  milestones: ReportMilestone[];
  tasks: ReportTask[];
  obstacles: Array<{ title: string; since: string }>;
  decisions: Array<{ title: string; note: string; date: string }>;
  /** ISO week key of the previous approved status, when decisions are "since" it. */
  decisionsSince: string | null;
  /** Which engine drafted the text, for the foot of the document. */
  engine: string;
};

/** The parts a person decides; everything else the report reads off the plan. */
export type StatusAuthored = {
  text: string;
  rag: Rag;
  ragSuggested: Rag;
  ragReason: string;
  managerComment: string;
  managementAsks: ManagementAsk[];
  nextWeek: string[];
  engine: string;
};

/** Authored parts for a status that is only text: tests and the plainest flow. */
export function plainAuthored(text: string, engine = ""): StatusAuthored {
  return {
    text,
    rag: "early",
    ragSuggested: "early",
    ragReason: "",
    managerComment: "",
    managementAsks: [],
    nextWeek: [],
    engine,
  };
}

/** What the report needs that the plan alone cannot say. */
export type StatusContext = {
  sinceLast: string[];
  approvedByName: string;
};

export function buildStatusReport(
  full: ProjectFull,
  authored: StatusAuthored,
  context: StatusContext,
  today = todayInCopenhagen(),
): StatusReport {
  const {
    project,
    milestones,
    tasks,
    expenses,
    obstacles,
    decisions,
    statusUpdates: statuses,
  } = full;
  const sorted = [...milestones].sort((a, b) => a.date.localeCompare(b.date));
  const index = new Map(sorted.map((m, i) => [m.id, i]));
  const approved = statuses.filter((s) => s.approvedAt);
  const previous = approved[0] ?? null;
  const since = previous?.approvedAt ?? null;
  const thisWeek = weekKey(today);
  const trend = [
    ...approved
      .slice(0, 4)
      .reverse()
      .map((s) => ({ weekKey: s.weekKey, rag: (s.rag as Rag | null) ?? null })),
    { weekKey: thisWeek, rag: authored.rag },
  ];

  return {
    version: 2,
    today,
    weekKey: thisWeek,
    projectName: project.name,
    goal: project.goal,
    ownerName: project.ownerName,
    managerName: project.managerName,
    approvedByName: context.approvedByName,
    rag: authored.rag,
    ragSuggested: authored.ragSuggested,
    ragReason: authored.ragReason,
    text: authored.text,
    managerComment: authored.managerComment,
    managementAsks: authored.managementAsks,
    nextWeek: authored.nextWeek,
    sinceLast: context.sinceLast,
    trend,
    progress: { done: tasks.filter((t) => t.state === "done").length, total: tasks.length },
    economy:
      project.budget !== null || expenses.length > 0
        ? {
            budget: project.budget,
            plannedTotal: expenses.reduce((sum, e) => sum + e.amount, 0),
            incurredTotal: expenses.reduce((sum, e) => sum + e.spent, 0),
            postCount: expenses.length,
          }
        : null,
    expenses: expenses.map((e) => ({
      title: e.title,
      amount: e.amount,
      spent: e.spent,
      incurred: e.incurred,
    })),
    milestones: sorted.map((m) => ({
      title: m.title,
      date: m.date,
      done: Boolean(m.doneAt),
      ownerName: m.ownerName,
      criterion: m.criterion,
    })),
    tasks: [...tasks]
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .map((t) => ({
        title: t.title,
        start: t.startDate,
        end: t.endDate,
        state: t.state,
        owner: t.ownerName,
        participants: t.participants.length,
        milestoneIndex:
          t.milestoneId !== null && index.has(t.milestoneId) ? index.get(t.milestoneId)! : null,
      })),
    obstacles: obstacles
      .filter((o) => o.status !== "resolved")
      .map((o) => ({ title: o.title, since: o.createdAt.toISOString().slice(0, 10) })),
    decisions: decisions
      .filter((d) => !since || d.createdAt > since)
      .map((d) => ({ title: d.title, note: d.note, date: d.createdAt.toISOString().slice(0, 10) })),
    decisionsSince: previous?.weekKey ?? null,
    engine: authored.engine,
  };
}

/**
 * Reads a frozen report of either version. A version 1 report becomes a
 * version 2 with the management parts empty: it still renders, and the
 * document is honest about not having assessed anything back then.
 */
export function parseStatusReport(raw: unknown): StatusReport | null {
  const r = raw as Record<string, unknown> | null;
  if (!r || !Array.isArray(r.milestones) || !Array.isArray(r.tasks)) return null;
  if (r.version === 2) return r as unknown as StatusReport;
  if (r.version !== 1) return null;
  const v1 = r as unknown as {
    today: string;
    weekKey: string;
    projectName: string;
    goal: string;
    ownerName: string;
    managerName: string;
    text: string;
    economy: StatusReport["economy"];
    milestones: ReportMilestone[];
    tasks: Array<Omit<ReportTask, "participants">>;
    obstacles: Array<{ title: string; since: string }>;
    decisions: StatusReport["decisions"];
    decisionsSince: string | null;
  };
  return {
    version: 2,
    today: v1.today,
    weekKey: v1.weekKey,
    projectName: v1.projectName,
    goal: v1.goal,
    ownerName: v1.ownerName,
    managerName: v1.managerName,
    approvedByName: "",
    rag: null,
    ragSuggested: null,
    ragReason: "",
    text: v1.text,
    managerComment: "",
    managementAsks: [],
    nextWeek: [],
    sinceLast: [],
    trend: [{ weekKey: v1.weekKey, rag: null }],
    progress: {
      done: v1.tasks.filter((t) => t.state === "done").length,
      total: v1.tasks.length,
    },
    economy: v1.economy ?? null,
    expenses: [],
    milestones: v1.milestones,
    tasks: v1.tasks.map((t) => ({ ...t, participants: 0 })),
    obstacles: v1.obstacles,
    decisions: v1.decisions ?? [],
    decisionsSince: v1.decisionsSince ?? null,
    engine: "",
  };
}

/** Approves a status: the authored parts and the frozen report become one row. */
export async function approveStatus(
  tx: AppTransaction,
  ctx: OrgContext,
  full: ProjectFull,
  authored: StatusAuthored,
  context: StatusContext,
  questions: string[],
): Promise<string> {
  const report = buildStatusReport(full, authored, context);
  const [row] = await tx
    .insert(statusUpdates)
    .values({
      orgId: ctx.orgId,
      projectId: full.project.id,
      weekKey: report.weekKey,
      text: authored.text,
      questions,
      details: report,
      engine: authored.engine,
      rag: authored.rag,
      managerComment: authored.managerComment,
      managementAsks: authored.managementAsks,
      approvedAt: new Date(),
      approvedBy: ctx.userId,
    })
    .returning({ id: statusUpdates.id });
  await recordEvent(tx, ctx, full.project.id, "status.approved", {
    week: report.weekKey,
    rag: authored.rag,
  });
  return row!.id;
}

export async function getStatus(tx: AppTransaction, statusId: string) {
  const [row] = await tx
    .select()
    .from(statusUpdates)
    .where(eq(statusUpdates.id, statusId))
    .limit(1);
  return row ?? null;
}
