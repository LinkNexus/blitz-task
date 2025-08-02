import {create} from "zustand/react";
import {combine} from "zustand/middleware";
import type {User} from "@/types.ts";

export const useAppStore = create(
  combine(
    {
      user: window["__blitz_task_user"]
    },
    (set) => ({
      setUser: (user: User|null) => set({ user })
    })
  )
)
