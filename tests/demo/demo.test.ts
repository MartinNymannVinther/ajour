import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { sql } from "drizzle-orm";
import { authDb } from "@/core/db/client";
import { demoWorkspaces } from "@/core/db/schema";
import { withOrgContext } from "@/core/db/tenant";
import { cleanupExpiredDemos } from "@/modules/demo/service";
import { seedDemoProject } from "@/modules/demo/seed";
import { getProjectFull } from "@/modules/projects/read";
import { adminPool } from "../helpers/db";
import { seedWorkspace } from "../helpers/workspace";

/**
 * The demo has to be two things at once: a real project built by the real
 * services, and something that reliably disappears. Both are tested here,
 * because a demo that leaks workspaces is a demo that fills a database.
 */

let admin: Pool;

beforeAll(async () => {
  admin = adminPool();
});

afterAll(async () => {
  await admin?.end();
});

describe("the seeded demo project", () => {
  it("has a plan that has already started to slip", async () => {
    const ctx = await seedWorkspace(admin, "demoseed");
    const projectId = await withOrgContext(ctx, (tx) => seedDemoProject(tx, ctx, "da"));
    const full = (await getProjectFull(ctx, projectId))!;

    expect(full.project.name).toContain("demo");
    expect(full.project.ownerName).toBe("Lise");
    expect(full.project.managerName).toBe("Mette");
    expect(full.project.budget).toBe(60000);
    expect(full.milestones).toHaveLength(3);
    expect(full.tasks).toHaveLength(9);
    // Something running, something open, something decided, money spent:
    // a plan where everything is fine demonstrates nothing.
    expect(full.tasks.some((task) => task.state === "doing")).toBe(true);
    expect(full.obstacles.some((o) => o.status !== "resolved")).toBe(true);
    expect(full.decisions).toHaveLength(1);
    expect(full.expenses.some((e) => e.incurred)).toBe(true);
    expect(full.expenses.some((e) => !e.incurred)).toBe(true);
    // People are identities here too, not strings on a task.
    expect(full.people.map((p) => p.name).sort()).toEqual([
      "Jonas",
      "Karim",
      "Lise",
      "Mette",
      "Sofie",
    ]);
    const withChecklist = full.tasks.find((task) => (task.subtasks ?? []).length > 0)!;
    expect(withChecklist.subtasks).toHaveLength(3);
  });

  it("builds the same shape in English", async () => {
    const ctx = await seedWorkspace(admin, "demoseeden");
    const projectId = await withOrgContext(ctx, (tx) => seedDemoProject(tx, ctx, "en"));
    const full = (await getProjectFull(ctx, projectId))!;
    expect(full.project.name).toContain("demo");
    expect(full.milestones).toHaveLength(3);
    expect(full.tasks).toHaveLength(9);
  });
});

describe("cleanup", () => {
  it("removes an expired demo and everything in it, and leaves a live one alone", async () => {
    const dead = await seedWorkspace(admin, "demodead");
    const alive = await seedWorkspace(admin, "demoalive");
    await withOrgContext(dead, (tx) => seedDemoProject(tx, dead, "da"));
    await withOrgContext(alive, (tx) => seedDemoProject(tx, alive, "da"));

    await authDb.insert(demoWorkspaces).values([
      {
        organizationId: dead.orgId,
        userId: dead.userId,
        expiresAt: new Date(Date.now() - 60_000),
      },
      {
        organizationId: alive.orgId,
        userId: alive.userId,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    ]);

    const removed = await cleanupExpiredDemos();
    expect(removed).toBeGreaterThanOrEqual(1);

    const gone = await admin.query(`select count(*)::int as n from organizations where id = $1`, [
      dead.orgId,
    ]);
    expect(gone.rows[0].n).toBe(0);
    const projects = await admin.query(
      `select count(*)::int as n from projects where org_id = $1`,
      [dead.orgId],
    );
    expect(projects.rows[0].n).toBe(0);
    const user = await admin.query(`select count(*)::int as n from users where id = $1`, [
      dead.userId,
    ]);
    expect(user.rows[0].n).toBe(0);

    const still = await admin.query(`select count(*)::int as n from organizations where id = $1`, [
      alive.orgId,
    ]);
    expect(still.rows[0].n).toBe(1);

    await authDb.execute(sql`delete from demo_workspaces where organization_id = ${alive.orgId}`);
  });
});

describe("the application role", () => {
  it("cannot read the demo register at all", async () => {
    const ctx = await seedWorkspace(admin, "demopeek");
    await expect(
      withOrgContext(ctx, (tx) => tx.execute(sql`select count(*) from demo_workspaces`)),
    ).rejects.toThrow();
  });
});
