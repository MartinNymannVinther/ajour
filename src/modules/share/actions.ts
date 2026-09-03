"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { requireOrgContext } from "@/core/auth/guard";
import { fail, ok, type Result } from "@/modules/projects/types";
import { createShareLink, revokeShareLink, shareUrl } from "./service";

/**
 * Making and withdrawing a share link. The token is returned once, here,
 * and never again: what the database keeps is its hash, so a link that is
 * lost is revoked and made anew rather than looked up.
 */

const CreateSchema = z.object({
  projectId: z.string().min(1).max(64),
  label: z.string().trim().max(80).default(""),
  ttlDays: z.union([z.literal(30), z.literal(90), z.null()]).default(null),
});

export async function createShareLinkAction(
  raw: unknown,
): Promise<Result<{ id: string; url: string; expiresAt: string | null }>> {
  const ctx = await requireOrgContext();
  if (!ctx) return fail("unauthorized");
  const parsed = CreateSchema.safeParse(raw);
  if (!parsed.success) return fail("invalid");
  const locale = (await getLocale()) as "da" | "en";
  try {
    const link = await createShareLink(
      ctx,
      parsed.data.projectId,
      parsed.data.label,
      parsed.data.ttlDays,
    );
    if (!link) return fail("notFound");
    revalidatePath(`/projects/${parsed.data.projectId}`);
    return ok({
      id: link.id,
      url: shareUrl(link.token, locale),
      expiresAt: link.expiresAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("share link creation failed", error);
    return fail("generic");
  }
}

export async function revokeShareLinkAction(raw: unknown): Promise<Result<undefined>> {
  const ctx = await requireOrgContext();
  if (!ctx) return fail("unauthorized");
  const parsed = z
    .object({ linkId: z.string().min(1).max(64), projectId: z.string().min(1).max(64) })
    .safeParse(raw);
  if (!parsed.success) return fail("invalid");
  try {
    const done = await revokeShareLink(ctx, parsed.data.linkId);
    revalidatePath(`/projects/${parsed.data.projectId}`);
    return done ? ok(undefined) : fail("notFound");
  } catch (error) {
    console.error("share link revocation failed", error);
    return fail("generic");
  }
}
