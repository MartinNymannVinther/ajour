import type { Rag } from "../status-report";

/**
 * The report's figures as plain geometry: rectangles, lines, text and
 * points in a coordinate space, with nothing about how they are drawn.
 * The browser preview draws them as SVG and the PDF draws them with
 * react-pdf's SVG primitives, from the same list, so the two can never
 * disagree about where a bar ends. One source, two pens.
 */

export type Shape =
  | { kind: "rect"; x: number; y: number; w: number; h: number; rx: number; fill: string }
  | {
      kind: "line";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      stroke: string;
      width: number;
      dash?: string;
    }
  | {
      kind: "text";
      x: number;
      y: number;
      text: string;
      size: number;
      fill: string;
      weight?: 400 | 600;
      anchor?: "start" | "middle" | "end";
    }
  | {
      kind: "polygon";
      points: Array<[number, number]>;
      fill: string;
      stroke?: string;
      strokeWidth?: number;
    }
  | {
      kind: "circle";
      cx: number;
      cy: number;
      r: number;
      fill: string;
      stroke?: string;
      strokeWidth?: number;
    };

export type Figure = { width: number; height: number; shapes: Shape[] };

/** The Haij 2a palette, as the print colours the theme comments name. */
export const INK = {
  fg: "#24221e",
  meta: "#65635e",
  label: "#6e6b67",
  hairline: "#eae5dc",
  card: "#fffdfa",
  primary: "#4a6b53",
  ink: "#31513c",
  soft: "#7a9a80",
  sand: "#c9c2b6",
  clay: "#c08a63",
  paper: "#e0dbd1",
  warn: "#8c5b3e",
  accent: "#e4ebe4",
  yellow: "#c9a24a",
  yellowTint: "#f7efdc",
  redTint: "#f6e8e0",
  greenTint: "#e4ebe4",
  earlyTint: "#f0ece5",
};

export const RAG_COLOR: Record<Rag, { dot: string; tint: string; edge: string }> = {
  green: { dot: INK.primary, tint: INK.greenTint, edge: "#c9d8cc" },
  yellow: { dot: INK.yellow, tint: INK.yellowTint, edge: "#e6d4a3" },
  red: { dot: INK.warn, tint: INK.redTint, edge: "#e2c4b2" },
  early: { dot: INK.sand, tint: INK.earlyTint, edge: INK.hairline },
};
