import { describe, expect, it } from "vitest";
import { frontPlan, fullPlan, reportSections } from "@/modules/reports/sections";
import { ganttFigure, economyFigure, milestoneTrackFigure } from "@/modules/reports/charts";
import { parseStatusReport } from "@/modules/reports/status-report";
import { renderStatusPdf } from "@/modules/reports/status-pdf";
import { reportWords } from "@/modules/reports/words";
import { fullReport } from "./fixture";

const words = reportWords(
  (key, values) => `${key}${values ? ":" + Object.values(values).join(",") : ""}`,
  (key) => `uge ${key.slice(-2)}`,
  { todo: "Ikke startet", doing: "I gang", done: "Færdig" },
  (n) => `${n} kr.`,
);

describe("the editor", () => {
  it("puts only the next two milestones and their moving tasks on the front", () => {
    const plan = frontPlan(fullReport());
    const milestones = plan.rows.filter((r) => r.kind === "milestone");
    const tasks = plan.rows.filter((r) => r.kind === "task");
    expect(milestones).toHaveLength(2);
    expect(tasks.every((r) => r.kind === "task" && r.task.state !== "done")).toBe(true);
    expect(plan.omitted).toBeGreaterThan(0);
  });

  it("keeps every task in the appendix", () => {
    const plan = fullPlan(fullReport());
    expect(plan.rows.filter((r) => r.kind === "task")).toHaveLength(9);
  });

  it("drops sections that have nothing in them", () => {
    const empty = {
      ...fullReport(),
      obstacles: [],
      decisions: [],
      managerComment: "",
      economy: null,
    };
    const s = reportSections(empty);
    expect(s.obstacles).toBe(false);
    expect(s.decisions).toBe(false);
    expect(s.comment).toBe(false);
    expect(s.economy).toBe(false);
    expect(reportSections(fullReport()).asks).toBe(true);
  });
});

describe("the figures", () => {
  it("draw the plan with a today line and a late label", () => {
    const report = fullReport();
    const figure = ganttFigure(report, frontPlan(report), 700, words.gantt);
    const texts = figure.shapes
      .filter((s) => s.kind === "text")
      .map((s) => (s as { text: string }).text);
    expect(texts).toContain("chart.today");
    expect(texts.some((t) => t.startsWith("chart.daysLate"))).toBe(true);
    expect(figure.shapes.some((s) => s.kind === "polygon")).toBe(true);
  });

  it("draw money ahead of work as a warning", () => {
    const figure = economyFigure(fullReport(), 320, words.economyChart);
    const texts = figure.shapes
      .filter((s) => s.kind === "text")
      .map((s) => (s as { text: string }).text);
    expect(texts.some((t) => t.startsWith("chart.ahead:31"))).toBe(true);
  });

  it("keep milestone labels off each other when the dates crowd", () => {
    const crowded = {
      ...fullReport(),
      milestones: [
        "Struktur for opgavehåndtering og leverancer etableret",
        "Team Charter færdiggjort",
        "Roadmap udarbejdet",
        "Backlog ryddet og prioriteret",
        "Opgavehåndteringsprincipper vedtaget",
        "Første retrospektiv",
      ].map((title, i) => ({
        title,
        date: `2026-10-0${i + 1}`,
        done: false,
        ownerName: "",
        criterion: "",
      })),
    };
    for (const width of [200, 320, 520]) {
      const figure = milestoneTrackFigure(crowded, width, words.track);
      const boxes = figure.shapes
        .filter((s) => s.kind === "text")
        .map((s) => {
          const t = s as { x: number; y: number; text: string; size: number; anchor?: string };
          const w = t.text.length * t.size * 0.56;
          const x0 = t.anchor === "end" ? t.x - w : t.anchor === "middle" ? t.x - w / 2 : t.x;
          return { x0, x1: x0 + w, y0: t.y - t.size, y1: t.y, text: t.text };
        });
      for (const a of boxes)
        for (const b of boxes) {
          if (a === b) continue;
          const apart = a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0;
          expect(apart, `${a.text} / ${b.text} at ${width}`).toBe(true);
          expect(a.x0).toBeGreaterThanOrEqual(0);
          expect(a.x1).toBeLessThanOrEqual(width);
        }
      expect(figure.height).toBeGreaterThan(boxes.reduce((m, b) => Math.max(m, b.y1), 0));
    }
  });

  it("ring the next milestone in the assessment's colour", () => {
    const figure = milestoneTrackFigure(fullReport(), 320, words.track);
    const polys = figure.shapes.filter((s) => s.kind === "polygon") as Array<{ stroke?: string }>;
    expect(polys[0]!.stroke).toBe("#c9a24a");
  });
});

describe("the PDF", () => {
  it("renders two pages in Archivo with no figure split across a page", async () => {
    const buffer = await renderStatusPdf(fullReport(), words);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    const text = buffer.toString("latin1");
    expect((text.match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBe(2);
    expect(text).toContain("Archivo");
  }, 30_000);

  it("renders a version 1 report upgraded on the fly", async () => {
    const v1 = {
      version: 1,
      today: "2026-09-03",
      weekKey: "2026-W36",
      projectName: "Gammelt",
      goal: "",
      ownerName: "",
      managerName: "",
      text: "Alt går efter planen.",
      economy: null,
      milestones: [{ title: "M", date: "2026-10-01", done: false, ownerName: "", criterion: "" }],
      tasks: [
        {
          title: "T",
          start: "2026-09-01",
          end: "2026-09-05",
          state: "doing",
          owner: "",
          milestoneIndex: 0,
        },
      ],
      obstacles: [],
      decisions: [],
      decisionsSince: null,
    };
    const report = parseStatusReport(v1)!;
    expect(report.version).toBe(2);
    expect(report.rag).toBeNull();
    const buffer = await renderStatusPdf(report, words);
    expect(buffer.length).toBeGreaterThan(1000);
  }, 30_000);

  it("grows to a third page for a long plan rather than cutting a figure", async () => {
    const report = fullReport();
    const many = Array.from({ length: 40 }, (_, i) => ({
      title: `Opgave ${i + 1}`,
      start: "2026-09-01",
      end: "2026-09-10",
      state: "todo",
      owner: "N",
      participants: 0,
      milestoneIndex: 2,
    }));
    const buffer = await renderStatusPdf({ ...report, tasks: [...report.tasks, ...many] }, words);
    const text = buffer.toString("latin1");
    expect((text.match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBeGreaterThanOrEqual(3);
  }, 30_000);
});
