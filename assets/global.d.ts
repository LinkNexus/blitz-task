import type { User } from "./types"

declare global {
  interface Window {
    "__blitz_task_user": User|null
  }
}
