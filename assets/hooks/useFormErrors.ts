import type { FormErrors } from "@/types.ts";
import { useEffect, useState } from "react";

export function useFormErrors(errors: FormErrors | null) {
  const [state, setState] = useState(errors);

  useEffect(() => {
    setState(errors);
  }, [errors]);

  return {
    hasErrors(key: string) {
      return state?.violations.some((v) => v.propertyPath === key);
    },
    getErrors(key: string) {
      return state?.violations.reduce((acc, v) => {
        if (v.propertyPath === key) {
          acc.push(v.title);
        }
        return acc;
      }, [] as string[]);
    },
    clearErrors(key: string) {
      setState((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          violations: prev.violations.filter((v) => v.propertyPath !== key),
        };
      });
    },
    clearAllErrors() {
      setState((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          violations: [],
        };
      });
    },
  };
}
