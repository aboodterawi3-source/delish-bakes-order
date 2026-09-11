import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usernameToEmail } from "@/lib/username";

export const Route = createFileRoute("/social-login")({
  head: () => ({
    meta: [
      { title: "دخول فريق السوشال | Delish Social Login" },
      { name: "description", content: "تسجيل دخول فريق السوشال ميديا لإدخال طلبات ديليش فوراً." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "دخول فريق السوشال | Delish Social Login" },
      { property: "og:description", content: "Social media team sign in for the Delish order portal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  ssr: false,
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
      if (data.user) void navigate({ to: "/social-portal", replace: true });
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
    void navigate({ to: "/social-portal", replace: true });
  };

  return (
    <main dir="rtl" className="grid min-h-dvh place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">دخول فريق السوشال</h1>
            <p className="text-xs text-muted-foreground">
              <span className="delish-wordmark">Delish</span> Social Portal
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm font-bold text-foreground">
            اسم المستخدم · Name
            <input
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-1 min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
            />
          </label>
          <label className="block text-sm font-bold text-foreground">
            كلمة المرور · Password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
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
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            تسجيل الدخول · Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
