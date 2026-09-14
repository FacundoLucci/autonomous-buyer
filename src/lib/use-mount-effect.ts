// This helper is reserved for one-time synchronization with external browser systems.
// eslint-disable-next-line no-restricted-imports
import { useEffect, useRef } from "react";
export function useMountEffect(setup: () => void | (() => void)) {
  const initial = useRef(setup);
  useEffect(() => initial.current(), []);
}
