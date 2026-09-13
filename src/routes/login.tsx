import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  validateSearch: (search) => {
    const raw = (search as { role?: unknown }).role;
    return raw && typeof raw === "string" ? { role: raw } : {};
  },
  beforeLoad: ({ search }) => {
    const role = (search as { role?: string }).role;
    throw redirect({ to: "/auth", search: role ? { role } : {} });
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