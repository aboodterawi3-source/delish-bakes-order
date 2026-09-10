import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ClipboardCopy, Loader2, LogOut, Send, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  createSocialOrder,
  getSocialAccess,
  getSocialProducts,
  type SocialOrderInput,
} from "@/lib/social.functions";

export const Route = createFileRoute("/social-portal")({
  head: () => ({
    meta: [
      { title: "بوابة السوشال ميديا | Delish Social Portal" },
      { name: "description", content: "إدخال طلبات ديليش من فريق السوشال ميديا فوراً إلى المبيعات والمطبخ." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "بوابة السوشال ميديا | Delish Social Portal" },
      { property: "og:description", content: "Social media order entry portal for Delish Cake & Bake." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirectToLogin();
  },
  component: SocialPortalPage;
});

function SocialPortalPage() {
  return null;
}
