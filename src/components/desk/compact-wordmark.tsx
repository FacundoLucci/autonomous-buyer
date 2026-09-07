import { DotMatrixDisplay } from "./dot-matrix-display";
import type { DotMatrixFrame } from "./dot-matrix-driver";

// Letterforms drawn for the small header: seven rows of clearly separated dots.
// This is a separate pixel map, not a scaled-down copy of the large wordmark.
const GLYPHS: Readonly<Record<string, readonly string[]>> = {
  " ": ["000", "000", "000", "000", "000", "000", "000"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  Y: ["10001", "10001", "01010", "01010", "00100", "00100", "00100"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  A: ["01110", "10001", "10001", "10001", "11111", "10001", "10001"],
  R: ["11110", "10001", "10001", "10001", "11110", "10010", "10001"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
};

const VALUE = "BUY HARD";
const rows = Array.from({ length: 7 }, (_, row) =>
  Array.from(VALUE, (character) => GLYPHS[character][row]).join("0"),
);
const pixels = Uint8Array.from(rows.join(""), (pixel) => (pixel === "1" ? 1 : 0));
const frame: DotMatrixFrame = {
  source: VALUE,
  normalizedSource: VALUE,
  columns: rows[0].length,
  rows: rows.length,
  pixels,
  litPixelCount: pixels.reduce((count, pixel) => count + pixel, 0),
};

export function CompactWordmark() {
  return <DotMatrixDisplay value={VALUE} frame={frame} />;
}
