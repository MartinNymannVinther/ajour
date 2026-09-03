import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { withOrgContext } from "@/core/db/tenant";
import { buildTemplate, PROJECT_TEMPLATES } from "@/modules/projects/templates";
import { createProjectFromProposal, applyReplan, buildReplanInput } from "@/modules/projects/plan";
import { getProjectFull, listProjects } from "@/modules/projects/read";
import { restoreSnapshotById, takeSnapshot } from "@/modules/projects/snapshots";
import {
  createMilestone,
  deleteMilestone,
  setMilestoneDone,
} from "@/modules/projects/write-milestones";
import {
  addDecision,
  addExpense,
  addObstacle,
  resolveObstacle,
  setBudget,
  setRoles,
} from "@/modules/projects/write-misc";
import {
  Conflict,
  createTask,
  deleteTask,
  moveTask,
  setTaskState,
  updateTaskPeople,
} from "@/modules/projects/write-tasks";
import { rulesEngine } from "@/modules/ai/rules-engine";
import { adminPool } from "../helpers/db";
import { seedWorkspace } from "../helpers/workspace";

/**
 * The product's services, end to end against the real database, as an
 * ordinary member of one workspace: a template becomes a project, the plan
 * is edited, people become identities, a replan moves what hangs on a
 * milestone, and a snapshot restores exactly what it should.
 */

let admin: Pool;
let ctx: { orgId: string; userId: string };
let projectId: string;

beforeAll(async () => {
  admin = adminPool();
  ctx = await seedWorkspace(admin, "flow");
});

afterAll(async () => {
  await admin?.end();
});

describe("Start: a template becomes a project", () => {
  it("creates the project with its milestones and tasks", async () => {
    const proposal = buildTemplate(PROJECT_TEMPLATES[2]!, "2026-09-01", "da");
    projectId = await createProjectFromProposal(
      ctx,
      proposal,
      PROJECT_TEMPLATES[2]!.description.da,
      "event",
    );
    const full = await getProjectFull(ctx, projectId);
    expect(full?.project.name).toBe("Arrangement");
    expect(full?.milestones).toHaveLength(3);
    expect(full?.tasks).toHaveLength(7);
    expect(full?.tasks.every((t) => t.milestoneId !== null)).toBe(true);
    expect(full?.events.map((e) => e.type)).toContain("project.created");
  });

  it("shows up in the workspace's list with counts", async () => {
    const list = await listProjects(ctx);
    expect(list.map((p) => p.id)).toContain(projectId);
    const summary = list.find((p) => p.id === projectId)!;
    expect(summary.taskCount).toBe(7);
    expect(summary.nextMilestone?.title).toBe("Dato og sted låst");
  });
});

describe("people are identities", () => {
  it("resolves the same name to one person, case-insensitively", async () => {
    const full = (await getProjectFull(ctx, projectId))!;
    const task = full.tasks[0]!;
    await withOrgContext(ctx, (tx) =>
      updateTaskPeople(tx, ctx, {
        taskId: task.id,
        owner: "Mette",
        participants: ["Jonas", "mette", "Sofie"],
      }),
    );
    await withOrgContext(ctx, (tx) => setRoles(tx, ctx, projectId, "mette", "Jonas"));
    const after = (await getProjectFull(ctx, projectId))!;
    const names = after.people.map((p) => p.name).sort();
    expect(names).toEqual(["Jonas", "Mette", "Sofie"]);
    const edited = after.tasks.find((t) => t.id === task.id)!;
    expect(edited.ownerName).toBe("Mette");
    // The owner is never also a participant.
    expect(edited.participants.sort()).toEqual(["Jonas", "Sofie"]);
    expect(after.project.ownerName).toBe("Mette");
    expect(after.project.managerName).toBe("Jonas");
  });

  it("refuses a stale edit with a conflict, not a silent overwrite", async () => {
    const full = (await getProjectFull(ctx, projectId))!;
    const task = full.tasks[0]!;
    await expect(
      withOrgContext(ctx, (tx) =>
        updateTaskPeople(tx, ctx, {
          taskId: task.id,
          owner: "Karim",
          participants: [],
          expectedUpdatedAt: "2020-01-01T00:00:00.000Z",
        }),
      ),
    ).rejects.toBeInstanceOf(Conflict);
  });
});

describe("the plan", () => {
  it("moves tasks, changes state, adds and deletes with events", async () => {
    const full = (await getProjectFull(ctx, projectId))!;
    const task = full.tasks[1]!;
    await withOrgContext(ctx, (tx) => moveTask(tx, ctx, task.id, "2026-09-20", "2026-09-10"));
    await withOrgContext(ctx, (tx) => setTaskState(tx, ctx, task.id, "doing"));
    const newId = await withOrgContext(ctx, (tx) =>
      createTask(tx, ctx, {
        projectId,
        title: "Ekstra opgave",
        milestoneId: null,
        owner: "",
        startDate: "2026-10-01",
        endDate: "2026-10-03",
      }),
    );
    const after = (await getProjectFull(ctx, projectId))!;
    const moved = after.tasks.find((t) => t.id === task.id)!;
    expect([moved.startDate, moved.endDate]).toEqual(["2026-09-10", "2026-09-20"]);
    expect(moved.state).toBe("doing");
    expect(after.tasks.some((t) => t.id === newId)).toBe(true);
    await withOrgContext(ctx, (tx) => deleteTask(tx, ctx, newId));
    const afterDelete = (await getProjectFull(ctx, projectId))!;
    expect(afterDelete.tasks.some((t) => t.id === newId)).toBe(false);
    expect(afterDelete.snapshots.some((s) => s.label.includes("Ekstra opgave"))).toBe(true);
    expect(afterDelete.events.map((e) => e.type)).toEqual(
      expect.arrayContaining(["task.moved", "task.state", "task.created", "task.deleted"]),
    );
  });

  it("does not accept a milestone from another project", async () => {
    const other = await createProjectFromProposal(
      ctx,
      buildTemplate(PROJECT_TEMPLATES[4]!, "2026-09-01", "da"),
      "",
      "solo",
    );
    const otherFull = (await getProjectFull(ctx, other))!;
    const id = await withOrgContext(ctx, (tx) =>
      createTask(tx, ctx, {
        projectId,
        title: "Forkert milepæl",
        milestoneId: otherFull.milestones[0]!.id,
        owner: "",
        startDate: "2026-10-01",
        endDate: "2026-10-02",
      }),
    );
    const full = (await getProjectFull(ctx, projectId))!;
    expect(full.tasks.find((t) => t.id === id)!.milestoneId).toBeNull();
  });

  it("deleting a milestone keeps its tasks and takes a copy first", async () => {
    const full = (await getProjectFull(ctx, projectId))!;
    const m = full.milestones[0]!;
    const under = full.tasks.filter((t) => t.milestoneId === m.id).length;
    expect(under).toBeGreaterThan(0);
    await withOrgContext(ctx, (tx) => deleteMilestone(tx, ctx, m.id));
    const after = (await getProjectFull(ctx, projectId))!;
    expect(after.milestones.some((x) => x.id === m.id)).toBe(false);
    expect(after.tasks.length).toBe(full.tasks.length);
    expect(after.snapshots[0]?.label).toContain(m.title);
  });
});

describe("Skred: a replan", () => {
  it("moves open tasks and later milestones with the milestone, and logs a decision", async () => {
    const full = (await getProjectFull(ctx, projectId))!;
    const m = full.milestones[0]!;
    const later = full.milestones.slice(1);
    const affected = full.tasks.filter((t) => t.milestoneId === m.id);
    const done = affected[0]!;
    await withOrgContext(ctx, (tx) => setTaskState(tx, ctx, done.id, "done"));
    const newDate = "2026-11-20";
    const prepared = await withOrgContext(ctx, (tx) =>
      buildReplanInput(tx, m.id, newDate, "da", (t, f, to) => `"${t}" flyttet fra ${f} til ${to}.`),
    );
    expect(prepared).not.toBeNull();
    const proposal = await rulesEngine.proposeReplan(prepared!.input);
    expect(proposal.taskMoves.map((t) => t.id)).not.toContain(done.id);
    await withOrgContext(ctx, (tx) =>
      applyReplan(tx, ctx, projectId, { id: m.id, newDate }, proposal, {
        snapshot: (t) => `Før "${t}"`,
        decision: (t, d) => `Replan: ${t} → ${d}`,
      }),
    );
    const after = (await getProjectFull(ctx, projectId))!;
    expect(after.milestones.find((x) => x.id === m.id)!.date).toBe(newDate);
    for (const l of later) {
      expect(after.milestones.find((x) => x.id === l.id)!.date > l.date).toBe(true);
    }
    expect(after.decisions[0]!.title).toContain("Replan");
    expect(after.snapshots[0]!.label).toContain(m.title);
  });
});

describe("snapshots", () => {
  it("restores known rows and leaves rows created since alone", async () => {
    const before = (await getProjectFull(ctx, projectId))!;
    const snapshotId = await withOrgContext(ctx, (tx) =>
      takeSnapshot(tx, ctx, projectId, "Testkopi"),
    );
    const budgetBefore = before.project.budget;
    await withOrgContext(ctx, (tx) => setBudget(tx, ctx, projectId, 123456));
    const laterTask = await withOrgContext(ctx, (tx) =>
      createTask(tx, ctx, {
        projectId,
        title: "Oprettet efter kopien",
        milestoneId: null,
        owner: "",
        startDate: "2026-12-01",
        endDate: "2026-12-02",
      }),
    );
    const victim = before.tasks[2]!;
    await withOrgContext(ctx, (tx) => deleteTask(tx, ctx, victim.id));
    await withOrgContext(ctx, (tx) => restoreSnapshotById(tx, ctx, snapshotId!));
    const after = (await getProjectFull(ctx, projectId))!;
    expect(after.project.budget).toBe(budgetBefore);
    expect(after.tasks.some((t) => t.id === victim.id)).toBe(true); // recreated
    expect(after.tasks.some((t) => t.id === laterTask)).toBe(true); // left alone
  });

  it("an undo removes exactly what the operation created", async () => {
    const snapshotId = await withOrgContext(ctx, (tx) =>
      takeSnapshot(tx, ctx, projectId, "Før AI"),
    );
    const created = await withOrgContext(ctx, (tx) =>
      createTask(tx, ctx, {
        projectId,
        title: "AI-opgave",
        milestoneId: null,
        owner: "",
        startDate: "2026-12-01",
        endDate: "2026-12-02",
      }),
    );
    await withOrgContext(ctx, (tx) =>
      restoreSnapshotById(tx, ctx, snapshotId!, { tasks: [created] }),
    );
    const after = (await getProjectFull(ctx, projectId))!;
    expect(after.tasks.some((t) => t.id === created)).toBe(false);
  });
});

describe("obstacles, decisions and money", () => {
  it("round-trips with events", async () => {
    const oId = await withOrgContext(ctx, (tx) =>
      addObstacle(tx, ctx, projectId, "Lokalet er optaget"),
    );
    await withOrgContext(ctx, (tx) => resolveObstacle(tx, ctx, oId));
    await withOrgContext(ctx, (tx) => addDecision(tx, ctx, projectId, "Lørdag", "Flest kan"));
    const eId = await withOrgContext(ctx, (tx) =>
      addExpense(tx, ctx, {
        projectId,
        title: "Depositum",
        amount: 15000,
        incurred: true,
        taskId: "not-a-task",
      }),
    );
    const mId = await withOrgContext(ctx, (tx) =>
      createMilestone(tx, ctx, { projectId, title: "Ekstra", date: "2026-12-24" }),
    );
    await withOrgContext(ctx, (tx) => setMilestoneDone(tx, ctx, mId, true));
    const full = (await getProjectFull(ctx, projectId))!;
    expect(full.obstacles.find((o) => o.id === oId)!.status).toBe("resolved");
    expect(full.decisions.some((d) => d.title === "Lørdag")).toBe(true);
    expect(full.expenses.find((e) => e.id === eId)!.taskId).toBeNull();
    expect(full.milestones.find((m) => m.id === mId)!.doneAt).not.toBeNull();
  });
});
