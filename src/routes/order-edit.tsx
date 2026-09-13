import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy path: customer edit links now live at /edit-order. */
export const Route = createFileRoute("/order-edit")({
  beforeLoad: ({ location }) => {
    throw redirect({ href: `/edit-order${location.searchStr}` });
  },
  head: () => ({
    meta: [
      { title: "تعديل طلبك | مخبز ديليش" },
      { name: "description", content: "تحويل إلى صفحة تعديل موعد الطلب." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "تعديل طلبك | مخبز ديليش" },
      { property: "og:description", content: "تحويل إلى صفحة تعديل موعد الطلب." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
