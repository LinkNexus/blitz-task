import { useEffect } from "react";
import { useAppStore } from "./use-store";

export function useTheme() {
  const theme = useAppStore.use.theme();

  useEffect(
    function () {
      const root = window.document.documentElement;
      root.classList.remove("light", "dark");

      if (theme === "system") {
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
          .matches
          ? "dark"
          : "light";

        root.classList.add(systemTheme);
      } else root.classList.add(theme);
    },
    [theme],
  );
}
