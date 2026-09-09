import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { withOrgContext } from "@/core/db/tenant";
import { clearOutbox, outboxMails, sendMail } from "@/core/mail";
import { createProjectFromProposal } from "@/modules/projects/plan";
import { getProjectFull } from "@/modules/projects/read";
import { buildTemplate, PROJECT_TEMPLATES } from "@/modules/projects/templates";
import { updateTaskPeople } from "@/modules/projects/write-tasks";
import { cleanRecipients, mailApprovedStatus, setStatusRecipients } from "@/modules/reports/mail";
import { schedulerAllowed, sendStatusReminders } from "@/modules/reports/reminder";
import { approveStatus, plainAuthored } from "@/modules/reports/status-report";
import { reportWords } from "@/modules/reports/words";
import { adminPool } from "../helpers/db";
import { seedWorkspace } from "../helpers/workspace";

/**
 * Mail out of the house, proven against the memory transport: the
 * approved status reaches exactly the recipients on the project with the
 * PDF attached; the reminder names the projects without a status this
 * week, once, and only when mail is set up.
 */

const words = {
  mail: {
    subject: (project: string, week: string) => `${project}: ${week}`,
    intro: (project: string, week: string, by: string) => `${week} for ${project}, af ${by}.`,
    comment: "Kommentar:",
    openLink: "Åbn",
    sentBy: "Sendt fra Ajour.",
  },
  report: reportWords(
    ((key: string) => key) as never,
    (key) => `Uge ${key.slice(-2)}`,
    { todo: "Ikke startet", doing: "I gang", done: "Færdig" },
    (n) => `${n} kr.`,
  ),
};

let admin: Pool;
let ctx: { orgId: string; userId: string };
let projectId: string;

beforeAll(async () => {
  admin = adminPool();
  ctx = await seedWorkspace(admin, "mail");
  projectId = await createProjectFromProposal(
    ctx,
    buildTemplate(PROJECT_TEMPLATES[2]!, "2026-08-01", "da"),
    "",
    "event",
  );
  const full = (await getProjectFull(ctx, projectId))!;
  await withOrgContext(ctx, (tx) =>
    updateTaskPeople(tx, ctx, { taskId: full.tasks[0]!.id, owner: "Mette", participants: [] }),
  );
});

beforeEach(() => clearOutbox());

afterAll(async () => {
  await admin?.end();
});

describe("cleanRecipients", () => {
  it("keeps valid, unique, lower-cased addresses and drops the rest", () => {
    expect(
      cleanRecipients([
        { name: "Lise", email: "Lise@Example.dk" },
        { email: "lise@example.dk" },
        { email: "ikke en adresse" },
        { name: 42, email: "jonas@example.dk" },
      ]),
    ).toEqual([
      { name: "Lise", email: "lise@example.dk" },
      { name: "", email: "jonas@example.dk" },
    ]);
  });
});

describe("the approved status by mail", () => {
  it("goes to the project's recipients with the PDF attached, and is recorded", async () => {
    await withOrgContext(ctx, (tx) =>
      setStatusRecipients(tx, projectId, [
        { name: "Lise", email: "lise@example.dk" },
        { name: "", email: "bestyrelsen@example.dk" },
      ]),
    );
    const full = (await getProjectFull(ctx, projectId))!;
    const statusId = await withOrgContext(ctx, (tx) =>
      approveStatus(
        tx,
        ctx,
        full,
        plainAuthored("Alt går efter planen.", "rules"),
        { sinceLast: [], approvedByName: "Mette" },
        [],
      ),
    );
    const outcome = await withOrgContext(ctx, (tx) =>
      mailApprovedStatus(tx, ctx, projectId, statusId, words, "da"),
    );
    expect(outcome).toEqual({ sent: true, count: 2 });
    const [mail] = outboxMails();
    expect(mail!.to).toEqual(["lise@example.dk", "bestyrelsen@example.dk"]);
    expect(mail!.subject).toContain("Arrangement");
    expect(mail!.text).toContain("Alt går efter planen.");
    expect(mail!.attachments?.[0]?.contentType).toBe("application/pdf");
    expect(mail!.attachments?.[0]?.content.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    const events = (await getProjectFull(ctx, projectId))!.events.map((e) => e.type);
    expect(events).toContain("status.sent");
  });

  it("sends nothing without recipients, and says so", async () => {
    await withOrgContext(ctx, (tx) => setStatusRecipients(tx, projectId, []));
    const full = (await getProjectFull(ctx, projectId))!;
    const statusId = full.statusUpdates.find((s) => s.approvedAt)!.id;
    const outcome = await withOrgContext(ctx, (tx) =>
      mailApprovedStatus(tx, ctx, projectId, statusId, words, "da"),
    );
    expect(outcome).toEqual({ sent: false, reason: "noRecipients" });
    expect(outboxMails()).toHaveLength(0);
  });

  it("does not reach a status in another workspace", async () => {
    const other = await seedWorkspace(admin, "mail2");
    const full = (await getProjectFull(ctx, projectId))!;
    const statusId = full.statusUpdates.find((s) => s.approvedAt)!.id;
    const outcome = await withOrgContext(other, (tx) =>
      mailApprovedStatus(tx, other, projectId, statusId, words, "da"),
    );
    expect(outcome).toEqual({ sent: false, reason: "notFound" });
  });
});

describe("the weekly reminder", () => {
  it("names the projects without a status this week, once", async () => {
    // The status above was approved "now"; a later week has none.
    const first = await sendStatusReminders("2026-12-10", "da");
    const mine = outboxMails().filter((m) => m.to.includes("mail@example.com"));
    expect(mine).toHaveLength(1);
    expect(mine[0]!.text).toContain("Arrangement");
    expect(mine[0]!.text).toContain(`/projects/${projectId}/status`);
    expect(first.projects).toBeGreaterThanOrEqual(1);

    clearOutbox();
    await sendStatusReminders("2026-12-11", "da");
    expect(outboxMails().filter((m) => m.to.includes("mail@example.com"))).toHaveLength(0);
  });

  it("guards the endpoint with the secret and nothing else", () => {
    expect(schedulerAllowed("Bearer test-cron-secret-with-length")).toBe(true);
    expect(schedulerAllowed("Bearer wrong")).toBe(false);
    expect(schedulerAllowed(null)).toBe(false);
  });
});

describe("sendMail", () => {
  it("refuses an empty or invalid recipient list before touching a transport", async () => {
    expect(await sendMail({ to: ["ikke en adresse"], subject: "x", text: "y" })).toEqual({
      sent: false,
      reason: "noRecipients",
    });
  });
});
