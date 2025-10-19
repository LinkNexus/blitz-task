import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type Theme = "dark" | "light" | "system";

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

type ThemeProviderProps = {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

const ThemeContext = createContext<ThemeProviderState | null>(null);

function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "theme",
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    (function () {
      const theme = localStorage.getItem(storageKey) as Theme | null;
      return theme ?? defaultTheme;
    })(),
  );

  useEffect(
    function () {
      const root = window.document.documentElement;
      root.classList.remove("light", "dark");
      localStorage.setItem(storageKey, theme);

      if (theme === "system") {
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
          .matches
          ? "dark"
          : "light";

        root.classList.add(systemTheme);
        return;
      }

      root.classList.add(theme);
    },
    [theme],
  );

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

function useTheme() {
  const context = useContext(ThemeContext);
  if (context === null)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
}

export { ThemeProvider, useTheme, type Theme };
