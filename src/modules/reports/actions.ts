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
import {
  cleanRecipients,
  mailApprovedStatus,
  setStatusRecipients,
  type MailWords,
  type SendOutcome,
} from "./mail";
import { serverReportWords } from "./pdf-words";
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

const Revise = z.object({
  projectId,
  text: z.string().trim().min(1).max(4000),
  nextWeek: z.array(z.string().trim().max(200)).max(6),
  answers: z
    .array(z.object({ question: z.string().max(300), answer: z.string().trim().max(600) }))
    .max(5),
});

/**
 * Between the draft and the approval: the person answered what the
 * engine lacked, and the answers go into the words rather than under
 * them. Counted as a call, like the draft.
 */
export async function reviseStatusAction(
  raw: unknown,
): Promise<Result<{ text: string; nextWeek: string[]; fallback: boolean }>> {
  const ctx = await requireOrgContext();
  if (!ctx) return fail("unauthorized");
  const parsed = Revise.safeParse(raw);
  if (!parsed.success) return fail("invalid");
  const answers = parsed.data.answers.filter((a) => a.answer.trim());
  if (answers.length === 0) {
    return ok({ text: parsed.data.text, nextWeek: parsed.data.nextWeek, fallback: false });
  }
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
    const context = buildStatusInput(
      full,
      locale,
      common("weekOf", { date: today }),
      activity,
      { assessment: { rag: status.rag, reason: status.reason }, sinceLast: status.sinceLast },
      today,
    );
    const res = await withEngine(ctx, (engine) =>
      engine.reviseStatus({
        locale,
        text: parsed.data.text,
        nextWeek: parsed.data.nextWeek,
        answers,
        context,
      }),
    );
    return ok({ ...res.result, fallback: res.fallback });
  } catch (error) {
    if (error instanceof RateLimited) return fail("conflict");
    console.error("status revision failed", error);
    return fail("generic");
  }
}

/** Ugen, step two: what the person decided becomes a status, frozen with the plan. */
const Approve = Authored.extend({
  /** Send the approved status to the project's recipients by mail. */
  send: z.boolean().default(false),
  recipients: z
    .array(z.object({ name: z.string().max(80), email: z.string().max(254) }))
    .max(20)
    .optional(),
});

export type ApproveOutcome = {
  statusId: string;
  /** What happened to the mail; null when sending was not asked for. */
  mail: SendOutcome | null;
};

export async function approveStatusAction(raw: unknown): Promise<Result<ApproveOutcome>> {
  const ctx = await requireOrgContext();
  if (!ctx) return fail("unauthorized");
  const parsed = Approve.safeParse(raw);
  if (!parsed.success) return fail("invalid");
  const locale = (await getLocale()) as Locale;
  const words = await statusWords(locale);
  const approvedByName = await approverName();
  try {
    const statusId = await withOrgContext(ctx, async (tx) => {
      const full = await readProjectFull(tx, parsed.data.projectId);
      if (!full) return null;
      if (parsed.data.recipients)
        await setStatusRecipients(
          tx,
          parsed.data.projectId,
          cleanRecipients(parsed.data.recipients),
        );
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
    // The mail goes in its own transaction: the approval stands whether
    // or not the provider answers, and the event says which it was.
    let mail: SendOutcome | null = null;
    if (parsed.data.send) {
      const words = { mail: await mailWords(), report: await serverReportWords() };
      mail = await withOrgContext(ctx, (tx) =>
        mailApprovedStatus(tx, ctx, parsed.data.projectId, statusId, words, locale),
      );
    }
    revalidatePath(`/projects/${parsed.data.projectId}`);
    return ok({ statusId, mail });
  } catch (error) {
    console.error("status approval failed", error);
    return fail("generic");
  }
}

/** Only the mail words, so the status flow can say who will get it. */
export async function mailWords(): Promise<MailWords> {
  const t = await getTranslations("status.mail");
  return {
    subject: (project, week) => t("subject", { project, week }),
    intro: (project, week, by) => t("intro", { project, week, by }),
    comment: t("comment"),
    openLink: t("openLink"),
    sentBy: t("sentBy"),
  };
}

const Recipients = z.object({
  projectId,
  recipients: z.array(z.object({ name: z.string().max(80), email: z.string().max(254) })).max(20),
});

export async function setStatusRecipientsAction(raw: unknown): Promise<Result<undefined>> {
  const ctx = await requireOrgContext();
  if (!ctx) return fail("unauthorized");
  const parsed = Recipients.safeParse(raw);
  if (!parsed.success) return fail("invalid");
  try {
    await withOrgContext(ctx, (tx) =>
      setStatusRecipients(tx, parsed.data.projectId, cleanRecipients(parsed.data.recipients)),
    );
    revalidatePath(`/projects/${parsed.data.projectId}`);
    return ok(undefined);
  } catch (error) {
    console.error("recipients update failed", error);
    return fail("generic");
  }
}
