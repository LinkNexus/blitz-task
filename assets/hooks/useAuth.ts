import {useAppStore} from "@/lib/store.ts";
import {apiFetch} from "@/lib/fetch.ts";
import type {User} from "@/types.ts";

export function useAuth() {
  const {lastRequestedUrl, user, setLastRequestedUrl, setUser} = useAppStore(state => state);

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
    user,
    status,
    authenticate() {
      apiFetch<User>("/api/auth/me")
        .then(setUser)
        .catch(() => setUser(null));
    },
    logout() {
      apiFetch("/api/auth/logout")
        .then(() => setUser(null));
    },
    lastRequestedUrl,
    setLastRequestedUrl
  }
}
