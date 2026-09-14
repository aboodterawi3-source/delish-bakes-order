import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/social-portal")({
  beforeLoad: () => {
    throw redirect({ to: "/staff", search: { tab: "social" as const } });
  },
});
