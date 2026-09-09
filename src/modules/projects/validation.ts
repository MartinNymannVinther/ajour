import { z } from "zod";
import { ISO_DATE } from "@/core/dates";
import { MILESTONE_RELATIONS, TASK_STATES } from "@/core/db/schema";

/**
 * Input schemas for everything a page or the AI may write. Lengths are the
 * product's, not the database's: a task title is a line, a note is a
 * paragraph, a description is a page.
 */

export const isoDate = z.string().regex(ISO_DATE);
export const id = z.string().min(1).max(64);
export const shortText = (max: number) => z.string().trim().max(max);
export const name = shortText(40);
export const amount = z.number().int().min(0).max(999_999_999);

export const subtaskSchema = z.object({ title: shortText(120).min(1), done: z.boolean() });

export const NewTaskSchema = z.object({
  projectId: id,
  title: shortText(100).min(1),
  milestoneId: id.nullable(),
  owner: name,
  startDate: isoDate,
  endDate: isoDate,
});

export const TaskPeopleSchema = z.object({
  taskId: id,
  owner: name,
  participants: z.array(name).max(12),
  milestoneRelation: z.enum(MILESTONE_RELATIONS),
  milestoneId: id.nullable(),
  expectedUpdatedAt: z.string().optional(),
});

export const TaskStateSchema = z.object({ taskId: id, state: z.enum(TASK_STATES) });

export const TaskMoveSchema = z.object({ taskId: id, startDate: isoDate, endDate: isoDate });

export const TaskRelinkSchema = z.object({
  taskId: id,
  milestoneId: id.nullable(),
  startDate: isoDate,
  endDate: isoDate,
});

export const TaskTitleSchema = z.object({
  taskId: id,
  title: shortText(100).min(1),
  expectedUpdatedAt: z.string().optional(),
});

export const SubtasksSchema = z.object({ taskId: id, subtasks: z.array(subtaskSchema).max(20) });

export const NewMilestoneSchema = z.object({
  projectId: id,
  title: shortText(80).min(1),
  date: isoDate,
});

export const MilestoneUpdateSchema = z.object({
  milestoneId: id,
  title: shortText(80).min(1),
  date: isoDate,
  owner: name,
  criterion: shortText(300),
  fixed: z.boolean().optional(),
  expectedUpdatedAt: z.string().optional(),
});

export const MilestoneDoneSchema = z.object({ milestoneId: id, done: z.boolean() });

export const NewObstacleSchema = z.object({ projectId: id, title: shortText(160).min(1) });
export const NewDecisionSchema = z.object({
  projectId: id,
  title: shortText(120).min(1),
  note: shortText(400),
});
export const BudgetSchema = z.object({ projectId: id, budget: amount.nullable() });
export const NewExpenseSchema = z.object({
  projectId: id,
  title: shortText(100).min(1),
  amount: amount.min(1),
  spent: amount.optional(),
  incurred: z.boolean().optional(),
  taskId: id.nullable(),
});
export const RolesSchema = z.object({ projectId: id, owner: name, manager: name });
export const SnapshotLabelSchema = z.object({ projectId: id, label: shortText(120) });
export const ProjectMetaSchema = z.object({
  projectId: id,
  name: shortText(80).min(1),
  goal: shortText(300),
});

/** Dates the wrong way round are swapped rather than refused; people type fast. */
export function orderedDates(start: string, end: string): [string, string] {
  return end < start ? [end, start] : [start, end];
}
