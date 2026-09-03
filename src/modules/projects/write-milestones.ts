import { eq } from "drizzle-orm";
import { milestones, tasks } from "@/core/db/schema";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";
import { recordEvent, type ActorKind } from "./events";
import { personIdForName } from "./people";
import { takeSnapshot } from "./snapshots";
import { Conflict } from "./write-tasks";

async function milestoneRow(tx: AppTransaction, milestoneId: string) {
  const [row] = await tx.select().from(milestones).where(eq(milestones.id, milestoneId)).limit(1);
  return row ?? null;
}

export async function createMilestone(
  tx: AppTransaction,
  ctx: OrgContext,
  input: {
    projectId: string;
    title: string;
    date: string;
    owner?: string;
    criterion?: string;
    sort?: number;
  },
  actor: ActorKind = "user",
): Promise<string> {
  const ownerPersonId = await personIdForName(tx, ctx, input.owner ?? "");
  const [row] = await tx
    .insert(milestones)
    .values({
      orgId: ctx.orgId,
      projectId: input.projectId,
      title: input.title,
      date: input.date,
      ownerPersonId,
      criterion: input.criterion ?? "",
      sort: input.sort ?? 99,
    })
    .returning({ id: milestones.id });
  await recordEvent(
    tx,
    ctx,
    input.projectId,
    "milestone.created",
    { title: input.title, date: input.date },
    actor,
  );
  return row!.id;
}

export async function updateMilestone(
  tx: AppTransaction,
  ctx: OrgContext,
  input: {
    milestoneId: string;
    title?: string;
    date?: string;
    owner?: string;
    criterion?: string;
    expectedUpdatedAt?: string;
  },
  actor: ActorKind = "user",
) {
  const m = await milestoneRow(tx, input.milestoneId);
  if (!m) return null;
  if (input.expectedUpdatedAt && m.updatedAt.toISOString() !== input.expectedUpdatedAt)
    throw new Conflict();
  const patch: Partial<typeof milestones.$inferInsert> = {};
  const payload: Record<string, unknown> = { title: input.title ?? m.title };
  if (input.title !== undefined && input.title !== m.title) {
    patch.title = input.title;
    payload.renamedFrom = m.title;
  }
  if (input.date !== undefined && input.date !== m.date) {
    patch.date = input.date;
    payload.dateFrom = m.date;
    payload.dateTo = input.date;
  }
  if (input.owner !== undefined) patch.ownerPersonId = await personIdForName(tx, ctx, input.owner);
  if (input.criterion !== undefined) patch.criterion = input.criterion;
  if (Object.keys(patch).length === 0) return m;
  await tx.update(milestones).set(patch).where(eq(milestones.id, m.id));
  await recordEvent(tx, ctx, m.projectId, "milestone.updated", payload, actor);
  return m;
}

export async function setMilestoneDone(
  tx: AppTransaction,
  ctx: OrgContext,
  milestoneId: string,
  done: boolean,
  actor: ActorKind = "user",
) {
  const m = await milestoneRow(tx, milestoneId);
  if (!m) return null;
  if (Boolean(m.doneAt) === done) return m;
  await tx
    .update(milestones)
    .set({ doneAt: done ? new Date() : null })
    .where(eq(milestones.id, m.id));
  await recordEvent(
    tx,
    ctx,
    m.projectId,
    done ? "milestone.done" : "milestone.reopened",
    { title: m.title },
    actor,
  );
  return m;
}

/** Its tasks survive under "other tasks"; a copy of the plan is taken first. */
export async function deleteMilestone(tx: AppTransaction, ctx: OrgContext, milestoneId: string) {
  const m = await milestoneRow(tx, milestoneId);
  if (!m) return null;
  await takeSnapshot(tx, ctx, m.projectId, `Before deleting milestone "${m.title}"`, "system");
  await tx.update(tasks).set({ milestoneId: null }).where(eq(tasks.milestoneId, m.id));
  await tx.delete(milestones).where(eq(milestones.id, m.id));
  await recordEvent(tx, ctx, m.projectId, "milestone.deleted", { title: m.title });
  return m;
}

/** A plain date move without replanning; the timeline drag goes through replan instead. */
export async function moveMilestone(
  tx: AppTransaction,
  ctx: OrgContext,
  milestoneId: string,
  date: string,
  actor: ActorKind = "user",
) {
  return updateMilestone(tx, ctx, { milestoneId, date }, actor);
}
