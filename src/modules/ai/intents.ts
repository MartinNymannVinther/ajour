import type { ChatContext, Locale } from "./types";

/**
 * Which parts of the action schema a chat message needs. The full schema
 * has sixteen action fields; a small local model handed all of them fills
 * in fields nobody asked for. So the message is read for what it is about
 * and the model gets the plan (always) plus the parts the words point at.
 * A message that points at nothing in particular gets everything, as
 * before: a narrower prompt is an optimisation, never a refusal.
 */
export type Intent =
  | "plan"
  | "money"
  | "obstacles"
  | "decisions"
  | "people"
  | "checklist"
  | "milestoneDetails"
  | "roles";

export const ALL_INTENTS: Intent[] = [
  "plan",
  "money",
  "obstacles",
  "decisions",
  "people",
  "checklist",
  "milestoneDetails",
  "roles",
];

/** Stems, lower-cased; a message matches an intent when it contains one. */
const CUES: Record<Locale, Record<Intent, string[]>> = {
  da: {
    plan: [
      "flyt",
      "skub",
      "ryk",
      "uge",
      "dato",
      "opgave",
      "færdig",
      "i gang",
      "start",
      "slut",
      "opret",
      "tilføj",
      "ikke startet",
      "udskyd",
      "frem",
      "tilbage",
      "deadline",
    ],
    money: [
      "budget",
      "økonomi",
      "penge",
      "kr.",
      "kr ",
      "kroner",
      "beløb",
      "udgift",
      "post",
      "betal",
      "faktura",
      "pris",
      "koste",
      "afholdt",
      "regning",
    ],
    obstacles: [
      "forhindring",
      "problem",
      "blok",
      "risiko",
      "stopper",
      "løst",
      "løs ",
      "bøvl",
      "knas",
      "forsink",
    ],
    decisions: [
      "beslut",
      "besluttede",
      "vi vælger",
      "vi går med",
      "log ",
      "notér",
      "noter",
      "aftalt",
      "aftale",
      "skriv ned",
    ],
    people: [
      "ansvarlig",
      "deltager",
      "hvem",
      "tildel",
      "overtag",
      "ejer af",
      "står på",
      "ressource",
    ],
    checklist: ["tjekliste", "underopgave", "punkt", "checkliste", "afkryds", "kryds"],
    milestoneDetails: ["milepæl", "nået", "kriterie", "acceptkrit", "omdøb", "genåbn"],
    roles: ["projektleder", "projektejer", "roller", "styregruppe"],
  },
  en: {
    plan: [
      "move",
      "push",
      "shift",
      "week",
      "date",
      "task",
      "done",
      "in progress",
      "start",
      "end",
      "create",
      "add",
      "postpone",
      "deadline",
      "delay",
    ],
    money: [
      "budget",
      "money",
      "cost",
      "expense",
      "spend",
      "spent",
      "paid",
      "invoice",
      "price",
      "amount",
      "kr.",
      "kr ",
      "dkk",
      "line",
    ],
    obstacles: [
      "obstacle",
      "problem",
      "block",
      "risk",
      "stuck",
      "resolved",
      "resolve",
      "issue",
      "delay",
    ],
    decisions: [
      "decid",
      "decision",
      "we go with",
      "we chose",
      "log ",
      "note down",
      "agreed",
      "record",
    ],
    people: ["owner", "participant", "who", "assign", "responsible", "take over", "resource"],
    checklist: ["checklist", "subtask", "item", "tick", "check off"],
    milestoneDetails: ["milestone", "reached", "criterion", "criteria", "rename", "reopen"],
    roles: ["project manager", "project owner", "roles", "steering"],
  },
};

export function detectIntents(message: string, locale: Locale): Intent[] {
  const text = ` ${message.toLowerCase().replace(/\s+/g, " ")} `;
  // A cue matches at the start of a word: "kr" in "kr." and "kroner", not in "skriv".
  const atWordStart = (cue: string) =>
    new RegExp(`(^|[^a-zæøå])${cue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "u").test(text);
  const found = new Set<Intent>();
  for (const [intent, cues] of Object.entries(CUES[locale]) as Array<[Intent, string[]]>) {
    if (cues.some(atWordStart)) found.add(intent);
  }
  // Nothing recognised: the message may still be about anything, so the
  // model gets the whole schema rather than a guess. The plan is always in.
  if (found.size === 0) return [...ALL_INTENTS];
  found.add("plan");
  return ALL_INTENTS.filter((i) => found.has(i));
}

/** The schema lines per intent, in the order the model sees them. */
const SCHEMA: Record<Intent, string[]> = {
  plan: [
    ' "taskMoves": [{"id": string, "newStart": "yyyy-mm-dd", "newEnd": "yyyy-mm-dd"}],',
    ' "milestoneMoves": [{"id": string, "newDate": "yyyy-mm-dd"}],',
    ' "newTasks": [{"title": string, "milestoneId": string | null, "owner": string, "startDate": "yyyy-mm-dd", "endDate": "yyyy-mm-dd"}],',
    ' "newMilestones": [{"title": string, "date": "yyyy-mm-dd"}],',
    ' "stateChanges": [{"id": string, "state": "todo" | "doing" | "done"}],',
    ' "milestoneChanges": [{"id": string, "milestoneId": string | null}],  // move an existing task to another milestone; null = no milestone',
  ],
  decisions: [
    ' "newDecisions": [{"title": string, "note": string}],  // decisions taken in the conversation; note is the short reason',
  ],
  money: [
    ' "budgetChange": {"budget": number | null},  // total budget in whole kroner; null removes the budget',
    ' "newExpenses": [{"title": string, "amount": number, "spent": number, "taskId": string | null}],  // amount: what the line is expected to cost; spent: paid so far, 0 if nothing yet',
    ' "expenseChanges": [{"id": string, "amount": number, "spent": number}],  // change an existing line; omit the field that does not change. "spent" may be part of the amount: 5000 of a 20000 line',
  ],
  obstacles: [' "newObstacles": [{"title": string}],', ' "resolvedObstacles": [{"id": string}],'],
  checklist: [
    ' "subtaskChanges": [{"id": string, "subtasks": [{"title": string, "done": boolean}]}],  // the whole checklist of the task; repeat existing items you keep',
  ],
  people: [
    ' "peopleChanges": [{"id": string, "owner": string, "participants": [string]}],  // omit the field that does not change',
    ' "newResources": [string],  // new names in the resource pool',
  ],
  milestoneDetails: [
    ' "milestoneUpdates": [{"id": string, "newTitle": string, "ownerName": string, "criterion": string, "done": boolean}],  // omit fields that do not change',
  ],
  roles: [
    ' "roleChanges": {"ownerName": string, "managerName": string},  // project owner and project manager; omit what does not change',
  ],
};

export function schemaFor(intents: Intent[]): string {
  const lines = intents.flatMap((intent) => SCHEMA[intent]);
  return ['{"reply": string,', ...lines, "}"].join("\n");
}

/**
 * The context trimmed to what the intents need. The plan is always there;
 * the money, the obstacles and the decision log go only when the message
 * is about them, so a small model reads less and invents less.
 */
export function contextFor(context: ChatContext, intents: Intent[]): ChatContext {
  const has = (i: Intent) => intents.includes(i);
  return {
    ...context,
    economy: has("money") ? context.economy : null,
    openObstacles: has("obstacles") ? context.openObstacles : [],
    decisions: has("decisions") ? context.decisions : [],
    tasks: context.tasks.map((t) => (has("checklist") ? t : { ...t, subtasks: [] })),
  };
}
