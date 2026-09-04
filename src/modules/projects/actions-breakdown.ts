"use server";

import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireOrgContext } from "@/core/auth/guard";
import { withOrgContext } from "@/core/db/tenant";
import { withEngine } from "@/modules/ai";
import { RateLimited, reserveAiCall } from "@/modules/ai/limits";
import type { Locale, TaskProposal } from "@/modules/ai/types";
import { action, NotFound } from "./action-helpers";
import { applyBreakdown, breakdownInputFor } from "./breakdown";
import { fail, ok, type Result } from "./types";

const milestoneId = z.string().min(1).max(64);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const ApplySchema = z.object({
  milestoneId,
  tasks: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(140),
        owner: z.string().trim().max(80).default(""),
        startDate: date,
        endDate: date,
      }),
    )
    .min(1)
    .max(7),
});

/** Asks the engine for the tasks a milestone would take. Nothing is written. */
export async function proposeMilestoneTasksAction(
  raw: unknown,
): Promise<Result<{ tasks: TaskProposal[]; engine: string; fallback: boolean }>> {
  const ctx = await requireOrgContext();
  if (!ctx) return fail("unauthorized");
  const parsed = z.object({ milestoneId }).safeParse(raw);
  if (!parsed.success) return fail("invalid");
  const locale = (await getLocale()) as Locale;
  try {
    const prepared = await withOrgContext(ctx, async (tx) => {
      const found = await breakdownInputFor(tx, parsed.data.milestoneId, locale);
      if (!found) return null;
      await reserveAiCall(tx, ctx, "plan", "");
      return found;
    });
    if (!prepared) return fail("notFound");
    const res = await withEngine(ctx, (engine) => engine.proposeTasks(prepared.input));
    return ok({ tasks: res.result, engine: res.engine, fallback: res.fallback });
  } catch (error) {
    if (error instanceof RateLimited) return fail("conflict");
    console.error("milestone breakdown failed", error);
    return fail("generic");
  }
}

/** Creates the tasks the person kept, with a snapshot first. */
export async function applyMilestoneTasksAction(raw: unknown): Promise<Result<string>> {
  const t = await getTranslations("projects.breakdown");
  return action(ApplySchema, raw, async (tx, ctx, input) => {
    const result = await applyBreakdown(
      tx,
      ctx,
      input.milestoneId,
      input.tasks,
      t("snapshotLabel"),
    );
    if (!result) throw new NotFound();
    return result.projectId;
  });
}
