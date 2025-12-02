import { useAppStore } from "./use-store";

export function useAccount() {
  const user = useAppStore.use.user();

  if (!user) throw new Error("The user must authenticated to use this hook");

  return {
    user,
  };
}
