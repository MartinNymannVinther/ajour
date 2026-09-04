import { addDaysIso, diffDays } from "@/core/dates";
import { PHRASES, formatDay, formatMoney } from "./phrases";
import { ruleBreakdown } from "./breakdown-rules";
import { fallbackTip, observeProject } from "./tip-rules";
import type {
  BreakdownInput,
  TaskProposal,
  AiEngine,
  ChatContext,
  ChatMessage,
  ChatReply,
  PlanInput,
  PlanProposal,
  ReplanInput,
  ReplanProposal,
  StatusDraft,
  StatusInput,
  Tip,
  TipInput,
} from "./types";
import { emptyChatReply } from "./types";

/**
 * The engine without a model: plain rules, no network, the same answer
 * every time. It runs the tests, it runs an installation with
 * LLM_PROVIDER=none, and it steps in whenever the model does not answer,
 * so the product never stands still and always says which engine spoke.
 */
export const RULES_ENGINE_NAME = "rules";

export const rulesEngine: AiEngine = {
  name: RULES_ENGINE_NAME,

  async generatePlan({ description, today, locale }: PlanInput): Promise<PlanProposal> {
    const p = PHRASES[locale];
    const firstLine = description.split(/[.\n!?]/)[0]?.trim() ?? p.newProject;
    const name = firstLine.length > 60 ? firstLine.slice(0, 57) + "..." : firstLine || p.newProject;
    const budgetMatch = description.match(/(\d{1,3}(?:[.\s]\d{3})+|\d{4,9})\s*(?:kr|dkk)/i);
    const budget = budgetMatch ? Number(budgetMatch[1]!.replace(/[.\s]/g, "")) : null;
    const m = (weeks: number) => addDaysIso(today, weeks * 7);
    const spans: Array<[number, number, number]> = [
      [1, 7, 0],
      [5, 14, 0],
      [8, 20, 0],
      [21, 35, 1],
      [36, 46, 1],
      [49, 56, 2],
      [63, 70, 2],
    ];
    return {
      name,
      goal: p.defaultGoal,
      budget,
      milestones: [
        { title: p.planMilestones[0], date: m(3) },
        { title: p.planMilestones[1], date: m(7) },
        { title: p.planMilestones[2], date: m(10) },
      ],
      tasks: p.planTasks.map((title, i) => ({
        title,
        milestoneIndex: spans[i]![2],
        owner: "",
        startDate: addDaysIso(today, spans[i]![0]),
        endDate: addDaysIso(today, spans[i]![1]),
      })),
    };
  },

  async draftStatus(input: StatusInput): Promise<StatusDraft> {
    const p = PHRASES[input.locale];
    const day = (iso: string) => formatDay(iso, input.locale);
    const parts: string[] = [];
    parts.push(
      input.doneTasks.length > 0
        ? p.doneCount(input.doneTasks.length, input.doneTasks.join(", "))
        : p.noneDone,
    );
    if (input.doingTasks.length > 0) {
      parts.push(
        p.inProgress(
          input.doingTasks.map((t) => t.title + (t.owner ? ` (${t.owner})` : "")).join(", "),
        ),
      );
    }
    if (input.overdueTasks.length > 0) parts.push(p.overdue(input.overdueTasks.length));
    if (input.openObstacles.length > 0)
      parts.push(p.obstaclesOpen(input.openObstacles.map((o) => o.title).join("; ")));
    if (input.nextMilestone) {
      parts.push(
        p.nextMilestone(
          input.nextMilestone.title,
          day(input.nextMilestone.date),
          diffDays(input.today, input.nextMilestone.date),
        ),
      );
    }
    if (input.economy && (input.economy.budget !== null || input.economy.postCount > 0)) {
      const e = input.economy;
      const kr = (n: number) => formatMoney(n, input.locale);
      if (e.budget !== null) {
        parts.push(p.economyWithBudget(kr(e.plannedTotal), kr(e.budget), kr(e.incurredTotal)));
        if (e.plannedTotal > e.budget) parts.push(p.overBudget);
      } else {
        parts.push(p.economyNoBudget(kr(e.plannedTotal), kr(e.incurredTotal)));
      }
    }
    const questions: string[] = [];
    for (const t of input.overdueTasks.slice(0, 2))
      questions.push(p.questionOverdue(t.title, day(t.endDate), t.owner));
    for (const o of input.openObstacles.slice(0, 1)) questions.push(p.questionObstacle(o.title));

    // Next week is what is in motion and what is late, by name.
    const nextWeek = [
      ...input.overdueTasks.map((t) => p.nextWeekLate(t.title, t.owner)),
      ...input.doingTasks.map((t) => p.nextWeekDoing(t.title, t.owner)),
    ].slice(0, 4);

    // What management could do: clear an obstacle, cover an overrun, or
    // accept a late milestone. Only when there is something to ask for.
    const suggestedAsks: StatusDraft["suggestedAsks"] = [];
    for (const o of input.openObstacles.slice(0, 2))
      suggestedAsks.push({ text: p.askObstacle(o.title), dueDate: null });
    if (
      input.economy?.budget !== null &&
      input.economy !== null &&
      input.economy.plannedTotal > input.economy.budget
    ) {
      suggestedAsks.push({
        text: p.askBudget(
          formatMoney(input.economy.plannedTotal - input.economy.budget, input.locale),
        ),
        dueDate: null,
      });
    }
    if (input.nextMilestone && input.overdueTasks.length >= 2) {
      suggestedAsks.push({
        text: p.askMilestone(input.nextMilestone.title, day(input.nextMilestone.date)),
        dueDate: input.nextMilestone.date,
      });
    }

    return {
      text: parts.join(" "),
      questions: questions.slice(0, 3),
      nextWeek,
      suggestedAsks: suggestedAsks.slice(0, 3),
    };
  },

  async chat(context: ChatContext, _history: ChatMessage[], message: string): Promise<ChatReply> {
    const p = PHRASES[context.locale];
    // Three fixed forms keep the product usable without a model:
    // "budget: 50000", "forhindring: <tekst>" / "obstacle: <text>", "beslutning: <tekst>" / "decision: <text>".
    const cmd = /^(budget|forhindring|obstacle|beslutning|decision)\s*:\s*(.+)$/i.exec(
      message.trim(),
    );
    if (cmd) {
      const kind = cmd[1]!.toLowerCase();
      const rest = cmd[2]!.trim();
      const out = emptyChatReply("");
      if (kind === "budget") {
        const n = Number(rest.replace(/[^\d]/g, ""));
        if (n > 0) {
          out.budgetChange = { budget: n };
          out.reply = p.budgetSet(formatMoney(n, context.locale));
        } else out.reply = p.noAmount;
      } else if (kind === "forhindring" || kind === "obstacle") {
        out.newObstacles = [{ title: rest.slice(0, 160) }];
        out.reply = p.obstacleCreated;
      } else {
        out.newDecisions = [{ title: rest.slice(0, 120), note: "" }];
        out.reply = p.decisionLogged;
      }
      return out;
    }
    const overdue = context.tasks.filter((t) => t.state !== "done" && t.endDate < context.today);
    const parts = [
      p.rulesIntro,
      overdue.length > 0 ? p.rulesOverdue(overdue.length) : p.rulesFine,
      p.rulesForms,
    ];
    return emptyChatReply(parts.join(" "));
  },

  async dailyTip(input: TipInput): Promise<Tip> {
    return fallbackTip(
      observeProject(input.context, input.daysSinceLastStatus),
      input.previousTips,
      input.context.locale,
    );
  },

  async proposeTasks(input: BreakdownInput): Promise<TaskProposal[]> {
    return ruleBreakdown(input);
  },

  async proposeReplan(input: ReplanInput): Promise<ReplanProposal> {
    const p = PHRASES[input.locale];
    const d = input.deltaDays;
    const taskMoves = input.affectedTasks
      .filter((t) => t.state !== "done")
      .map((t) => ({
        id: t.id,
        title: t.title,
        oldStart: t.startDate,
        oldEnd: t.endDate,
        newStart: addDaysIso(t.startDate, d),
        newEnd: addDaysIso(t.endDate, d),
      }));
    const milestoneMoves = input.laterMilestones.map((m) => ({
      id: m.id,
      title: m.title,
      oldDate: m.date,
      newDate: addDaysIso(m.date, d),
    }));
    const summary = p.replanSummary(
      input.reason,
      taskMoves.length,
      Math.abs(d),
      milestoneMoves.length > 0,
      milestoneMoves.length,
      d > 0 ? p.laterDir : p.earlierDir,
    );
    return { summary, milestoneMoves, taskMoves };
  },
};
