import {useAppStore} from "@/lib/store.ts";
import {apiFetch} from "@/lib/fetch.ts";

export function useAccount() {
  const user = useAppStore(state => state.user);
  const setUser = useAppStore.getState().setUser;

  return {
    user,
    logout() {
      apiFetch("/api/auth/logout")
        .then(() => setUser(null));
    }
  }
}
