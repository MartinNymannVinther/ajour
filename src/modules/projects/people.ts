import { and, eq, inArray, sql } from "drizzle-orm";
import { people } from "@/core/db/schema";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";

/**
 * People are identities: one row per person in the workspace, matched by
 * name without regard to case, created the first time a name is typed.
 * Everything that takes a person takes a name at the edge and stores an id
 * inside, so a person can be renamed once and appear renamed everywhere.
 */

export const MAX_NAME = 40;

export function cleanName(name: unknown): string {
  return typeof name === "string" ? name.trim().replace(/\s+/g, " ").slice(0, MAX_NAME) : "";
}

/** The id for a name, creating the person when the name is new; null for no name. */
export async function personIdForName(
  tx: AppTransaction,
  ctx: OrgContext,
  rawName: unknown,
): Promise<string | null> {
  const name = cleanName(rawName);
  if (!name) return null;
  const [existing] = await tx
    .select({ id: people.id })
    .from(people)
    .where(and(eq(people.orgId, ctx.orgId), sql`lower(${people.name}) = lower(${name})`))
    .limit(1);
  if (existing) return existing.id;
  const [created] = await tx
    .insert(people)
    .values({ orgId: ctx.orgId, name })
    .onConflictDoNothing()
    .returning({ id: people.id });
  if (created) return created.id;
  // Lost a race with a concurrent insert of the same name; read it back.
  const [again] = await tx
    .select({ id: people.id })
    .from(people)
    .where(and(eq(people.orgId, ctx.orgId), sql`lower(${people.name}) = lower(${name})`))
    .limit(1);
  return again?.id ?? null;
}

/** Ids for a list of names, deduplicated, in the order given. */
export async function personIdsForNames(
  tx: AppTransaction,
  ctx: OrgContext,
  rawNames: unknown[],
  max = 12,
): Promise<string[]> {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const raw of rawNames) {
    const name = cleanName(raw);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const id = await personIdForName(tx, ctx, name);
    if (id) ids.push(id);
    if (ids.length >= max) break;
  }
  return ids;
}

/** Name lookup for a set of ids; unknown ids map to an empty string. */
export async function namesForIds(
  tx: AppTransaction,
  ids: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  const map = new Map<string, string>();
  if (wanted.length === 0) return map;
  const rows = await tx
    .select({ id: people.id, name: people.name })
    .from(people)
    .where(inArray(people.id, wanted));
  for (const row of rows) map.set(row.id, row.name);
  return map;
}

export async function listPeople(tx: AppTransaction, ctx: OrgContext) {
  return tx.select().from(people).where(eq(people.orgId, ctx.orgId)).orderBy(people.name);
}

export async function renamePerson(
  tx: AppTransaction,
  ctx: OrgContext,
  personId: string,
  rawName: unknown,
): Promise<boolean> {
  const name = cleanName(rawName);
  if (!name) return false;
  const rows = await tx
    .update(people)
    .set({ name })
    .where(and(eq(people.id, personId), eq(people.orgId, ctx.orgId)))
    .returning({ id: people.id });
  return rows.length > 0;
}

export async function removePerson(
  tx: AppTransaction,
  ctx: OrgContext,
  personId: string,
): Promise<boolean> {
  const rows = await tx
    .delete(people)
    .where(and(eq(people.id, personId), eq(people.orgId, ctx.orgId)))
    .returning({ id: people.id });
  return rows.length > 0;
}
