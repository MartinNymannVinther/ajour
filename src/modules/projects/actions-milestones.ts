"use server";

import { z } from "zod";
import { action, NotFound } from "./action-helpers";
import { MilestoneDoneSchema, MilestoneUpdateSchema, NewMilestoneSchema } from "./validation";
import {
  createMilestone,
  deleteMilestone,
  setMilestoneDone,
  updateMilestone,
} from "./write-milestones";
import type { Result } from "./types";

/**
 * Milestones. Moving one on the timeline does not come through here: that
 * is a replan, which proposes what should follow and asks first.
 */

const found = <T>(row: T | null): T => {
  if (row === null) throw new NotFound();
  return row;
};

const milestoneId = z.object({ milestoneId: z.string().min(1).max(64) });

export async function createMilestoneAction(raw: unknown): Promise<Result<string>> {
  return action(NewMilestoneSchema, raw, (tx, ctx, input) => createMilestone(tx, ctx, input));
}

export async function updateMilestoneAction(raw: unknown): Promise<Result<string>> {
  return action(MilestoneUpdateSchema, raw, async (tx, ctx, input) => {
    const m = found(await updateMilestone(tx, ctx, input));
    return m.projectId;
  });
}

export async function setMilestoneDoneAction(raw: unknown): Promise<Result<string>> {
  return action(MilestoneDoneSchema, raw, async (tx, ctx, input) => {
    const m = found(await setMilestoneDone(tx, ctx, input.milestoneId, input.done));
    return m.projectId;
  });
}

export async function deleteMilestoneAction(raw: unknown): Promise<Result<string>> {
  return action(milestoneId, raw, async (tx, ctx, input) => {
    const m = found(await deleteMilestone(tx, ctx, input.milestoneId));
    return m.projectId;
  });
}
