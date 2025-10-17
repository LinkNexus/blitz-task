import type { Theme } from "@/components/theme-provider";
import type { User } from "@/types";
import { create } from "zustand";
import { combine, persist } from "zustand/middleware";

export const useAppStore = create(
  persist(
    combine(
      {
        user: undefined as User | null | undefined,
        theme: "system" as Theme,
        lastRequestedPath: null as string | null,
        sidebarState: "expanded" as "collapsed" | "expanded",
      },
      (set) => ({
        setUser: (user: User | null) => set({ user }),

        setTheme: (theme: Theme) => set({ theme }),

        setLastRequestedPath: (path: string | null) =>
          set({ lastRequestedPath: path }),

        toggleSidebar: () => {
          set((state) => ({
            sidebarState:
              state.sidebarState === "collapsed" ? "expanded" : "collapsed",
          }));
        },
      }),
    ),
    {
      name: "app-store",
      partialize: (state) => ({
        sidebarState: state.sidebarState,
        theme: state.theme,
        lastRequestedPath: state.lastRequestedPath,
      }),
    },
  ),
);
