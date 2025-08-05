import {create} from "zustand/react";
import {combine, persist} from "zustand/middleware";
import type {User} from "@/types.ts";

export const useAppStore = create(
    persist(
        combine(
            {
                user: undefined as User | null | undefined
            },
            (set) => ({
                setUser: (user: User | null) => set({user})
            })
        ), {
            name: "app-store",
            partialize: (state) => ({
                user: state.user
            })
        }
    )
)
