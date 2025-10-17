import { useAppStore } from "./use-app-store";
import { apiFetch } from "@/lib/api-fetch";
import type { User } from "@/types";

export function useAuth() {
  const user = useAppStore((state) => state.user);
  const setUser = useAppStore((state) => state.setUser);

  let status: "authenticated" | "unauthenticated" | "unknown" = "unknown";

  switch (user) {
    case null:
      status = "unauthenticated";
      break;
    case undefined:
      status = "unknown";
      break;
    default:
      status = "authenticated";
      break;
  }

  return {
    user,
    status,
    authenticate() {
      fetch("/api/csrf-token").then(() => {
        apiFetch<User>("/api/me")
          .then(setUser)
          .catch(() => {
            setUser(null);
          });
      });
    },
  };
}
