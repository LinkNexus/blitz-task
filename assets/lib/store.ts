import {create} from "zustand/react";
import {combine, persist} from "zustand/middleware";
import type {Project, Team, User} from "@/types.ts";
import type {Theme} from "@/components/custom/theme-provider.tsx";

export const useAppStore = create(
  persist(
    combine(
      {
        user: undefined as User | null | undefined,
        sidebarState: "open" as "open" | "closed",
        theme: "system" as Theme,
        defaultTeam: null as Team | null,
        activeTeamId: null as number | null,
        activeProjectId: null as number | null,
        teams: [] as Team[],
      },
      (set) => ({
        setUser: (user: User | null) => set({user}),
        toggleSidebar: () => set(state => ({sidebarState: state.sidebarState === "open" ? "closed" : "open"})),
        setTheme: (theme: Theme) => set({theme}),
        setActiveTeamId: (teamId: number) => set({activeTeamId: teamId}),
        setActiveProjectId: (projectId: number) => set({activeProjectId: projectId}),
        setTeams: (teams: Team[]) => set({teams}),
        setProjects: (teamId: number, projects: Project[]) => set(state => {
          return {
            teams: state.teams.map(t => {
              if (t.id === teamId) {
                return {
                  ...t,
                  projects
                }
              }
              return t;
            })
          }
        }),
        addProject(teamId: number, project: Project) {
          set(state => {
            return {
              teams: state.teams.map(t => {
                if (t.id === teamId) {
                  if (t.projects?.some(p => p.id === project.id)) {
                    return t;
                  }

                  return {
                    ...t,
                    projects: [...(t.projects || []), project]
                  }
                }
                return t;
              })
            }
          })
        }
      })
    ), {
      name: "app-store",
      partialize: (state) => ({
        sidebarState: state.sidebarState,
        theme: state.theme
      })
    }
  )
)
