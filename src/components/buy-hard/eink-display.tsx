import { RotateCcw, SlidersHorizontal } from "lucide-react";

export type EinkLightSource = "top-left" | "top" | "left" | "center";

export type EinkSettings = {
  paper: string;
  ink: string;
  accent: string;
  grain: number;
  lightStrength: number;
  contrast: number;
  lightSource: EinkLightSource;
};

export const DEFAULT_EINK_SETTINGS: EinkSettings = {
  paper: "#1f211e",
  ink: "#c7c5b8",
  accent: "#7293a3",
  grain: 25,
  lightStrength: 20,
  contrast: 116,
  lightSource: "top-left",
};

type TunerProps = {
  settings: EinkSettings;
  onChange: <Key extends keyof EinkSettings>(key: Key, value: EinkSettings[Key]) => void;
  onReset: () => void;
};

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
        <span className="bh-eink-tuner__summary-value">Grain {settings.grain}%</span>
      </summary>
      <div className="bh-eink-tuner__panel">
        <div className="bh-eink-tuner__heading">
          <div>
            <p>Display tuning</p>
            <span>Crisp live type · matte grain overlay</span>
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
        </div>
      </div>
    </details>
  );
}
