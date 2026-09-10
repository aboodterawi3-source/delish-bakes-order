import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Preload staff pages on hover/focus so switching screens feels instant,
    // and keep the previous screen visible instead of flashing a spinner.
    defaultPreload: "intent",
    defaultPreloadDelay: 40,
    defaultPreloadStaleTime: 0,
    defaultPendingMs: 800,
    defaultPendingMinMs: 200,
  });

  return router;
};
