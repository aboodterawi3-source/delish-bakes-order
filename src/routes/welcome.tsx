import { createFileRoute } from "@tanstack/react-router";
import { WelcomeView } from "@/components/delish/WelcomeView";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "DELISH Bakes | Small Joys, Baked Daily" },
      { name: "description", content: "Closer to love with every bite. Handcrafted luxury cakes and signature pastries in Amman, Jordan." },
      { property: "og:title", content: "DELISH Bakes | Small Joys, Baked Daily" },
      { property: "og:description", content: "Closer to love with every bite. Handcrafted luxury cakes and signature pastries in Amman, Jordan." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WelcomePage,
});

function WelcomePage() {
  return (
    <main className="min-h-dvh w-full bg-[#F9FBFC]">
      <WelcomeView />
    </main>
  );
}
