import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Loader2,
  Crown,
  ShieldCheck,
  ShoppingBag,
  ReceiptCent,
  ChefHat,
  MessageSquareHeart,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usernameToEmail } from "@/lib/username";
import { DelishLogo } from "@/components/delish/DelishLogo";
import { BackgroundCurves } from "@/components/delish/BackgroundCurves";

export const Route = createFileRoute("/auth")({
  validateSearch: (search) => {
    const raw = (search as { role?: unknown }).role;
    return raw && typeof raw === "string" ? { role: raw } : {};
  },
  head: () => ({
    meta: [
      { title: "دخول الموظفين | Delish Staff Sign In" },
      { name: "description", content: "تسجيل دخول فريق عمل ديليش للوصول إلى البوابات الداخلية." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "دخول الموظفين | Delish Staff Sign In" },
      { property: "og:description", content: "Delish staff portal sign in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type StaffRole = "admin" | "sales" | "kitchen" | "social";

interface PortalMeta {
  role: StaffRole | "staff";
  titleAr: string;
  titleEn: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  iconLabel: string;
  description: string;
}

function portalMeta(roleHint?: string): PortalMeta {
  switch (roleHint) {
    case "admin":
      return {
        role: "admin",
        titleAr: "لوحة التحكم الإدارية",
        titleEn: "Admin Portal",
        subtitle: "وصول محصور للمدراء · Management access only",
        icon: Crown,
        iconLabel: "Crown icon",
        description: "Delish admin portal sign in.",
      };
    case "sales":
      return {
        role: "sales",
        titleAr: "بوابة المبيعات المباشرة",
        titleEn: "Sales Portal",
        subtitle: "إدارة الطلبات والفواتير · Orders & billing",
        icon: ShoppingBag,
        iconLabel: "Shopping bag icon",
        description: "Delish sales portal sign in.",
      };
    case "kitchen":
      return {
        role: "kitchen",
        titleAr: "شاشة المطبخ والتجهيز",
        titleEn: "Kitchen Display",
        subtitle: "تتبع التحضير والجاهزية · Prep & readiness",
        icon: ChefHat,
        iconLabel: "Chef hat icon",
        description: "Delish kitchen display sign in.",
      };
    case "social":
      return {
        role: "social",
        titleAr: "بوابة طلبات السوشيال ميديا",
        titleEn: "Social Media Portal",
        subtitle: "استقبال طلبات المنصات · Social order intake",
        icon: MessageSquareHeart,
        iconLabel: "Message heart icon",
        description: "Delish social media portal sign in.",
      };
    default:
      return {
        role: "staff",
        titleAr: "دخول الموظفين",
        titleEn: "Staff Sign In",
        subtitle: "تسجيل الدخول لفريق العمل · Team access",
        icon: ShieldCheck,
        iconLabel: "Shield check icon",
        description: "Delish staff sign in.",
      };
  }
}

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
  const search = useSearch({ from: "/auth" });
  const portal = portalMeta(search.role);
  const Icon = portal.icon;

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
    <main dir="rtl" className="relative grid min-h-dvh place-items-center overflow-hidden bg-[#F9FBFC] px-4 py-10">
      <BackgroundCurves />
      <div className="relative z-10 w-full max-w-sm rounded-3xl border border-[#B8860B]/20 bg-white p-7 shadow-[var(--shadow-soft)]">
        <div className="flex flex-col items-center text-center">
          <DelishLogo size="md" />

          <div
            className="mb-3 mt-5 flex h-16 w-16 items-center justify-center rounded-full border border-[#B8860B]/20 bg-[#FDE2CF] p-4 text-[#B8860B] shadow-md"
            aria-label={portal.iconLabel}
          >
            <Icon className="h-8 w-8" />
          </div>

          <div className="max-w-[16rem]">
            <h1 className="font-display text-balance text-lg font-bold leading-snug text-[#3E2723] sm:text-xl">
              {portal.titleAr} <span className="text-[#B8860B]">|</span> {portal.titleEn}
            </h1>
            <p className="mt-1 text-xs text-[#8B4513]/80">{portal.subtitle}</p>
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

          {error && (
            <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-xs font-bold text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#8B4513] px-5 text-sm font-bold text-white shadow-sm transition-all hover:scale-[1.02] hover:bg-[#7B3F00] active:scale-[0.98] disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            تسجيل الدخول · Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
