import {create} from "zustand/react";
import {combine, persist} from "zustand/middleware";
import type {Team, User} from "@/types.ts";
import type {Theme} from "@/components/custom/theme-provider.tsx";

export const useAppStore = create(
  persist(
    combine(
      {
        user: undefined as User | null | undefined,
        sidebarState: "open" as "open" | "closed",
        theme: "system" as Theme,

        teams: {
          data: [] as Team[],
          fetched: false,
          activeTeam: null as Team|null
        }
      },
      (set) => ({
        setUser: (user: User | null) => set({user}),
        toggleSidebar: () => set(state => ({sidebarState: state.sidebarState === "open" ? "closed" : "open"})),
        setTheme: (theme: Theme) => set({theme}),

        setTeams(teams: Team[]) {
          set({
            teams: {
              data: teams,
              fetched: true,
              activeTeam: teams.find(t => t.isDefault)!
            }
          })
        },
        setActiveTeam(teamId: number) {
          set(state => ({
            teams: {
              ...state.teams,
              activeTeam: state.teams.data.find(t => t.id === teamId)!
            }
          }))
        }
      })
    ), {
      name: "app-store",
      partialize: (state) => ({
        sidebarState: state.sidebarState,
        theme: state.theme,
      })
    }
  )
)
