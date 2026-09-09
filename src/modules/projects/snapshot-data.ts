import { eq, inArray } from "drizzle-orm";
import {
  decisions,
  expenses,
  milestones,
  obstacles,
  people,
  projects,
  snapshots,
  taskParticipants,
  tasks,
  type Subtask,
} from "@/core/db/schema";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";
import type { ActorKind } from "./events";

/**
 * The shape of a snapshot and how one is taken. Restoring lives in
 * `snapshots.ts`; the two halves are kept apart because taking a copy is
 * a few selects, while putting one back is the careful part.
 */

export type SnapshotData = {
  version: 2;
  project: {
    name: string;
    goal: string;
    budget: number | null;
    ownerPersonId: string | null;
    managerPersonId: string | null;
  };
  people: Array<{ id: string; name: string }>;
  milestones: Array<{
    id: string;
    title: string;
    date: string;
    doneAt: string | null;
    ownerPersonId: string | null;
    criterion: string;
    fixed?: boolean;
    sort: number;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    ownerPersonId: string | null;
    participantIds: string[];
    milestoneId: string | null;
    milestoneRelation: string;
    state: string;
    startDate: string;
    endDate: string;
    subtasks: Subtask[];
  }>;
  expenses: Array<{
    id: string;
    taskId: string | null;
    title: string;
    amount: number;
    spent?: number;
    incurred: boolean;
  }>;
  obstacles: Array<{
    id: string;
    title: string;
    note: string;
    status: string;
    resolvedAt: string | null;
  }>;
  decisions: Array<{ id: string; title: string; note: string; source: string }>;
};

/** Ids an operation created, so an undo can remove exactly those. */
export type CreatedRows = {
  tasks?: string[];
  milestones?: string[];
  expenses?: string[];
  obstacles?: string[];
  decisions?: string[];
};

export async function collectSnapshot(
  tx: AppTransaction,
  projectId: string,
): Promise<SnapshotData | null> {
  const [project] = await tx.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) return null;
  const ms = await tx.select().from(milestones).where(eq(milestones.projectId, projectId));
  const ts = await tx.select().from(tasks).where(eq(tasks.projectId, projectId));
  const ex = await tx.select().from(expenses).where(eq(expenses.projectId, projectId));
  const ob = await tx.select().from(obstacles).where(eq(obstacles.projectId, projectId));
  const de = await tx.select().from(decisions).where(eq(decisions.projectId, projectId));
  const pe = await tx.select({ id: people.id, name: people.name }).from(people);
  const participants =
    ts.length === 0
      ? []
      : await tx
          .select()
          .from(taskParticipants)
          .where(
            inArray(
              taskParticipants.taskId,
              ts.map((t) => t.id),
            ),
          );
  return {
    version: 2,
    project: {
      name: project.name,
      goal: project.goal,
      budget: project.budget,
      ownerPersonId: project.ownerPersonId,
      managerPersonId: project.managerPersonId,
    },
    people: pe,
    milestones: ms.map((m) => ({
      id: m.id,
      title: m.title,
      date: m.date,
      doneAt: m.doneAt ? m.doneAt.toISOString() : null,
      ownerPersonId: m.ownerPersonId,
      criterion: m.criterion,
      fixed: m.fixed,
      sort: m.sort,
    })),
    tasks: ts.map((t) => ({
      id: t.id,
      title: t.title,
      ownerPersonId: t.ownerPersonId,
      participantIds: participants.filter((p) => p.taskId === t.id).map((p) => p.personId),
      milestoneId: t.milestoneId,
      milestoneRelation: t.milestoneRelation,
      state: t.state,
      startDate: t.startDate,
      endDate: t.endDate,
      subtasks: t.subtasks,
    })),
    expenses: ex.map((e) => ({
      id: e.id,
      taskId: e.taskId,
      title: e.title,
      amount: e.amount,
      spent: e.spent,
      incurred: e.incurred,
    })),
    obstacles: ob.map((o) => ({
      id: o.id,
      title: o.title,
      note: o.note,
      status: o.status,
      resolvedAt: o.resolvedAt ? o.resolvedAt.toISOString() : null,
    })),
    decisions: de.map((d) => ({ id: d.id, title: d.title, note: d.note, source: d.source })),
  };
}

export async function takeSnapshot(
  tx: AppTransaction,
  ctx: OrgContext,
  projectId: string,
  label: string,
  reason: ActorKind = "user",
): Promise<string | null> {
  const data = await collectSnapshot(tx, projectId);
  if (!data) return null;
  const [row] = await tx
    .insert(snapshots)
    .values({
      orgId: ctx.orgId,
      projectId,
      label: label.trim().slice(0, 120) || "Snapshot",
      reason,
      data,
      createdBy: ctx.userId,
    })
    .returning({ id: snapshots.id });
  return row?.id ?? null;
}

export function parseSnapshot(raw: unknown): SnapshotData | null {
  const d = raw as SnapshotData | null;
  if (!d || d.version !== 2 || !Array.isArray(d.milestones) || !Array.isArray(d.tasks)) return null;
  return d;
}
