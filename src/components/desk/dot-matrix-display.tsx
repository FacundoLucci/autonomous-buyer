import type { CSSProperties } from "react";

import { dotMatrixDriver, type DotMatrixFrame } from "./dot-matrix-driver";
import "./dot-matrix-display.css";

// A separate copy of the original display, without its hardware or grille styles.
export function DotMatrixPixels({
  frame,
  layer = "all",
}: {
  frame: DotMatrixFrame;
  layer?: "all" | "lit" | "background";
}) {
  return Array.from(frame.pixels, (pixel, index) => {
    if (layer === "lit" && pixel !== 1) return null;

    return (
      <circle
        key={index}
        cx={(index % frame.columns) + 0.5}
        cy={Math.floor(index / frame.columns) + 0.5}
        r={0.43}
        className={
          layer !== "background" && pixel === 1 ? "desk-dot-matrix__lit" : "desk-dot-matrix__unlit"
        }
      />
    );
  });
}

type DotMatrixDisplayProps = {
  value: string;
  /** Supply changing frames for future effects; value remains the accessible label. */
  frame?: DotMatrixFrame;
  scrollOnHover?: boolean;
};

export function DotMatrixDisplay({
  value,
  frame: suppliedFrame,
  scrollOnHover = false,
}: DotMatrixDisplayProps) {
  const frame = suppliedFrame ?? dotMatrixDriver.rasterize(value);
  const loopColumns = frame.columns + 10;
  const scrollStyle = {
    "--desk-scroll-distance": `${-loopColumns}px`,
    "--desk-scroll-duration": `${loopColumns / 18}s`,
    "--desk-scroll-steps": loopColumns,
  } as CSSProperties;

  return (
    <span
      className="desk-dot-matrix"
      data-dot-matrix-value={frame.normalizedSource}
      data-matrix-columns={frame.columns}
      data-matrix-rows={frame.rows}
    >
      <svg
        className="desk-dot-matrix__grid"
        width={frame.columns}
        height={frame.rows}
        viewBox={`0 0 ${frame.columns} ${frame.rows}`}
        preserveAspectRatio="xMinYMid meet"
        aria-hidden="true"
      >
        {scrollOnHover ? (
          <>
            <DotMatrixPixels frame={frame} layer="background" />
            <g className="desk-dot-matrix__scroll" style={scrollStyle}>
              <DotMatrixPixels frame={frame} layer="lit" />
              <g transform={`translate(${loopColumns} 0)`}>
                <DotMatrixPixels frame={frame} layer="lit" />
              </g>
            </g>
          </>
        ) : (
          <DotMatrixPixels frame={frame} />
        )}
      </svg>
      <span className="sr-only">{value}</span>
    </span>
  );
}
