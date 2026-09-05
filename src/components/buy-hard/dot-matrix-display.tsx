import type { CSSProperties } from "react";

import { dotMatrixDriver, type DotMatrixFrame } from "./dot-matrix-driver";

export function DotMatrixPixels({ frame }: { frame: DotMatrixFrame }) {
  return Array.from(frame.pixels, (pixel, index) =>
    pixel === 1 ? (
      <circle
        key={index}
        cx={(index % frame.columns) + 0.5}
        cy={Math.floor(index / frame.columns) + 0.5}
        r={0.3}
        className="bh-dot-matrix__light"
      />
    ) : null,
  );
}

type DotMatrixDisplayProps = {
  value: string;
  className?: string;
  /** The rack paints its lights in the shared grille; retain a tooltip hit area. */
  painted?: boolean;
};

export function DotMatrixDisplay({ value, className, painted = true }: DotMatrixDisplayProps) {
  const frame = dotMatrixDriver.rasterize(value);
  const gridStyle = {
    "--bh-frame-columns": frame.columns,
    "--bh-frame-rows": frame.rows,
  } as CSSProperties;

  return (
    <span
      className={["bh-dot-matrix", className].filter(Boolean).join(" ")}
      data-dot-matrix-value={frame.normalizedSource}
      data-matrix-columns={frame.columns}
      data-matrix-rows={frame.rows}
      data-lit-pixels={frame.litPixelCount}
      style={gridStyle}
    >
      <svg
        className="bh-dot-matrix__grid"
        viewBox={`0 0 ${frame.columns} ${frame.rows}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        {painted ? <DotMatrixPixels frame={frame} /> : null}
      </svg>
      <span className="sr-only">{value}</span>
    </span>
  );
}
