/**
 * The contract between the product and the AI engine. Two engines
 * implement it: one that talks to a language model through the LLM
 * adapter, and one that is plain rules. Everything the model may do is in
 * these types; the sanitizer in `sanitize.ts` turns raw model output into
 * them and nothing else reaches the database.
 *
 * People appear as names here because that is how people and models refer
 * to them; the write layer turns names into identities.
 */

export type Locale = "da" | "en";

export type PlanProposal = {
  name: string;
  goal: string;
  budget: number | null; // whole kroner when the description names an amount
  milestones: { title: string; date: string }[]; // ISO dates
  tasks: {
    title: string;
    milestoneIndex: number | null; // index into milestones
    owner: string;
    startDate: string;
    endDate: string;
  }[];
};

/** A draft plus the answers the person gave to what the engine lacked. */
export type ReviseInput = {
  locale: Locale;
  text: string;
  nextWeek: string[];
  answers: Array<{ question: string; answer: string }>;
  /** The same plan the draft was written from, so the rewrite stays true to it. */
  context: StatusInput;
};

export type StatusDraft = {
  text: string; // the week's summary in plain language, 3-6 sentences
  questions: string[]; // what the AI still needs answered, at most 3
  /** Next week in two to four short lines, each naming who. */
  nextWeek: string[];
  /** What management could be asked for, drawn from what is stuck. */
  suggestedAsks: Array<{ text: string; dueDate: string | null }>;
};

export type ReplanProposal = {
  summary: string;
  milestoneMoves: { id: string; title: string; oldDate: string; newDate: string }[];
  taskMoves: {
    id: string;
    title: string;
    oldStart: string;
    oldEnd: string;
    newStart: string;
    newEnd: string;
  }[];
};

export type PlanInput = { description: string; today: string; locale: Locale };

export type StatusInput = {
  locale: Locale;
  today: string;
  weekLabel: string;
  projectName: string;
  goal: string;
  nextMilestone: { title: string; date: string } | null;
  doneTasks: string[];
  doingTasks: { title: string; owner: string; endDate: string }[];
  overdueTasks: { title: string; owner: string; endDate: string }[];
  openObstacles: { title: string; status: string }[];
  economy: {
    budget: number | null;
    plannedTotal: number;
    incurredTotal: number;
    postCount: number;
  } | null;
  recentActivity: string[];
  previousStatus: string | null;
  /** The deterministic assessment, so the words agree with the colour. */
  assessment: { rag: "green" | "yellow" | "red" | "early"; reason: string };
  sinceLast: string[];
  progress: { done: number; total: number };
  /** Asks to management still open from the previous status. */
  openAsks: string[];
};

/** What the engine needs to break a milestone into tasks. */
export type BreakdownInput = {
  locale: Locale;
  today: string;
  projectName: string;
  goal: string;
  milestone: { title: string; date: string; criterion: string; ownerName: string };
  /** The first day work on this milestone can start: the day after the previous one. */
  windowStart: string;
  existingTasks: string[];
  people: string[];
};

export type TaskProposal = {
  title: string;
  owner: string;
  startDate: string;
  endDate: string;
};

export type ReplanInput = {
  locale: Locale;
  today: string;
  reason: string;
  deltaDays: number;
  movedMilestone: { id: string; title: string; oldDate: string; newDate: string } | null;
  affectedTasks: { id: string; title: string; startDate: string; endDate: string; state: string }[];
  laterMilestones: { id: string; title: string; date: string }[];
};

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChatContext = {
  locale: Locale;
  today: string;
  projectName: string;
  goal: string;
  ownerName: string;
  managerName: string;
  resources: string[];
  milestones: {
    id: string;
    title: string;
    date: string;
    done: boolean;
    ownerName: string;
    criterion: string;
  }[];
  tasks: {
    id: string;
    title: string;
    state: string;
    owner: string;
    participants: string[];
    startDate: string;
    endDate: string;
    milestoneId: string | null;
    subtasks: { title: string; done: boolean }[];
  }[];
  openObstacles: { id: string; title: string; status: string }[];
  decisions: { title: string; date: string }[];
  economy: {
    budget: number | null;
    plannedTotal: number;
    incurredTotal: number;
    expenses: {
      id: string;
      title: string;
      amount: number;
      spent: number;
      incurred: boolean;
      taskId: string | null;
    }[];
  } | null;
};

/** Everything the AI may do from the chat. Add and change, never delete. */
export type ChatReply = {
  reply: string;
  taskMoves: {
    id: string;
    title: string;
    oldStart: string;
    oldEnd: string;
    newStart: string;
    newEnd: string;
  }[];
  milestoneMoves: { id: string; title: string; oldDate: string; newDate: string }[];
  newTasks: {
    title: string;
    milestoneId: string | null;
    owner: string;
    startDate: string;
    endDate: string;
  }[];
  newMilestones: { title: string; date: string }[];
  stateChanges: { id: string; title: string; state: "todo" | "doing" | "done" }[];
  milestoneChanges: {
    id: string;
    title: string;
    milestoneId: string | null;
    milestoneTitle: string | null;
  }[];
  newDecisions: { title: string; note: string }[];
  budgetChange: { budget: number | null } | null;
  newExpenses: {
    title: string;
    amount: number;
    spent: number;
    incurred: boolean;
    taskId: string | null;
  }[];
  expenseChanges: {
    id: string;
    title: string;
    incurred: boolean | null;
    amount: number | null;
    spent: number | null;
  }[];
  newObstacles: { title: string }[];
  resolvedObstacles: { id: string; title: string }[];
  subtaskChanges: { id: string; title: string; subtasks: { title: string; done: boolean }[] }[];
  peopleChanges: {
    id: string;
    title: string;
    owner: string | null;
    participants: string[] | null;
  }[];
  milestoneUpdates: {
    id: string;
    title: string;
    newTitle: string | null;
    ownerName: string | null;
    criterion: string | null;
    done: boolean | null;
  }[];
  roleChanges: { ownerName: string | null; managerName: string | null } | null;
  newResources: string[];
};

export function emptyChatReply(reply: string): ChatReply {
  return {
    reply,
    taskMoves: [],
    milestoneMoves: [],
    newTasks: [],
    newMilestones: [],
    stateChanges: [],
    milestoneChanges: [],
    newDecisions: [],
    budgetChange: null,
    newExpenses: [],
    expenseChanges: [],
    newObstacles: [],
    resolvedObstacles: [],
    subtaskChanges: [],
    peopleChanges: [],
    milestoneUpdates: [],
    roleChanges: null,
    newResources: [],
  };
}

export function chatReplyHasChanges(r: ChatReply): boolean {
  const lists: unknown[][] = [
    r.taskMoves,
    r.milestoneMoves,
    r.newTasks,
    r.newMilestones,
    r.stateChanges,
    r.milestoneChanges,
    r.newDecisions,
    r.newExpenses,
    r.expenseChanges,
    r.newObstacles,
    r.resolvedObstacles,
    r.subtaskChanges,
    r.peopleChanges,
    r.milestoneUpdates,
    r.newResources,
  ];
  return lists.some((l) => l.length > 0) || r.budgetChange !== null || r.roleChanges !== null;
}

export type TipInput = {
  context: ChatContext;
  recentActivity: string[];
  statusHistory: { weekLabel: string; date: string; text: string }[];
  daysSinceLastStatus: number | null;
  previousTips: string[];
  observations: string[];
};

export type Tip = {
  title: string;
  text: string;
  action: string | null; // a chat instruction the tool can carry out, or null
};

export interface AiEngine {
  readonly name: string;
  generatePlan(input: PlanInput): Promise<PlanProposal>;
  draftStatus(input: StatusInput): Promise<StatusDraft>;
  /** Works the answers into the words, so a status never reads as a form. */
  reviseStatus(input: ReviseInput): Promise<{ text: string; nextWeek: string[] }>;
  proposeReplan(input: ReplanInput): Promise<ReplanProposal>;
  /** Three to seven tasks that would carry the milestone, dated inside its window. */
  proposeTasks(input: BreakdownInput): Promise<TaskProposal[]>;
  chat(context: ChatContext, history: ChatMessage[], message: string): Promise<ChatReply>;
  dailyTip(input: TipInput): Promise<Tip>;
}

export type EngineResult<T> = {
  result: T;
  engine: string;
  /** The configured model did not answer and the rules engine stepped in. */
  fallback: boolean;
  fallbackReason?: string;
};
