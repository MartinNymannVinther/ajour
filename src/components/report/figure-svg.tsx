import type { Figure } from "@/modules/reports/charts";

/**
 * Draws a figure's geometry as an inline SVG. The PDF draws the same list
 * with react-pdf's primitives (src/modules/reports/pdf-figure.tsx), which
 * is the whole point: one set of coordinates, two renderers.
 */
export function FigureSvg({ figure, title }: { figure: Figure; title: string }) {
  return (
    <svg
      viewBox={`0 0 ${figure.width} ${figure.height}`}
      width="100%"
      role="img"
      aria-label={title}
      className="block"
      style={{ fontFamily: "var(--font-sans), system-ui, sans-serif" }}
    >
      {figure.shapes.map((s, i) => {
        switch (s.kind) {
          case "rect":
            return (
              <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} fill={s.fill} />
            );
          case "line":
            return (
              <line
                key={i}
                x1={s.x1}
                y1={s.y1}
                x2={s.x2}
                y2={s.y2}
                stroke={s.stroke}
                strokeWidth={s.width}
                strokeDasharray={s.dash}
                strokeLinecap="round"
              />
            );
          case "text":
            return (
              <text
                key={i}
                x={s.x}
                y={s.y}
                fontSize={s.size}
                fill={s.fill}
                fontWeight={s.weight ?? 400}
                textAnchor={s.anchor ?? "start"}
              >
                {s.text}
              </text>
            );
          case "polygon":
            return (
              <polygon
                key={i}
                points={s.points.map((p) => p.join(",")).join(" ")}
                fill={s.fill}
                stroke={s.stroke}
                strokeWidth={s.strokeWidth}
              />
            );
          case "circle":
            return (
              <circle
                key={i}
                cx={s.cx}
                cy={s.cy}
                r={s.r}
                fill={s.fill}
                stroke={s.stroke}
                strokeWidth={s.strokeWidth}
              />
            );
        }
      })}
    </svg>
  );
}
