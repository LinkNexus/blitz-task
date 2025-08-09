import type { Theme } from "@/components/custom/theme-provider.tsx";
import type { Project, TaskColumn, Team, User } from "@/types.ts";
import { combine, persist } from "zustand/middleware";
import { create } from "zustand/react";

export const useAppStore = create(
  persist(
    combine(
      {
        user: undefined as User | null | undefined,
        sidebarState: "open" as "open" | "closed",
        theme: "system" as Theme,
        lastRequestedUrl: null as string | null,
        activeTeamId: null as number | null,
        activeProjectId: null as number | null,
        teams: [] as Team[],
      },
      (set) => ({
        setUser: (user: User | null) => set({ user }),
        toggleSidebar: () =>
          set((state) => ({
            sidebarState: state.sidebarState === "open" ? "closed" : "open",
          })),
        setTheme: (theme: Theme) => set({ theme }),
        setLastRequestedUrl: (url: string) => set({ lastRequestedUrl: url }),
        setActiveTeamId: (teamId: number) => set({ activeTeamId: teamId }),
        setActiveProjectId: (projectId: number) =>
          set({ activeProjectId: projectId }),
        setTeams: (teams: Team[]) => set({ teams }),
        setProjects: (teamId: number, projects: Project[]) =>
          set((state) => {
            return {
              teams: state.teams.map((t) => {
                if (t.id === teamId) {
                  return {
                    ...t,
                    projects,
                  };
                }
                return t;
              }),
            };
          }),
        addProject(teamId: number, project: Project) {
          set((state) => {
            return {
              teams: state.teams.map((t) => {
                if (t.id === teamId) {
                  if (t.projects?.some((p) => p.id === project.id)) {
                    return t;
                  }

                  return {
                    ...t,
                    projects: [...(t.projects || []), project],
                  };
                }
                return t;
              }),
            };
          });
        },
        addColumn(projectId: number, column: TaskColumn) {
          set((state) => {
            return {
              teams: state.teams.map((t) => {
                if (t.projects?.some((p) => p.id === projectId)) {
                  return {
                    ...t,
                    projects: t.projects.map((p) => {
                      if (p.id === projectId) {
                        // Check if column already exists to avoid duplicates
                        if (p.columns?.some((c) => c.id === column.id)) {
                          return p;
                        }
                        return {
                          ...p,
                          columns: [...(p.columns || []), column],
                        };
                      }
                      return p;
                    }),
                  };
                }
                return t;
              }),
            };
          });
        },
        setColumns(projectId: number, columns: TaskColumn[]) {
          set((state) => {
            return {
              teams: state.teams.map((t) => {
                if (t.projects?.some((p) => p.id === projectId)) {
                  return {
                    ...t,
                    projects: t.projects.map((p) => {
                      if (p.id === projectId) {
                        return {
                          ...p,
                          columns,
                        };
                      }
                      return p;
                    }),
                  };
                }
                return t;
              }),
            };
          });
        },
        // Helper function to normalize task positions in a column
        normalizeTaskPositions: (projectId: number, columnId: number) => {
          set((state) => {
            return {
              teams: state.teams.map((t) => {
                if (t.projects?.some((p) => p.id === projectId)) {
                  return {
                    ...t,
                    projects: t.projects.map((p) => {
                      if (p.id === projectId && p.columns) {
                        return {
                          ...p,
                          columns: p.columns.map((col) => {
                            if (col.id === columnId) {
                              const sortedTasks = [...col.tasks].sort(
                                (a, b) => a.position - b.position
                              );
                              return {
                                ...col,
                                tasks: sortedTasks.map((task, index) => ({
                                  ...task,
                                  position: index,
                                })),
                              };
                            }
                            return col;
                          }),
                        };
                      }
                      return p;
                    }),
                  };
                }
                return t;
              }),
            };
          });
        },
        moveTaskBetweenColumns: (
          projectId: number,
          taskId: number,
          sourceColumnId: number,
          targetColumnId: number,
          newPosition: number
        ) => {
          set((state) => {
            return {
              teams: state.teams.map((t) => {
                if (t.projects?.some((p) => p.id === projectId)) {
                  return {
                    ...t,
                    projects: t.projects.map((p) => {
                      if (p.id === projectId && p.columns) {
                        return {
                          ...p,
                          columns: p.columns.map((col) => {
                            if (col.id === sourceColumnId) {
                              // Remove task from source column
                              return {
                                ...col,
                                tasks: col.tasks.filter(
                                  (task) => task.id !== taskId
                                ),
                              };
                            } else if (col.id === targetColumnId) {
                              // Find the task from the original column and add to target
                              const sourceColumn = p.columns?.find(
                                (c) => c.id === sourceColumnId
                              );
                              const taskToMove = sourceColumn?.tasks.find(
                                (task) => task.id === taskId
                              );
                              if (taskToMove) {
                                return {
                                  ...col,
                                  tasks: [
                                    ...col.tasks,
                                    { ...taskToMove, position: newPosition },
                                  ],
                                };
                              }
                            }
                            return col;
                          }),
                        };
                      }
                      return p;
                    }),
                  };
                }
                return t;
              }),
            };
          });
        },
        reorderTaskInColumn(
          projectId: number,
          columnId: number,
          taskId: number,
          newPosition: number
        ) {
          set((state) => {
            return {
              teams: state.teams.map((t) => {
                if (t.projects?.some((p) => p.id === projectId)) {
                  return {
                    ...t,
                    projects: t.projects.map((p) => {
                      if (p.id === projectId && p.columns) {
                        return {
                          ...p,
                          columns: p.columns.map((col) => {
                            if (col.id === columnId) {
                              return {
                                ...col,
                                tasks: col.tasks.map((task) =>
                                  task.id === taskId
                                    ? { ...task, position: newPosition }
                                    : task
                                ),
                              };
                            }
                            return col;
                          }),
                        };
                      }
                      return p;
                    }),
                  };
                }
                return t;
              }),
            };
          });
        },
      })
    ),
    {
      name: "app-store",
      partialize: (state) => ({
        sidebarState: state.sidebarState,
        theme: state.theme,
      }),
    }
  )
);
