import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Wipe/clean orders operations are strictly restricted to authenticated admins
 * and managed through the Store Operations (Danger Zone) tab inside AdminPanel.
 */
export const Route = createFileRoute("/_authenticated/clean-orders")({
  beforeLoad: () => {
    throw redirect({
      to: "/staff",
      search: { tab: "admin" },
      replace: true,
    });
  },
  component: () => null,
});
