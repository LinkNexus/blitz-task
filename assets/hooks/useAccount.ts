import {useAppStore} from "@/lib/store.ts";

export function useAccount() {
  const user = useAppStore(state => state.user);
  const setUser = useAppStore.getState().setUser;

  if (!user) {
    throw new Error("User not found");
  }

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
