import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/kitchen")({
  beforeLoad: () => {
    throw redirect({ to: "/kds" });
  },
  head: () => ({
    meta: [
      { title: "المطبخ | Delish Jordan" },
      { name: "description", content: "واجهة مطبخ Delish Jordan الآمنة." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "المطبخ | Delish Jordan" },
      { property: "og:description", content: "Secure Delish Jordan kitchen display." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});