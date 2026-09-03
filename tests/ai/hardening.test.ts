import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { withOrgContext } from "@/core/db/tenant";
import { applyChatReply } from "@/modules/ai/apply";
import {
  MAX_CALLS_PER_USER_PER_HOUR,
  RateLimited,
  capText,
  reserveAiCall,
} from "@/modules/ai/limits";
import { emptyChatReply } from "@/modules/ai/types";
import { createProjectFromProposal } from "@/modules/projects/plan";
import { getProjectFull } from "@/modules/projects/read";
import { buildTemplate, PROJECT_TEMPLATES } from "@/modules/projects/templates";
import { adminPool } from "../helpers/db";
import { seedWorkspace } from "../helpers/workspace";

/**
 * The AI surface, pressed on rather than described. Two claims: a model
 * that names rows from another project cannot touch them even if the
 * sanitizer were fooled, and no caller can spend a workspace's model
 * budget without limit.
 */

let admin: Pool;
let ctx: { orgId: string; userId: string };
let projectId: string;
let otherProjectId: string;

beforeAll(async () => {
  admin = adminPool();
  ctx = await seedWorkspace(admin, "hard");
  projectId = await createProjectFromProposal(
    ctx,
    buildTemplate(PROJECT_TEMPLATES[2]!, "2026-09-01", "da"),
    "",
    "event",
  );
  otherProjectId = await createProjectFromProposal(
    ctx,
    buildTemplate(PROJECT_TEMPLATES[4]!, "2026-09-01", "da"),
    "",
    "solo",
  );
});

afterAll(async () => {
  await admin?.end();
});

describe("the write boundary", () => {
  it("will not move another project's task, even when handed its real id", async () => {
    const other = (await getProjectFull(ctx, otherProjectId))!;
    const victim = other.tasks[0]!;
    const before = { start: victim.startDate, end: victim.endDate };

    const reply = emptyChatReply("Flyttet.");
    reply.taskMoves = [
      {
        id: victim.id,
        title: victim.title,
        oldStart: victim.startDate,
        oldEnd: victim.endDate,
        newStart: "2027-01-01",
        newEnd: "2027-01-08",
      },
    ];
    await withOrgContext(ctx, (tx) => applyChatReply(tx, ctx, projectId, reply));

    const after = (await getProjectFull(ctx, otherProjectId))!;
    const task = after.tasks.find((x) => x.id === victim.id)!;
    expect([task.startDate, task.endDate]).toEqual([before.start, before.end]);
  });

  it("will not hang a new task on another project's milestone", async () => {
    const other = (await getProjectFull(ctx, otherProjectId))!;
    const reply = emptyChatReply("Oprettet.");
    reply.newTasks = [
      {
        title: "Smuglet ind",
        milestoneId: other.milestones[0]!.id,
        owner: "",
        startDate: "2026-10-01",
        endDate: "2026-10-02",
      },
    ];
    await withOrgContext(ctx, (tx) => applyChatReply(tx, ctx, projectId, reply));

    const full = (await getProjectFull(ctx, projectId))!;
    const created = full.tasks.find((task) => task.title === "Smuglet ind")!;
    expect(created.milestoneId).toBeNull();
    const otherAfter = (await getProjectFull(ctx, otherProjectId))!;
    expect(otherAfter.tasks.some((task) => task.title === "Smuglet ind")).toBe(false);
  });

  it("has no way to delete, because the reply has no delete in it", () => {
    const reply = emptyChatReply("x");
    expect(Object.keys(reply).some((key) => /delete|remove|drop/i.test(key))).toBe(false);
  });
});

describe("prompt length", () => {
  it("trims and caps whatever is handed to it", () => {
    expect(capText("  hej  ", 100)).toBe("hej");
    expect(capText("a".repeat(5000), 2000)).toHaveLength(2000);
    expect(capText(null, 100)).toBe("");
    expect(capText({ toString: () => "nej" }, 100)).toBe("");
    expect(capText("linje\r\nto", 100)).toBe("linje\nto");
  });
});

describe("the ceiling on model calls", () => {
  it("refuses a caller who is over the hourly limit", async () => {
    const heavy = await seedWorkspace(admin, "heavy");
    await withOrgContext(heavy, async (tx) => {
      for (let i = 0; i < MAX_CALLS_PER_USER_PER_HOUR; i++)
        await reserveAiCall(tx, heavy, "chat", "test");
    });
    await expect(
      withOrgContext(heavy, (tx) => reserveAiCall(tx, heavy, "chat", "test")),
    ).rejects.toBeInstanceOf(RateLimited);
  });

  it("counts calls per workspace, not globally", async () => {
    const quiet = await seedWorkspace(admin, "quiet");
    await expect(
      withOrgContext(quiet, (tx) => reserveAiCall(tx, quiet, "chat", "test")),
    ).resolves.toBeUndefined();
  });
});
