import { diffDays } from "@/core/dates";
import { formatDay, formatMoney } from "./phrases";
import type { ChatContext, Locale, Tip } from "./types";

/**
 * Deterministic observations about a project: what the system can see by
 * itself. They are the rules engine's daily tip, and they go into the
 * model's prompt as facts, so a model-written tip stands on something.
 */
export type Observation = { severity: 1 | 2 | 3; text: string; tip: Tip };

type Words = {
  overdueText: (n: number, titles: string) => string;
  overdueTitle: (n: number) => string;
  overdueBody: (title: string, owner: string, date: string) => string;
  overdueAction: (title: string) => string;
  lateMsText: (title: string, date: string) => string;
  lateMsTitle: (title: string) => string;
  lateMsBody: (date: string) => string;
  soonText: (title: string, days: number, n: number) => string;
  soonTitle: (title: string, days: number) => string;
  soonBody: (n: number, titles: string, owners: string) => string;
  noOwnerText: (n: number, titles: string) => string;
  noOwnerTitle: string;
  noOwnerBody: (n: number, first: string) => string;
  overBudgetText: (planned: string, budget: string) => string;
  overBudgetTitle: string;
  overBudgetBody: (planned: string, budget: string) => string;
  obstacleText: (n: number, titles: string) => string;
  obstacleTitle: string;
  obstacleBody: (title: string) => string;
  statusNever: string;
  statusOld: (days: number) => string;
  statusNeverTitle: string;
  statusOldTitle: string;
  statusBody: string;
  longText: (title: string, days: number) => string;
  longTitle: (title: string) => string;
  longBody: (days: number, owner: string) => string;
  healthyTitle: string;
  healthyBody: string;
  theOwners: string;
  theOwner: string;
};

const WORDS: Record<Locale, Words> = {
  da: {
    overdueText: (n, titles) => `${n} opgave${n === 1 ? " er" : "r er"} over deadline: ${titles}.`,
    overdueTitle: (n) => (n === 1 ? "Én opgave er over deadline" : `${n} opgaver er over deadline`),
    overdueBody: (title, owner, date) =>
      `"${title}"${owner ? ` (${owner})` : ""} skulle være færdig ${date}. Enten er den færdig og skal markeres, eller også skal den have en ny dato, så planen fortæller sandheden.`,
    overdueAction: (title) => `Flyt "${title}" så den slutter om en uge`,
    lateMsText: (title, date) =>
      `Milepælen "${title}" (${date}) er passeret uden at være markeret nået.`,
    lateMsTitle: (title) => `Milepælen "${title}" er passeret`,
    lateMsBody: (date) =>
      `Datoen var ${date}. Er den nået, så markér den; ellers skal den have en ny dato, og opgaverne under den bør ses efter.`,
    soonText: (title, days, n) =>
      `Milepælen "${title}" er om ${days} dage, og ${n} opgave${n === 1 ? "" : "r"} under den er ikke færdig.`,
    soonTitle: (title, days) => `"${title}" er om ${days} dage`,
    soonBody: (n, titles, owners) =>
      `${n === 1 ? "Én opgave" : `${n} opgaver`} under milepælen er stadig åben: ${titles}. Tag en snak med ${owners} om det holder.`,
    noOwnerText: (n, titles) =>
      `${n} åben opgave${n === 1 ? "" : "r"} har ingen ansvarlig: ${titles}.`,
    noOwnerTitle: "Opgaver uden ansvarlig",
    noOwnerBody: (n, first) =>
      `${n === 1 ? `"${first}" har` : `${n} opgaver har`} ingen ansvarlig. En opgave uden navn på bliver sjældent lavet.`,
    overBudgetText: (planned, budget) =>
      `De registrerede poster (${planned}) overstiger budgettet (${budget}).`,
    overBudgetTitle: "Økonomien overstiger budgettet",
    overBudgetBody: (planned, budget) =>
      `Posterne løber op i ${planned} mod et budget på ${budget}. Tag det med projektejeren nu, ikke når regningen kommer.`,
    obstacleText: (n, titles) => `${n} åben forhindring${n === 1 ? "" : "er"}: ${titles}.`,
    obstacleTitle: "En forhindring står stadig åben",
    obstacleBody: (title) =>
      `"${title}" er ikke løst. Hvem ejer den, og hvad er næste skridt? En forhindring uden ejer bliver til en forsinkelse.`,
    statusNever: "Der er endnu ikke sendt en ugestatus.",
    statusOld: (days) => `Seneste ugestatus er ${days} dage gammel.`,
    statusNeverTitle: "Send den første ugestatus",
    statusOldTitle: "Tid til en ugestatus",
    statusBody:
      "Fem minutter på en status er den billigste måde at få hele holdet til at se det samme. Klik Ny ugestatus, så skriver AI'en udkastet.",
    longText: (title, days) => `"${title}" har været i gang i ${days} dage.`,
    longTitle: (title) => `"${title}" har været i gang længe`,
    longBody: (days, owner) =>
      `Opgaven har stået som i gang i ${days} dage. Spørg ${owner} om den kan deles op, eller om noget blokerer.`,
    healthyTitle: "Planen ser sund ud",
    healthyBody:
      "Ingen opgaver over deadline, ingen åbne forhindringer, og status er sendt. Brug fem minutter på at kigge en uge frem: hvad skal være sket på fredag?",
    theOwners: "de ansvarlige",
    theOwner: "den ansvarlige",
  },
  en: {
    overdueText: (n, titles) => `${n} task${n === 1 ? " is" : "s are"} overdue: ${titles}.`,
    overdueTitle: (n) => (n === 1 ? "One task is overdue" : `${n} tasks are overdue`),
    overdueBody: (title, owner, date) =>
      `"${title}"${owner ? ` (${owner})` : ""} was due ${date}. Either it is done and should be marked, or it needs a new date so the plan tells the truth.`,
    overdueAction: (title) => `Move "${title}" so it ends in a week`,
    lateMsText: (title, date) =>
      `The milestone "${title}" (${date}) has passed without being marked reached.`,
    lateMsTitle: (title) => `The milestone "${title}" has passed`,
    lateMsBody: (date) =>
      `The date was ${date}. If it is reached, mark it; otherwise it needs a new date, and the tasks under it should be looked over.`,
    soonText: (title, days, n) =>
      `The milestone "${title}" is in ${days} days, and ${n} task${n === 1 ? "" : "s"} under it ${n === 1 ? "is" : "are"} not done.`,
    soonTitle: (title, days) => `"${title}" is in ${days} days`,
    soonBody: (n, titles, owners) =>
      `${n === 1 ? "One task" : `${n} tasks`} under the milestone ${n === 1 ? "is" : "are"} still open: ${titles}. Talk to ${owners} about whether it holds.`,
    noOwnerText: (n, titles) => `${n} open task${n === 1 ? " has" : "s have"} no owner: ${titles}.`,
    noOwnerTitle: "Tasks without an owner",
    noOwnerBody: (n, first) =>
      `${n === 1 ? `"${first}" has` : `${n} tasks have`} no owner. A task without a name on it rarely gets done.`,
    overBudgetText: (planned, budget) =>
      `The registered lines (${planned}) exceed the budget (${budget}).`,
    overBudgetTitle: "Spending exceeds the budget",
    overBudgetBody: (planned, budget) =>
      `The lines add up to ${planned} against a budget of ${budget}. Raise it with the project owner now, not when the bill arrives.`,
    obstacleText: (n, titles) => `${n} open obstacle${n === 1 ? "" : "s"}: ${titles}.`,
    obstacleTitle: "An obstacle is still open",
    obstacleBody: (title) =>
      `"${title}" is not resolved. Who owns it, and what is the next step? An obstacle without an owner turns into a delay.`,
    statusNever: "No weekly status has been sent yet.",
    statusOld: (days) => `The latest weekly status is ${days} days old.`,
    statusNeverTitle: "Send the first weekly status",
    statusOldTitle: "Time for a weekly status",
    statusBody:
      "Five minutes on a status is the cheapest way to get the whole team seeing the same thing. Click New weekly status and the AI drafts it.",
    longText: (title, days) => `"${title}" has been in progress for ${days} days.`,
    longTitle: (title) => `"${title}" has been in progress for a while`,
    longBody: (days, owner) =>
      `The task has been marked in progress for ${days} days. Ask ${owner} whether it can be split, or whether something is blocking.`,
    healthyTitle: "The plan looks healthy",
    healthyBody:
      "No overdue tasks, no open obstacles, and the status is sent. Spend five minutes looking a week ahead: what needs to have happened by Friday?",
    theOwners: "the owners",
    theOwner: "the owner",
  },
};

const quoteList = (titles: string[], max = 3) =>
  titles
    .slice(0, max)
    .map((t) => `"${t}"`)
    .join(", ");

export function observeProject(
  ctx: ChatContext,
  daysSinceLastStatus: number | null,
): Observation[] {
  const w = WORDS[ctx.locale];
  const day = (iso: string) => formatDay(iso, ctx.locale);
  const obs: Observation[] = [];
  const today = ctx.today;
  const open = ctx.tasks.filter((t) => t.state !== "done");

  const overdue = open.filter((t) => t.endDate < today);
  if (overdue.length > 0) {
    const t = overdue[0]!;
    obs.push({
      severity: 3,
      text: w.overdueText(
        overdue.length,
        quoteList(
          overdue.map((x) => x.title),
          5,
        ),
      ),
      tip: {
        title: w.overdueTitle(overdue.length),
        text: w.overdueBody(t.title, t.owner, day(t.endDate)),
        action: w.overdueAction(t.title),
      },
    });
  }

  const lateMs = ctx.milestones.filter((m) => !m.done && m.date < today);
  if (lateMs.length > 0) {
    const m = lateMs[0]!;
    obs.push({
      severity: 3,
      text: w.lateMsText(m.title, m.date),
      tip: { title: w.lateMsTitle(m.title), text: w.lateMsBody(day(m.date)), action: null },
    });
  }

  const soon = ctx.milestones
    .filter((m) => !m.done && m.date >= today && diffDays(today, m.date) <= 7)
    .map((m) => ({ m, openTasks: open.filter((t) => t.milestoneId === m.id) }))
    .filter((x) => x.openTasks.length > 0);
  if (soon.length > 0) {
    const { m, openTasks } = soon[0]!;
    const owners =
      [...new Set(openTasks.map((t) => t.owner).filter(Boolean))].join(", ") || w.theOwners;
    obs.push({
      severity: 2,
      text: w.soonText(m.title, diffDays(today, m.date), openTasks.length),
      tip: {
        title: w.soonTitle(m.title, diffDays(today, m.date)),
        text: w.soonBody(openTasks.length, quoteList(openTasks.map((t) => t.title)), owners),
        action: null,
      },
    });
  }

  const noOwner = open.filter((t) => !t.owner);
  if (noOwner.length > 0) {
    obs.push({
      severity: 2,
      text: w.noOwnerText(noOwner.length, quoteList(noOwner.map((t) => t.title))),
      tip: {
        title: w.noOwnerTitle,
        text: w.noOwnerBody(noOwner.length, noOwner[0]!.title),
        action: null,
      },
    });
  }

  if (ctx.economy?.budget && ctx.economy.plannedTotal > ctx.economy.budget) {
    const planned = formatMoney(ctx.economy.plannedTotal, ctx.locale);
    const budget = formatMoney(ctx.economy.budget, ctx.locale);
    obs.push({
      severity: 2,
      text: w.overBudgetText(planned, budget),
      tip: { title: w.overBudgetTitle, text: w.overBudgetBody(planned, budget), action: null },
    });
  }

  if (ctx.openObstacles.length > 0) {
    const o = ctx.openObstacles[0]!;
    obs.push({
      severity: 2,
      text: w.obstacleText(
        ctx.openObstacles.length,
        quoteList(
          ctx.openObstacles.map((x) => x.title),
          5,
        ),
      ),
      tip: { title: w.obstacleTitle, text: w.obstacleBody(o.title), action: null },
    });
  }

  if (daysSinceLastStatus === null || daysSinceLastStatus >= 7) {
    obs.push({
      severity: 1,
      text: daysSinceLastStatus === null ? w.statusNever : w.statusOld(daysSinceLastStatus),
      tip: {
        title: daysSinceLastStatus === null ? w.statusNeverTitle : w.statusOldTitle,
        text: w.statusBody,
        action: null,
      },
    });
  }

  const doingLong = open.filter((t) => t.state === "doing" && diffDays(t.startDate, today) > 14);
  if (doingLong.length > 0) {
    const t = doingLong[0]!;
    const days = diffDays(t.startDate, today);
    obs.push({
      severity: 1,
      text: w.longText(t.title, days),
      tip: {
        title: w.longTitle(t.title),
        text: w.longBody(days, t.owner || w.theOwner),
        action: null,
      },
    });
  }

  return obs.sort((a, b) => b.severity - a.severity);
}

export function fallbackTip(obs: Observation[], previousTips: string[], locale: Locale): Tip {
  const fresh = obs.find((o) => !previousTips.includes(o.tip.title)) ?? obs[0];
  if (fresh) return fresh.tip;
  const w = WORDS[locale];
  return { title: w.healthyTitle, text: w.healthyBody, action: null };
}
