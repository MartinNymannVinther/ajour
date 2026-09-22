import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { auth } from "@/core/auth/auth";
import { registerUserWithOrganization } from "@/core/auth/register";
import { renameWorkspace } from "@/modules/export/workspace";
import { adminPool } from "../helpers/db";

/**
 * Renaming the workspace goes through Better Auth, which owns the table,
 * and must leave two things behind: the row change by trigger and a named
 * event that says who did it. A plain member is turned away.
 */

const PASSWORD = "en-meget-lang-kode-123";
let admin: Pool;

beforeAll(async () => {
  admin = adminPool();
});

afterAll(async () => {
  await admin?.end();
});

async function signedUp(email: string, organizationName: string) {
  const result = await registerUserWithOrganization(new Headers(), {
    name: "Rename Tester",
    email,
    password: PASSWORD,
    organizationName,
  });
  expect(result).toEqual({ ok: true });
  const { headers: responseHeaders } = await auth.api.signInEmail({
    body: { email, password: PASSWORD },
    returnHeaders: true,
  });
  const cookie = responseHeaders
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  const user = await admin.query("select id from users where email = $1", [email]);
  const membership = await admin.query(
    "select organization_id from memberships where user_id = $1",
    [user.rows[0].id],
  );
  return {
    userId: user.rows[0].id as string,
    orgId: membership.rows[0].organization_id as string,
    headers: new Headers({ cookie }),
  };
}

describe("renaming the workspace", () => {
  it("changes the name and records who did it", async () => {
    const owner = await signedUp("rename-owner@example.com", "Før omdøbning");
    const ctx = { orgId: owner.orgId, userId: owner.userId };
    expect(await renameWorkspace(ctx, "Efter omdøbning", owner.headers)).toBe("renamed");

    const org = await admin.query("select name, slug from organizations where id = $1", [
      owner.orgId,
    ]);
    expect(org.rows[0].name).toBe("Efter omdøbning");
    expect(org.rows[0].slug).toMatch(/^foer-omdoebning-/);

    const audit = await admin.query(
      `select action, actor_user_id, after_data ->> 'name' as name from audit_log
       where org_id = $1 and action in ('organizations.update', 'workspace.renamed') order by id`,
      [owner.orgId],
    );
    const actions = audit.rows.map((r) => r.action);
    expect(actions).toContain("organizations.update");
    expect(actions).toContain("workspace.renamed");
    expect(audit.rows.find((r) => r.action === "organizations.update")!.name).toBe(
      "Efter omdøbning",
    );
    expect(audit.rows.find((r) => r.action === "workspace.renamed")!.actor_user_id).toBe(
      owner.userId,
    );
  });

  it("turns a plain member away", async () => {
    const owner = await signedUp("rename-owner-2@example.com", "Ejerens rum");
    const member = await signedUp("rename-member@example.com", "Medlemmets eget rum");
    await admin.query(
      `insert into memberships (id, organization_id, user_id, role) values ($1, $2, $3, 'member')`,
      ["mem_rename_member", owner.orgId, member.userId],
    );
    const ctx = { orgId: owner.orgId, userId: member.userId };
    expect(await renameWorkspace(ctx, "Kuppet", member.headers)).toBe("notAllowed");
    const org = await admin.query("select name from organizations where id = $1", [owner.orgId]);
    expect(org.rows[0].name).toBe("Ejerens rum");
  });
});
