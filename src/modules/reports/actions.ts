"use server";

import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireOrgContext } from "@/core/auth/guard";
import { todayInCopenhagen } from "@/core/dates";
import { withOrgContext } from "@/core/db/tenant";
import { buildStatusInput } from "@/modules/ai/context";
import { withEngine } from "@/modules/ai";
import { RateLimited, reserveAiCall } from "@/modules/ai/limits";
import type { Locale, StatusDraft } from "@/modules/ai/types";
import { recentEvents, renderEvent } from "@/modules/projects/events";
import { readProjectFull } from "@/modules/projects/read";
import { fail, ok, type Result } from "@/modules/projects/types";
import { prepareStatus } from "./prepare";
import {
  approveStatus,
  buildStatusReport,
  type ManagementAsk,
  type StatusAuthored,
  type StatusReport,
} from "./status-report";
import { approverName, Authored, authoredFrom, statusWords } from "./status-authoring";

const projectId = z.string().min(1).max(64);

/**
 * Ugen, as two actions. The draft reads the plan, assesses it, works out
 * what changed and asks the engine for the words; the approval takes what
 * the person decided and freezes it with the plan. Nothing the browser
 * sends is trusted as the report: the report is always rebuilt here.
 */

export type StatusDraftResult = {
  draft: StatusDraft;
  engine: string;
  fallback: boolean;
  rag: StatusAuthored["rag"];
  reason: string;
  sinceLast: string[];
  carriedAsks: ManagementAsk[];
  previousComment: string;
  /** The report as it would look with the draft untouched, for the preview. */
  base: StatusReport;
};

/** Ugen, step one: the draft, the assessment and the preview's base. Nothing is written yet. */
export async function draftStatusAction(raw: unknown): Promise<Result<StatusDraftResult>> {
  const ctx = await requireOrgContext();
  if (!ctx) return fail("unauthorized");
  const parsed = z.object({ projectId }).safeParse(raw);
  if (!parsed.success) return fail("invalid");
  const locale = (await getLocale()) as Locale;
  const common = await getTranslations("common");
  const eventText = await getTranslations("events");
  const words = await statusWords(locale);
  const today = todayInCopenhagen();
  try {
    const prepared = await withOrgContext(ctx, async (tx) => {
      const full = await readProjectFull(tx, parsed.data.projectId);
      if (!full) return null;
      await reserveAiCall(tx, ctx, "status", "");
      const activity = (await recentEvents(tx, parsed.data.projectId, 25)).map((row) =>
        renderEvent(eventText, row),
      );
      return { full, activity, status: await prepareStatus(tx, full, words, today) };
    });
    if (!prepared) return fail("notFound");
    const { full, activity, status } = prepared;
    const weekLabel = common("weekOf", { date: today });
    const res = await withEngine(ctx, (engine) =>
      engine.draftStatus(
        buildStatusInput(
          full,
          locale,
          weekLabel,
          activity,
          { assessment: { rag: status.rag, reason: status.reason }, sinceLast: status.sinceLast },
          today,
        ),
      ),
    );
    const draft = res.result;
    const base = buildStatusReport(
      full,
      {
        text: draft.text,
        rag: status.rag,
        ragSuggested: status.rag,
        ragReason: status.reason,
        managerComment: status.previousComment,
        managementAsks: status.carriedAsks,
        nextWeek: draft.nextWeek,
        engine: res.engine,
      },
      { sinceLast: status.sinceLast, approvedByName: await approverName() },
      today,
    );
    return ok({
      draft,
      engine: res.engine,
      fallback: res.fallback,
      rag: status.rag,
      reason: status.reason,
      sinceLast: status.sinceLast,
      carriedAsks: status.carriedAsks,
      previousComment: status.previousComment,
      base,
    });
  } catch (error) {
    if (error instanceof RateLimited) return fail("conflict");
    console.error("status draft failed", error);
    return fail("generic");
  }
}

/** Ugen, step two: what the person decided becomes a status, frozen with the plan. */
export async function approveStatusAction(raw: unknown): Promise<Result<string>> {
  const ctx = await requireOrgContext();
  if (!ctx) return fail("unauthorized");
  const parsed = Authored.safeParse(raw);
  if (!parsed.success) return fail("invalid");
  const locale = (await getLocale()) as Locale;
  const words = await statusWords(locale);
  const approvedByName = await approverName();
  try {
    const statusId = await withOrgContext(ctx, async (tx) => {
      const full = await readProjectFull(tx, parsed.data.projectId);
      if (!full) return null;
      const status = await prepareStatus(tx, full, words);
      return approveStatus(
        tx,
        ctx,
        full,
        authoredFrom(parsed.data),
        { sinceLast: status.sinceLast, approvedByName },
        parsed.data.questions,
      );
    });
    if (!statusId) return fail("notFound");
    revalidatePath(`/projects/${parsed.data.projectId}`);
    return ok(statusId);
  } catch (error) {
    console.error("status approval failed", error);
    return fail("generic");
  }
}
