import { createFileRoute } from "@tanstack/react-router";
import { WelcomeView } from "@/components/delish/WelcomeView";

const TITLE = "DELISH Bakes | Luxury Bakery in Amman";
const DESCRIPTION = "Handcrafted celebration cakes, artisan pastries, and signature macarons from Delish Cake & Bake in Amman, Jordan.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "keywords", content: "Delish Jordan, custom cakes Amman, pastries Amman, luxury bakery Jordan, macarons" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <main className="min-h-dvh bg-background">
      <WelcomeView />
    </main>
  );
}
