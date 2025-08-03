import {useAppStore} from "@/lib/store.ts";

export function useAccount() {
  const user = useAppStore(state => state.user);
  const setUser = useAppStore.getState().setUser;

  return {
    user,
    verifyUser() {
      if (user) {
        setUser({
          ...user,
          isVerified: true
        });
      }
    }
  }
}
