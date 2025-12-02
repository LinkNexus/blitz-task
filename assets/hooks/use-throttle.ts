import {useRef} from "react";

export function useThrottle<T extends Function>(fn: T, delayMs: number = 500) {
  const lastExecuted = useRef(Date.now());

  return ((...args: any[]) => {
    const now = Date.now();
    if (now - lastExecuted.current >= delayMs) {
      fn(...args);
      lastExecuted.current = now;
    }
  }) as unknown as T;
}
