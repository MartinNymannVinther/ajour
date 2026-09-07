import { diffDays, formatDateDa } from "@/core/dates";
import type { StatusReport } from "../status-report";
import { INK, RAG_COLOR, type Figure, type Shape } from "./types";

export type TrackWords = { start: string; daysTo: (days: number) => string };

/** The milestones as one line, the reached part filled, the next one ringed in the assessment's colour. */
export function milestoneTrackFigure(
  report: StatusReport,
  width: number,
  words: TrackWords,
): Figure {
  const shapes: Shape[] = [];
  const left = 10;
  const right = width - 10;
  const points = [
    { title: words.start, date: null as string | null, done: true },
    ...report.milestones.map((m) => ({
      title: m.title,
      date: m.date as string | null,
      done: m.done,
    })),
  ];
  const n = points.length;
  const gap = n > 1 ? (right - left) / (n - 1) : 0;
  const nextIndex = points.findIndex((p, i) => i > 0 && !p.done);
  // Five points in a card's width leave no room for five labels in one
  // row; every other label steps down a row instead of into its neighbour.
  const stagger = gap < 64;
  const height = stagger ? 100 : 78;
  const reachedUntil = nextIndex === -1 ? n - 1 : nextIndex - 1;
  const rag = report.rag ?? "early";

  shapes.push({ kind: "line", x1: left, y1: 14, x2: right, y2: 14, stroke: INK.paper, width: 3 });
  if (reachedUntil > 0) {
    shapes.push({
      kind: "line",
      x1: left,
      y1: 14,
      x2: left + gap * reachedUntil,
      y2: 14,
      stroke: INK.primary,
      width: 3,
    });
  }
  points.forEach((p, i) => {
    const px = left + gap * i;
    if (i === 0) {
      shapes.push({ kind: "circle", cx: px, cy: 14, r: 4, fill: INK.primary });
    } else {
      const isNext = i === nextIndex;
      shapes.push({
        kind: "polygon",
        points: [
          [px, 8],
          [px + 6, 14],
          [px, 20],
          [px - 6, 14],
        ],
        fill: p.done ? INK.primary : INK.card,
        stroke: p.done ? INK.primary : isNext ? RAG_COLOR[rag].dot : INK.sand,
        strokeWidth: 2,
      });
    }
    const anchor = i === 0 ? "start" : i === n - 1 ? "end" : "middle";
    if (stagger && i % 2 === 1) {
      shapes.push({ kind: "line", x1: px, y1: 21, x2: px, y2: 44, stroke: INK.hairline, width: 1 });
    }
    // Two lines when the title needs them, cut only when two are not enough.
    const maxChars = Math.max(8, Math.floor(gap / 4.4));
    const lines = wrapTitle(
      p.title,
      stagger ? Math.max(10, Math.floor((gap * 2) / 4.4)) : maxChars,
    );
    const drop = stagger && i % 2 === 1 ? 24 : 0;
    lines.forEach((line, li) =>
      shapes.push({
        kind: "text",
        x: px,
        y: 32 + drop + li * 9.5,
        text: line,
        size: 7.5,
        fill: INK.fg,
        weight: 600,
        anchor,
      }),
    );
    if (p.date) {
      const days = diffDays(report.today, p.date);
      const dateY = 32 + drop + lines.length * 9.5 + 1;
      shapes.push({
        kind: "text",
        x: px,
        y: dateY,
        text: formatDateDa(p.date),
        size: 7.2,
        fill: i === nextIndex ? INK.fg : INK.meta,
        anchor,
      });
      // "in N days" on its own line: beside the date it collides with the
      // neighbour's date as soon as the card is narrow.
      if (i === nextIndex && days >= 0) {
        shapes.push({
          kind: "text",
          x: px,
          y: dateY + 9,
          text: words.daysTo(days),
          size: 7.2,
          fill: INK.fg,
          weight: 600,
          anchor,
        });
      }
    }
  });
  return { width, height, shapes };
}

function wrapTitle(title: string, maxChars: number): string[] {
  if (title.length <= maxChars) return [title];
  const words = title.split(" ");
  const first: string[] = [];
  while (words.length > 0 && `${first.join(" ")} ${words[0]}`.trim().length <= maxChars) {
    first.push(words.shift()!);
  }
  if (first.length === 0) first.push(words.shift()!);
  const rest = words.join(" ");
  return [
    first.join(" "),
    rest.length > maxChars ? rest.slice(0, maxChars - 1) + "…" : rest,
  ].filter(Boolean);
}
