import {useAppStore} from "@/lib/store.ts";
import {apiFetch} from "@/lib/fetch.ts";
import type {User} from "@/types.ts";

export function useAuth() {
  const user = useAppStore(state => state.user);
  const setUser = useAppStore.getState().setUser;

  let status: "authenticated" | "not-authenticated" | "unknown";

  switch (user) {
    case null:
      status = "not-authenticated"
      break;
    case undefined:
      status = "unknown";
      break;
    default:
      status = "authenticated";
  }

  return {
    status,
    authenticate() {
      apiFetch<User>("/api/auth/me")
        .then(setUser)
    },
    logout() {
      apiFetch("/api/auth/logout")
        .then(() => setUser(null));
    }
  }
}
