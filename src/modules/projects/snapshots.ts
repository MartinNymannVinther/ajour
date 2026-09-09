import { and, eq, inArray } from "drizzle-orm";
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
} from "@/core/db/schema";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";
import { recordEvent } from "./events";
import { parseSnapshot, takeSnapshot, type CreatedRows, type SnapshotData } from "./snapshot-data";

export { collectSnapshot, parseSnapshot, takeSnapshot } from "./snapshot-data";
export type { CreatedRows, SnapshotData } from "./snapshot-data";

/**
 * A copy of the whole project, taken before anything that should be
 * undoable: a replan, a deletion, every change the AI makes.
 *
 * Restoring is deliberately conservative. It puts back the rows the copy
 * knows about, exactly as they were, and recreates the ones deleted since;
 * rows created after the copy are left alone, because with several people
 * in a workspace they may be someone else's work. The one exception is an
 * undo of a specific operation, which also removes exactly the rows that
 * operation created (`created`).
 */

const asDate = (iso: string | null) => (iso ? new Date(iso) : null);

/**
 * Writes a copy back. Touches only rows the copy knows plus, for an undo,
 * the rows that operation created. The caller takes a fresh snapshot first
 * so the restore itself can be undone.
 */
export async function restoreSnapshot(
  tx: AppTransaction,
  ctx: OrgContext,
  projectId: string,
  data: SnapshotData,
  created: CreatedRows = {},
): Promise<void> {
  // People a task or milestone points at may have been removed since.
  const existingPeople = new Set(
    (await tx.select({ id: people.id }).from(people)).map((p) => p.id),
  );
  for (const p of data.people) {
    if (!existingPeople.has(p.id)) {
      await tx
        .insert(people)
        .values({ id: p.id, orgId: ctx.orgId, name: p.name })
        .onConflictDoNothing();
    }
  }

  const currentMs = new Set(
    (
      await tx
        .select({ id: milestones.id })
        .from(milestones)
        .where(eq(milestones.projectId, projectId))
    ).map((m) => m.id),
  );
  for (const m of data.milestones) {
    const values = {
      title: m.title,
      date: m.date,
      doneAt: asDate(m.doneAt),
      ownerPersonId: m.ownerPersonId,
      criterion: m.criterion,
      fixed: m.fixed ?? false,
      sort: m.sort,
    };
    if (currentMs.has(m.id)) await tx.update(milestones).set(values).where(eq(milestones.id, m.id));
    else await tx.insert(milestones).values({ id: m.id, orgId: ctx.orgId, projectId, ...values });
  }

  const currentTasks = new Set(
    (await tx.select({ id: tasks.id }).from(tasks).where(eq(tasks.projectId, projectId))).map(
      (t) => t.id,
    ),
  );
  for (const t of data.tasks) {
    const values = {
      title: t.title,
      ownerPersonId: t.ownerPersonId,
      milestoneId: t.milestoneId,
      milestoneRelation: t.milestoneRelation,
      state: t.state,
      startDate: t.startDate,
      endDate: t.endDate,
      subtasks: t.subtasks,
    };
    if (currentTasks.has(t.id)) await tx.update(tasks).set(values).where(eq(tasks.id, t.id));
    else await tx.insert(tasks).values({ id: t.id, orgId: ctx.orgId, projectId, ...values });
    await tx.delete(taskParticipants).where(eq(taskParticipants.taskId, t.id));
    if (t.participantIds.length > 0) {
      await tx
        .insert(taskParticipants)
        .values(t.participantIds.map((personId) => ({ orgId: ctx.orgId, taskId: t.id, personId })))
        .onConflictDoNothing();
    }
  }

  const currentEx = new Set(
    (
      await tx.select({ id: expenses.id }).from(expenses).where(eq(expenses.projectId, projectId))
    ).map((e) => e.id),
  );
  for (const e of data.expenses) {
    // Snapshots from before partial spend carry the flag only.
    const spent = e.spent ?? (e.incurred ? e.amount : 0);
    const values = {
      taskId: e.taskId,
      title: e.title,
      amount: e.amount,
      spent,
      incurred: e.incurred,
    };
    if (currentEx.has(e.id)) await tx.update(expenses).set(values).where(eq(expenses.id, e.id));
    else await tx.insert(expenses).values({ id: e.id, orgId: ctx.orgId, projectId, ...values });
  }
  const currentOb = new Set(
    (
      await tx
        .select({ id: obstacles.id })
        .from(obstacles)
        .where(eq(obstacles.projectId, projectId))
    ).map((o) => o.id),
  );
  for (const o of data.obstacles) {
    const values = {
      title: o.title,
      note: o.note,
      status: o.status,
      resolvedAt: asDate(o.resolvedAt),
    };
    if (currentOb.has(o.id)) await tx.update(obstacles).set(values).where(eq(obstacles.id, o.id));
    else await tx.insert(obstacles).values({ id: o.id, orgId: ctx.orgId, projectId, ...values });
  }
  const currentDe = new Set(
    (
      await tx
        .select({ id: decisions.id })
        .from(decisions)
        .where(eq(decisions.projectId, projectId))
    ).map((d) => d.id),
  );
  for (const d of data.decisions) {
    const values = { title: d.title, note: d.note, source: d.source };
    if (currentDe.has(d.id)) await tx.update(decisions).set(values).where(eq(decisions.id, d.id));
    else await tx.insert(decisions).values({ id: d.id, orgId: ctx.orgId, projectId, ...values });
  }

  await tx.update(projects).set(data.project).where(eq(projects.id, projectId));

  // An undo removes what the operation itself created, and only that.
  const scoped = (ids: string[] | undefined) => (ids ?? []).filter(Boolean);
  if (scoped(created.tasks).length)
    await tx
      .delete(tasks)
      .where(and(eq(tasks.projectId, projectId), inArray(tasks.id, scoped(created.tasks))));
  if (scoped(created.milestones).length)
    await tx
      .delete(milestones)
      .where(
        and(
          eq(milestones.projectId, projectId),
          inArray(milestones.id, scoped(created.milestones)),
        ),
      );
  if (scoped(created.expenses).length)
    await tx
      .delete(expenses)
      .where(
        and(eq(expenses.projectId, projectId), inArray(expenses.id, scoped(created.expenses))),
      );
  if (scoped(created.obstacles).length)
    await tx
      .delete(obstacles)
      .where(
        and(eq(obstacles.projectId, projectId), inArray(obstacles.id, scoped(created.obstacles))),
      );
  if (scoped(created.decisions).length)
    await tx
      .delete(decisions)
      .where(
        and(eq(decisions.projectId, projectId), inArray(decisions.id, scoped(created.decisions))),
      );
}

/** Restore by id, with a safety copy first; returns the label of what was restored. */
export async function restoreSnapshotById(
  tx: AppTransaction,
  ctx: OrgContext,
  snapshotId: string,
  created: CreatedRows = {},
  beforeLabel: (label: string) => string = (label) => `Before restoring "${label}"`,
): Promise<{ projectId: string; label: string } | null> {
  const [row] = await tx.select().from(snapshots).where(eq(snapshots.id, snapshotId)).limit(1);
  if (!row) return null;
  const data = parseSnapshot(row.data);
  if (!data) return null;
  await takeSnapshot(tx, ctx, row.projectId, beforeLabel(row.label), "system");
  await restoreSnapshot(tx, ctx, row.projectId, data, created);
  await recordEvent(tx, ctx, row.projectId, "snapshot.restored", { label: row.label });
  return { projectId: row.projectId, label: row.label };
}
