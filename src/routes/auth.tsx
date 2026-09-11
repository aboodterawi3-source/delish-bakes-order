import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChefHat, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usernameToEmail } from "@/lib/username";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "دخول الموظفين | Delish Staff Sign In" },
      { name: "description", content: "تسجيل دخول موظفي مطبخ ديليش للوصول إلى شاشة التجهيز." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "دخول الموظفين | Delish Staff Sign In" },
      { property: "og:description", content: "Staff sign in for the Delish kitchen display." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  ssr: false,
  component: AuthPage,
});

/** Sends each signed-in staff member to the screen their role uses. */
async function landingPath(userId: string): Promise<"/kds" | "/sales" | "/admin"> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((row) => row.role as string);
  if (roles.includes("kitchen")) return "/kds";
  if (roles.includes("sales")) return "/sales";
  return "/admin";
}

function AuthPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      void navigate({ to: await landingPath(data.user.id), replace: true });
    });
  }, [navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
    setBusy(false);
    if (signInError || !data.user) {
      setError("بيانات الدخول غير صحيحة · Invalid name or password");
      return;
    }
    void navigate({ to: await landingPath(data.user.id), replace: true });
  };


  return (
    <main dir="rtl" className="grid min-h-dvh place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground">
            <ChefHat className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">دخول الموظفين</h1>
            <p className="text-xs text-muted-foreground">Delish Staff Sign In</p>
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

          {error && (
            <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-xs font-bold text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            تسجيل الدخول · Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
