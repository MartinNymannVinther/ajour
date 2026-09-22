"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOrgContext } from "@/core/auth/guard";
import { fail, ok, type Result } from "@/modules/projects/types";
import {
  deleteWorkspace,
  renameWorkspace,
  type DeleteResult,
  type RenameResult,
} from "./workspace";

/**
 * Dogma three's exit door. The export itself is a download and lives in a
 * route handler; deletion is an action, because it ends with the person
 * being sent somewhere else.
 */

export async function deleteWorkspaceAction(raw: unknown): Promise<Result<DeleteResult>> {
  const ctx = await requireOrgContext();
  if (!ctx) return fail("unauthorized");
  const parsed = z.object({ name: z.string().trim().min(1).max(120) }).safeParse(raw);
  if (!parsed.success) return fail("invalid");
  const result = await deleteWorkspace(ctx, parsed.data.name, await headers());
  if (result === "deleted") redirect("/");
  return ok(result);
}

/** The name is on every screen, in the sidebar lockup, so the whole layout is refreshed. */
export async function renameWorkspaceAction(raw: unknown): Promise<Result<RenameResult>> {
  const ctx = await requireOrgContext();
  if (!ctx) return fail("unauthorized");
  const parsed = z.object({ name: z.string().trim().min(1).max(120) }).safeParse(raw);
  if (!parsed.success) return fail("invalid");
  const result = await renameWorkspace(ctx, parsed.data.name, await headers());
  if (result === "renamed") revalidatePath("/", "layout");
  return ok(result);
}
