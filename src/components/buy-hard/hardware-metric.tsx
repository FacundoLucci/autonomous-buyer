import { useId, type ComponentProps, type ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { DotMatrixDisplay } from "./dot-matrix-display";
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
            <DotMatrixDisplay value={displayValue} />
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

/** Size the entire rack together; values never choose their own dot resolution. */
export function HardwareMetricRack({
  children,
  className,
  "aria-label": ariaLabel = "Purchasing summary",
  ...props
}: HardwareMetricRackProps) {
  return (
    <section
      className={["bh-metric-rack", className].filter(Boolean).join(" ")}
      aria-label={ariaLabel}
      {...props}
    >
      <div className="bh-metric-grid">{children}</div>
    </section>
  );
}
