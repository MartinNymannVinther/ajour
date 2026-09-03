import { and, eq } from "drizzle-orm";
import { milestones, projects, tasks } from "@/core/db/schema";
import { withOrgContext, type AppTransaction, type OrgContext } from "@/core/db/tenant";
import type { PlanProposal, ReplanInput, ReplanProposal } from "@/modules/ai/types";
import { diffDays, todayInCopenhagen } from "@/core/dates";
import { recordEvent } from "./events";
import { personIdForName } from "./people";
import { takeSnapshot } from "./snapshots";
import { addDecision } from "./write-misc";
import { orderedDates } from "./validation";

/**
 * The Start and Skred flows on the write side: a proposal becomes a
 * project, and a milestone dragged on the timeline becomes a replan the
 * person said yes to.
 */

export async function createProjectFromProposal(
  ctx: OrgContext,
  proposal: PlanProposal,
  description: string,
  templateKey: string | null,
): Promise<string> {
  return withOrgContext(ctx, async (tx) => {
    const [project] = await tx
      .insert(projects)
      .values({
        orgId: ctx.orgId,
        name: proposal.name,
        description,
        goal: proposal.goal,
        budget: proposal.budget,
        templateKey,
        createdBy: ctx.userId,
      })
      .returning({ id: projects.id });
    const projectId = project!.id;
    const milestoneIds: string[] = [];
    for (const [i, m] of proposal.milestones.entries()) {
      const [row] = await tx
        .insert(milestones)
        .values({ orgId: ctx.orgId, projectId, title: m.title, date: m.date, sort: i })
        .returning({ id: milestones.id });
      milestoneIds.push(row!.id);
    }
    for (const t of proposal.tasks) {
      const [startDate, endDate] = orderedDates(t.startDate, t.endDate);
      await tx.insert(tasks).values({
        orgId: ctx.orgId,
        projectId,
        milestoneId: t.milestoneIndex === null ? null : (milestoneIds[t.milestoneIndex] ?? null),
        title: t.title,
        ownerPersonId: await personIdForName(tx, ctx, t.owner),
        startDate,
        endDate,
      });
    }
    await recordEvent(tx, ctx, projectId, "project.created", { name: proposal.name });
    return projectId;
  });
}

/** The facts a replan is proposed from: the moved milestone and what hangs on it. */
export async function buildReplanInput(
  tx: AppTransaction,
  milestoneId: string,
  newDate: string,
  locale: "da" | "en",
  reason: (title: string, from: string, to: string) => string,
): Promise<{ input: ReplanInput; projectId: string } | null> {
  const [m] = await tx.select().from(milestones).where(eq(milestones.id, milestoneId)).limit(1);
  if (!m) return null;
  const delta = diffDays(m.date, newDate);
  const affected = await tx
    .select()
    .from(tasks)
    .where(and(eq(tasks.projectId, m.projectId), eq(tasks.milestoneId, m.id)));
  const later = (
    await tx.select().from(milestones).where(eq(milestones.projectId, m.projectId))
  ).filter((x) => x.id !== m.id && x.date > m.date && !x.doneAt);
  return {
    projectId: m.projectId,
    input: {
      locale,
      today: todayInCopenhagen(),
      reason: reason(m.title, m.date, newDate),
      deltaDays: delta,
      movedMilestone: { id: m.id, title: m.title, oldDate: m.date, newDate },
      affectedTasks: affected.map((t) => ({
        id: t.id,
        title: t.title,
        startDate: t.startDate,
        endDate: t.endDate,
        state: t.state,
      })),
      laterMilestones:
        delta > 0 ? later.map((x) => ({ id: x.id, title: x.title, date: x.date })) : [],
    },
  };
}

/**
 * Applies a replan the person approved. Every id is checked against the
 * project again here, at the write boundary: the proposal came back from
 * the browser, and a browser can say anything.
 */
export async function applyReplan(
  tx: AppTransaction,
  ctx: OrgContext,
  projectId: string,
  moved: { id: string; newDate: string },
  proposal: ReplanProposal,
  labels: {
    snapshot: (title: string) => string;
    decision: (title: string, date: string) => string;
  },
): Promise<boolean> {
  const [m] = await tx
    .select()
    .from(milestones)
    .where(and(eq(milestones.id, moved.id), eq(milestones.projectId, projectId)))
    .limit(1);
  if (!m) return false;
  const known = new Set(
    (
      await tx
        .select({ id: milestones.id })
        .from(milestones)
        .where(eq(milestones.projectId, projectId))
    ).map((x) => x.id),
  );
  const knownTasks = new Set(
    (await tx.select({ id: tasks.id }).from(tasks).where(eq(tasks.projectId, projectId))).map(
      (x) => x.id,
    ),
  );
  await takeSnapshot(tx, ctx, projectId, labels.snapshot(m.title), "system");
  await tx.update(milestones).set({ date: moved.newDate }).where(eq(milestones.id, m.id));
  let count = 0;
  for (const mm of proposal.milestoneMoves) {
    if (!known.has(mm.id) || mm.id === m.id) continue;
    await tx.update(milestones).set({ date: mm.newDate }).where(eq(milestones.id, mm.id));
    count++;
  }
  for (const tm of proposal.taskMoves) {
    if (!knownTasks.has(tm.id)) continue;
    const [start, end] = orderedDates(tm.newStart, tm.newEnd);
    await tx.update(tasks).set({ startDate: start, endDate: end }).where(eq(tasks.id, tm.id));
    count++;
  }
  await addDecision(
    tx,
    ctx,
    projectId,
    labels.decision(m.title, moved.newDate),
    proposal.summary.slice(0, 400),
  );
  await recordEvent(tx, ctx, projectId, "replan.applied", {
    milestone: m.title,
    date: moved.newDate,
    moved: count,
  });
  return true;
}
