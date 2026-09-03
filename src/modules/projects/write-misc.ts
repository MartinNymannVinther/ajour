import { and, eq } from "drizzle-orm";
import { decisions, expenses, obstacles, projects, tasks } from "@/core/db/schema";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";
import { recordEvent, type ActorKind } from "./events";
import { personIdForName } from "./people";
import { getProjectRow } from "./read";

/** Obstacles, decisions, money and roles: small writes with an event each. */

export async function addObstacle(
  tx: AppTransaction,
  ctx: OrgContext,
  projectId: string,
  title: string,
  actor: ActorKind = "user",
): Promise<string> {
  const [row] = await tx
    .insert(obstacles)
    .values({ orgId: ctx.orgId, projectId, title, status: "open" })
    .returning({ id: obstacles.id });
  await recordEvent(tx, ctx, projectId, "obstacle.added", { title }, actor);
  return row!.id;
}

export async function resolveObstacle(
  tx: AppTransaction,
  ctx: OrgContext,
  obstacleId: string,
  actor: ActorKind = "user",
) {
  const [o] = await tx.select().from(obstacles).where(eq(obstacles.id, obstacleId)).limit(1);
  if (!o) return null;
  if (o.status !== "resolved") {
    await tx
      .update(obstacles)
      .set({ status: "resolved", resolvedAt: new Date() })
      .where(eq(obstacles.id, o.id));
    await recordEvent(tx, ctx, o.projectId, "obstacle.resolved", { title: o.title }, actor);
  }
  return o;
}

export async function addDecision(
  tx: AppTransaction,
  ctx: OrgContext,
  projectId: string,
  title: string,
  note: string,
  actor: ActorKind = "user",
): Promise<string> {
  const [row] = await tx
    .insert(decisions)
    .values({ orgId: ctx.orgId, projectId, title, note, source: actor === "ai" ? "ai" : "user" })
    .returning({ id: decisions.id });
  await recordEvent(tx, ctx, projectId, "decision.added", { title }, actor);
  return row!.id;
}

export async function setBudget(
  tx: AppTransaction,
  ctx: OrgContext,
  projectId: string,
  budget: number | null,
  actor: ActorKind = "user",
) {
  const project = await getProjectRow(tx, projectId);
  if (!project) return null;
  await tx.update(projects).set({ budget }).where(eq(projects.id, projectId));
  await recordEvent(tx, ctx, projectId, "budget.set", { amount: budget ?? "" }, actor);
  return project;
}

export async function addExpense(
  tx: AppTransaction,
  ctx: OrgContext,
  input: {
    projectId: string;
    title: string;
    amount: number;
    incurred: boolean;
    taskId: string | null;
  },
  actor: ActorKind = "user",
): Promise<string> {
  let taskId: string | null = null;
  if (input.taskId) {
    const [task] = await tx
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.id, input.taskId), eq(tasks.projectId, input.projectId)))
      .limit(1);
    taskId = task?.id ?? null;
  }
  const [row] = await tx
    .insert(expenses)
    .values({
      orgId: ctx.orgId,
      projectId: input.projectId,
      taskId,
      title: input.title,
      amount: input.amount,
      incurred: input.incurred,
    })
    .returning({ id: expenses.id });
  await recordEvent(
    tx,
    ctx,
    input.projectId,
    "expense.added",
    { title: input.title, amount: input.amount, incurred: input.incurred ? "yes" : "no" },
    actor,
  );
  return row!.id;
}

export async function updateExpense(
  tx: AppTransaction,
  ctx: OrgContext,
  expenseId: string,
  patch: { incurred?: boolean; amount?: number },
  actor: ActorKind = "user",
) {
  const [e] = await tx.select().from(expenses).where(eq(expenses.id, expenseId)).limit(1);
  if (!e) return null;
  await tx.update(expenses).set(patch).where(eq(expenses.id, e.id));
  await recordEvent(
    tx,
    ctx,
    e.projectId,
    "expense.toggled",
    {
      title: e.title,
      incurred: (patch.incurred ?? e.incurred) ? "yes" : "no",
      amount: patch.amount ?? e.amount,
    },
    actor,
  );
  return e;
}

export async function removeExpense(tx: AppTransaction, ctx: OrgContext, expenseId: string) {
  const [e] = await tx.select().from(expenses).where(eq(expenses.id, expenseId)).limit(1);
  if (!e) return null;
  await tx.delete(expenses).where(eq(expenses.id, e.id));
  await recordEvent(tx, ctx, e.projectId, "expense.removed", { title: e.title, amount: e.amount });
  return e;
}

export async function setRoles(
  tx: AppTransaction,
  ctx: OrgContext,
  projectId: string,
  owner: string | null,
  manager: string | null,
  actor: ActorKind = "user",
) {
  const project = await getProjectRow(tx, projectId);
  if (!project) return null;
  const patch: Partial<typeof projects.$inferInsert> = {};
  if (owner !== null) patch.ownerPersonId = await personIdForName(tx, ctx, owner);
  if (manager !== null) patch.managerPersonId = await personIdForName(tx, ctx, manager);
  await tx.update(projects).set(patch).where(eq(projects.id, projectId));
  await recordEvent(
    tx,
    ctx,
    projectId,
    "roles.set",
    { owner: owner ?? "", manager: manager ?? "" },
    actor,
  );
  return project;
}

export async function updateProjectMeta(
  tx: AppTransaction,
  ctx: OrgContext,
  projectId: string,
  patch: { name?: string; goal?: string },
) {
  const project = await getProjectRow(tx, projectId);
  if (!project) return null;
  await tx.update(projects).set(patch).where(eq(projects.id, projectId));
  return project;
}
