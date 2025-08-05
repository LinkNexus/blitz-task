import {create} from "zustand/react";
import {combine, persist} from "zustand/middleware";
import type {User} from "@/types.ts";

export const useAppStore = create(
    persist(
        combine(
            {
                user: undefined as User | null | undefined,
                sidebarState: "open" as "open" | "closed"
            },
            (set) => ({
                setUser: (user: User | null) => set({user}),
                toggleSidebar: () => set(state => ({sidebarState: state.sidebarState === "open" ? "closed" : "open"})),
            })
        ), {
            name: "app-store",
            partialize: (state) => ({
                user: state.user,
                sidebarState: state.sidebarState
            })
        }
    )
)
