import type {
  Decision,
  Expense,
  Milestone,
  Obstacle,
  Person,
  Project,
  ProjectEvent,
  ShareLink,
  Snapshot,
  StatusUpdate,
  Task,
} from "@/core/db/schema";

/**
 * What the pages and the AI see: the rows of a project with the people on
 * them resolved to names. People are identities in the database; names are
 * how humans and models refer to them.
 */

export type TaskView = Task & {
  ownerName: string;
  participantIds: string[];
  participants: string[];
};

export type MilestoneView = Milestone & { ownerName: string };

export type ProjectView = Project & { ownerName: string; managerName: string };

export type ShareLinkView = Omit<ShareLink, "tokenHash">;

export type ProjectFull = {
  project: ProjectView;
  people: Person[];
  milestones: MilestoneView[];
  tasks: TaskView[];
  obstacles: Obstacle[];
  decisions: Decision[];
  statusUpdates: StatusUpdate[];
  expenses: Expense[];
  snapshots: Array<Pick<Snapshot, "id" | "label" | "reason" | "createdAt">>;
  events: ProjectEvent[];
  shareLinks: ShareLinkView[];
};

export type ProjectSummary = {
  id: string;
  name: string;
  goal: string;
  description: string;
  createdAt: Date;
  archivedAt: Date | null;
  taskCount: number;
  doneCount: number;
  nextMilestone: { title: string; date: string } | null;
  latestStatusAt: Date | null;
};

/** Every mutation answers with one of these; the UI never sees a stack. */
export type Result<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: "unauthorized" | "invalid" | "notFound" | "conflict" | "generic" };

export const ok = <T>(data: T): Result<T> => ({ ok: true, data });
export const fail = <T = undefined>(
  error: Extract<Result<T>, { ok: false }>["error"],
): Result<T> => ({
  ok: false,
  error,
});
