import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { withOrgContext } from "@/core/db/tenant";
import { createProjectFromProposal } from "@/modules/projects/plan";
import { getProjectFull } from "@/modules/projects/read";
import { setBudget } from "@/modules/projects/write-misc";
import { approveStatus } from "@/modules/reports/status-report";
import { buildTemplate, PROJECT_TEMPLATES } from "@/modules/projects/templates";
import { createShareLink, readSharedProject, revokeShareLink } from "@/modules/share/service";
import { adminPool } from "../helpers/db";
import { seedWorkspace } from "../helpers/workspace";

/**
 * A share link opens one project's status page for anyone holding the
 * token, with no login. Two claims are tested: the page shows only what a
 * shared status may show, and a revoked or expired token shows nothing.
 */

let admin: Pool;
let ctx: { orgId: string; userId: string };
let projectId: string;

beforeAll(async () => {
  admin = adminPool();
  ctx = await seedWorkspace(admin, "share");
  projectId = await createProjectFromProposal(
    ctx,
    buildTemplate(PROJECT_TEMPLATES[2]!, "2026-09-01", "da"),
    "",
    "event",
  );
  await withOrgContext(ctx, (tx) => setBudget(tx, ctx, projectId, 60000));
  const full = (await getProjectFull(ctx, projectId))!;
  await withOrgContext(ctx, (tx) =>
    approveStatus(tx, ctx, full, "Alt går efter planen.", [], "rules"),
  );
});

afterAll(async () => {
  await admin?.end();
});

describe("a share link", () => {
  it("opens the project without a session and shows the approved status", async () => {
    const link = await createShareLink(ctx, projectId, "Til styregruppen", null);
    expect(link).not.toBeNull();
    const shared = await readSharedProject(link!.token, "2026-09-03");
    expect(shared).not.toBeNull();
    expect(shared!.name).toBe("Arrangement");
    expect(shared!.milestones.length).toBeGreaterThan(0);
    expect(shared!.statuses[0]!.text).toBe("Alt går efter planen.");
    // The report is frozen with the status, so the page reads the same next year.
    expect(shared!.statuses[0]!.report?.projectName).toBe("Arrangement");
  });

  it("carries nothing the workspace keeps to itself", async () => {
    const link = await createShareLink(ctx, projectId, "Offentlig", null);
    const shared = await readSharedProject(link!.token, "2026-09-03");
    const keys = Object.keys(shared!);
    expect(keys).not.toContain("obstacles");
    expect(keys).not.toContain("economy");
    expect(keys).not.toContain("chat");
    // The frozen report is cut down on the way out: no money, no obstacles.
    expect(shared!.statuses[0]!.report?.economy).toBeNull();
    expect(shared!.statuses[0]!.report?.obstacles).toEqual([]);
  });

  it("gives nothing for a revoked token", async () => {
    const link = await createShareLink(ctx, projectId, "Kortvarig", null);
    expect(await revokeShareLink(ctx, link!.id)).toBe(true);
    expect(await readSharedProject(link!.token, "2026-09-03")).toBeNull();
    // Revoking twice is not an error, it is simply no longer open.
    expect(await revokeShareLink(ctx, link!.id)).toBe(false);
  });

  it("gives nothing for an expired token", async () => {
    const link = await createShareLink(ctx, projectId, "Udløbet", 30);
    await admin.query(
      `update share_links set expires_at = now() - interval '1 day' where id = $1`,
      [link!.id],
    );
    expect(await readSharedProject(link!.token, "2026-09-03")).toBeNull();
  });

  it("gives nothing for a token that was never issued", async () => {
    expect(await readSharedProject("aldrig-udstedt-token-1234", "2026-09-03")).toBeNull();
    expect(await readSharedProject("../../etc/passwd", "2026-09-03")).toBeNull();
    expect(await readSharedProject("", "2026-09-03")).toBeNull();
  });

  it("stores the token as a hash, never as itself", async () => {
    const link = await createShareLink(ctx, projectId, "Hash", null);
    const rows = await admin.query(`select token_hash from share_links where id = $1`, [link!.id]);
    expect(rows.rows[0].token_hash).not.toBe(link!.token);
    expect(rows.rows[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("refuses to be made for a project in another workspace", async () => {
    const other = await seedWorkspace(admin, "share2");
    expect(await createShareLink(other, projectId, "Smuglet", null)).toBeNull();
  });
});
