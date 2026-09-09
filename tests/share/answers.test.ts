import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { withOrgContext } from "@/core/db/tenant";
import { createProjectFromProposal } from "@/modules/projects/plan";
import { getProjectFull } from "@/modules/projects/read";
import { updateTaskPeople } from "@/modules/projects/write-tasks";
import { approveStatus, plainAuthored } from "@/modules/reports/status-report";
import { buildTemplate, PROJECT_TEMPLATES } from "@/modules/projects/templates";
import {
  addOwnTaskNoteViaShare,
  answerQuestionViaShare,
  identifyViaShare,
  setOwnTaskStateViaShare,
} from "@/modules/share/answers";
import { createShareLink, readSharedProject, revokeShareLink } from "@/modules/share/service";
import { adminPool } from "../helpers/db";
import { seedWorkspace } from "../helpers/workspace";

/**
 * The share link as an answer channel. Three claims: a holder can speak
 * only as someone on the project's tasks and only about their own tasks;
 * a read-only link lets nobody write; and what is said lands in the
 * project as replies and events the next status is written from.
 */

let admin: Pool;
let ctx: { orgId: string; userId: string };
let projectId: string;
let mettesTask: string;
let jonasTask: string;
let mette: string;
let jonas: string;
let statusId: string;

beforeAll(async () => {
  admin = adminPool();
  ctx = await seedWorkspace(admin, "answers");
  projectId = await createProjectFromProposal(
    ctx,
    buildTemplate(PROJECT_TEMPLATES[2]!, "2026-09-01", "da"),
    "",
    "event",
  );
  let full = (await getProjectFull(ctx, projectId))!;
  mettesTask = full.tasks[0]!.id;
  jonasTask = full.tasks[1]!.id;
  await withOrgContext(ctx, async (tx) => {
    await updateTaskPeople(tx, ctx, {
      taskId: mettesTask,
      owner: "Mette",
      participants: ["Sofie"],
    });
    await updateTaskPeople(tx, ctx, { taskId: jonasTask, owner: "Jonas", participants: [] });
  });
  full = (await getProjectFull(ctx, projectId))!;
  mette = full.people.find((p) => p.name === "Mette")!.id;
  jonas = full.people.find((p) => p.name === "Jonas")!.id;
  statusId = await withOrgContext(ctx, (tx) =>
    approveStatus(
      tx,
      ctx,
      full,
      plainAuthored("Vi er i gang.", "rules"),
      { sinceLast: [], approvedByName: "Test" },
      ["Mette, holder datoen for lokalet?", "Jonas, er programmet på plads?"],
    ),
  );
});

afterAll(async () => {
  await admin?.end();
});

describe("a link that may answer", () => {
  it("shows who is on which task and what the status asked; a read-only link does not", async () => {
    const answering = await createShareLink(ctx, projectId, "Til holdet", null, true);
    const shared = (await readSharedProject(answering!.token, "2026-09-03"))!;
    expect(shared.canAnswer).toBe(true);
    expect(shared.people.map((p) => p.name).sort()).toEqual(["Jonas", "Mette", "Sofie"]);
    expect(shared.tasks.find((t) => t.id === mettesTask)!.personIds).toContain(mette);
    expect(shared.statuses[0]!.questions).toHaveLength(2);

    const readOnly = await createShareLink(ctx, projectId, "Til styregruppen", null);
    const quiet = (await readSharedProject(readOnly!.token, "2026-09-03"))!;
    expect(quiet.canAnswer).toBe(false);
    expect(quiet.people).toEqual([]);
    expect(quiet.tasks.every((t) => t.personIds.length === 0)).toBe(true);
    expect(quiet.statuses[0]!.questions).toEqual([]);
  });

  it("lets a person mark and annotate their own task, and nobody else's", async () => {
    const link = (await createShareLink(ctx, projectId, "Holdet", null, true))!;
    expect(await identifyViaShare(link.token, mette)).toEqual({
      ok: true,
      data: { name: "Mette" },
    });

    expect(await setOwnTaskStateViaShare(link.token, mette, mettesTask, "doing")).toEqual({
      ok: true,
      data: undefined,
    });
    expect(await setOwnTaskStateViaShare(link.token, mette, jonasTask, "done")).toEqual({
      ok: false,
      error: "notYourTask",
    });
    expect(await setOwnTaskStateViaShare(link.token, mette, mettesTask, "kaput")).toEqual({
      ok: false,
      error: "invalid",
    });

    const note = await addOwnTaskNoteViaShare(
      link.token,
      mette,
      mettesTask,
      "Lokalet er bekræftet.",
    );
    expect(note.ok).toBe(true);
    expect(await addOwnTaskNoteViaShare(link.token, mette, jonasTask, "Snyd")).toEqual({
      ok: false,
      error: "notYourTask",
    });

    const full = (await getProjectFull(ctx, projectId))!;
    expect(full.tasks.find((t) => t.id === mettesTask)!.state).toBe("doing");
    const kinds = full.events.map((e) => `${e.type}:${e.actorKind}`);
    expect(kinds).toContain("reply.state:participant");
    expect(kinds).toContain("reply.note:participant");
    const shared = (await readSharedProject(link.token, "2026-09-03"))!;
    expect(shared.replies.find((r) => r.kind === "note")?.personName).toBe("Mette");
  });

  it("takes an answer to a question the approved status asked, and only those", async () => {
    const link = (await createShareLink(ctx, projectId, "Holdet", null, true))!;
    const ok = await answerQuestionViaShare(
      link.token,
      jonas,
      statusId,
      1,
      "Ja, programmet er klar.",
    );
    expect(ok.ok).toBe(true);
    expect(
      await answerQuestionViaShare(link.token, jonas, statusId, 7, "Hvilket spørgsmål?"),
    ).toEqual({ ok: false, error: "noSuchQuestion" });
    expect(await answerQuestionViaShare(link.token, jonas, statusId, 0, "")).toEqual({
      ok: false,
      error: "invalid",
    });
    const shared = (await readSharedProject(link.token, "2026-09-03"))!;
    const answer = shared.replies.find((r) => r.kind === "answer")!;
    expect(answer.personName).toBe("Jonas");
    expect(answer.question).toBe("Jonas, er programmet på plads?");
  });

  it("refuses a name that is not on the project's tasks", async () => {
    const link = (await createShareLink(ctx, projectId, "Holdet", null, true))!;
    const stranger = await admin.query<{ id: string }>(
      `insert into people (org_id, name) values ($1, 'Ukendt') returning id`,
      [ctx.orgId],
    );
    expect(await identifyViaShare(link.token, stranger.rows[0]!.id)).toEqual({
      ok: false,
      error: "unknownPerson",
    });
    expect(await setOwnTaskStateViaShare(link.token, "no-such-person", mettesTask, "done")).toEqual(
      { ok: false, error: "unknownPerson" },
    );
  });

  it("refuses every write on a read-only, revoked or unknown link", async () => {
    const readOnly = (await createShareLink(ctx, projectId, "Læs", null))!;
    expect(await setOwnTaskStateViaShare(readOnly.token, mette, mettesTask, "done")).toEqual({
      ok: false,
      error: "readOnly",
    });
    const revoked = (await createShareLink(ctx, projectId, "Trukket", null, true))!;
    await revokeShareLink(ctx, revoked.id);
    expect(await addOwnTaskNoteViaShare(revoked.token, mette, mettesTask, "Hej")).toEqual({
      ok: false,
      error: "noLink",
    });
    expect(
      await answerQuestionViaShare("aldrig-udstedt-token-1234", mette, statusId, 0, "x"),
    ).toEqual({ ok: false, error: "noLink" });
  });

  it("cannot reach a task in another workspace, even with a valid link", async () => {
    const other = await seedWorkspace(admin, "answers2");
    const otherProject = await createProjectFromProposal(
      other,
      buildTemplate(PROJECT_TEMPLATES[2]!, "2026-09-01", "da"),
      "",
      "event",
    );
    const otherTask = (await getProjectFull(other, otherProject))!.tasks[0]!.id;
    await withOrgContext(other, (tx) =>
      updateTaskPeople(tx, other, { taskId: otherTask, owner: "Mette", participants: [] }),
    );
    const link = (await createShareLink(ctx, projectId, "Holdet", null, true))!;
    // Same name, other workspace: a different person, and a task the link cannot see.
    expect(await setOwnTaskStateViaShare(link.token, mette, otherTask, "done")).toEqual({
      ok: false,
      error: "notYourTask",
    });
    const untouched = (await getProjectFull(other, otherProject))!.tasks.find(
      (t) => t.id === otherTask,
    )!;
    expect(untouched.state).toBe("todo");
  });
});
