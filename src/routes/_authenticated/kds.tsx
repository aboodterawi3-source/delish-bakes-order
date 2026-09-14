import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/kds")({
  beforeLoad: () => {
    throw redirect({ to: "/staff", search: { tab: "kitchen" as const } });
  },
});
