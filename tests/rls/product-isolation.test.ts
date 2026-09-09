import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client, Pool } from "pg";
import { adminPool, appClient, asApp, expectSqlError } from "../helpers/db";

/**
 * Workspace isolation for every product table, proven as the application
 * role with raw SQL. Each table gets one row per workspace, seeded as the
 * superuser; the application role must then see exactly its own row with
 * its context, nothing without one, and be refused when writing for the
 * other workspace. New tables are added to TABLES here or the meta-test in
 * tenant-isolation fails them for missing RLS anyway.
 */

const A = { orgId: "org_prod_a", userId: "user_prod_a" };
const B = { orgId: "org_prod_b", userId: "user_prod_b" };

/** Table → column list and a row factory keyed by workspace. */
const TABLES: Array<{
  table: string;
  row: (org: typeof A, suffix: string) => Record<string, unknown>;
}> = [
  { table: "people", row: (o, s) => ({ name: `Person ${s}` }) },
  { table: "projects", row: (o, s) => ({ id: `proj_${s}`, name: `Projekt ${s}` }) },
  {
    table: "milestones",
    row: (o, s) => ({ project_id: `proj_${s}`, title: `M ${s}`, date: "2026-10-01" }),
  },
  {
    table: "tasks",
    row: (o, s) => ({
      id: `task_${s}`,
      project_id: `proj_${s}`,
      title: `T ${s}`,
      start_date: "2026-09-01",
      end_date: "2026-09-05",
    }),
  },
  {
    table: "task_participants",
    row: (o, s) => ({ task_id: `task_${s}`, person_id: `person_${s}` }),
  },
  { table: "obstacles", row: (o, s) => ({ project_id: `proj_${s}`, title: `O ${s}` }) },
  { table: "decisions", row: (o, s) => ({ project_id: `proj_${s}`, title: `D ${s}` }) },
  {
    table: "expenses",
    row: (o, s) => ({ project_id: `proj_${s}`, title: `E ${s}`, amount: 100 }),
  },
  {
    table: "status_updates",
    row: (o, s) => ({ project_id: `proj_${s}`, week_key: "2026-W36", text: `S ${s}` }),
  },
  {
    table: "snapshots",
    row: (o, s) => ({ project_id: `proj_${s}`, label: `Snap ${s}`, data: JSON.stringify({}) }),
  },
  {
    table: "tips",
    row: (o, s) => ({ project_id: `proj_${s}`, day: "2026-09-03", title: `Tip ${s}`, text: "t" }),
  },
  { table: "events", row: (o, s) => ({ project_id: `proj_${s}`, type: "test" }) },
  {
    table: "chat_messages",
    row: (o, s) => ({ project_id: `proj_${s}`, role: "user", content: `hej ${s}` }),
  },
  { table: "ai_calls", row: () => ({ kind: "chat" }) },
  {
    table: "share_links",
    row: (o, s) => ({ project_id: `proj_${s}`, token_hash: `hash_${s}` }),
  },
  {
    table: "participant_replies",
    row: (o, s) => ({
      project_id: `proj_${s}`,
      person_id: `person_${s}`,
      kind: "note",
      task_id: `task_${s}`,
      text: `Svar ${s}`,
    }),
  },
  {
    table: "workspace_llm_settings",
    row: (o, s) => ({ provider: "ollama", model: `model-${s}` }),
  },
];

let admin: Pool;
let app: Client;

async function insertAsAdmin(table: string, values: Record<string, unknown>) {
  const columns = Object.keys(values);
  const params = columns.map((_, i) => `$${i + 1}`);
  await admin.query(
    `insert into "${table}" (${columns.map((c) => `"${c}"`).join(", ")}) values (${params.join(", ")})`,
    columns.map((c) => values[c]),
  );
}

beforeAll(async () => {
  admin = adminPool();
  app = await appClient();
  for (const [org, s] of [
    [A, "a"],
    [B, "b"],
  ] as const) {
    await admin.query(
      `insert into organizations (id, name, slug) values ($1, $2, $3) on conflict do nothing`,
      [org.orgId, `Prod ${s}`, `prod-${s}`],
    );
    await admin.query(
      `insert into users (id, name, email) values ($1, $2, $3) on conflict do nothing`,
      [org.userId, `User ${s}`, `prod-${s}@example.com`],
    );
    await admin.query(
      `insert into memberships (id, organization_id, user_id, role) values ($1, $2, $3, 'owner') on conflict do nothing`,
      [`mem_prod_${s}`, org.orgId, org.userId],
    );
    // people first with a fixed id, because task_participants points at it.
    await insertAsAdmin("people", { id: `person_${s}`, org_id: org.orgId, name: `Ejer ${s}` });
    for (const spec of TABLES) {
      if (spec.table === "people") continue;
      await insertAsAdmin(spec.table, { org_id: org.orgId, ...spec.row(org, s) });
    }
  }
});

afterAll(async () => {
  await app?.end();
  await admin?.end();
});

describe.each(TABLES.map((t) => t.table))("%s", (table) => {
  it("shows the active workspace its own rows and nothing else", async () => {
    const rows = await asApp(app, A, (c) => c.query(`select org_id from "${table}"`));
    expect(rows.rowCount).toBeGreaterThan(0);
    expect(rows.rows.every((r) => r.org_id === A.orgId)).toBe(true);
  });

  it("shows nothing without a context", async () => {
    const rows = await asApp(app, null, (c) =>
      c.query(`select count(*)::int as n from "${table}"`),
    );
    expect(rows.rows[0].n).toBe(0);
  });

  it("refuses an update that would move a row to the other workspace", async () => {
    const code = await asApp(app, A, (c) =>
      expectSqlError(
        c.query(`update "${table}" set org_id = $1 where org_id = $2`, [B.orgId, A.orgId]),
      ),
    );
    expect(code).toBe("42501");
  });
});

describe("writing for the other workspace", () => {
  it("is refused by the row-level policy, not merely by a missing row", async () => {
    const code = await asApp(app, A, (c) =>
      expectSqlError(
        c.query(`insert into projects (org_id, name) values ($1, 'Smuglet ind')`, [B.orgId]),
      ),
    );
    expect(code).toBe("42501");
  });

  it("cannot delete or touch the other workspace's rows even by id", async () => {
    const before = await admin.query(`select count(*)::int as n from projects where org_id = $1`, [
      B.orgId,
    ]);
    const result = await asApp(app, A, (c) =>
      c.query(`delete from projects where org_id = $1`, [B.orgId]),
    );
    expect(result.rowCount).toBe(0);
    const after = await admin.query(`select count(*)::int as n from projects where org_id = $1`, [
      B.orgId,
    ]);
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });
});

describe("workspace members", () => {
  it("are readable by the application role, other workspaces' users are not", async () => {
    const seen = await asApp(app, A, (c) => c.query(`select id from users order by id`));
    expect(seen.rows.map((r) => r.id)).toEqual([A.userId]);
  });
});

describe("the share-link read path", () => {
  it("resolves exactly the link whose hash is presented, without a workspace context", async () => {
    await app.query("begin");
    try {
      await app.query("select set_config('app.share_hash', 'hash_b', true)");
      const rows = await app.query(`select org_id, project_id from share_links`);
      expect(rows.rows).toEqual([{ org_id: B.orgId, project_id: "proj_b" }]);
      // The token opens the link row and nothing else until the workspace is set.
      const projects = await app.query(`select id from projects`);
      expect(projects.rowCount).toBe(0);
    } finally {
      await app.query("rollback");
    }
  });

  it("gives an unknown token nothing", async () => {
    await app.query("begin");
    try {
      await app.query("select set_config('app.share_hash', 'hash_nope', true)");
      const rows = await app.query(`select id from share_links`);
      expect(rows.rowCount).toBe(0);
    } finally {
      await app.query("rollback");
    }
  });
});
