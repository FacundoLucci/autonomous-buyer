const GLYPH_HEIGHT = 7;

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

function compileGlyph(character: string, rows: GlyphRows): CompiledGlyph {
  if (rows.length !== GLYPH_HEIGHT) {
    throw new Error(`Dot-matrix glyph ${character} must be ${GLYPH_HEIGHT} rows tall.`);
  }

  const columns = rows[0]?.length ?? 0;
  if (columns === 0 || rows.some((row) => row.length !== columns || /[^01]/u.test(row))) {
    throw new Error(`Dot-matrix glyph ${character} has an invalid pixel map.`);
  }

  return {
    columns,
    pixels: Uint8Array.from(rows.join(""), (pixel) => (pixel === "1" ? 1 : 0)),
  };
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

  constructor({ letterSpacing = 1, lineSpacing = 1 }: VirtualDotMatrixDriverOptions = {}) {
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
