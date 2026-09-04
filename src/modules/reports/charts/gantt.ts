import { addDaysIso, diffDays, formatDateDa, weekNumber } from "@/core/dates";
import type { PlanSlice } from "../sections";
import type { StatusReport } from "../status-report";
import { INK, type Figure, type Shape } from "./types";

/** The plan as bars in weeks; see ./types for why this is geometry only. */
export type GanttWords = {
  today: string;
  week: string;
  daysLate: (days: number) => string;
  states: Record<string, string>;
};

const LABEL_W = 170;
const HEAD_H = 16;
const MILESTONE_H = 24;
const TASK_H = 16;
const BAR_H = 12;

function stateFill(state: string, overdue: boolean): { fill: string; text: string } {
  if (state === "done") return { fill: INK.primary, text: "#ffffff" };
  if (overdue) return { fill: INK.clay, text: "#ffffff" };
  if (state === "doing") return { fill: INK.soft, text: "#ffffff" };
  return { fill: INK.paper, text: "#4a463f" };
}

export function ganttFigure(
  report: StatusReport,
  slice: PlanSlice,
  width: number,
  words: GanttWords,
): Figure {
  const gridW = width - LABEL_W;
  const dayW = gridW / (slice.weeks * 7);
  const x = (iso: string) =>
    LABEL_W + Math.max(0, Math.min(gridW, diffDays(slice.from, iso) * dayW));
  const shapes: Shape[] = [];

  let height = HEAD_H;
  for (const row of slice.rows) height += row.kind === "milestone" ? MILESTONE_H : TASK_H;
  height += 4;

  // Week columns.
  for (let w = 0; w < slice.weeks; w++) {
    const monday = addDaysIso(slice.from, w * 7);
    const gx = LABEL_W + w * 7 * dayW;
    shapes.push({
      kind: "line",
      x1: gx,
      y1: HEAD_H - 2,
      x2: gx,
      y2: height,
      stroke: INK.hairline,
      width: 1,
    });
    shapes.push({
      kind: "text",
      x: gx + 3,
      y: 10,
      text: w === 0 ? `${words.week} ${weekNumber(monday)}` : String(weekNumber(monday)),
      size: 8,
      fill: INK.label,
      weight: 600,
    });
  }
  shapes.push({
    kind: "line",
    x1: width,
    y1: HEAD_H - 2,
    x2: width,
    y2: height,
    stroke: INK.hairline,
    width: 1,
  });

  // Rows.
  let y = HEAD_H;
  for (const row of slice.rows) {
    if (row.kind === "milestone") {
      const m = row.milestone;
      shapes.push({
        kind: "text",
        x: 0,
        y: y + 10,
        text: m.title,
        size: 9,
        fill: INK.fg,
        weight: 600,
      });
      shapes.push({
        kind: "text",
        x: 0,
        y: y + 20,
        text: [formatDateDa(m.date), m.ownerName].filter(Boolean).join(" · "),
        size: 7.5,
        fill: INK.meta,
      });
      const mx = x(m.date);
      const my = y + 12;
      shapes.push({
        kind: "polygon",
        points: [
          [mx, my - 7],
          [mx + 7, my],
          [mx, my + 7],
          [mx - 7, my],
        ],
        fill: m.done ? INK.primary : INK.card,
        stroke: INK.ink,
        strokeWidth: 1.5,
      });
      y += MILESTONE_H;
      continue;
    }
    const t = row.task;
    const overdue = t.state !== "done" && t.end < report.today;
    const { fill, text } = stateFill(t.state, overdue);
    const bx = x(t.start);
    const bw = Math.max(dayW * 2, x(addDaysIso(t.end, 1)) - bx);
    shapes.push({ kind: "rect", x: bx, y: y + 2, w: bw, h: BAR_H, rx: 3, fill });
    const label = [t.title, t.owner + (t.participants > 0 ? ` +${t.participants}` : "")]
      .filter(Boolean)
      .join(" · ");
    const lateText = overdue ? words.daysLate(diffDays(t.end, report.today)) : "";
    // Roughly 4.3 units per character at 7.5pt: enough to know whether the
    // label fits inside the bar, after it, or has to go before it because
    // the bar ends at the right edge of the picture.
    const charW = 4.3;
    const fits = label.length * charW < bw - 8;
    const afterW = (label.length + (lateText ? lateText.length + 2 : 0)) * charW + 8;
    const roomAfter = width - (bx + bw) >= afterW;
    if (fits) {
      shapes.push({ kind: "text", x: bx + 5, y: y + 11, text: label, size: 7.5, fill: text });
      if (lateText)
        shapes.push({
          kind: "text",
          x: bx + bw + 4,
          y: y + 11,
          text: lateText,
          size: 7.5,
          fill: INK.warn,
          weight: 600,
        });
    } else if (roomAfter || bx - LABEL_W < afterW) {
      const shown = roomAfter
        ? label
        : label.slice(0, Math.max(8, Math.floor((width - bx - bw - 8) / charW) - 1)) + "…";
      shapes.push({
        kind: "text",
        x: bx + bw + 4,
        y: y + 11,
        text: shown,
        size: 7.5,
        fill: INK.meta,
      });
      if (lateText)
        shapes.push({
          kind: "text",
          x: bx + bw + 4 + shown.length * charW + 6,
          y: y + 11,
          text: lateText,
          size: 7.5,
          fill: INK.warn,
          weight: 600,
        });
    } else {
      // Before the bar, ending where the bar starts.
      shapes.push({
        kind: "text",
        x: bx - 4,
        y: y + 11,
        text: lateText ? `${label} · ${lateText}` : label,
        size: 7.5,
        fill: lateText ? INK.warn : INK.meta,
        anchor: "end",
      });
    }
    y += TASK_H;
  }

  // Today, drawn last so it sits on top.
  if (report.today >= slice.from && report.today < slice.to) {
    const tx = x(report.today);
    shapes.push({
      kind: "line",
      x1: tx,
      y1: HEAD_H - 2,
      x2: tx,
      y2: height,
      stroke: INK.warn,
      width: 1.2,
      dash: "3 2",
    });
    shapes.push({ kind: "rect", x: tx - 15, y: HEAD_H - 2, w: 30, h: 11, rx: 2, fill: INK.warn });
    shapes.push({
      kind: "text",
      x: tx,
      y: HEAD_H + 6.5,
      text: words.today,
      size: 7.5,
      fill: "#ffffff",
      weight: 600,
      anchor: "middle",
    });
  }

  return { width, height, shapes };
}
