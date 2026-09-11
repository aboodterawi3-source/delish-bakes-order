import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { bootstrapAdmin, getAdminSetupState } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { usernameToEmail } from "@/lib/username";

export const Route = createFileRoute("/admin-setup")({
  head: () => ({
    meta: [
      { title: "تهيئة حساب المدير | Delish Admin Setup" },
      { name: "description", content: "إنشاء حساب المدير الأول لإدارة متجر ديليش والموظفين والطلبات." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "تهيئة حساب المدير | Delish Admin Setup" },
      { property: "og:description", content: "One-time setup for the first Delish admin account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  ssr: false,
  component: AdminSetupPage,
});

function AdminSetupPage() {
  const navigate = useNavigate();
  const checkState = useServerFn(getAdminSetupState);
  const create = useServerFn(bootstrapAdmin);
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void checkState().then((state) => setNeedsSetup(state.needsSetup));
  }, [checkState]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await create({ data: { username, password, token } });
      await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
      void navigate({ to: "/admin", replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذّر إنشاء الحساب · Could not create the account");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main dir="rtl" className="grid min-h-dvh place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">تهيئة حساب المدير</h1>
            <p className="text-xs text-muted-foreground">One-time admin setup</p>
          </div>
        </div>

        {needsSetup === null && (
          <p className="mt-6 text-sm text-muted-foreground">جاري التحقق… · Checking…</p>
        )}

        {needsSetup === false && (
          <div className="mt-6 space-y-4">
            <p className="rounded-xl bg-muted p-3 text-sm font-bold text-foreground">
              تم إنشاء حساب المدير مسبقاً · An admin account already exists.
            </p>
            <button
              type="button"
              onClick={() => void navigate({ to: "/auth" })}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground"
            >
              تسجيل الدخول · Sign in
            </button>
          </div>
        )}

        {needsSetup === true && (
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
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
              />
            </label>
            <label className="block text-sm font-bold text-foreground">
              رمز التهيئة · Setup token
              <input
                type="password"
                required
                autoComplete="off"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                className="mt-1 min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
              />
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                الرمز محفوظ في إعدادات المتجر · Kept in your project secrets
              </span>
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
              إنشاء حساب المدير · Create admin
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
