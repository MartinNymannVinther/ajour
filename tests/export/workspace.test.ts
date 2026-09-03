import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { sql } from "drizzle-orm";
import { withOrgContext } from "@/core/db/tenant";
import { buildOrgExport } from "@/modules/export/service";
import { exportToJson, exportToXlsx } from "@/modules/export/format";
import { EXPORT_TABLES } from "@/modules/export/tables";
import { createProjectFromProposal } from "@/modules/projects/plan";
import { buildTemplate, PROJECT_TEMPLATES } from "@/modules/projects/templates";
import { addDecision, setBudget } from "@/modules/projects/write-misc";
import { createShareLink } from "@/modules/share/service";
import { adminPool } from "../helpers/db";
import { seedWorkspace } from "../helpers/workspace";

/**
 * Dogma three: everything a workspace owns comes out in open formats, and
 * goes away completely when asked. Both halves are proven here against
 * the real database, including that deletion takes the audit rows with it.
 */

let admin: Pool;
let ctx: { orgId: string; userId: string };

beforeAll(async () => {
  admin = adminPool();
  ctx = await seedWorkspace(admin, "export");
  const projectId = await createProjectFromProposal(
    ctx,
    buildTemplate(PROJECT_TEMPLATES[0]!, "2026-09-01", "da"),
    "En beskrivelse",
    "procurement",
  );
  await withOrgContext(ctx, (tx) => setBudget(tx, ctx, projectId, 250000));
  await withOrgContext(ctx, (tx) => addDecision(tx, ctx, projectId, "Vi udbyder i to spor", ""));
  await createShareLink(ctx, projectId, "Til styregruppen", 30);
});

afterAll(async () => {
  await admin?.end();
});

describe("the export", () => {
  it("carries every table the workspace owns, and the members", async () => {
    const data = await buildOrgExport(ctx);
    const sheets = data.sections.map((s) => s.sheet);
    for (const t of EXPORT_TABLES) expect(sheets).toContain(t.sheet);
    expect(sheets).toContain("Brugere");
    const projects = data.sections.find((s) => s.sheet === "Projekter")!;
    expect(projects.rows.length).toBe(1);
  });

  it("leaves the share token's hash behind", async () => {
    const data = await buildOrgExport(ctx);
    const links = data.sections.find((s) => s.sheet === "Delelinks")!;
    expect(links.rows.length).toBe(1);
    expect(links.columns).not.toContain("token_hash");
    expect(JSON.stringify(links.rows)).not.toContain("token_hash");
  });

  it("comes out as a spreadsheet and as JSON", async () => {
    const data = await buildOrgExport(ctx);
    const xlsx = exportToXlsx(data);
    expect(xlsx.length).toBeGreaterThan(1000);
    expect(xlsx.subarray(0, 2).toString("latin1")).toBe("PK");
    const json = JSON.parse(exportToJson(data));
    expect(json.ajour.format).toBe(1);
    expect(Object.keys(json.tables)).toHaveLength(data.sections.length);
    expect(json.tables["Projekter"]).toHaveLength(1);
    expect(json.tables["Projekter"][0].name).toBeTruthy();
  });

  it("writes itself into the audit log as an event that happened", async () => {
    await buildOrgExport(ctx);
    const rows = await admin.query(
      `select count(*)::int as n from audit_log where org_id = $1 and action = 'workspace.exported'`,
      [ctx.orgId],
    );
    expect(rows.rows[0].n).toBeGreaterThan(0);
  });
});

describe("deleting a workspace", () => {
  it("removes the rows, the audit rows about them, and leaves one marker", async () => {
    const doomed = await seedWorkspace(admin, "doomed");
    await createProjectFromProposal(
      doomed,
      buildTemplate(PROJECT_TEMPLATES[4]!, "2026-09-01", "da"),
      "",
      "solo",
    );
    const before = await admin.query(`select count(*)::int as n from audit_log where org_id = $1`, [
      doomed.orgId,
    ]);
    expect(before.rows[0].n).toBeGreaterThan(0);

    await withOrgContext(doomed, async (tx) => {
      await tx.execute(sql`select delete_workspace(${doomed.orgId})`);
    });

    for (const table of ["projects", "milestones", "tasks", "people", "events"]) {
      const rows = await admin.query(
        `select count(*)::int as n from "${table}" where org_id = $1`,
        [doomed.orgId],
      );
      expect(rows.rows[0].n).toBe(0);
    }
    const org = await admin.query(`select count(*)::int as n from organizations where id = $1`, [
      doomed.orgId,
    ]);
    expect(org.rows[0].n).toBe(0);
    const audit = await admin.query(`select count(*)::int as n from audit_log where org_id = $1`, [
      doomed.orgId,
    ]);
    expect(audit.rows[0].n).toBe(0);
    const marker = await admin.query(
      `select count(*)::int as n from audit_log
         where action = 'workspace.deleted' and entity_id = $1 and org_id is null`,
      [doomed.orgId],
    );
    expect(marker.rows[0].n).toBe(1);
  });

  it("cannot be done by a member who is not the owner", async () => {
    const victim = await seedWorkspace(admin, "victim");
    const bystander = await seedWorkspace(admin, "bystander");
    await expect(
      withOrgContext(bystander, async (tx) => {
        await tx.execute(sql`select delete_workspace(${victim.orgId})`);
      }),
    ).rejects.toThrow();
    const org = await admin.query(`select count(*)::int as n from organizations where id = $1`, [
      victim.orgId,
    ]);
    expect(org.rows[0].n).toBe(1);
  });
});
