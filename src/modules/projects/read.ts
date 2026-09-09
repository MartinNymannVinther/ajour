import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import {
  decisions,
  events,
  expenses,
  milestones,
  obstacles,
  participantReplies,
  people,
  projects,
  shareLinks,
  snapshots,
  statusUpdates,
  taskParticipants,
  tasks,
} from "@/core/db/schema";
import { withOrgContext, type AppTransaction, type OrgContext } from "@/core/db/tenant";
import type { MilestoneView, ProjectFull, ProjectSummary, ReplyView, TaskView } from "./types";

/**
 * Reads. Everything goes through the tenant-scoped transaction; the ids in
 * a URL are looked up inside the active workspace and simply do not exist
 * outside it.
 */

/** Milestones and tasks of a project with the people on them, ready for the plan. */
export async function loadPlan(tx: AppTransaction, projectId: string) {
  // One transaction is one connection: queries run one after another.
  const milestoneRows = await tx
    .select()
    .from(milestones)
    .where(eq(milestones.projectId, projectId))
    .orderBy(asc(milestones.date), asc(milestones.sort));
  const taskRows = await tx
    .select()
    .from(tasks)
    .where(eq(tasks.projectId, projectId))
    .orderBy(asc(tasks.startDate), asc(tasks.createdAt));
  const workspacePeople = await tx.select().from(people).orderBy(asc(people.name));
  const names = new Map(workspacePeople.map((p) => [p.id, p.name]));
  const participantRows =
    taskRows.length === 0
      ? []
      : await tx
          .select()
          .from(taskParticipants)
          .where(
            inArray(
              taskParticipants.taskId,
              taskRows.map((t) => t.id),
            ),
          );
  const byTask = new Map<string, string[]>();
  for (const row of participantRows) {
    byTask.set(row.taskId, [...(byTask.get(row.taskId) ?? []), row.personId]);
  }
  const taskViews: TaskView[] = taskRows.map((t) => {
    const participantIds = byTask.get(t.id) ?? [];
    return {
      ...t,
      ownerName: (t.ownerPersonId && names.get(t.ownerPersonId)) || "",
      participantIds,
      participants: participantIds.map((id) => names.get(id) ?? "").filter(Boolean),
    };
  });
  const milestoneViews: MilestoneView[] = milestoneRows.map((m) => ({
    ...m,
    ownerName: (m.ownerPersonId && names.get(m.ownerPersonId)) || "",
  }));
  return { milestones: milestoneViews, tasks: taskViews, people: workspacePeople, names };
}

export async function getProjectRow(tx: AppTransaction, projectId: string) {
  const [row] = await tx.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  return row ?? null;
}

export async function readProjectFull(
  tx: AppTransaction,
  projectId: string,
): Promise<ProjectFull | null> {
  const project = await getProjectRow(tx, projectId);
  if (!project) return null;
  const plan = await loadPlan(tx, projectId);
  const obstacleRows = await tx
    .select()
    .from(obstacles)
    .where(eq(obstacles.projectId, projectId))
    .orderBy(desc(obstacles.createdAt));
  const decisionRows = await tx
    .select()
    .from(decisions)
    .where(eq(decisions.projectId, projectId))
    .orderBy(desc(decisions.createdAt));
  const statusRows = await tx
    .select()
    .from(statusUpdates)
    .where(eq(statusUpdates.projectId, projectId))
    .orderBy(desc(statusUpdates.createdAt));
  const expenseRows = await tx
    .select()
    .from(expenses)
    .where(eq(expenses.projectId, projectId))
    .orderBy(asc(expenses.createdAt));
  const snapshotRows = await tx
    .select({
      id: snapshots.id,
      label: snapshots.label,
      reason: snapshots.reason,
      createdAt: snapshots.createdAt,
    })
    .from(snapshots)
    .where(eq(snapshots.projectId, projectId))
    .orderBy(desc(snapshots.createdAt))
    .limit(50);
  const eventRows = await tx
    .select()
    .from(events)
    .where(eq(events.projectId, projectId))
    .orderBy(desc(events.createdAt))
    .limit(30);
  const replyRows = await tx
    .select()
    .from(participantReplies)
    .where(eq(participantReplies.projectId, projectId))
    .orderBy(desc(participantReplies.createdAt))
    .limit(50);
  const taskTitles = new Map(plan.tasks.map((t) => [t.id, t.title]));
  const replies: ReplyView[] = replyRows.map((r) => ({
    id: r.id,
    kind: r.kind === "answer" ? "answer" : "note",
    personName: plan.names.get(r.personId) ?? "",
    about: r.kind === "answer" ? r.question : ((r.taskId && taskTitles.get(r.taskId)) ?? ""),
    text: r.text,
    createdAt: r.createdAt,
  }));
  const linkRows = await tx
    .select({
      id: shareLinks.id,
      orgId: shareLinks.orgId,
      projectId: shareLinks.projectId,
      label: shareLinks.label,
      canAnswer: shareLinks.canAnswer,
      createdBy: shareLinks.createdBy,
      expiresAt: shareLinks.expiresAt,
      revokedAt: shareLinks.revokedAt,
      lastUsedAt: shareLinks.lastUsedAt,
      createdAt: shareLinks.createdAt,
    })
    .from(shareLinks)
    .where(and(eq(shareLinks.projectId, projectId), isNull(shareLinks.revokedAt)))
    .orderBy(desc(shareLinks.createdAt));
  return {
    project: {
      ...project,
      ownerName: (project.ownerPersonId && plan.names.get(project.ownerPersonId)) || "",
      managerName: (project.managerPersonId && plan.names.get(project.managerPersonId)) || "",
    },
    people: plan.people,
    milestones: plan.milestones,
    tasks: plan.tasks,
    obstacles: obstacleRows,
    decisions: decisionRows,
    statusUpdates: statusRows,
    expenses: expenseRows,
    snapshots: snapshotRows,
    events: eventRows,
    shareLinks: linkRows,
    replies,
  };
}

export async function getProjectFull(ctx: OrgContext, projectId: string) {
  return withOrgContext(ctx, (tx) => readProjectFull(tx, projectId));
}

export async function listProjects(ctx: OrgContext): Promise<ProjectSummary[]> {
  return withOrgContext(ctx, async (tx) => {
    const rows = await tx.select().from(projects).orderBy(desc(projects.createdAt));
    if (rows.length === 0) return [];
    const ids = rows.map((p) => p.id);
    const taskRows = await tx
      .select({ projectId: tasks.projectId, state: tasks.state })
      .from(tasks)
      .where(inArray(tasks.projectId, ids));
    const milestoneRows = await tx
      .select({
        projectId: milestones.projectId,
        title: milestones.title,
        date: milestones.date,
        doneAt: milestones.doneAt,
      })
      .from(milestones)
      .where(inArray(milestones.projectId, ids))
      .orderBy(asc(milestones.date));
    const statusRows = await tx
      .select({ projectId: statusUpdates.projectId, approvedAt: statusUpdates.approvedAt })
      .from(statusUpdates)
      .where(inArray(statusUpdates.projectId, ids));
    return rows.map((p) => {
      const own = taskRows.filter((t) => t.projectId === p.id);
      const next = milestoneRows.find((m) => m.projectId === p.id && !m.doneAt) ?? null;
      const latest = statusRows
        .filter((s) => s.projectId === p.id && s.approvedAt)
        .map((s) => s.approvedAt!)
        .sort((a, b) => b.getTime() - a.getTime())[0];
      return {
        id: p.id,
        name: p.name,
        goal: p.goal,
        description: p.description,
        createdAt: p.createdAt,
        archivedAt: p.archivedAt,
        taskCount: own.length,
        doneCount: own.filter((t) => t.state === "done").length,
        nextMilestone: next ? { title: next.title, date: next.date } : null,
        latestStatusAt: latest ?? null,
      };
    });
  });
}
