import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { withOrgContext, type OrgContext } from "@/core/db/tenant";
import { ruleBreakdown } from "@/modules/ai/breakdown-rules";
import { applyBreakdown, breakdownInputFor } from "@/modules/projects/breakdown";
import { createProjectFromProposal } from "@/modules/projects/plan";
import { getProjectFull } from "@/modules/projects/read";
import { restoreSnapshotById } from "@/modules/projects/snapshots";
import { buildTemplate, PROJECT_TEMPLATES } from "@/modules/projects/templates";
import { createMilestone } from "@/modules/projects/write-milestones";
import { adminPool } from "../helpers/db";
import { seedWorkspace } from "../helpers/workspace";

/**
 * A milestone broken into tasks. Without a model the rules find a
 * template milestone that sounds like this one, or fall back to the four
 * moves; either way every task lands inside the window. With the tasks
 * written, a snapshot stands before them so the whole set can go again.
 */

const base = {
  locale: "da" as const,
  today: "2026-09-01",
  projectName: "Test",
  goal: "",
  windowStart: "2026-09-01",
  existingTasks: [],
  people: ["Mette", "Jonas"],
};

describe("ruleBreakdown", () => {
  it("borrows a template's tasks when the milestone sounds like one", () => {
    const tasks = ruleBreakdown({
      ...base,
      milestone: { title: "Leverandør valgt", date: "2026-10-15", criterion: "", ownerName: "" },
    });
    expect(tasks.length).toBeGreaterThanOrEqual(2);
    expect(tasks.every((t) => t.startDate >= "2026-09-01" && t.endDate <= "2026-10-15")).toBe(true);
    expect(tasks.some((t) => /tilbud|leverand/i.test(t.title))).toBe(true);
    expect(tasks[0]!.owner).toBe("Mette");
  });

  it("falls back to the four moves for a milestone nothing sounds like", () => {
    const tasks = ruleBreakdown({
      ...base,
      milestone: {
        title: "Zebraen er malet",
        date: "2026-09-30",
        criterion: "",
        ownerName: "Jonas",
      },
    });
    expect(tasks).toHaveLength(4);
    expect(tasks[0]!.title).toContain("Zebraen er malet");
    expect(tasks[0]!.owner).toBe("Jonas");
    expect(tasks[3]!.endDate).toBe("2026-09-30");
    for (let i = 1; i < tasks.length; i++)
      expect(tasks[i]!.startDate >= tasks[i - 1]!.startDate).toBe(true);
  });

  it("leaves out what already exists under the milestone", () => {
    const first = ruleBreakdown({
      ...base,
      milestone: { title: "Zebraen er malet", date: "2026-09-30", criterion: "", ownerName: "" },
    });
    const again = ruleBreakdown({
      ...base,
      existingTasks: [first[0]!.title],
      milestone: { title: "Zebraen er malet", date: "2026-09-30", criterion: "", ownerName: "" },
    });
    expect(again).toHaveLength(3);
  });
});

describe("applyBreakdown", () => {
  let admin: Pool;
  let ctx: OrgContext;
  let projectId: string;

  beforeAll(async () => {
    admin = adminPool();
    ctx = await seedWorkspace(admin, "breakdown");
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

  it("opens the window the day after the previous milestone", async () => {
    const milestoneId = await withOrgContext(ctx, (tx) =>
      createMilestone(tx, ctx, { projectId, title: "Evaluering afsluttet", date: "2027-01-15" }),
    );
    const found = await withOrgContext(ctx, (tx) => breakdownInputFor(tx, milestoneId, "da"));
    const full = (await getProjectFull(ctx, projectId))!;
    const previous = full.milestones
      .filter((m) => m.date < "2027-01-15")
      .sort((a, b) => b.date.localeCompare(a.date))[0]!;
    expect(found!.input.windowStart > previous.date).toBe(true);
    expect(found!.input.existingTasks).toEqual([]);
  });

  it("writes the kept tasks under the milestone after a snapshot, and the snapshot takes them back", async () => {
    const full = (await getProjectFull(ctx, projectId))!;
    const milestone = full.milestones.find((m) => m.title === "Evaluering afsluttet")!;
    const before = full.tasks.length;
    const result = await withOrgContext(ctx, (tx) =>
      applyBreakdown(
        tx,
        ctx,
        milestone.id,
        [
          {
            title: "Saml tilbagemeldinger",
            owner: "",
            startDate: "2026-12-10",
            endDate: "2026-12-20",
          },
          {
            title: "Skriv evalueringen",
            owner: "",
            startDate: "2027-01-02",
            endDate: "2027-02-01",
          },
        ],
        "Før nedbrydning",
      ),
    );
    expect(result!.created).toHaveLength(2);
    expect(result!.snapshotId).toBeTruthy();

    const after = (await getProjectFull(ctx, projectId))!;
    expect(after.tasks).toHaveLength(before + 2);
    const written = after.tasks.filter((t) => t.milestoneId === milestone.id);
    expect(written).toHaveLength(2);
    // The end is clamped to the milestone: a task cannot finish after the thing it carries.
    expect(written.find((t) => t.title === "Skriv evalueringen")!.endDate).toBe("2027-01-15");
    expect(after.events.some((e) => e.type === "ai.applied")).toBe(true);

    await withOrgContext(ctx, (tx) =>
      restoreSnapshotById(tx, ctx, result!.snapshotId!, { tasks: result!.created }),
    );
    const restored = (await getProjectFull(ctx, projectId))!;
    expect(restored.tasks).toHaveLength(before);
  });
});
