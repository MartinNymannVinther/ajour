import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { withOrgContext, type OrgContext } from "@/core/db/tenant";
import { createProjectFromProposal } from "@/modules/projects/plan";
import { getProjectFull } from "@/modules/projects/read";
import { buildTemplate, PROJECT_TEMPLATES } from "@/modules/projects/templates";
import { addExpense, spendOf, updateExpense } from "@/modules/projects/write-misc";
import { adminPool } from "../helpers/db";
import { seedWorkspace } from "../helpers/workspace";

/**
 * A budget line paid in parts. The number is the truth and the old
 * all-or-nothing flag follows it, so the totals, the report and anything
 * written before partial spend existed keep agreeing.
 */

describe("spendOf", () => {
  it("turns the old flag into a number and the number into the flag", () => {
    expect(spendOf({ amount: 20000, incurred: true })).toEqual({ spent: 20000, incurred: true });
    expect(spendOf({ amount: 20000, incurred: false })).toEqual({ spent: 0, incurred: false });
    expect(spendOf({ amount: 20000, spent: 5000 })).toEqual({ spent: 5000, incurred: false });
    expect(spendOf({ amount: 20000, spent: 20000 })).toEqual({ spent: 20000, incurred: true });
    expect(spendOf({ amount: 20000, spent: 23000 })).toEqual({ spent: 23000, incurred: true });
    expect(spendOf({ amount: 20000, spent: -5 })).toEqual({ spent: 0, incurred: false });
  });
});

describe("a line paid in parts", () => {
  let admin: Pool;
  let ctx: OrgContext;
  let projectId: string;

  beforeAll(async () => {
    admin = adminPool();
    ctx = await seedWorkspace(admin, "spend");
    projectId = await createProjectFromProposal(
      ctx,
      buildTemplate(PROJECT_TEMPLATES[2]!, "2026-09-01", "da"),
      "",
      "event",
    );
  });

  afterAll(async () => {
    await admin.end();
  });

  it("counts only what is paid, and flips the flag when it is all paid", async () => {
    const id = await withOrgContext(ctx, (tx) =>
      addExpense(tx, ctx, { projectId, title: "Lokale", amount: 20000, spent: 5000, taskId: null }),
    );
    let full = (await getProjectFull(ctx, projectId))!;
    let line = full.expenses.find((e) => e.id === id)!;
    expect(line.spent).toBe(5000);
    expect(line.incurred).toBe(false);

    await withOrgContext(ctx, (tx) => updateExpense(tx, ctx, id, { spent: 20000 }));
    full = (await getProjectFull(ctx, projectId))!;
    line = full.expenses.find((e) => e.id === id)!;
    expect(line.incurred).toBe(true);

    // Lowering the amount below the spend keeps it incurred; raising it reopens it.
    await withOrgContext(ctx, (tx) => updateExpense(tx, ctx, id, { amount: 25000 }));
    full = (await getProjectFull(ctx, projectId))!;
    line = full.expenses.find((e) => e.id === id)!;
    expect(line.spent).toBe(20000);
    expect(line.incurred).toBe(false);

    // The old flag still works as "all of it".
    await withOrgContext(ctx, (tx) => updateExpense(tx, ctx, id, { incurred: true }));
    full = (await getProjectFull(ctx, projectId))!;
    line = full.expenses.find((e) => e.id === id)!;
    expect(line.spent).toBe(25000);
  });
});
