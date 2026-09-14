import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/kitchen")({
  beforeLoad: () => {
    throw redirect({ to: "/staff", search: { tab: "kitchen" as const } });
  },
});
