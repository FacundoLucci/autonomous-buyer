import type { CSSProperties } from "react";

import { dotMatrixDriver } from "./dot-matrix-driver";

type DotMatrixDisplayProps = {
  value: string;
  className?: string;
};

export function DotMatrixDisplay({ value, className }: DotMatrixDisplayProps) {
  const frame = dotMatrixDriver.rasterize(value);
  const classes = ["bh-dot-matrix", className].filter(Boolean).join(" ");
  const gridStyle = {
    "--bh-frame-columns": frame.columns,
    "--bh-frame-rows": frame.rows,
  } as CSSProperties;

  return (
    <span
      className={classes}
      data-dot-matrix-value={frame.normalizedSource}
      data-matrix-columns={frame.columns}
      data-matrix-rows={frame.rows}
      data-lit-pixels={frame.litPixelCount}
    >
      <span className="bh-dot-matrix__grid" style={gridStyle} aria-hidden="true">
        {Array.from(frame.pixels, (pixel, index) => {
          const state = pixel === 1 ? "on" : "off";

          return (
            <span key={index} className={`bh-dot-matrix__pixel bh-dot-matrix__pixel--${state}`} />
          );
        })}
      </span>
      <span className="sr-only">{value}</span>
    </span>
  );
}
