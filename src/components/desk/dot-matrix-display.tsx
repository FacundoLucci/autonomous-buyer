import { dotMatrixDriver, type DotMatrixFrame } from "./dot-matrix-driver";
import "./dot-matrix-display.css";

// A separate copy of the original display, without its hardware or grille styles.
export function DotMatrixPixels({ frame }: { frame: DotMatrixFrame }) {
  return Array.from(frame.pixels, (pixel, index) => (
    <circle
      key={index}
      cx={(index % frame.columns) + 0.5}
      cy={Math.floor(index / frame.columns) + 0.5}
      r={0.43}
      className={pixel === 1 ? "desk-dot-matrix__lit" : "desk-dot-matrix__unlit"}
    />
  ));
}

type DotMatrixDisplayProps = {
  value: string;
  /** Supply changing frames for future effects; value remains the accessible label. */
  frame?: DotMatrixFrame;
};

export function DotMatrixDisplay({ value, frame: suppliedFrame }: DotMatrixDisplayProps) {
  const frame = suppliedFrame ?? dotMatrixDriver.rasterize(value);

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
        <DotMatrixPixels frame={frame} />
      </svg>
      <span className="sr-only">{value}</span>
    </span>
  );
}
