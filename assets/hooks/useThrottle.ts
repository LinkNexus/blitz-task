import {useRef} from "react";

export function useThrottle<T extends Function>(callback: T, delay: number = 500) {
  const lastExecuted = useRef(Date.now());
  return ((...args: any[]) => {
    const now = Date.now();
    if (now - lastExecuted.current >= delay) {
      callback(...args);
      lastExecuted.current = now;
    }
  }) as unknown as T;
}
