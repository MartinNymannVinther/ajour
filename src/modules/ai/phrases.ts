import type { Locale } from "./types";

/**
 * The rules engine's vocabulary in both languages. It writes plans, status
 * drafts and tips without a model, so its words have to be ours, and they
 * have to follow the reader's language like everything else in the UI.
 */
const MONTHS: Record<Locale, string[]> = {
  da: [
    "januar",
    "februar",
    "marts",
    "april",
    "maj",
    "juni",
    "juli",
    "august",
    "september",
    "oktober",
    "november",
    "december",
  ],
  en: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
};

/** "3. september" / "3 September". */
export function formatDay(iso: string, locale: Locale): string {
  const [, m, d] = iso.split("-").map(Number);
  const month = MONTHS[locale][(m ?? 1) - 1] ?? "";
  return locale === "da" ? `${d}. ${month}` : `${d} ${month}`;
}

export function formatMoney(n: number, locale: Locale): string {
  return locale === "da" ? `${n.toLocaleString("da-DK")} kr.` : `DKK ${n.toLocaleString("en-GB")}`;
}

export function plural(n: number, locale: Locale, one: string, many: string): string {
  void locale;
  return n === 1 ? one : many;
}

type PhraseSet = {
  newProject: string;
  defaultGoal: string;
  planMilestones: [string, string, string];
  planTasks: string[];
  noneDone: string;
  doneCount: (n: number, titles: string) => string;
  inProgress: (list: string) => string;
  overdue: (n: number) => string;
  obstaclesOpen: (list: string) => string;
  nextMilestone: (title: string, date: string, days: number) => string;
  economyWithBudget: (planned: string, budget: string, incurred: string) => string;
  overBudget: string;
  economyNoBudget: (planned: string, incurred: string) => string;
  questionOverdue: (title: string, date: string, owner: string) => string;
  questionObstacle: (title: string) => string;
  nextWeekLate: (title: string, owner: string) => string;
  nextWeekDoing: (title: string, owner: string) => string;
  askObstacle: (title: string) => string;
  askBudget: (amount: string) => string;
  askMilestone: (title: string, date: string) => string;
  /** The generic breakdown of a milestone, in order, each taking the milestone's title. */
  breakdown: Array<(title: string) => string>;
  answerAbout: (title: string, answer: string) => string;
  budgetSet: (amount: string) => string;
  noAmount: string;
  obstacleCreated: string;
  decisionLogged: string;
  rulesIntro: string;
  rulesOverdue: (n: number) => string;
  rulesFine: string;
  rulesForms: string;
  replanSummary: (
    reason: string,
    tasks: number,
    days: number,
    later: boolean,
    milestones: number,
    laterDir: string,
  ) => string;
  laterDir: string;
  earlierDir: string;
  explainReplan: string;
};

export const PHRASES: Record<Locale, PhraseSet> = {
  da: {
    newProject: "Nyt projekt",
    defaultGoal: "Projektet er i mål til tiden, og alle ved hele vejen hvem der gør hvad.",
    planMilestones: ["Rammerne på plads", "Indholdet klar", "I mål"],
    planTasks: [
      "Afklar hvad succes betyder, og hvem der er med",
      "Læg budgetrammen fast",
      "Book det der skal bookes",
      "Udarbejd første udkast til indholdet",
      "Indhent feedback og ret til",
      "Kommunikér planen til alle involverede",
      "Gennemfør og saml op",
    ],
    noneDone: "Der er ikke afsluttet opgaver siden sidst.",
    doneCount: (n, titles) =>
      `Siden sidst er ${n === 1 ? "én opgave" : `${n} opgaver`} afsluttet: ${titles}.`,
    inProgress: (list) => `I gang lige nu: ${list}.`,
    overdue: (n) =>
      `${n === 1 ? "Én opgave er" : `${n} opgaver er`} over deadline og kræver en beslutning.`,
    obstaclesOpen: (list) => `Åbne forhindringer: ${list}.`,
    nextMilestone: (title, date, days) =>
      `Næste milepæl er "${title}" den ${date}${days >= 0 ? ` (om ${days} dage)` : " (overskredet)"}.`,
    economyWithBudget: (planned, budget, incurred) =>
      `Økonomi: ${planned} er registreret af budgettet på ${budget}, heraf ${incurred} afholdt.`,
    overBudget: "Bemærk at de registrerede poster overstiger budgettet.",
    economyNoBudget: (planned, incurred) =>
      `Økonomi: ${planned} er registreret, heraf ${incurred} afholdt. Der er ikke sat et budget.`,
    questionOverdue: (title, date, owner) =>
      `"${title}" skulle være færdig ${date}. Hvad er status${owner ? `, ${owner}` : ""}?`,
    questionObstacle: (title) => `Er der nyt om "${title}"?`,
    nextWeekLate: (title, owner) =>
      `Færdiggøre "${title}", som er forsinket${owner ? ` (${owner})` : ""}`,
    nextWeekDoing: (title, owner) => `Arbejde videre på "${title}"${owner ? ` (${owner})` : ""}`,
    askObstacle: (title) => `Hjælp med at fjerne forhindringen "${title}"`,
    askBudget: (amount) => `Tag stilling til et forventet merforbrug på ${amount}`,
    askMilestone: (title, date) =>
      `Bekræft at milepælen "${title}" den ${date} stadig gælder, eller flyt den`,
    answerAbout: (title, answer) => `Om "${title}": ${answer}.`,
    breakdown: [
      (title) => `Afklar hvad "${title}" kræver, og hvem der skal med`,
      (title) => `Planlæg arbejdet frem mod "${title}" og fordel det`,
      (title) => `Gennemfør det der skal til for "${title}"`,
      (title) => `Tjek at "${title}" er nået, og aflever`,
    ],
    budgetSet: (amount) => `Budgettet er sat til ${amount}`,
    noAmount: "Jeg kunne ikke læse et beløb.",
    obstacleCreated: "Forhindringen er oprettet.",
    decisionLogged: "Beslutningen er logget.",
    rulesIntro: "Der er ingen sprogmodel tilgængelig lige nu, så jeg svarer ud fra faste regler.",
    rulesOverdue: (n) =>
      `Det jeg kan se i planen: ${n === 1 ? "én opgave er" : `${n} opgaver er`} over deadline. Flyt dem, eller markér dem færdige, så planen fortæller sandheden.`,
    rulesFine:
      "Planen ser ud til at hænge sammen lige nu. Et generelt råd: flyt hellere en milepæl i tide end at lade den lyve.",
    rulesForms:
      'Jeg forstår tre faste former: "budget: 50000", "forhindring: <tekst>" og "beslutning: <tekst>".',
    replanSummary: (reason, tasks, days, later, milestones, dir) =>
      `${reason} Forslaget flytter ${tasks === 1 ? "én åben opgave" : `${tasks} åbne opgaver`} ${days} dage ${dir}${later ? ` og skubber ${milestones === 1 ? "én senere milepæl" : `${milestones} senere milepæle`} tilsvarende` : ""}. Færdige opgaver røres ikke.`,
    laterDir: "senere",
    earlierDir: "tidligere",
    explainReplan: "Forklar replanlægningen kort.",
  },
  en: {
    newProject: "New project",
    defaultGoal: "The project lands on time, and everyone knows who does what all the way.",
    planMilestones: ["Frame in place", "Content ready", "Done"],
    planTasks: [
      "Agree what success means, and who is in",
      "Settle the budget frame",
      "Book what needs booking",
      "Draft the content",
      "Gather feedback and adjust",
      "Communicate the plan to everyone involved",
      "Deliver and wrap up",
    ],
    noneDone: "No tasks have been completed since last time.",
    doneCount: (n, titles) =>
      `Since last time ${n === 1 ? "one task has" : `${n} tasks have`} been completed: ${titles}.`,
    inProgress: (list) => `In progress right now: ${list}.`,
    overdue: (n) => `${n === 1 ? "One task is" : `${n} tasks are`} overdue and need a decision.`,
    obstaclesOpen: (list) => `Open obstacles: ${list}.`,
    nextMilestone: (title, date, days) =>
      `The next milestone is "${title}" on ${date}${days >= 0 ? ` (in ${days} days)` : " (passed)"}.`,
    economyWithBudget: (planned, budget, incurred) =>
      `Money: ${planned} of the ${budget} budget is registered, ${incurred} of it spent.`,
    overBudget: "Note that the registered lines exceed the budget.",
    economyNoBudget: (planned, incurred) =>
      `Money: ${planned} registered, ${incurred} of it spent. No budget is set.`,
    questionOverdue: (title, date, owner) =>
      `"${title}" was due ${date}. What is the status${owner ? `, ${owner}` : ""}?`,
    questionObstacle: (title) => `Any news on "${title}"?`,
    nextWeekLate: (title, owner) => `Finish "${title}", which is late${owner ? ` (${owner})` : ""}`,
    nextWeekDoing: (title, owner) => `Keep working on "${title}"${owner ? ` (${owner})` : ""}`,
    askObstacle: (title) => `Help clear the obstacle "${title}"`,
    askBudget: (amount) => `Decide on an expected overrun of ${amount}`,
    askMilestone: (title, date) =>
      `Confirm that the milestone "${title}" on ${date} still stands, or move it`,
    answerAbout: (title, answer) => `On "${title}": ${answer}.`,
    breakdown: [
      (title) => `Work out what "${title}" needs, and who has to be involved`,
      (title) => `Plan the work towards "${title}" and hand it out`,
      (title) => `Do what it takes to reach "${title}"`,
      (title) => `Check that "${title}" is reached, and hand over`,
    ],
    budgetSet: (amount) => `The budget is set to ${amount}`,
    noAmount: "I could not read an amount.",
    obstacleCreated: "The obstacle has been added.",
    decisionLogged: "The decision has been logged.",
    rulesIntro: "No language model is available right now, so I answer from fixed rules.",
    rulesOverdue: (n) =>
      `What I can see in the plan: ${n === 1 ? "one task is" : `${n} tasks are`} overdue. Move them or mark them done, so the plan tells the truth.`,
    rulesFine:
      "The plan looks consistent right now. General advice: move a milestone in time rather than let it lie.",
    rulesForms:
      'I understand three fixed forms: "budget: 50000", "obstacle: <text>" and "decision: <text>".',
    replanSummary: (reason, tasks, days, later, milestones, dir) =>
      `${reason} The proposal moves ${tasks === 1 ? "one open task" : `${tasks} open tasks`} ${days} days ${dir}${later ? ` and pushes ${milestones === 1 ? "one later milestone" : `${milestones} later milestones`} accordingly` : ""}. Completed tasks are left alone.`,
    laterDir: "later",
    earlierDir: "earlier",
    explainReplan: "Explain the replan briefly.",
  },
};
