import { Circle, G, Line, Polygon, Rect, Svg, Text } from "@react-pdf/renderer";
import type { Figure } from "./charts";

/**
 * Draws a figure's geometry with react-pdf's SVG primitives: the same
 * list of shapes the browser draws in src/components/report/figure-svg.
 * The width is the width on the page; the height follows the figure's
 * own aspect, so a figure never has to be squeezed to fit a guess.
 */
export function PdfFigure({ figure, width }: { figure: Figure; width: number }) {
  const scale = width / figure.width;
  const height = figure.height * scale;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${figure.width} ${figure.height}`}>
      <G>
        {figure.shapes.map((s, i) => {
          switch (s.kind) {
            case "rect":
              return (
                <Rect
                  key={i}
                  x={s.x}
                  y={s.y}
                  width={s.w}
                  height={s.h}
                  rx={s.rx}
                  ry={s.rx}
                  fill={s.fill}
                />
              );
            case "line":
              return (
                <Line
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
                <Text
                  key={i}
                  x={s.x}
                  y={s.y}
                  style={{
                    fontSize: s.size,
                    fontFamily: "Archivo",
                    fontWeight: s.weight === 600 ? 600 : 400,
                  }}
                  fill={s.fill}
                  textAnchor={s.anchor ?? "start"}
                >
                  {s.text}
                </Text>
              );
            case "polygon":
              return (
                <Polygon
                  key={i}
                  points={s.points.map((p) => p.join(",")).join(" ")}
                  fill={s.fill}
                  stroke={s.stroke}
                  strokeWidth={s.strokeWidth}
                />
              );
            case "circle":
              return (
                <Circle
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
      </G>
    </Svg>
  );
}
