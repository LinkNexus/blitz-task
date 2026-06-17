import { useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { getCurrentUserOptions } from "@/api/@tanstack/react-query.gen";

export const useAccount = () => {
  const routeContext = useRouteContext({ from: "__root__" });

  const { data: user, error } = useQuery({
    ...getCurrentUserOptions(),
    initialData: routeContext.user,
    staleTime: Infinity,
  });

  if (!user || error) throw error;

  return {
    user,
  };
};
