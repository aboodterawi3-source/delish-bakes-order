import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/sales")({
  beforeLoad: () => {
    throw redirect({ to: "/staff", search: { tab: "sales" as const } });
  },
});
