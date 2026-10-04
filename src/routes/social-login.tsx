import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/social-login")({
  beforeLoad: () => {
    throw redirect({
      to: "/auth",
      search: { role: "social" },
      replace: true,
    });
  },
  component: () => null,
});
