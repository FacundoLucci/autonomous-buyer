import { gsap } from "gsap";

type AppWindow = Window & { renderMobile?: (time: number) => void; mobileReady?: Promise<void> };
type TimelineWindow = Window & { __timelines?: Record<string, gsap.core.Timeline> };
const frame = document.getElementById("mobile") as HTMLIFrameElement;
const stage = document.getElementById("stage")!;
const length = Number(stage.dataset.duration ?? 90);
const offset = Number(stage.dataset.offset ?? 0);
const position = { time: 0 };
const timeline = gsap.timeline({ paused: true });
timeline.to(position, {
  time: length,
  duration: length,
  ease: "none",
  onUpdate() {
    (frame.contentWindow as AppWindow | null)?.renderMobile?.(offset + position.time);
  },
});
(window as TimelineWindow).__timelines = { "mobile-app": timeline };
frame.addEventListener("load", async () => {
  const app = frame.contentWindow as AppWindow;
  await app.mobileReady;
  app.renderMobile?.(offset + position.time);
});
