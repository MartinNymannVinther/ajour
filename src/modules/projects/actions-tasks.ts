"use server";

import { z } from "zod";
import { action, NotFound } from "./action-helpers";
import {
  NewTaskSchema,
  SubtasksSchema,
  TaskMoveSchema,
  TaskPeopleSchema,
  TaskRelinkSchema,
  TaskStateSchema,
  TaskTitleSchema,
  orderedDates,
} from "./validation";
import {
  createTask,
  deleteTask,
  moveTask,
  relinkTask,
  renameTask,
  setTaskState,
  updateSubtasks,
  updateTaskPeople,
} from "./write-tasks";
import type { Result } from "./types";

/**
 * Everything a person can do to a task. Each action is four lines by
 * design: the guard, the schema, the service, the refresh. The services
 * answer null when a row is not in the caller's project, which becomes
 * "notFound" rather than a silent success.
 */

const found = <T>(row: T | null): T => {
  if (row === null) throw new NotFound();
  return row;
};

export async function createTaskAction(raw: unknown): Promise<Result<string>> {
  return action(NewTaskSchema, raw, async (tx, ctx, input) => {
    const [startDate, endDate] = orderedDates(input.startDate, input.endDate);
    return createTask(tx, ctx, { ...input, startDate, endDate });
  });
}

export async function setTaskStateAction(raw: unknown): Promise<Result<string>> {
  return action(TaskStateSchema, raw, async (tx, ctx, input) => {
    const task = found(await setTaskState(tx, ctx, input.taskId, input.state));
    return task.projectId;
  });
}

export async function moveTaskAction(raw: unknown): Promise<Result<string>> {
  return action(TaskMoveSchema, raw, async (tx, ctx, input) => {
    const task = found(await moveTask(tx, ctx, input.taskId, input.startDate, input.endDate));
    return task.projectId;
  });
}

export async function relinkTaskAction(raw: unknown): Promise<Result<string>> {
  return action(TaskRelinkSchema, raw, async (tx, ctx, input) => {
    const task = found(
      await relinkTask(tx, ctx, input.taskId, input.milestoneId, input.startDate, input.endDate),
    );
    return task.projectId;
  });
}

export async function updateTaskPeopleAction(raw: unknown): Promise<Result<string>> {
  return action(TaskPeopleSchema, raw, async (tx, ctx, input) => {
    const task = found(await updateTaskPeople(tx, ctx, input));
    return task.projectId;
  });
}

export async function renameTaskAction(raw: unknown): Promise<Result<string>> {
  return action(TaskTitleSchema, raw, async (tx, ctx, input) => {
    const task = found(
      await renameTask(tx, ctx, input.taskId, input.title, input.expectedUpdatedAt),
    );
    return task.projectId;
  });
}

export async function updateSubtasksAction(raw: unknown): Promise<Result<string>> {
  return action(SubtasksSchema, raw, async (tx, ctx, input) => {
    const task = found(await updateSubtasks(tx, ctx, input.taskId, input.subtasks));
    return task.projectId;
  });
}

export async function deleteTaskAction(raw: unknown): Promise<Result<string>> {
  return action(z.object({ taskId: z.string().min(1).max(64) }), raw, async (tx, ctx, input) => {
    const task = found(await deleteTask(tx, ctx, input.taskId));
    return task.projectId;
  });
}
