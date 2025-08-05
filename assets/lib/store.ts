import {create} from "zustand/react";
import {combine, persist} from "zustand/middleware";
import type {User} from "@/types.ts";
import type {Theme} from "@/components/custom/theme-provider.tsx";

export const useAppStore = create(
  persist(
    combine(
      {
        user: undefined as User | null | undefined,
        sidebarState: "open" as "open" | "closed",
        theme: "system" as Theme
      },
      (set) => ({
        setUser: (user: User | null) => set({user}),
        toggleSidebar: () => set(state => ({sidebarState: state.sidebarState === "open" ? "closed" : "open"})),
        setTheme: (theme: Theme) => set({theme})
      })
    ), {
      name: "app-store",
      partialize: (state) => ({
        user: state.user,
        sidebarState: state.sidebarState,
        theme: state.theme
      })
    }
  )
)
