import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, MessageSquareHeart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usernameToEmail } from "@/lib/username";
import { DelishLogo } from "@/components/delish/DelishLogo";
import { BackgroundCurves } from "@/components/delish/BackgroundCurves";

export const Route = createFileRoute("/social-login")({
  head: () => ({
    meta: [
      { title: "بوابة طلبات السوشيال ميديا | Delish Social Media Portal" },
      { name: "description", content: "تسجيل دخول فريق السوشال ميديا لإدخال طلبات ديليش فوراً." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "بوابة طلبات السوشيال ميديا | Delish Social Media Portal" },
      { property: "og:description", content: "Social media team sign in for the Delish order portal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SocialLoginPage,
});

function SocialLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) void navigate({ to: "/staff", search: { tab: "social" as const }, replace: true });
    });
  }, [navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
    setBusy(false);
    if (signInError) {
      setError("بيانات الدخول غير صحيحة · Invalid name or password");
      return;
    }
    void navigate({ to: "/staff", search: { tab: "social" as const }, replace: true });
  };

  return (
    <main dir="rtl" className="relative grid min-h-dvh place-items-center overflow-hidden bg-[#F9FBFC] px-4 py-10">
      <BackgroundCurves />
      <div className="relative z-10 w-full max-w-sm rounded-3xl border border-[#B8860B]/20 bg-white p-7 shadow-[var(--shadow-soft)]">
        <div className="flex flex-col items-center text-center">
          <DelishLogo size="md" />

          <div
            className="mb-3 mt-5 flex h-16 w-16 items-center justify-center rounded-full border border-[#B8860B]/20 bg-[#FDE2CF] p-4 text-[#B8860B] shadow-md"
            aria-label="Message heart icon"
          >
            <MessageSquareHeart className="h-8 w-8" />
          </div>

          <div className="max-w-[16rem]">
            <h1 className="font-display text-balance text-lg font-bold leading-snug text-[#3E2723] sm:text-xl">
              بوابة طلبات السوشيال ميديا <span className="text-[#B8860B]">|</span> Social Media Portal
            </h1>
            <p className="mt-1 text-xs text-[#8B4513]/80">استقبال طلبات المنصات · Social order intake</p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm font-bold text-[#3E2723]">
            اسم المستخدم · Name
            <input
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-1 min-h-12 w-full rounded-xl border border-[#B8860B]/20 bg-[#F9FBFC] px-3 text-sm text-[#3E2723] placeholder:text-[#3E2723]/40 focus:border-[#B8860B] focus:outline-none focus:ring-2 focus:ring-[#B8860B]/20"
            />
          </label>
          <label className="block text-sm font-bold text-[#3E2723]">
            كلمة المرور · Password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 min-h-12 w-full rounded-xl border border-[#B8860B]/20 bg-[#F9FBFC] px-3 text-sm text-[#3E2723] placeholder:text-[#3E2723]/40 focus:border-[#B8860B] focus:outline-none focus:ring-2 focus:ring-[#B8860B]/20"
            />
          </label>

          {error ? (
            <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-bold text-destructive">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#8B4513] px-5 text-sm font-bold text-white shadow-sm transition-all hover:scale-[1.02] hover:bg-[#7B3F00] active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            تسجيل الدخول · Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
