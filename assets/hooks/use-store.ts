import type { Project, User } from "@/types";
import { create, type StoreApi, type UseBoundStore } from "zustand";
import { combine, persist } from "zustand/middleware";

type WithSelectors<S> = S extends { getState: () => infer T }
  ? S & { use: { [K in keyof T]: () => T[K] } }
  : never;

export const createSelectors = <S extends UseBoundStore<StoreApi<object>>>(
  _store: S,
) => {
  let store = _store as WithSelectors<typeof _store>;
  store.use = {};
  for (let k of Object.keys(store.getState())) {
    (store.use as any)[k] = () => store((s) => s[k as keyof typeof s]);
  }

  return store;
};

type Theme = "light" | "dark" | "system";

export const useAppStore = createSelectors(
  create(
    persist(
      combine(
        {
          user: undefined as User | null | undefined,
          theme: "system" as Theme,
          sidebarCollapsed: false,
        },
        function (set) {
          return {
            setUser: (user: User | null) => set({ user }),
            setTheme: (theme: Theme) => set({ theme }),
            setSidebarCollapsed: (collapsed: boolean) =>
              set({ sidebarCollapsed: collapsed }),
          };
        },
      ),
      {
        name: "app-store",
        partialize(state) {
          return {
            theme: state.theme,
          };
        },
      },
    ),
  ),
);
