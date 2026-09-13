import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    throw redirect({ to: "/auth" });
  },
  head: () => ({
    meta: [
      { title: "دخول الموظفين | Delish Jordan" },
      { name: "description", content: "تسجيل دخول فريق Delish Jordan." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "دخول الموظفين | Delish Jordan" },
      { property: "og:description", content: "Delish Jordan staff sign in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});