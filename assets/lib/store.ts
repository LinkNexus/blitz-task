import type {Theme} from "@/components/custom/theme-provider.tsx";
import type {Project, Task, TaskColumn, Team, User} from "@/types.ts";
import {combine, persist} from "zustand/middleware";
import {create} from "zustand/react";

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
      (set, get) => ({
        setUser: (user: User | null) => set({user}),
        toggleSidebar: () =>
          set((state) => ({
            sidebarState: state.sidebarState === "open" ? "closed" : "open",
          })),
        setTheme: (theme: Theme) => set({theme}),
        setLastRequestedUrl: (url: string) => set({lastRequestedUrl: url}),
        setActiveTeamId: (teamId: number) => set({activeTeamId: teamId}),
        setActiveProjectId: (projectId: number) =>
          set({activeProjectId: projectId}),
        setTeams: (teams: Team[]) => set({teams}),
        getActiveTeam() {
          return get().teams
            .find((t) => t.id === get().activeTeamId);
        },
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
        updateColumn(column: TaskColumn) {
          set(state => ({
            teams: state.teams.map(t => ({
              ...t,
              projects: t.projects?.map(p => {
                if (p.columns?.some(c => c.id === column.id)) {
                  return {
                    ...p,
                    columns: p.columns?.map(c => {
                      if (c.id === column.id) {
                        return column;
                      }
                      return c;
                    })
                  }
                }
                return p;
              })
            }))
          }))
        },
        deleteColumn(colId: number) {
          set(state => ({
            teams: state.teams.map(t => ({
              ...t,
              projects: t.projects?.map(p => {
                if (p.columns?.some(c => c.id === colId)) {
                  return {
                    ...p,
                    columns: p.columns?.filter(c => c.id !== colId)
                  }
                }
                return p;
              })
            }))
          }))
        },
        getTask(taskId: number) {
          return get().teams
            ?.flatMap(t => t.projects)
            .flatMap(p => p?.columns)
            .flatMap(p => p?.tasks)
            .find(t => t?.id === taskId);
        },
        addTask(columnId: number, task: Task) {
          set((state) => {
            return {
              teams: state.teams.map((t) => ({
                ...t,
                projects: t.projects?.map((p) => ({
                  ...p,
                  columns: p.columns?.map((c) => {
                    if (
                      c.id === columnId &&
                      !c.tasks.some((t) => t.id === task.id)
                    ) {
                      return {
                        ...c,
                        tasks: [...c.tasks, task],
                      };
                    }
                    return c;
                  }),
                })),
              })),
            };
          });
        },
        updateTask(updatedTask: Task) {
          set((state) => ({
            teams: state.teams.map((t) => ({
              ...t,
              projects: t.projects?.map((p) => ({
                ...p,
                columns: p.columns?.map((c) => {
                  if (c.tasks.some((t) => t.id === updatedTask.id)) {
                    return {
                      ...c,
                      tasks: c.tasks.map((t) => {
                        if (t.id === updatedTask.id) {
                          return updatedTask;
                        }
                        return t;
                      }),
                    };
                  }
                  return c;
                }),
              })),
            })),
          }));
        },
        deleteTask(taskId: number) {
          set(state => ({
            teams: state.teams.map(t => ({
              ...t,
              projects: t.projects?.map(p => ({
                ...p,
                columns: p.columns?.map(c => {
                  if (c.tasks.some(t => t.id === taskId)) {
                    return {
                      ...c,
                      tasks: c.tasks.filter(t => t.id !== taskId)
                    }
                  }
                  return c;
                })
              }))
            }))
          }))
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
        moveTaskBetweenColumns: (
          projectId: number,
          taskId: number,
          sourceColumnId: number,
          targetColumnId: number,
          newScore: number
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
                                    {...taskToMove, score: newScore},
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
          newScore: number
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
                                    ? {...task, score: newScore}
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
