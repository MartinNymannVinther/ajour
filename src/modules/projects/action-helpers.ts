import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { requireOrgContext } from "@/core/auth/guard";
import { withOrgContext, type AppTransaction, type OrgContext } from "@/core/db/tenant";
import { Conflict } from "./write-tasks";
import { fail, ok, type Result } from "./types";

/**
 * The shape every server action in the product has: resolve the caller's
 * workspace, validate the input, run one transaction, refresh the page.
 * Nothing else. An action that reaches past this helper is a bug — the
 * whole point is that authorization cannot be forgotten in one place.
 *
 * Ids are never trusted from the client. The services check that every id
 * belongs to the project, and RLS checks that the project belongs to the
 * workspace, so a stolen id fails twice.
 */

/** Refreshes the pages a project change can be visible on. */
export function revalidateProject(projectId: string) {
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
}

type Options = {
  /** The project whose pages should refresh, when it is known up front. */
  projectId?: string;
};

/**
 * Runs `fn` with a validated payload inside the caller's workspace. The
 * return value is the action's data; the project whose pages refresh is
 * `options.projectId`, the payload's own `projectId`, or — for the task
 * and milestone actions, which are addressed by row id — the project id
 * the service answered with.
 */
export async function action<S extends z.ZodType, T>(
  schema: S,
  raw: unknown,
  fn: (tx: AppTransaction, ctx: OrgContext, input: z.infer<S>) => Promise<T>,
  options: Options = {},
): Promise<Result<T>> {
  const ctx = await requireOrgContext();
  if (!ctx) return fail("unauthorized");
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return fail("invalid");
  try {
    const data = await withOrgContext(ctx, (tx) => fn(tx, ctx, parsed.data));
    const fromPayload = (parsed.data as { projectId?: unknown }).projectId;
    const projectId =
      options.projectId ??
      (typeof fromPayload === "string" ? fromPayload : null) ??
      (typeof data === "string" ? data : null);
    if (projectId) revalidateProject(projectId);
    else revalidatePath("/projects");
    return ok(data);
  } catch (error) {
    return fail(classify(error));
  }
}

/** An action that needs the workspace but no payload. */
export async function withWorkspace<T>(fn: (ctx: OrgContext) => Promise<T>): Promise<Result<T>> {
  const ctx = await requireOrgContext();
  if (!ctx) return fail("unauthorized");
  try {
    return ok(await fn(ctx));
  } catch (error) {
    return fail(classify(error));
  }
}

function classify(error: unknown): "conflict" | "notFound" | "generic" {
  if (error instanceof Conflict) return "conflict";
  if (error instanceof Error && error.message === "notFound") return "notFound";
  // Details stay in the server log; the client gets a word it can render.
  console.error("action failed", error);
  return "generic";
}

export class NotFound extends Error {
  constructor() {
    super("notFound");
  }
}
