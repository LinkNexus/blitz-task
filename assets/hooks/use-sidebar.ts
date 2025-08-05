import {useAppStore} from "@/lib/store.ts";

export function useSidebar() {
  const sidebarState = useAppStore((state) => state.sidebarState);
  const toggleSidebar = useAppStore.getState().toggleSidebar;

  return {
    sidebarState,
    toggleSidebar,
  }
}
