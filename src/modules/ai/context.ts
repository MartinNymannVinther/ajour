import { todayInCopenhagen } from "@/core/dates";
import type { ProjectFull } from "@/modules/projects/types";
import type { ChatContext, Locale, StatusInput } from "./types";

/**
 * What the AI sees of a project: the plan, the people, the money, the
 * obstacles and the latest decisions, with people as names. Built from
 * the same rows the page shows, so the model and the person look at one
 * truth.
 */
export function buildChatContext(
  full: ProjectFull,
  locale: Locale,
  today = todayInCopenhagen(),
): ChatContext {
  const { project, tasks, milestones, obstacles, decisions, expenses, people } = full;
  const resources = new Set<string>(people.map((p) => p.name));
  return {
    locale,
    today,
    projectName: project.name,
    goal: project.goal,
    ownerName: project.ownerName,
    managerName: project.managerName,
    resources: [...resources].sort((a, b) => a.localeCompare(b, locale)),
    milestones: milestones.map((m) => ({
      id: m.id,
      title: m.title,
      date: m.date,
      done: Boolean(m.doneAt),
      ownerName: m.ownerName,
      criterion: m.criterion,
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      state: t.state,
      owner: t.ownerName,
      participants: t.participants,
      startDate: t.startDate,
      endDate: t.endDate,
      milestoneId: t.milestoneId,
      subtasks: t.subtasks,
    })),
    openObstacles: obstacles
      .filter((o) => o.status !== "resolved")
      .map((o) => ({ id: o.id, title: o.title, status: o.status })),
    decisions: decisions
      .slice(0, 10)
      .map((d) => ({ title: d.title, date: d.createdAt.toISOString().slice(0, 10) })),
    economy:
      project.budget !== null || expenses.length > 0
        ? {
            budget: project.budget,
            plannedTotal: expenses.reduce((sum, e) => sum + e.amount, 0),
            incurredTotal: expenses.filter((e) => e.incurred).reduce((sum, e) => sum + e.amount, 0),
            expenses: expenses.map((e) => ({
              id: e.id,
              title: e.title,
              amount: e.amount,
              incurred: e.incurred,
              taskId: e.taskId,
            })),
          }
        : null,
  };
}

/** The facts the weekly status is written from. */
export function buildStatusInput(
  full: ProjectFull,
  locale: Locale,
  weekLabel: string,
  recentActivity: string[],
  extra: {
    assessment: StatusInput["assessment"];
    sinceLast: string[];
  },
  today = todayInCopenhagen(),
): StatusInput {
  const { project, tasks, milestones, obstacles, expenses, statusUpdates } = full;
  const previous = statusUpdates.find((s) => s.approvedAt) ?? null;
  return {
    assessment: extra.assessment,
    sinceLast: extra.sinceLast,
    progress: { done: tasks.filter((t) => t.state === "done").length, total: tasks.length },
    openAsks: (previous?.managementAsks ?? []).filter((a) => !a.answered).map((a) => a.text),
    locale,
    today,
    weekLabel,
    projectName: project.name,
    goal: project.goal,
    nextMilestone:
      milestones
        .filter((m) => !m.doneAt)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((m) => ({ title: m.title, date: m.date }))[0] ?? null,
    doneTasks: tasks.filter((t) => t.state === "done").map((t) => t.title),
    doingTasks: tasks
      .filter((t) => t.state === "doing")
      .map((t) => ({ title: t.title, owner: t.ownerName, endDate: t.endDate })),
    overdueTasks: tasks
      .filter((t) => t.state !== "done" && t.endDate < today)
      .map((t) => ({ title: t.title, owner: t.ownerName, endDate: t.endDate })),
    openObstacles: obstacles
      .filter((o) => o.status !== "resolved")
      .map((o) => ({ title: o.title, status: o.status })),
    economy:
      project.budget !== null || expenses.length > 0
        ? {
            budget: project.budget,
            plannedTotal: expenses.reduce((sum, e) => sum + e.amount, 0),
            incurredTotal: expenses.filter((e) => e.incurred).reduce((sum, e) => sum + e.amount, 0),
            postCount: expenses.length,
          }
        : null,
    recentActivity,
    previousStatus: previous?.text ?? null,
  };
}
