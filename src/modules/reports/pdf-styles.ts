import path from "node:path";
import { Font, StyleSheet } from "@react-pdf/renderer";
import { INK } from "./charts";

/**
 * The PDF's type and spacing. Archivo, the family's face, is registered
 * from public/fonts so the document is set in the same letters as the
 * screen; the files ship in the image next to the rest of public/.
 */
let registered = false;
export function ensureFonts() {
  if (registered) return;
  registered = true;
  const dir = path.join(process.cwd(), "public", "fonts");
  Font.register({
    family: "Archivo",
    fonts: [
      { src: path.join(dir, "Archivo-Regular.ttf"), fontWeight: 400 },
      { src: path.join(dir, "Archivo-SemiBold.ttf"), fontWeight: 600 },
    ],
  });
  // Archivo has no need for hyphenation in short labels, and react-pdf's
  // default hyphenator would split Danish words in the wrong places.
  Font.registerHyphenationCallback((word) => [word]);
}

export const PAGE_W = 595.28;
export const MARGIN = 40;
export const CONTENT_W = PAGE_W - MARGIN * 2;
export const GAP = 14;
export const LEFT_W = Math.round((CONTENT_W - GAP) * 0.57);
export const RIGHT_W = CONTENT_W - GAP - LEFT_W;

export const styles = StyleSheet.create({
  page: {
    paddingTop: MARGIN,
    paddingHorizontal: MARGIN,
    paddingBottom: MARGIN + 14,
    fontFamily: "Archivo",
    fontSize: 9,
    color: INK.fg,
    backgroundColor: "#f7f5f1",
  },
  eyebrow: {
    fontSize: 7,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: INK.label,
    fontWeight: 600,
  },
  title: { fontSize: 18, fontWeight: 600, marginTop: 2, marginBottom: 2 },
  titleSmall: { fontSize: 14, fontWeight: 600, marginTop: 2, marginBottom: 2 },
  meta: { fontSize: 8, color: INK.meta, lineHeight: 1.35 },
  h2: {
    fontSize: 7,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: INK.label,
    fontWeight: 600,
    marginBottom: 4,
  },
  body: { fontSize: 9, lineHeight: 1.45 },
  small: { fontSize: 8, lineHeight: 1.4 },
  card: {
    backgroundColor: "#fffdfa",
    borderWidth: 0.75,
    borderColor: INK.hairline,
    borderRadius: 8,
    padding: 9,
  },
  row: { flexDirection: "row" },
  columns: { flexDirection: "row", gap: GAP, marginTop: 12 },
  left: { width: LEFT_W },
  right: { width: RIGHT_W },
  section: { marginTop: 10 },
  rag: { borderWidth: 0.75, borderRadius: 8, padding: 9, width: 190 },
  ragWord: { fontSize: 11, fontWeight: 600 },
  ragReason: { fontSize: 8, lineHeight: 1.35, marginTop: 3 },
  ragMeta: { fontSize: 7, color: INK.meta, marginTop: 3 },
  dot: { width: 11, height: 11, borderRadius: 6, marginRight: 6 },
  trendDot: { width: 6.5, height: 6.5, borderRadius: 4, marginRight: 3 },
  bullet: { flexDirection: "row", marginBottom: 2 },
  bulletMark: { width: 8, color: INK.primary, fontWeight: 600 },
  askNumber: {
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: INK.ink,
    color: "#ffffff",
    fontSize: 7,
    fontWeight: 600,
    textAlign: "center",
    paddingTop: 2.5,
    marginRight: 6,
  },
  pill: {
    fontSize: 6.5,
    fontWeight: 600,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    marginLeft: 4,
  },
  quote: { borderLeftWidth: 2.5, borderLeftColor: INK.primary, paddingLeft: 7 },
  legend: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
    fontSize: 7,
    color: INK.meta,
    alignItems: "center",
  },
  legendSwatch: { width: 8, height: 6, borderRadius: 1, marginRight: 3 },
  th: {
    fontSize: 6.5,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: INK.label,
    fontWeight: 600,
    paddingBottom: 3,
    borderBottomWidth: 0.75,
    borderBottomColor: INK.hairline,
  },
  td: { fontSize: 8, paddingVertical: 3.5, borderBottomWidth: 0.5, borderBottomColor: "#f0ece5" },
  tdMilestone: {
    fontSize: 8,
    fontWeight: 600,
    color: INK.ink,
    backgroundColor: INK.accent,
    paddingVertical: 3.5,
    paddingHorizontal: 5,
    borderRadius: 3,
    marginTop: 3,
  },
  footer: {
    position: "absolute",
    bottom: 22,
    left: MARGIN,
    right: MARGIN,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: INK.label,
    borderTopWidth: 0.5,
    borderTopColor: INK.hairline,
    paddingTop: 5,
  },
});
