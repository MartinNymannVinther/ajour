"use server";

import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireOrgContext } from "@/core/auth/guard";
import { todayInCopenhagen } from "@/core/dates";
import { withOrgContext } from "@/core/db/tenant";
import { withEngine } from "@/modules/ai";
import { MAX_DESCRIPTION_CHARS, RateLimited, capText, reserveAiCall } from "@/modules/ai/limits";
import { rulesEngine } from "@/modules/ai/rules-engine";
import type { Locale, PlanProposal, ReplanProposal } from "@/modules/ai/types";
import { action, revalidateProject } from "./action-helpers";
import { applyReplan, buildReplanInput, createProjectFromProposal } from "./plan";
import { restoreSnapshotById, takeSnapshot } from "./snapshots";
import { buildTemplate, findTemplate } from "./templates";
import { fail, ok, type Result } from "./types";
import { SnapshotLabelSchema, id, isoDate } from "./validation";

/**
 * Start and Skred: a project comes into being, and a milestone that moved
 * becomes a plan the person approved. The proposals travel through the
 * browser, so `applyReplan` checks every id against the project again
 * before it writes anything.
 */

const PlanProposalSchema = z.object({
  name: z.string().trim().min(1).max(80),
  goal: z.string().trim().max(300),
  budget: z.number().int().min(0).max(999_999_999).nullable(),
  milestones: z.array(z.object({ title: z.string().trim().min(1).max(80), date: isoDate })).max(20),
  tasks: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(100),
        milestoneIndex: z.number().int().min(0).max(19).nullable(),
        owner: z.string().trim().max(40),
        startDate: isoDate,
        endDate: isoDate,
      }),
    )
    .max(100),
});

const NewProjectSchema = z.object({
  proposal: PlanProposalSchema,
  description: z.string().max(MAX_DESCRIPTION_CHARS).default(""),
  templateKey: z.string().max(40).nullable().default(null),
});

/** Turns a description into a proposal. Nothing is written yet. */
export async function proposePlanAction(
  rawDescription: unknown,
): Promise<Result<{ proposal: PlanProposal; engine: string; fallback: boolean }>> {
  const ctx = await requireOrgContext();
  if (!ctx) return fail("unauthorized");
  const description = capText(rawDescription, MAX_DESCRIPTION_CHARS);
  if (description.length < 10) return fail("invalid");
  const locale = (await getLocale()) as Locale;
  try {
    await withOrgContext(ctx, (tx) => reserveAiCall(tx, ctx, "plan", ""));
    const res = await withEngine(ctx, (engine) =>
      engine.generatePlan({ description, today: todayInCopenhagen(), locale }),
    );
    return ok({ proposal: res.result, engine: res.engine, fallback: res.fallback });
  } catch (error) {
    if (error instanceof RateLimited) return fail("conflict");
    console.error("plan proposal failed", error);
    return fail("generic");
  }
}

/** The template path: no model involved, so no call is counted. */
export async function proposeTemplateAction(rawId: unknown): Promise<Result<PlanProposal>> {
  const ctx = await requireOrgContext();
  if (!ctx) return fail("unauthorized");
  const template = typeof rawId === "string" ? findTemplate(rawId) : undefined;
  if (!template) return fail("notFound");
  const locale = (await getLocale()) as Locale;
  return ok(buildTemplate(template, todayInCopenhagen(), locale));
}

export async function createProjectAction(raw: unknown): Promise<Result<string>> {
  const ctx = await requireOrgContext();
  if (!ctx) return fail("unauthorized");
  const parsed = NewProjectSchema.safeParse(raw);
  if (!parsed.success) return fail("invalid");
  const { proposal, description, templateKey } = parsed.data;
  if (proposal.milestones.length === 0 && proposal.tasks.length === 0) return fail("invalid");
  try {
    const projectId = await createProjectFromProposal(
      ctx,
      { ...proposal, tasks: proposal.tasks.map((t) => ({ ...t })) },
      description,
      templateKey,
    );
    revalidatePath("/projects");
    return ok(projectId);
  } catch (error) {
    console.error("project creation failed", error);
    return fail("generic");
  }
}

const ReplanRequestSchema = z.object({ milestoneId: id, newDate: isoDate });

/**
 * Prepares a replan: what would move, and why. Deterministic on purpose —
 * a person dragging a milestone should not wait for a model, so the rules
 * engine answers and the chat is where a model gets asked instead.
 */
export async function proposeReplanAction(
  raw: unknown,
): Promise<Result<{ proposal: ReplanProposal; projectId: string }>> {
  const ctx = await requireOrgContext();
  if (!ctx) return fail("unauthorized");
  const parsed = ReplanRequestSchema.safeParse(raw);
  if (!parsed.success) return fail("invalid");
  const locale = (await getLocale()) as Locale;
  const replan = await getTranslations("projects.replan");
  try {
    const prepared = await withOrgContext(ctx, (tx) =>
      buildReplanInput(
        tx,
        parsed.data.milestoneId,
        parsed.data.newDate,
        locale,
        (title, from, to) => replan("reason", { title, from, to }),
      ),
    );
    if (!prepared) return fail("notFound");
    const proposal = await rulesEngine.proposeReplan(prepared.input);
    return ok({ proposal, projectId: prepared.projectId });
  } catch (error) {
    console.error("replan proposal failed", error);
    return fail("generic");
  }
}

const ApplyReplanSchema = z.object({
  projectId: id,
  milestoneId: id,
  newDate: isoDate,
  proposal: z.object({
    summary: z.string().max(1000),
    milestoneMoves: z
      .array(z.object({ id, title: z.string().max(80), oldDate: isoDate, newDate: isoDate }))
      .max(50),
    taskMoves: z
      .array(
        z.object({
          id,
          title: z.string().max(100),
          oldStart: isoDate,
          oldEnd: isoDate,
          newStart: isoDate,
          newEnd: isoDate,
        }),
      )
      .max(200),
  }),
});

export async function applyReplanAction(raw: unknown): Promise<Result<undefined>> {
  const words = await getTranslations("projects.replan");
  return action(ApplyReplanSchema, raw, async (tx, ctx, input) => {
    const done = await applyReplan(
      tx,
      ctx,
      input.projectId,
      { id: input.milestoneId, newDate: input.newDate },
      input.proposal,
      {
        snapshot: (title) => words("snapshot", { title }),
        decision: (title, date) => words("decision", { title, date }),
      },
    );
    if (!done) throw new Error("notFound");
    return undefined;
  });
}

export async function takeSnapshotAction(raw: unknown): Promise<Result<string | null>> {
  return action(SnapshotLabelSchema, raw, (tx, ctx, input) =>
    takeSnapshot(tx, ctx, input.projectId, input.label),
  );
}

const RestoreSchema = z.object({ projectId: id, snapshotId: id });

export async function restoreSnapshotAction(raw: unknown): Promise<Result<undefined>> {
  const history = await getTranslations("projects.history");
  return action(RestoreSchema, raw, async (tx, ctx, input) => {
    const done = await restoreSnapshotById(tx, ctx, input.snapshotId, {}, (label) =>
      history("beforeRestore", { label }),
    );
    if (!done) throw new Error("notFound");
    revalidateProject(input.projectId);
    return undefined;
  });
}
