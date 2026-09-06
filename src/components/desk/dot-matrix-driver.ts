const SOURCE_GLYPH_HEIGHT = 7;
const RESOLUTION = 2;
const GLYPH_HEIGHT = SOURCE_GLYPH_HEIGHT * RESOLUTION;
const STROKE_EXPANSION = 1;

type GlyphRows = readonly string[];

const FONT_5X7: Readonly<Record<string, GlyphRows>> = {
  " ": ["000", "000", "000", "000", "000", "000", "000"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  ",": ["00000", "00000", "00000", "00000", "00110", "00100", "01000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "00110", "00110"],
  "/": ["00001", "00010", "00100", "01000", "10000", "00000", "00000"],
  0: ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  2: ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  3: ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  5: ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  6: ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  8: ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  9: ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  ":": ["00000", "00100", "00100", "00000", "00100", "00100", "00000"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
};

// Draw these letters directly on the final grid so their joins and diagonal
// strokes can be refined without changing the display's dot density or weight.
const WORDMARK_GLYPHS: Readonly<Record<string, GlyphRows>> = {
  A: [
    "0111111110",
    "1111111111",
    "1111111111",
    "1110000111",
    "1110000111",
    "1110000111",
    "1110000111",
    "1111111111",
    "1111111111",
    "1111111111",
    "1111111111",
    "1110000111",
    "1110000111",
    "1110000111",
  ],
  R: [
    "1111111110",
    "1111111111",
    "1111111111",
    "1110000111",
    "1110000111",
    "1110000111",
    "1110000111",
    "1111111111",
    "1111111111",
    "1111111110",
    "1110011100",
    "1110001110",
    "1110001110",
    "1110000111",
  ],
  Y: [
    "1110000111",
    "1110000111",
    "1110000111",
    "1110000111",
    "0111001110",
    "0111001110",
    "0011111100",
    "0011111100",
    "0001111000",
    "0001111000",
    "0001111000",
    "0001111000",
    "0001111000",
    "0001111000",
  ],
};

type CompiledGlyph = {
  readonly columns: number;
  readonly pixels: Uint8Array;
};

export type DotMatrixFrame = {
  readonly source: string;
  readonly normalizedSource: string;
  readonly columns: number;
  readonly rows: number;
  readonly pixels: Uint8Array;
  readonly litPixelCount: number;
};

export type VirtualDotMatrixDriverOptions = {
  readonly letterSpacing?: number;
  readonly lineSpacing?: number;
};

function compileGlyph(character: string, sourceRows: GlyphRows): CompiledGlyph {
  const wordmarkRows = WORDMARK_GLYPHS[character];
  const rows = wordmarkRows ?? sourceRows;
  const expectedHeight = wordmarkRows ? GLYPH_HEIGHT : SOURCE_GLYPH_HEIGHT;
  if (rows.length !== expectedHeight) {
    throw new Error(`Dot-matrix glyph ${character} must be ${expectedHeight} rows tall.`);
  }

  const sourceColumns = rows[0]?.length ?? 0;
  if (
    sourceColumns === 0 ||
    rows.some((row) => row.length !== sourceColumns || /[^01]/u.test(row))
  ) {
    throw new Error(`Dot-matrix glyph ${character} has an invalid pixel map.`);
  }

  if (wordmarkRows) {
    return {
      columns: sourceColumns,
      pixels: Uint8Array.from(rows.join(""), (pixel) => (pixel === "1" ? 1 : 0)),
    };
  }

  const columns = sourceColumns * RESOLUTION;
  const pixels = new Uint8Array(columns * GLYPH_HEIGHT);

  // Subdivide the original letterforms, then widen each stroke inside its own
  // glyph. Keeping the expansion within each letter preserves the blank gaps.
  for (let row = 0; row < GLYPH_HEIGHT; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const firstRow = Math.floor(Math.max(0, row - STROKE_EXPANSION) / RESOLUTION);
      const lastRow = Math.floor(Math.min(GLYPH_HEIGHT - 1, row + STROKE_EXPANSION) / RESOLUTION);
      const firstColumn = Math.floor(Math.max(0, column - STROKE_EXPANSION) / RESOLUTION);
      const lastColumn = Math.floor(Math.min(columns - 1, column + STROKE_EXPANSION) / RESOLUTION);

      for (let sourceRow = firstRow; sourceRow <= lastRow; sourceRow += 1) {
        if (rows[sourceRow].slice(firstColumn, lastColumn + 1).includes("1")) {
          pixels[row * columns + column] = 1;
          break;
        }
      }
    }
  }

  return { columns, pixels };
}

const COMPILED_FONT = new Map(
  Object.entries(FONT_5X7).map(([character, rows]) => [character, compileGlyph(character, rows)]),
);

const CHARACTER_ALIASES: Readonly<Record<string, string>> = {
  "–": "-",
  "—": "-",
  "×": "X",
};

function assertSpacing(name: string, value: number) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
}

function glyphFor(character: string) {
  const normalizedCharacter = CHARACTER_ALIASES[character] ?? character.toUpperCase();
  return COMPILED_FONT.get(normalizedCharacter) ?? COMPILED_FONT.get("?")!;
}

/**
 * Converts serial-style text into a device-independent pixel frame. Keep display
 * values on this path: a CSS texture alone is not a dynamic dot-matrix display.
 */
export class VirtualDotMatrixDriver {
  readonly letterSpacing: number;
  readonly lineSpacing: number;

  constructor({
    letterSpacing = RESOLUTION,
    lineSpacing = RESOLUTION,
  }: VirtualDotMatrixDriverOptions = {}) {
    assertSpacing("letterSpacing", letterSpacing);
    assertSpacing("lineSpacing", lineSpacing);
    this.letterSpacing = letterSpacing;
    this.lineSpacing = lineSpacing;
  }

  rasterize(source: string): DotMatrixFrame {
    const normalizedSource = source.replace(/\r\n?/gu, "\n").toUpperCase();
    const lines = normalizedSource.split("\n");
    const glyphLines = lines.map((line) => Array.from(line, glyphFor));
    const lineWidths = glyphLines.map((glyphs) =>
      glyphs.reduce(
        (width, glyph, index) => width + glyph.columns + (index === 0 ? 0 : this.letterSpacing),
        0,
      ),
    );
    const columns = Math.max(1, ...lineWidths);
    const rows = Math.max(
      GLYPH_HEIGHT,
      lines.length * GLYPH_HEIGHT + Math.max(0, lines.length - 1) * this.lineSpacing,
    );
    const pixels = new Uint8Array(columns * rows);
    let litPixelCount = 0;

    glyphLines.forEach((glyphs, lineIndex) => {
      const rowOffset = lineIndex * (GLYPH_HEIGHT + this.lineSpacing);
      let columnOffset = 0;

      glyphs.forEach((glyph, glyphIndex) => {
        if (glyphIndex > 0) columnOffset += this.letterSpacing;

        for (let row = 0; row < GLYPH_HEIGHT; row += 1) {
          for (let column = 0; column < glyph.columns; column += 1) {
            const isLit = glyph.pixels[row * glyph.columns + column];
            if (isLit === 1) {
              pixels[(rowOffset + row) * columns + columnOffset + column] = 1;
              litPixelCount += 1;
            }
          }
        }

        columnOffset += glyph.columns;
      });
    });

    return { source, normalizedSource, columns, rows, pixels, litPixelCount };
  }
}

export const dotMatrixDriver = new VirtualDotMatrixDriver();
