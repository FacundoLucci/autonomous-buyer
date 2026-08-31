import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { useCallback, useRef, type RefObject } from "react";

export type EinkLightSource = "top-left" | "top" | "left" | "center";

export type EinkSettings = {
  paper: string;
  ink: string;
  accent: string;
  pixelScale: number;
  grain: number;
  lightStrength: number;
  contrast: number;
  accentStrength: number;
  lightSource: EinkLightSource;
};

export const DEFAULT_EINK_SETTINGS: EinkSettings = {
  paper: "#1f211e",
  ink: "#c7c5b8",
  accent: "#7293a3",
  pixelScale: 1,
  grain: 22,
  lightStrength: 12,
  contrast: 102,
  accentStrength: 68,
  lightSource: "top-left",
};

type CanvasSurfaceProps = {
  sourceRef: RefObject<HTMLElement | null>;
  settings: EinkSettings;
  revision: string;
};

type TunerProps = {
  settings: EinkSettings;
  onChange: <Key extends keyof EinkSettings>(key: Key, value: EinkSettings[Key]) => void;
  onReset: () => void;
};

type LowResolutionRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type RGB = [number, number, number];

const STATUS_COLORS = {
  awaiting_quotes: "#9a5634",
  confirmed: "#61753a",
  covered: "#61753a",
  delivered: "#625f56",
  monitoring: "#35657a",
} as const;

const BINARY_GLYPH_ALPHA_THRESHOLD = 96;
const BINARY_GLYPH_PADDING = 2;

function parseHex(value: string): RGB {
  const normalized = value.replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((character) => `${character}${character}`)
          .join("")
      : normalized;
  const parsed = Number.parseInt(expanded, 16);
  return [(parsed >> 16) & 255, (parsed >> 8) & 255, parsed & 255];
}

function rgb(value: string, alpha = 1) {
  const [red, green, blue] = parseHex(value);
  return `rgb(${red} ${green} ${blue} / ${alpha})`;
}

function mixColors(from: string, to: string, amount: number) {
  const start = parseHex(from);
  const end = parseHex(to);
  const mixed = start.map((channel, index) =>
    Math.round(channel + ((end[index] ?? channel) - channel) * amount),
  );
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function lowResolutionRect(
  element: Element,
  canvasRect: DOMRect,
  pixelScale: number,
): LowResolutionRect {
  const rect = element.getBoundingClientRect();
  return {
    x: (rect.left - canvasRect.left) / pixelScale,
    y: (rect.top - canvasRect.top) / pixelScale,
    width: rect.width / pixelScale,
    height: rect.height / pixelScale,
  };
}

function roundedRect(context: CanvasRenderingContext2D, rect: LowResolutionRect, radius: number) {
  const safeRadius = Math.min(radius, rect.width / 2, rect.height / 2);
  context.beginPath();
  context.roundRect(rect.x, rect.y, rect.width, rect.height, safeRadius);
}

function transformedText(element: Element) {
  const text = element.textContent?.trim() ?? "";
  const transform = getComputedStyle(element).textTransform;
  if (transform === "uppercase") return text.toUpperCase();
  if (transform === "lowercase") return text.toLowerCase();
  return text;
}

function fitText(context: CanvasRenderingContext2D, value: string, maxWidth: number) {
  if (context.measureText(value).width <= maxWidth) return value;
  let fitted = value;
  while (fitted.length > 1 && context.measureText(`${fitted}…`).width > maxWidth) {
    fitted = fitted.slice(0, -1);
  }
  return `${fitted}…`;
}

function drawElementText(
  context: CanvasRenderingContext2D,
  element: Element | null,
  canvasRect: DOMRect,
  pixelScale: number,
  color: string,
  value?: string,
) {
  if (!element) return;
  const rect = lowResolutionRect(element, canvasRect, pixelScale);
  if (rect.width <= 0 || rect.height <= 0) return;

  const style = getComputedStyle(element);
  const fontSize = Math.max(5, Math.round(Number.parseFloat(style.fontSize) / pixelScale));
  const fontWeight = style.fontWeight === "normal" ? "400" : style.fontWeight;
  const glyphCanvas = document.createElement("canvas");
  glyphCanvas.width = Math.max(1, Math.ceil(rect.width) + BINARY_GLYPH_PADDING * 2);
  glyphCanvas.height = Math.max(1, Math.ceil(rect.height) + BINARY_GLYPH_PADDING * 2);
  const glyphContext = glyphCanvas.getContext("2d", { willReadFrequently: true });
  if (!glyphContext) return;

  glyphContext.imageSmoothingEnabled = false;
  glyphContext.fillStyle = "#ffffff";
  glyphContext.font = `${fontWeight} ${fontSize}px ${style.fontFamily}`;
  glyphContext.fontKerning = "none";
  glyphContext.textBaseline = "middle";
  glyphContext.textAlign = style.textAlign === "right" ? "right" : "left";
  const trackedContext = glyphContext as CanvasRenderingContext2D & { letterSpacing?: string };
  if ("letterSpacing" in trackedContext) {
    const letterSpacing = Number.parseFloat(style.letterSpacing);
    trackedContext.letterSpacing = `${Number.isFinite(letterSpacing) ? Math.round(letterSpacing / pixelScale) : 0}px`;
  }
  const x =
    glyphContext.textAlign === "right" ? BINARY_GLYPH_PADDING + rect.width : BINARY_GLYPH_PADDING;
  const text = fitText(glyphContext, value ?? transformedText(element), rect.width);
  glyphContext.fillText(text, x, BINARY_GLYPH_PADDING + rect.height / 2);

  const glyphPixels = glyphContext.getImageData(0, 0, glyphCanvas.width, glyphCanvas.height);
  const [red, green, blue] = parseHex(color);
  for (let index = 0; index < glyphPixels.data.length; index += 4) {
    const isInk = glyphPixels.data[index + 3] >= BINARY_GLYPH_ALPHA_THRESHOLD;
    glyphPixels.data[index] = red;
    glyphPixels.data[index + 1] = green;
    glyphPixels.data[index + 2] = blue;
    glyphPixels.data[index + 3] = isInk ? 255 : 0;
  }
  glyphContext.putImageData(glyphPixels, 0, 0);
  context.drawImage(
    glyphCanvas,
    Math.round(rect.x) - BINARY_GLYPH_PADDING,
    Math.round(rect.y) - BINARY_GLYPH_PADDING,
  );
}

function drawSearchIcon(
  context: CanvasRenderingContext2D,
  rect: LowResolutionRect,
  pixelScale: number,
  color: string,
) {
  const radius = 4.2 / pixelScale;
  const centerX = rect.x + 14 / pixelScale;
  const centerY = rect.y + rect.height / 2 - 0.5 / pixelScale;
  context.save();
  context.strokeStyle = color;
  context.lineWidth = Math.max(0.55, 1 / pixelScale);
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.moveTo(centerX + radius * 0.72, centerY + radius * 0.72);
  context.lineTo(centerX + radius * 1.65, centerY + radius * 1.65);
  context.stroke();
  context.restore();
}

function drawFilterIcon(
  context: CanvasRenderingContext2D,
  rect: LowResolutionRect,
  pixelScale: number,
  color: string,
) {
  const x = rect.x + 10 / pixelScale;
  const y = rect.y + rect.height / 2 - 5 / pixelScale;
  context.save();
  context.strokeStyle = color;
  context.lineWidth = Math.max(0.55, 1 / pixelScale);
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(x + 10 / pixelScale, y);
  context.lineTo(x + 6 / pixelScale, y + 5 / pixelScale);
  context.lineTo(x + 6 / pixelScale, y + 9 / pixelScale);
  context.lineTo(x + 4 / pixelScale, y + 10 / pixelScale);
  context.lineTo(x + 4 / pixelScale, y + 5 / pixelScale);
  context.closePath();
  context.stroke();
  context.restore();
}

function drawControl(
  context: CanvasRenderingContext2D,
  label: Element | null,
  input: HTMLInputElement | HTMLSelectElement | null,
  kind: "filter" | "search",
  canvasRect: DOMRect,
  pixelScale: number,
  settings: EinkSettings,
) {
  if (!label || !input) return;
  const rect = lowResolutionRect(label, canvasRect, pixelScale);
  context.save();
  roundedRect(context, rect, 3 / pixelScale);
  context.fillStyle = rgb(settings.ink, 0.055);
  context.fill();
  context.strokeStyle = rgb(settings.ink, 0.34);
  context.lineWidth = Math.max(0.5, 1 / pixelScale);
  context.stroke();

  const muted = mixColors(settings.paper, settings.ink, 0.58);
  if (kind === "search") drawSearchIcon(context, rect, pixelScale, muted);
  else drawFilterIcon(context, rect, pixelScale, muted);

  const value =
    input instanceof HTMLSelectElement
      ? (input.selectedOptions[0]?.text ?? "")
      : input.value || input.placeholder;
  drawElementText(context, input, canvasRect, pixelScale, muted, value);

  if (kind === "filter") {
    const x = rect.x + rect.width - 14 / pixelScale;
    const y = rect.y + rect.height / 2 - 1 / pixelScale;
    context.strokeStyle = settings.ink;
    context.lineWidth = Math.max(0.6, 1 / pixelScale);
    context.beginPath();
    context.moveTo(x - 3 / pixelScale, y - 2 / pixelScale);
    context.lineTo(x, y + 1 / pixelScale);
    context.lineTo(x + 3 / pixelScale, y - 2 / pixelScale);
    context.stroke();
  }
  context.restore();
}

function statusColor(status: string, settings: EinkSettings) {
  const base = STATUS_COLORS[status as keyof typeof STATUS_COLORS] ?? STATUS_COLORS.delivered;
  const target = status === "monitoring" ? settings.accent : base;
  return mixColors(settings.ink, target, settings.accentStrength / 100);
}

function drawRow(
  context: CanvasRenderingContext2D,
  row: HTMLButtonElement,
  canvasRect: DOMRect,
  pixelScale: number,
  settings: EinkSettings,
) {
  const rect = lowResolutionRect(row, canvasRect, pixelScale);
  const selected = row.dataset.selected === "true";
  const status = row.dataset.status ?? "delivered";
  const accent = selected ? settings.accent : statusColor(status, settings);
  const muted = mixColors(settings.paper, settings.ink, 0.58);

  context.save();
  if (selected) {
    context.fillStyle = rgb(settings.ink, 0.1);
    context.fillRect(rect.x, rect.y, rect.width, rect.height);
  }

  context.fillStyle = accent;
  context.fillRect(
    rect.x,
    rect.y + 9 / pixelScale,
    Math.max(1, 2 / pixelScale),
    rect.height - 18 / pixelScale,
  );

  context.strokeStyle = rgb(settings.ink, 0.24);
  context.lineWidth = Math.max(0.5, 1 / pixelScale);
  context.beginPath();
  context.moveTo(rect.x, rect.y + rect.height - 0.5 / pixelScale);
  context.lineTo(rect.x + rect.width, rect.y + rect.height - 0.5 / pixelScale);
  context.stroke();

  drawElementText(
    context,
    row.querySelector(".bh-buy-row__id"),
    canvasRect,
    pixelScale,
    selected ? settings.accent : settings.ink,
  );
  drawElementText(
    context,
    row.querySelector(".bh-buy-row__name"),
    canvasRect,
    pixelScale,
    selected ? settings.accent : muted,
  );
  row.querySelectorAll(".bh-buy-row__schedule > span").forEach((element) => {
    drawElementText(context, element, canvasRect, pixelScale, muted);
  });
  drawElementText(
    context,
    row.querySelector(".bh-status"),
    canvasRect,
    pixelScale,
    statusColor(status, settings),
  );

  const chevron = row.querySelector(".bh-buy-row__chevron");
  if (chevron) {
    const chevronRect = lowResolutionRect(chevron, canvasRect, pixelScale);
    const centerX = chevronRect.x + chevronRect.width / 2;
    const centerY = chevronRect.y + chevronRect.height / 2;
    context.strokeStyle = muted;
    context.lineWidth = Math.max(0.6, 1 / pixelScale);
    context.beginPath();
    context.moveTo(centerX - 2 / pixelScale, centerY - 4 / pixelScale);
    context.lineTo(centerX + 2 / pixelScale, centerY);
    context.lineTo(centerX - 2 / pixelScale, centerY + 4 / pixelScale);
    context.stroke();
  }
  context.restore();
}

function drawLowResolutionContent(
  context: CanvasRenderingContext2D,
  source: HTMLElement,
  canvasRect: DOMRect,
  pixelScale: number,
  settings: EinkSettings,
) {
  const width = context.canvas.width;
  const height = context.canvas.height;
  const muted = mixColors(settings.paper, settings.ink, 0.58);
  context.fillStyle = settings.paper;
  context.fillRect(0, 0, width, height);

  const header = source.querySelector(".bh-panel__header");
  if (header) {
    const rect = lowResolutionRect(header, canvasRect, pixelScale);
    context.fillStyle = rgb(settings.ink, 0.025);
    context.fillRect(rect.x, rect.y, rect.width, rect.height);
    context.strokeStyle = rgb(settings.ink, 0.26);
    context.lineWidth = Math.max(0.5, 1 / pixelScale);
    context.beginPath();
    context.moveTo(rect.x, rect.y + rect.height - 0.5 / pixelScale);
    context.lineTo(rect.x + rect.width, rect.y + rect.height - 0.5 / pixelScale);
    context.stroke();
  }

  drawElementText(context, source.querySelector(".bh-kicker"), canvasRect, pixelScale, muted);
  drawElementText(
    context,
    source.querySelector("#all-buys-title"),
    canvasRect,
    pixelScale,
    settings.ink,
  );
  drawControl(
    context,
    source.querySelector(".bh-search"),
    source.querySelector(".bh-search input"),
    "search",
    canvasRect,
    pixelScale,
    settings,
  );
  drawControl(
    context,
    source.querySelector(".bh-filter"),
    source.querySelector(".bh-filter select"),
    "filter",
    canvasRect,
    pixelScale,
    settings,
  );

  source.querySelectorAll<HTMLButtonElement>(".bh-buy-row").forEach((row) => {
    drawRow(context, row, canvasRect, pixelScale, settings);
  });

  const empty = source.querySelector(".bh-empty");
  if (empty) {
    drawElementText(context, empty.querySelector("p"), canvasRect, pixelScale, muted);
    const button = empty.querySelector("button");
    if (button) {
      const rect = lowResolutionRect(button, canvasRect, pixelScale);
      roundedRect(context, rect, 3 / pixelScale);
      context.fillStyle = rgb(settings.ink, 0.055);
      context.fill();
      context.strokeStyle = rgb(settings.ink, 0.42);
      context.stroke();
      drawElementText(context, button, canvasRect, pixelScale, settings.ink);
    }
  }

  const pagination = source.querySelector(".bh-pagination");
  if (pagination) {
    const rect = lowResolutionRect(pagination, canvasRect, pixelScale);
    context.fillStyle = rgb(settings.ink, 0.035);
    context.fillRect(rect.x, rect.y, rect.width, rect.height);
    context.strokeStyle = rgb(settings.ink, 0.26);
    context.beginPath();
    context.moveTo(rect.x, rect.y + 0.5 / pixelScale);
    context.lineTo(rect.x + rect.width, rect.y + 0.5 / pixelScale);
    context.stroke();
    pagination.querySelectorAll(":scope > span").forEach((element) => {
      drawElementText(context, element, canvasRect, pixelScale, muted);
    });
  }
}

function drawLightOverlay(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  settings: EinkSettings,
) {
  const points: Record<EinkLightSource, [number, number]> = {
    "top-left": [0, 0],
    top: [width / 2, 0],
    left: [0, height / 2],
    center: [width / 2, height / 2],
  };
  const [sourceX, sourceY] = points[settings.lightSource];
  const intensity = settings.lightStrength / 100;
  const radius = Math.max(width, height) * 0.92;
  const light = context.createRadialGradient(sourceX, sourceY, 0, sourceX, sourceY, radius);
  light.addColorStop(0, rgb("#fff2cf", intensity * 0.23));
  light.addColorStop(0.42, rgb("#fff2cf", intensity * 0.08));
  light.addColorStop(1, rgb("#fff2cf", 0));
  context.fillStyle = light;
  context.fillRect(0, 0, width, height);

  const shade = context.createLinearGradient(sourceX, sourceY, width - sourceX, height - sourceY);
  shade.addColorStop(0, rgb("#17150f", 0));
  shade.addColorStop(1, rgb("#17150f", intensity * 0.09));
  context.fillStyle = shade;
  context.fillRect(0, 0, width, height);
}

function drawMatteGrain(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  grainStrength: number,
) {
  if (grainStrength <= 0) return;
  const tile = document.createElement("canvas");
  tile.width = 64;
  tile.height = 64;
  const tileContext = tile.getContext("2d");
  if (!tileContext) return;
  const pixels = tileContext.createImageData(tile.width, tile.height);
  let seed = 0x2f6e2b1;
  for (let index = 0; index < pixels.data.length; index += 4) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    const value = (seed >>> 24) & 255;
    pixels.data[index] = value;
    pixels.data[index + 1] = value;
    pixels.data[index + 2] = value;
    pixels.data[index + 3] = 255;
  }
  tileContext.putImageData(pixels, 0, 0);
  const pattern = context.createPattern(tile, "repeat");
  if (!pattern) return;
  context.save();
  context.globalCompositeOperation = "soft-light";
  context.globalAlpha = (grainStrength / 100) * 0.24;
  context.fillStyle = pattern;
  context.fillRect(0, 0, width, height);
  context.restore();
}

function renderCanvas(canvas: HTMLCanvasElement, source: HTMLElement, settings: EinkSettings) {
  const canvasRect = canvas.getBoundingClientRect();
  if (canvasRect.width <= 0 || canvasRect.height <= 0) return false;
  const pixelScale = Math.max(1, settings.pixelScale);
  const lowWidth = Math.max(1, Math.ceil(canvasRect.width / pixelScale));
  const lowHeight = Math.max(1, Math.ceil(canvasRect.height / pixelScale));
  const lowCanvas = document.createElement("canvas");
  lowCanvas.width = lowWidth;
  lowCanvas.height = lowHeight;
  const lowContext = lowCanvas.getContext("2d", { alpha: false });
  if (!lowContext) return false;
  lowContext.imageSmoothingEnabled = false;
  drawLowResolutionContent(lowContext, source, canvasRect, pixelScale, settings);

  const deviceScale = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(canvasRect.width * deviceScale));
  canvas.height = Math.max(1, Math.round(canvasRect.height * deviceScale));
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return false;
  context.imageSmoothingEnabled = false;
  canvas.dataset.contentWidth = String(lowWidth);
  canvas.dataset.contentHeight = String(lowHeight);
  canvas.dataset.pixelScale = String(pixelScale);
  canvas.dataset.smoothing = "false";
  canvas.dataset.glyphRendering = "binary";
  canvas.dataset.glyphThreshold = String(BINARY_GLYPH_ALPHA_THRESHOLD);
  canvas.dataset.grain = String(settings.grain);
  canvas.dataset.lightSource = settings.lightSource;
  canvas.dataset.contrast = String(settings.contrast);
  context.save();
  context.filter = `contrast(${settings.contrast}%)`;
  context.drawImage(lowCanvas, 0, 0, lowWidth, lowHeight, 0, 0, canvas.width, canvas.height);
  context.restore();
  context.imageSmoothingEnabled = false;
  drawLightOverlay(context, canvas.width, canvas.height, settings);
  drawMatteGrain(context, canvas.width, canvas.height, settings.grain);
  return true;
}

export function EinkCanvasSurface({ sourceRef, settings, revision }: CanvasSurfaceProps) {
  const observerRef = useRef<ResizeObserver | null>(null);

  const setCanvasRef = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;

      const source = sourceRef.current;
      if (!canvas || !source) {
        if (source) source.dataset.canvasReady = "false";
        return;
      }

      const render = () => {
        const ready = renderCanvas(canvas, source, settings);
        canvas.dataset.revision = revision;
        source.dataset.canvasReady = ready ? "true" : "false";
        canvas.parentElement?.setAttribute("data-canvas-ready", ready ? "true" : "false");
      };

      render();
      const observer = new ResizeObserver(render);
      observer.observe(source);
      observerRef.current = observer;
    },
    [revision, settings, sourceRef],
  );

  return <canvas ref={setCanvasRef} className="bh-eink-canvas" aria-hidden="true" />;
}

function RangeField({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="bh-eink-tuner__field bh-eink-tuner__field--range">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <output>
        {value}
        {suffix}
      </output>
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="bh-eink-tuner__field bh-eink-tuner__field--color">
      <span>{label}</span>
      <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
      <output>{value.toUpperCase()}</output>
    </label>
  );
}

export function EinkTuner({ settings, onChange, onReset }: TunerProps) {
  return (
    <details className="bh-eink-tuner">
      <summary aria-label="Open E Ink display tuning controls">
        <SlidersHorizontal aria-hidden="true" />
        <span className="bh-eink-tuner__summary-label">E Ink</span>
        <span className="bh-eink-tuner__summary-value">{settings.pixelScale.toFixed(1)}×</span>
      </summary>
      <div className="bh-eink-tuner__panel">
        <div className="bh-eink-tuner__heading">
          <div>
            <p>Display tuning</p>
            <span>Binary calculator glyphs · matte e-ink surface</span>
          </div>
          <button type="button" onClick={onReset}>
            <RotateCcw aria-hidden="true" />
            Reset
          </button>
        </div>

        <div className="bh-eink-tuner__grid">
          <ColorField
            label="Paper"
            value={settings.paper}
            onChange={(value) => onChange("paper", value)}
          />
          <ColorField
            label="Ink"
            value={settings.ink}
            onChange={(value) => onChange("ink", value)}
          />
          <ColorField
            label="Accent"
            value={settings.accent}
            onChange={(value) => onChange("accent", value)}
          />
          <label className="bh-eink-tuner__field">
            <span>Light source</span>
            <select
              value={settings.lightSource}
              onChange={(event) => onChange("lightSource", event.target.value as EinkLightSource)}
            >
              <option value="top-left">Top left</option>
              <option value="top">Top center</option>
              <option value="left">Left center</option>
              <option value="center">Center</option>
            </select>
          </label>
          <RangeField
            label="Pixel block"
            value={settings.pixelScale}
            min={1}
            max={4}
            step={0.5}
            suffix="×"
            onChange={(value) => onChange("pixelScale", value)}
          />
          <RangeField
            label="Matte grain"
            value={settings.grain}
            min={0}
            max={50}
            step={1}
            suffix="%"
            onChange={(value) => onChange("grain", value)}
          />
          <RangeField
            label="Surface light"
            value={settings.lightStrength}
            min={0}
            max={60}
            step={1}
            suffix="%"
            onChange={(value) => onChange("lightStrength", value)}
          />
          <RangeField
            label="Ink contrast"
            value={settings.contrast}
            min={70}
            max={130}
            step={1}
            suffix="%"
            onChange={(value) => onChange("contrast", value)}
          />
          <RangeField
            label="Accent ink"
            value={settings.accentStrength}
            min={0}
            max={100}
            step={1}
            suffix="%"
            onChange={(value) => onChange("accentStrength", value)}
          />
        </div>
      </div>
    </details>
  );
}
