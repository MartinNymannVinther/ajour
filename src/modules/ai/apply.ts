import { eq } from "drizzle-orm";
import { people, taskParticipants, tasks } from "@/core/db/schema";
import type { OrgContext, AppTransaction } from "@/core/db/tenant";
import { personIdsForNames } from "@/modules/projects/people";
import type { CreatedRows } from "@/modules/projects/snapshots";
import {
  createMilestone,
  setMilestoneDone,
  updateMilestone,
} from "@/modules/projects/write-milestones";
import {
  addDecision,
  addExpense,
  addObstacle,
  resolveObstacle,
  setBudget,
  setRoles,
  updateExpense,
} from "@/modules/projects/write-misc";
import {
  createTask,
  moveTask,
  relinkTask,
  setTaskState,
  updateSubtasks,
  updateTaskPeople,
} from "@/modules/projects/write-tasks";
import type { ChatReply } from "./types";

/**
 * Carries out what a sanitized chat reply asks for, through the same
 * services a person's clicks go through, so every change is validated,
 * audited and recorded as an event with the AI as actor. The caller has
 * taken a snapshot first. Returns what was done as structured lines (the
 * same shape as events, rendered later in the reader's language) and the
 * ids of rows created, so an undo can remove exactly those.
 */
export type AppliedLine = { type: string; payload: Record<string, unknown> };

export type Applied = { lines: AppliedLine[]; created: CreatedRows };

export async function applyChatReply(
  tx: AppTransaction,
  ctx: OrgContext,
  projectId: string,
  reply: ChatReply,
): Promise<Applied> {
  const lines: AppliedLine[] = [];
  const created: Required<CreatedRows> = {
    tasks: [],
    milestones: [],
    expenses: [],
    obstacles: [],
    decisions: [],
  };
  const actor = "ai" as const;

  for (const mm of reply.milestoneMoves) {
    await updateMilestone(tx, ctx, { milestoneId: mm.id, date: mm.newDate }, actor);
    lines.push({
      type: "milestone.updated",
      payload: { title: mm.title, dateFrom: mm.oldDate, dateTo: mm.newDate },
    });
  }
  for (const tm of reply.taskMoves) {
    await moveTask(tx, ctx, tm.id, tm.newStart, tm.newEnd, actor);
    lines.push({
      type: "task.moved",
      payload: { title: tm.title, start: tm.newStart, end: tm.newEnd },
    });
  }
  for (const nm of reply.newMilestones) {
    const id = await createMilestone(tx, ctx, { projectId, title: nm.title, date: nm.date }, actor);
    created.milestones.push(id);
    lines.push({ type: "milestone.created", payload: { title: nm.title, date: nm.date } });
  }
  for (const nt of reply.newTasks) {
    const id = await createTask(
      tx,
      ctx,
      {
        projectId,
        title: nt.title,
        milestoneId: nt.milestoneId,
        owner: nt.owner,
        startDate: nt.startDate,
        endDate: nt.endDate,
      },
      actor,
    );
    created.tasks.push(id);
    lines.push({
      type: "task.created",
      payload: { title: nt.title, start: nt.startDate, end: nt.endDate },
    });
  }
  for (const sc of reply.stateChanges) {
    await setTaskState(tx, ctx, sc.id, sc.state, actor);
    lines.push({ type: "task.state", payload: { title: sc.title, state: sc.state } });
  }
  for (const mc of reply.milestoneChanges) {
    const task = await relinkTaskKeepingDates(tx, ctx, mc.id, mc.milestoneId);
    if (task)
      lines.push({
        type: "task.relinked",
        payload: { title: mc.title, milestone: mc.milestoneTitle ?? "" },
      });
  }
  for (const nd of reply.newDecisions) {
    const id = await addDecision(tx, ctx, projectId, nd.title, nd.note, actor);
    created.decisions.push(id);
    lines.push({ type: "decision.added", payload: { title: nd.title } });
  }
  if (reply.budgetChange) {
    await setBudget(tx, ctx, projectId, reply.budgetChange.budget, actor);
    lines.push({ type: "budget.set", payload: { amount: reply.budgetChange.budget ?? "" } });
  }
  for (const ne of reply.newExpenses) {
    const id = await addExpense(tx, ctx, { projectId, ...ne }, actor);
    created.expenses.push(id);
    lines.push({
      type: "expense.added",
      payload: { title: ne.title, amount: ne.amount, incurred: ne.incurred ? "yes" : "no" },
    });
  }
  for (const ec of reply.expenseChanges) {
    const patch: { incurred?: boolean; amount?: number } = {};
    if (ec.incurred !== null) patch.incurred = ec.incurred;
    if (ec.amount !== null) patch.amount = ec.amount;
    const row = await updateExpense(tx, ctx, ec.id, patch, actor);
    if (row)
      lines.push({
        type: "expense.toggled",
        payload: {
          title: ec.title,
          incurred: (ec.incurred ?? row.incurred) ? "yes" : "no",
          amount: ec.amount ?? row.amount,
        },
      });
  }
  for (const no of reply.newObstacles) {
    const id = await addObstacle(tx, ctx, projectId, no.title, actor);
    created.obstacles.push(id);
    lines.push({ type: "obstacle.added", payload: { title: no.title } });
  }
  for (const ro of reply.resolvedObstacles) {
    await resolveObstacle(tx, ctx, ro.id, actor);
    lines.push({ type: "obstacle.resolved", payload: { title: ro.title } });
  }
  for (const sc of reply.subtaskChanges) {
    await updateSubtasks(tx, ctx, sc.id, sc.subtasks, actor);
    lines.push({ type: "task.subtasks", payload: { title: sc.title, count: sc.subtasks.length } });
  }
  for (const pc of reply.peopleChanges) {
    const task = await updateTaskPeople(
      tx,
      ctx,
      {
        taskId: pc.id,
        owner: pc.owner ?? (await currentOwnerName(tx, ctx, pc.id)),
        participants: pc.participants ?? (await currentParticipants(tx, ctx, pc.id)),
      },
      actor,
    );
    if (task)
      lines.push({
        type: "task.people",
        payload: { title: pc.title, owner: pc.owner ?? "", participants: pc.participants ?? [] },
      });
  }
  for (const mu of reply.milestoneUpdates) {
    await updateMilestone(
      tx,
      ctx,
      {
        milestoneId: mu.id,
        title: mu.newTitle ?? undefined,
        owner: mu.ownerName ?? undefined,
        criterion: mu.criterion ?? undefined,
      },
      actor,
    );
    if (mu.done !== null) await setMilestoneDone(tx, ctx, mu.id, mu.done, actor);
    lines.push({
      type: "milestone.updated",
      payload: { title: mu.newTitle ?? mu.title, renamedFrom: mu.newTitle ? mu.title : "" },
    });
  }
  if (reply.roleChanges) {
    await setRoles(
      tx,
      ctx,
      projectId,
      reply.roleChanges.ownerName,
      reply.roleChanges.managerName,
      actor,
    );
    lines.push({
      type: "roles.set",
      payload: {
        owner: reply.roleChanges.ownerName ?? "",
        manager: reply.roleChanges.managerName ?? "",
      },
    });
  }
  if (reply.newResources.length > 0) {
    await personIdsForNames(tx, ctx, reply.newResources, 10);
    lines.push({ type: "people.added", payload: { names: reply.newResources } });
  }
  return { lines, created };
}

/** A milestone change from the chat keeps the task's own dates. */
async function relinkTaskKeepingDates(
  tx: AppTransaction,
  ctx: OrgContext,
  taskId: string,
  milestoneId: string | null,
) {
  const [task] = await tx.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) return null;
  return relinkTask(tx, ctx, taskId, milestoneId, task.startDate, task.endDate, "ai");
}

async function currentOwnerName(
  tx: AppTransaction,
  ctx: OrgContext,
  taskId: string,
): Promise<string> {
  void ctx;
  const [row] = await tx
    .select({ name: people.name })
    .from(tasks)
    .leftJoin(people, eq(people.id, tasks.ownerPersonId))
    .where(eq(tasks.id, taskId))
    .limit(1);
  return row?.name ?? "";
}

async function currentParticipants(
  tx: AppTransaction,
  ctx: OrgContext,
  taskId: string,
): Promise<string[]> {
  void ctx;
  const rows = await tx
    .select({ name: people.name })
    .from(taskParticipants)
    .innerJoin(people, eq(people.id, taskParticipants.personId))
    .where(eq(taskParticipants.taskId, taskId));
  return rows.map((r) => r.name);
}
