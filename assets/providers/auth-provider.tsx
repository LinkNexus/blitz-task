import { apiFetch } from "@/lib/api-fetch";
import type { User } from "@/types";
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

const AuthContext = createContext<AuthProviderState | null>(null);

type Authstatus = "authenticated" | "unauthenticated" | "unknown";

type AuthProviderState = {
  status: Authstatus;
  user: User | null | undefined;
  setUser: (user: User | null) => void;
  authenticate: () => void;
  logout: () => void;
};

const AuthProvider = memo(function ({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>();

  let status: Authstatus;

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

  const authenticate = useCallback(
    function () {
      fetch("/api/csrf-token").then(() => {
        apiFetch<User>("/api/me")
          .then(setUser)
          .catch(() => {
            setUser(null);
          });
      });
    },
    [user, setUser],
  );

  const logout = useCallback(
    function () {
      fetch("/api/logout")
        .then(() => fetch("/api/csrf-token"))
        .finally(() => setUser(null));
    },
    [setUser],
  );

  return (
    <AuthContext.Provider
      value={{ user, setUser, status, authenticate, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
});

function useAuth() {
  const context = useContext(AuthContext);

  if (context === null) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}

export { AuthProvider, useAuth };
