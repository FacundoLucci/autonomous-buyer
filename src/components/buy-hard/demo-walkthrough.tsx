import { useCallback, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { placeDemoSpotlight, type SpotlightLayout } from "./demo-spotlight-geometry";
import "./demo-walkthrough.css";

export type DemoWalkthroughStep = {
  id: string;
  title: string;
  description: string;
  /** A selector for saved evidence already rendered by the application. */
  target: string;
};

export type DemoWalkthroughProps = {
  steps: readonly DemoWalkthroughStep[];
  currentStep: number;
  onStepChange: (index: number) => void;
  onClose: () => void;
  loading?: boolean;
  disabled?: boolean;
};

/** Guidance only. Navigation and recorded evidence remain owned by the caller. */
export function DemoWalkthrough(props: DemoWalkthroughProps) {
  const step = props.steps[props.currentStep];
  if (!step) return null;

  return <WalkthroughStepPanel {...props} step={step} />;
}

function interpolateSpotlight(
  from: SpotlightLayout,
  to: SpotlightLayout,
  progress: number,
): SpotlightLayout {
  const mix = (a: number, b: number) => a + (b - a) * progress;
  return {
    target: {
      x: mix(from.target.x, to.target.x),
      y: mix(from.target.y, to.target.y),
      width: mix(from.target.width, to.target.width),
      height: mix(from.target.height, to.target.height),
    },
    panel: { x: mix(from.panel.x, to.panel.x), y: mix(from.panel.y, to.panel.y) },
    connector: {
      x1: mix(from.connector.x1, to.connector.x1),
      y1: mix(from.connector.y1, to.connector.y1),
      x2: mix(from.connector.x2, to.connector.x2),
      y2: mix(from.connector.y2, to.connector.y2),
    },
  };
}

function WalkthroughStepPanel({
  steps,
  step,
  currentStep,
  onStepChange,
  onClose,
  loading = false,
  disabled = false,
}: DemoWalkthroughProps & { step: DemoWalkthroughStep }) {
  const titleId = useId();
  const descriptionId = useId();
  const [readyStep, setReadyStep] = useState<string | null>(null);
  const painted = useRef<SpotlightLayout | null>(null);
  const clipId = `demo-spotlight-${useId().replaceAll(":", "")}`;

  // A persistent overlay measures semantic anchors, not coordinates saved in a step.
  // Ref cleanup owns every observer/listener; animation frames never rerender React.
  const attachGuide = useCallback(
    (panel: HTMLElement | null) => {
      if (!panel) return;
      const stage = panel.closest<HTMLElement>(".bh-demo-stage");
      const mask = stage?.querySelector<SVGPathElement>("[data-spotlight-mask]");
      const halos = stage?.querySelectorAll<SVGRectElement>("[data-spotlight-halo]");
      const connector = stage?.querySelector<SVGLineElement>("[data-spotlight-connector]");
      if (!stage || !mask || !halos || !connector) return;
      let target: HTMLElement | null = null;
      let previousMarker: string | null = null;
      let frame = 0;
      let motionFrame = 0;
      let trackingFrame = 0;
      let lastBounds = "";
      let destination: SpotlightLayout | null = null;
      let active = true;
      let focused = false;
      const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");

      const paint = (layout: SpotlightLayout) => {
        painted.current = layout;
        const { x, y, width, height } = layout.target;
        const radius = Math.min(10, width / 2, height / 2);
        const right = x + width;
        const bottom = y + height;
        // Even-odd clipping leaves the real target sharp and interactive.
        mask.setAttribute(
          "d",
          `M0 0H${innerWidth}V${innerHeight}H0Z M${x + radius} ${y}H${right - radius}Q${right} ${y} ${right} ${y + radius}V${bottom - radius}Q${right} ${bottom} ${right - radius} ${bottom}H${x + radius}Q${x} ${bottom} ${x} ${bottom - radius}V${y + radius}Q${x} ${y} ${x + radius} ${y}Z`,
        );
        for (const halo of halos) {
          for (const [key, value] of Object.entries({ x, y, width, height, rx: radius }))
            halo.setAttribute(key, String(value));
        }
        for (const [key, value] of Object.entries(layout.connector))
          connector.setAttribute(key, String(value));
        panel.style.transform = `translate3d(${layout.panel.x}px, ${layout.panel.y}px, 0)`;
        stage.dataset.spotlightReady = "true";
      };

      const move = (next: SpotlightLayout, animate: boolean) => {
        if (destination && JSON.stringify(destination) === JSON.stringify(next)) return;
        destination = next;
        cancelAnimationFrame(motionFrame);
        const from = painted.current;
        if (!from || !animate || motionPreference.matches) {
          paint(next);
          delete stage.dataset.spotlightMoving;
          return;
        }
        const started = performance.now();
        stage.dataset.spotlightMoving = "true";
        const tick = (now: number) => {
          const progress = Math.min(1, (now - started) / 300);
          const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
          paint(interpolateSpotlight(from, next, eased));
          if (progress < 1) motionFrame = requestAnimationFrame(tick);
          else delete stage.dataset.spotlightMoving;
        };
        motionFrame = requestAnimationFrame(tick);
      };

      const clearTarget = () => {
        if (!target) return;
        resizeObserver.unobserve(target);
        if (previousMarker === null) target.removeAttribute("data-demo-guide-active");
        else target.setAttribute("data-demo-guide-active", previousMarker);
        target = null;
      };

      const measure = () => {
        frame = 0;
        if (!active || loading) return;
        const found = Array.from(document.querySelectorAll<HTMLElement>(step.target)).find(
          (element) => {
            const bounds = element.getBoundingClientRect();
            return (
              bounds.width > 0 &&
              bounds.height > 0 &&
              getComputedStyle(element).visibility !== "hidden" &&
              !element.closest("[inert], [hidden], details:not([open])")
            );
          },
        );
        if (!found) {
          cancelAnimationFrame(motionFrame);
          destination = null;
          clearTarget();
          setReadyStep(null);
          delete stage.dataset.spotlightReady;
          delete stage.dataset.spotlightMoving;
          return;
        }
        const changed = found !== target;
        const headerBottom = Math.max(
          0,
          document.querySelector<HTMLElement>("[data-demo-obstruction]")?.getBoundingClientRect()
            .bottom ?? 0,
        );
        if (changed) {
          clearTarget();
          target = found;
          previousMarker = target.getAttribute("data-demo-guide-active");
          target.setAttribute("data-demo-guide-active", step.id);
          resizeObserver.observe(target);
          // Read the actual sticky header height; no breakpoint-specific scroll offsets.
          const previousScrollMargin = target.style.scrollMarginTop;
          target.style.scrollMarginTop = `${headerBottom + 24}px`;
          target.scrollIntoView({ block: "start", inline: "nearest", behavior: "instant" });
          target.style.scrollMarginTop = previousScrollMargin;
        }
        const bounds = found.getBoundingClientRect();
        const viewport = window.visualViewport;
        panel.style.maxWidth = `${Math.max(0, (viewport?.width ?? innerWidth) - 24)}px`;
        panel.style.maxHeight = `${Math.max(0, (viewport?.height ?? innerHeight) - Math.max(0, headerBottom - (viewport?.offsetTop ?? 0)) - 24)}px`;
        move(
          placeDemoSpotlight(
            { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
            {
              width: viewport?.width ?? innerWidth,
              height: viewport?.height ?? innerHeight,
              offsetLeft: viewport?.offsetLeft ?? 0,
              offsetTop: viewport?.offsetTop ?? 0,
            },
            { width: panel.offsetWidth, height: panel.offsetHeight },
            headerBottom,
          ),
          changed || stage.dataset.spotlightMoving === "true",
        );
        setReadyStep(step.id);
        if (!focused) {
          panel.querySelector<HTMLElement>("[data-guide-heading]")?.focus({ preventScroll: true });
          focused = true;
        }
      };
      const scheduleMeasure = () => {
        if (!frame) frame = requestAnimationFrame(measure);
      };
      const resizeObserver = new ResizeObserver(scheduleMeasure);
      resizeObserver.observe(panel);
      resizeObserver.observe(document.body);
      const header = document.querySelector("[data-demo-obstruction]");
      if (header) resizeObserver.observe(header);
      const observer = new MutationObserver((records) => {
        if (records.some((record) => !stage.contains(record.target))) scheduleMeasure();
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: [
          "class",
          "style",
          "hidden",
          "inert",
          "open",
          "data-view",
          "data-focused",
          "data-demo-target",
          "data-demo-obstruction",
        ],
      });
      // Size observers alone miss transforms and sibling reflow in fixed-height layouts.
      // Sample only two bounds while visible; unchanged frames do no DOM writes or React work.
      const trackBounds = () => {
        if (!active || document.hidden) return;
        if (target && !loading) {
          const box = target.getBoundingClientRect();
          const headerBox = header?.getBoundingClientRect();
          const signature = `${target.isConnected}:${box.x}:${box.y}:${box.width}:${box.height}:${headerBox?.bottom}`;
          if (signature !== lastBounds) {
            lastBounds = signature;
            scheduleMeasure();
          }
        }
        trackingFrame = requestAnimationFrame(trackBounds);
      };
      const onVisibilityChange = () => {
        cancelAnimationFrame(trackingFrame);
        if (!document.hidden) {
          scheduleMeasure();
          trackBounds();
        }
      };
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          event.preventDefault();
          panel.querySelector<HTMLButtonElement>("[data-guide-close]")?.click();
        }
      };
      const onMotionChange = () => {
        destination = null;
        scheduleMeasure();
      };
      document.addEventListener("keydown", onKeyDown);
      document.addEventListener("visibilitychange", onVisibilityChange);
      document.addEventListener("scroll", scheduleMeasure, true);
      document.addEventListener("load", scheduleMeasure, true);
      window.addEventListener("resize", scheduleMeasure);
      window.visualViewport?.addEventListener("resize", scheduleMeasure);
      window.visualViewport?.addEventListener("scroll", scheduleMeasure);
      motionPreference.addEventListener("change", onMotionChange);
      void document.fonts.ready.then(() => {
        if (active) scheduleMeasure();
      });
      scheduleMeasure();
      trackBounds();

      return () => {
        active = false;
        observer.disconnect();
        resizeObserver.disconnect();
        cancelAnimationFrame(frame);
        cancelAnimationFrame(motionFrame);
        cancelAnimationFrame(trackingFrame);
        delete stage.dataset.spotlightMoving;
        document.removeEventListener("keydown", onKeyDown);
        document.removeEventListener("visibilitychange", onVisibilityChange);
        document.removeEventListener("scroll", scheduleMeasure, true);
        document.removeEventListener("load", scheduleMeasure, true);
        window.removeEventListener("resize", scheduleMeasure);
        window.visualViewport?.removeEventListener("resize", scheduleMeasure);
        window.visualViewport?.removeEventListener("scroll", scheduleMeasure);
        motionPreference.removeEventListener("change", onMotionChange);
        clearTarget();
      };
    },
    [loading, step.id, step.target],
  );
  const isLastStep = currentStep === steps.length - 1;
  const waiting = loading || readyStep !== step.id;
  const cannotNavigate = disabled || waiting;

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="bh-demo-stage">
      <div
        className="bh-demo-spotlight-veil"
        style={{ clipPath: `url(#${clipId})` }}
        aria-hidden="true"
      />
      <svg className="bh-demo-spotlight-art" aria-hidden="true">
        <defs>
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            <path data-spotlight-mask clipRule="evenodd" />
          </clipPath>
        </defs>
        <rect data-spotlight-halo className="bh-demo-spotlight-haze" />
        <rect data-spotlight-halo className="bh-demo-spotlight-glow" />
        <line data-spotlight-connector className="bh-demo-spotlight-connector" />
      </svg>
      <section
        ref={attachGuide}
        className="bh-demo-guide bh-eink bh-cutout"
        data-testid="demo-walkthrough"
        aria-label="Demo walkthrough"
        aria-describedby={descriptionId}
        aria-busy={loading}
      >
        <div className="bh-demo-guide-header">
          <p>Recorded run · demo guide</p>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close demo guide"
            data-guide-close
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </Button>
        </div>

        <div className="bh-demo-guide-copy" key={step.id} aria-live="polite" aria-atomic="true">
          <h2 id={titleId} tabIndex={-1} data-guide-heading>
            {step.title}
          </h2>
          <p id={descriptionId}>{step.description}</p>
        </div>

        <ol className="bh-demo-guide-progress" aria-label="Demo steps">
          {steps.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                aria-label={`Step ${index + 1}: ${item.title}`}
                aria-current={index === currentStep ? "step" : undefined}
                disabled={disabled || loading}
                onClick={() => onStepChange(index)}
              >
                <span />
              </button>
            </li>
          ))}
        </ol>

        <div className="bh-demo-guide-actions">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={currentStep === 0 || disabled || loading}
            onClick={() => onStepChange(currentStep - 1)}
          >
            <ArrowLeft aria-hidden="true" />
            Back
          </Button>
          <output className="bh-demo-guide-step-count">
            {waiting ? "Loading evidence…" : `${currentStep + 1} / ${steps.length}`}
          </output>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={cannotNavigate}
            onClick={() => (isLastStep ? onClose() : onStepChange(currentStep + 1))}
          >
            {isLastStep ? "Finish" : "Next"}
            {isLastStep ? <Check aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
          </Button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
