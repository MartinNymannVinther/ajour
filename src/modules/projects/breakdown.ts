import { eq } from "drizzle-orm";
import { addDaysIso, todayInCopenhagen } from "@/core/dates";
import { milestones } from "@/core/db/schema";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";
import type { BreakdownInput, Locale, TaskProposal } from "@/modules/ai/types";
import { recordEvent } from "./events";
import { readProjectFull } from "./read";
import { takeSnapshot } from "./snapshots";
import { createTask } from "./write-tasks";

/**
 * Breaking a milestone into tasks. The engine proposes; the person ticks
 * what should exist; a snapshot is taken before anything is written, so
 * the whole set can be taken back with one restore. Dogma five: the AI
 * drafts, the human decides, everything can be undone.
 */

export async function breakdownInputFor(
  tx: AppTransaction,
  milestoneId: string,
  locale: Locale,
  today = todayInCopenhagen(),
): Promise<{ input: BreakdownInput; projectId: string } | null> {
  const [milestone] = await tx
    .select({ id: milestones.id, projectId: milestones.projectId })
    .from(milestones)
    .where(eq(milestones.id, milestoneId))
    .limit(1);
  if (!milestone) return null;
  const full = await readProjectFull(tx, milestone.projectId);
  if (!full) return null;
  const target = full.milestones.find((m) => m.id === milestoneId);
  if (!target) return null;

  // The window opens the day after the previous milestone, or today for
  // the first one, and never after the milestone itself.
  const previous = full.milestones
    .filter((m) => m.date < target.date)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const windowStart = previous ? addDaysIso(previous.date, 1) : today;

  return {
    projectId: full.project.id,
    input: {
      locale,
      today,
      projectName: full.project.name,
      goal: full.project.goal,
      milestone: {
        title: target.title,
        date: target.date,
        criterion: target.criterion,
        ownerName: target.ownerName,
      },
      windowStart: windowStart <= target.date ? windowStart : target.date,
      existingTasks: full.tasks.filter((t) => t.milestoneId === milestoneId).map((t) => t.title),
      people: full.people.map((p) => p.name),
    },
  };
}

/** Writes the tasks the person kept, after a snapshot. Returns the project id. */
export async function applyBreakdown(
  tx: AppTransaction,
  ctx: OrgContext,
  milestoneId: string,
  tasks: TaskProposal[],
  snapshotLabel: string,
): Promise<{ projectId: string; snapshotId: string | null; created: string[] } | null> {
  const [milestone] = await tx
    .select({ id: milestones.id, projectId: milestones.projectId, date: milestones.date })
    .from(milestones)
    .where(eq(milestones.id, milestoneId))
    .limit(1);
  if (!milestone) return null;
  const snapshotId = await takeSnapshot(tx, ctx, milestone.projectId, snapshotLabel, "ai");
  const created: string[] = [];
  for (const task of tasks) {
    created.push(
      await createTask(
        tx,
        ctx,
        {
          projectId: milestone.projectId,
          title: task.title,
          milestoneId,
          owner: task.owner,
          startDate: task.startDate,
          endDate: task.endDate > milestone.date ? milestone.date : task.endDate,
        },
        "ai",
      ),
    );
  }
  await recordEvent(tx, ctx, milestone.projectId, "ai.applied", { count: created.length }, "ai");
  return { projectId: milestone.projectId, snapshotId, created };
}
