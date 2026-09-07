import { useSyncExternalStore } from "react";
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
function subscribe(listener: () => void) {
  listeners.add(listener);
  timer ??= setInterval(() => listeners.forEach((fn) => fn()), 60_000);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}
const snapshot = () => Math.floor(Date.now() / 60_000) * 60_000;
const serverSnapshot = () => 0;
export function useClock() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
