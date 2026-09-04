import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { withOrgContext, type OrgContext } from "@/core/db/tenant";
import { createProjectFromProposal } from "@/modules/projects/plan";
import { getProjectFull, readProjectFull } from "@/modules/projects/read";
import { buildTemplate, PROJECT_TEMPLATES } from "@/modules/projects/templates";
import { addObstacle, setBudget } from "@/modules/projects/write-misc";
import { prepareStatus, type StatusWords } from "@/modules/reports/prepare";
import {
  approveStatus,
  parseStatusReport,
  plainAuthored,
  type ManagementAsk,
} from "@/modules/reports/status-report";
import { adminPool } from "../helpers/db";
import { seedWorkspace } from "../helpers/workspace";

/**
 * The status across weeks: what is asked of management follows to the
 * next status until it is answered, the trend remembers the colours, and
 * "since last" is worked out from the events between two approvals.
 */

const words: StatusWords = {
  reason: (r) => r.key,
  sinceLast: {
    tasksDone: (n) => `done ${n}`,
    tasksMoved: (n) => `moved ${n}`,
    milestonesReached: (t) => `reached ${t}`,
    milestonesChanged: (t) => `changed ${t}`,
    obstaclesAdded: (n, ex) => `obstacle ${ex}`,
    obstaclesResolved: (n, ex) => `resolved ${ex}`,
    decisions: (n) => `decisions ${n}`,
    budgetSet: (a) => `budget ${a}`,
    nothing: "nothing",
  },
};

let admin: Pool;
let ctx: OrgContext;
let projectId: string;

beforeAll(async () => {
  admin = adminPool();
  ctx = await seedWorkspace(admin, "statusflow");
  projectId = await createProjectFromProposal(
    ctx,
    buildTemplate(PROJECT_TEMPLATES[2]!, "2026-08-01", "da"),
    "",
    "event",
  );
});

afterAll(async () => {
  await admin.end();
});

describe("the status across weeks", () => {
  it("starts with nothing carried and the whole creation as since-last", async () => {
    const full = (await getProjectFull(ctx, projectId))!;
    const prepared = await withOrgContext(ctx, (tx) =>
      prepareStatus(tx, full, words, "2026-09-10"),
    );
    expect(prepared.carriedAsks).toEqual([]);
    expect(prepared.previousComment).toBe("");
    expect(prepared.rag).toBeDefined();
  });

  it("carries an unanswered ask to the next week, marked with the week it came from", async () => {
    const asks: ManagementAsk[] = [
      {
        id: "ask-1",
        text: "Godkend lokalet",
        dueDate: "2026-09-15",
        carriedFrom: null,
        answered: false,
      },
      { id: "ask-2", text: "Frigiv Sofie", dueDate: null, carriedFrom: null, answered: true },
    ];
    await withOrgContext(ctx, async (tx) => {
      const full = (await readProjectFull(tx, projectId))!;
      await approveStatus(
        tx,
        ctx,
        full,
        {
          ...plainAuthored("Uge 36.", "rules"),
          rag: "yellow",
          ragSuggested: "green",
          managerComment: "Min kommentar",
          managementAsks: asks,
        },
        { sinceLast: [], approvedByName: "Mette" },
        [],
      );
    });

    // Something happens in between, so since-last has something to say.
    await withOrgContext(ctx, async (tx) => {
      await setBudget(tx, ctx, projectId, 60000);
      await addObstacle(tx, ctx, projectId, "Lokalet er optaget");
    });

    const full = (await getProjectFull(ctx, projectId))!;
    const prepared = await withOrgContext(ctx, (tx) =>
      prepareStatus(tx, full, words, "2026-09-17"),
    );
    expect(prepared.carriedAsks).toHaveLength(1);
    expect(prepared.carriedAsks[0]).toMatchObject({
      id: "ask-1",
      carriedFrom: full.statusUpdates[0]!.weekKey,
    });
    expect(prepared.previousComment).toBe("Min kommentar");
    expect(prepared.sinceLast).toContain("obstacle Lokalet er optaget");
    expect(prepared.sinceLast).toContain("budget 60000");
  });

  it("freezes the report with the trend, the override and the asks", async () => {
    const full = (await getProjectFull(ctx, projectId))!;
    const previous = full.statusUpdates[0]!;
    await withOrgContext(ctx, async (tx) => {
      const prepared = await prepareStatus(tx, full, words, "2026-09-17");
      await approveStatus(
        tx,
        ctx,
        full,
        {
          ...plainAuthored("Uge 37.", "rules"),
          rag: "red",
          ragSuggested: prepared.rag,
          managementAsks: prepared.carriedAsks.map((a) => ({ ...a, answered: true })),
        },
        { sinceLast: prepared.sinceLast, approvedByName: "Mette" },
        [],
      );
    });
    const after = (await getProjectFull(ctx, projectId))!;
    const latest = after.statusUpdates[0]!;
    expect(latest.rag).toBe("red");
    const report = parseStatusReport(latest.details)!;
    expect(report.version).toBe(2);
    expect(report.trend.map((p) => p.rag)).toEqual(["yellow", "red"]);
    expect(report.trend[0]!.weekKey).toBe(previous.weekKey);
    expect(report.managementAsks[0]).toMatchObject({ id: "ask-1", answered: true });
    expect(report.sinceLast.length).toBeGreaterThan(0);

    // Answered means gone next week.
    const next = await withOrgContext(ctx, (tx) => prepareStatus(tx, after, words, "2026-09-24"));
    expect(next.carriedAsks).toEqual([]);
  });
});
