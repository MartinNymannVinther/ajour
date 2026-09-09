"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { callerKey, rateLimit } from "@/core/rate-limit";
import {
  addOwnTaskNoteViaShare,
  answerQuestionViaShare,
  identifyViaShare,
  setOwnTaskStateViaShare,
  type ShareWriteError,
} from "./answers";

/**
 * The public writes behind a share link that may answer. No session: the
 * token is the credential and the address is what the rate limit counts.
 * Who is speaking is a cookie the holder set by picking a name, checked
 * against the project's people on every write — the cookie is a
 * convenience, never an authority.
 */

export type ShareActionResult<T = undefined> =
  { ok: true; data: T } | { ok: false; error: ShareWriteError | "rateLimited" };

const Token = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/);
const Id = z.string().min(1).max(64);

/** Thirty writes a minute per address: a person, not a script. */
async function allowed(): Promise<boolean> {
  return rateLimit(callerKey(await headers(), "share-write"), 30, 60_000).allowed;
}

function cookieName(token: string): string {
  // The cookie is scoped to the link, not the site, so two links on one
  // browser do not share a name; the token itself never goes in a cookie.
  return `ajour_who_${token.slice(0, 8)}`;
}

export async function whoAmI(token: string): Promise<string | null> {
  const jar = await cookies();
  return jar.get(cookieName(token))?.value ?? null;
}

export async function identifyAction(raw: unknown): Promise<ShareActionResult<{ name: string }>> {
  const parsed = z.object({ token: Token, personId: Id }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  if (!(await allowed())) return { ok: false, error: "rateLimited" };
  const result = await identifyViaShare(parsed.data.token, parsed.data.personId);
  if (!result.ok) return result;
  const jar = await cookies();
  jar.set(cookieName(parsed.data.token), parsed.data.personId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 90,
    path: "/",
  });
  return result;
}

export async function forgetMeAction(raw: unknown): Promise<void> {
  const parsed = z.object({ token: Token }).safeParse(raw);
  if (!parsed.success) return;
  const jar = await cookies();
  jar.delete(cookieName(parsed.data.token));
}

export async function setOwnTaskStateAction(raw: unknown): Promise<ShareActionResult> {
  const parsed = z
    .object({ token: Token, taskId: Id, state: z.enum(["todo", "doing", "done"]) })
    .safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  if (!(await allowed())) return { ok: false, error: "rateLimited" };
  const personId = await whoAmI(parsed.data.token);
  if (!personId) return { ok: false, error: "unknownPerson" };
  const result = await setOwnTaskStateViaShare(
    parsed.data.token,
    personId,
    parsed.data.taskId,
    parsed.data.state,
  );
  if (result.ok) revalidatePath(`/s/${parsed.data.token}`);
  return result;
}

export async function addOwnTaskNoteAction(
  raw: unknown,
): Promise<ShareActionResult<{ id: string }>> {
  const parsed = z
    .object({ token: Token, taskId: Id, text: z.string().trim().min(1).max(600) })
    .safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  if (!(await allowed())) return { ok: false, error: "rateLimited" };
  const personId = await whoAmI(parsed.data.token);
  if (!personId) return { ok: false, error: "unknownPerson" };
  const result = await addOwnTaskNoteViaShare(
    parsed.data.token,
    personId,
    parsed.data.taskId,
    parsed.data.text,
  );
  if (result.ok) revalidatePath(`/s/${parsed.data.token}`);
  return result;
}

export async function answerQuestionAction(
  raw: unknown,
): Promise<ShareActionResult<{ id: string }>> {
  const parsed = z
    .object({
      token: Token,
      statusUpdateId: Id,
      questionIndex: z.number().int().min(0).max(9),
      text: z.string().trim().min(1).max(600),
    })
    .safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  if (!(await allowed())) return { ok: false, error: "rateLimited" };
  const personId = await whoAmI(parsed.data.token);
  if (!personId) return { ok: false, error: "unknownPerson" };
  const result = await answerQuestionViaShare(
    parsed.data.token,
    personId,
    parsed.data.statusUpdateId,
    parsed.data.questionIndex,
    parsed.data.text,
  );
  if (result.ok) revalidatePath(`/s/${parsed.data.token}`);
  return result;
}
