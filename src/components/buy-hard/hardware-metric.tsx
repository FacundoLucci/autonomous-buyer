import { Children, isValidElement, useId, type ComponentProps, type ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/legacy-ui/tooltip";

import { DotMatrixDisplay, DotMatrixPixels } from "./dot-matrix-display";
import { dotMatrixDriver } from "./dot-matrix-driver";
import { formatCompactMetric } from "./metric-format";
import "./hardware-metric.css";

type HardwareMetricProps = Omit<ComponentProps<"div">, "children"> & {
  label: string;
  value: number | null | undefined;
  currency?: "USD";
  source?: string;
};

/** One compact readout in the shared perforated metal opening. */
export function HardwareMetric({
  label,
  value,
  currency,
  source,
  className,
  ...props
}: HardwareMetricProps) {
  const sourceId = useId();
  const displayValue = formatCompactMetric(value);
  const fullValue =
    value != null && Number.isFinite(value)
      ? new Intl.NumberFormat("en-US", {
          ...(currency ? { style: "currency", currency } : {}),
          maximumFractionDigits: 0,
        }).format(value)
      : "Unavailable";
  const annotation = [currency, source].filter(Boolean).join(" · ");

  return (
    <div className={["bh-metric", className].filter(Boolean).join(" ")} {...props}>
      <span className="bh-metric__label">{label}</span>
      <Tooltip>
        <TooltipTrigger
          type="button"
          closeOnClick={false}
          className="bh-metric__value"
          aria-label={`${label}: ${fullValue}`}
          aria-describedby={annotation ? sourceId : undefined}
        >
          <span aria-hidden="true">
            <DotMatrixDisplay value={displayValue} painted={false} />
          </span>
        </TooltipTrigger>
        <TooltipContent>{`${label}: ${fullValue}`}</TooltipContent>
      </Tooltip>
      <p id={sourceId} className="bh-metric__source">
        {currency ? <span>{currency}</span> : null}
        {source ? <span>{source}</span> : null}
      </p>
    </div>
  );
}

type HardwareMetricRackProps = ComponentProps<"section"> & {
  children: ReactNode;
};

const grilleLayouts = [
  { name: "wide", columns: 73, noteRows: 6 },
  { name: "medium", columns: 49, noteRows: 6 },
  { name: "small", columns: 31, noteRows: 6 },
  { name: "phone", columns: 31, noteRows: 8 },
] as const;

/** Size the entire rack together; values never choose their own dot resolution. */
export function HardwareMetricRack({
  children,
  className,
  "aria-label": ariaLabel = "Purchasing summary",
  ...props
}: HardwareMetricRackProps) {
  const grilleId = useId();
  const frames = Children.toArray(children)
    .filter(isValidElement<HardwareMetricProps>)
    .map((child) => dotMatrixDriver.rasterize(formatCompactMetric(child.props.value)));

  return (
    <section
      className={["bh-metric-rack", className].filter(Boolean).join(" ")}
      aria-label={ariaLabel}
      {...props}
    >
      <div className="bh-metric-grid">
        {grilleLayouts.map(({ name, columns, noteRows }) => {
          const patternId = `${grilleId}-${name}`;
          return (
            <svg
              key={name}
              className={`bh-metric-grille bh-metric-grille--${name}`}
              viewBox={`0 0 ${columns * 4 + 4} ${17 + noteRows}`}
              preserveAspectRatio="xMidYMid meet"
              aria-hidden="true"
            >
              <defs>
                <pattern id={patternId} width="1" height="1" patternUnits="userSpaceOnUse">
                  <path
                    d="M1 0H0V1"
                    fill="none"
                    stroke="white"
                    strokeOpacity="0.024"
                    strokeWidth="0.06"
                  />
                  <circle cx="0.5" cy="0.5" r="0.38" fill="var(--bh-display-cell-rim, #151817)" />
                  <circle cx="0.5" cy="0.5" r="0.315" fill="var(--bh-display-cell, #020303)" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill={`url(#${patternId})`} />
              {frames.map((frame, index) => (
                <g
                  key={index}
                  transform={`translate(${2 + index * columns + (columns - frame.columns) / 2} 8)`}
                  data-grille-value={frame.normalizedSource}
                >
                  <DotMatrixPixels frame={frame} />
                </g>
              ))}
            </svg>
          );
        })}
        {children}
      </div>
    </section>
  );
}
