import type { ReactNode } from "react";

/**
 * Ten small vignettes in the tool's own language of lines: calm strokes,
 * the family's moss green as the accent, everything else a grey. They are
 * decoration, so they are hidden from screen readers and the text next to
 * them carries the whole meaning.
 */

const ACCENT = "var(--primary)";
const LINE = "var(--label)";
const SOFT = "var(--muted)";
const WARN = "var(--destructive)";
const GOOD = "var(--success)";

export const ABC_FIGURES: ReactNode[] = [
  <g key="goal" fill="none" strokeLinecap="round">
    <path d="M8 72 C 36 68, 60 52, 100 24" stroke={LINE} strokeWidth="2.5" strokeDasharray="1 7" />
    <line x1="100" y1="24" x2="100" y2="58" stroke={ACCENT} strokeWidth="3" />
    <path d="M100 24 L 100 40 L 78 32 Z" fill={ACCENT} stroke="none" />
    <ellipse cx="100" cy="62" rx="10" ry="3.5" fill={SOFT} stroke="none" />
  </g>,
  <g key="owner" fill="none">
    <circle cx="60" cy="26" r="11" fill={ACCENT} stroke="none" />
    <path d="M42 68 C 42 50, 78 50, 78 68 Z" fill={ACCENT} stroke="none" />
    <circle cx="24" cy="32" r="8" stroke={LINE} strokeWidth="2.5" />
    <path d="M12 64 C 12 50, 36 50, 36 64" stroke={LINE} strokeWidth="2.5" />
    <circle cx="96" cy="32" r="8" stroke={LINE} strokeWidth="2.5" />
    <path d="M84 64 C 84 50, 108 50, 108 64" stroke={LINE} strokeWidth="2.5" />
  </g>,
  <g key="pieces" fill="none" strokeLinecap="round">
    <rect x="10" y="14" width="100" height="12" rx="6" fill={SOFT} stroke="none" />
    <line x1="52" y1="10" x2="68" y2="30" stroke={WARN} strokeWidth="2.5" />
    <rect x="10" y="46" width="26" height="12" rx="6" fill={ACCENT} stroke="none" />
    <rect x="42" y="46" width="26" height="12" rx="6" fill={ACCENT} stroke="none" />
    <rect x="74" y="46" width="26" height="12" rx="6" fill={ACCENT} stroke="none" />
  </g>,
  <g key="milestone" fill="none" strokeLinecap="round">
    <line x1="10" y1="52" x2="110" y2="52" stroke={LINE} strokeWidth="2" />
    <rect
      x="34"
      y="44"
      width="14"
      height="14"
      rx="2"
      transform="rotate(45 41 51)"
      fill={ACCENT}
      stroke="none"
    />
    <rect
      x="76"
      y="44"
      width="14"
      height="14"
      rx="2"
      transform="rotate(45 83 51)"
      fill={ACCENT}
      stroke="none"
    />
    <line x1="41" y1="20" x2="41" y2="40" stroke={LINE} strokeWidth="2" strokeDasharray="3 4" />
    <line x1="83" y1="20" x2="83" y2="40" stroke={LINE} strokeWidth="2" strokeDasharray="3 4" />
  </g>,
  <g key="truth" fill="none" strokeLinecap="round">
    <path d="M10 60 L 46 60 L 70 34 L 110 34" stroke={ACCENT} strokeWidth="3" />
    <path d="M10 40 L 110 40" stroke={LINE} strokeWidth="2" strokeDasharray="4 5" />
    <circle cx="70" cy="34" r="4" fill={ACCENT} stroke="none" />
  </g>,
  <g key="questions" fill="none" strokeLinecap="round">
    <circle cx="26" cy="42" r="13" stroke={LINE} strokeWidth="2.5" />
    <circle cx="60" cy="42" r="13" stroke={ACCENT} strokeWidth="2.5" />
    <circle cx="94" cy="42" r="13" stroke={LINE} strokeWidth="2.5" />
  </g>,
  <g key="obstacle" fill="none" strokeLinecap="round">
    <line x1="10" y1="58" x2="110" y2="58" stroke={LINE} strokeWidth="2" />
    <path d="M60 20 L 76 52 L 44 52 Z" fill={WARN} stroke="none" opacity="0.85" />
    <line x1="60" y1="32" x2="60" y2="42" stroke="var(--card)" strokeWidth="2.5" />
  </g>,
  <g key="decision" fill="none" strokeLinecap="round">
    <path d="M60 66 L 60 44" stroke={LINE} strokeWidth="2.5" />
    <path d="M60 44 L 30 22" stroke={ACCENT} strokeWidth="3" />
    <path d="M60 44 L 90 22" stroke={LINE} strokeWidth="2" strokeDasharray="4 4" />
    <circle cx="30" cy="20" r="5" fill={ACCENT} stroke="none" />
  </g>,
  <g key="money" fill="none" strokeLinecap="round">
    <rect x="12" y="52" width="54" height="10" rx="5" fill={ACCENT} stroke="none" />
    <rect x="20" y="24" width="22" height="14" rx="4" fill={ACCENT} stroke="none" />
    <rect
      x="50"
      y="24"
      width="22"
      height="14"
      rx="4"
      stroke={LINE}
      strokeWidth="2"
      strokeDasharray="4 3"
    />
    <text x="86" y="36" fontSize="15" fill={LINE} fontFamily="sans-serif">
      kr.
    </text>
  </g>,
  <g key="gift" fill="none" strokeLinecap="round">
    <circle cx="60" cy="44" r="24" stroke={ACCENT} strokeWidth="2.5" />
    <line x1="60" y1="44" x2="60" y2="28" stroke={ACCENT} strokeWidth="2.5" />
    <line x1="60" y1="44" x2="72" y2="50" stroke={ACCENT} strokeWidth="2.5" />
    <path
      d="M96 20 L 100 28 L 108 30 L 100 33 L 96 40 L 92 33 L 84 30 L 92 28 Z"
      fill={GOOD}
      stroke="none"
      opacity="0.9"
    />
  </g>,
];
