import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChefHat, Crown, History, Inbox, Loader2, LogOut, MessageSquareHeart, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPanel } from "@/components/staff/AdminPanel";
import { SalesPanel } from "@/components/staff/SalesPanel";
import { KitchenPanel } from "@/components/staff/KitchenPanel";
import { SocialPanel } from "@/components/staff/SocialPanel";
import { MessagesPanel } from "@/components/staff/MessagesPanel";
import { HistoryPanel } from "@/components/staff/HistoryPanel";

type StaffTab = "sales" | "kitchen" | "social" | "history" | "messages" | "admin";

const TABS: { value: StaffTab; ar: string; en: string; icon: typeof Crown; roles?: string[] }[] = [
  { value: "sales", ar: "المبيعات", en: "Sales", icon: ShoppingBag },
  { value: "kitchen", ar: "المطبخ", en: "Kitchen", icon: ChefHat },
  { value: "social", ar: "السوشال", en: "Social", icon: MessageSquareHeart },
  {
    value: "history",
    ar: "السجل",
    en: "History",
    icon: History,
    roles: ["sales", "social", "admin"],
  },
  {
    value: "messages",
    ar: "الرسائل",
    en: "Messages",
    icon: Inbox,
    roles: ["sales", "social", "admin"],
  },
  { value: "admin", ar: "الإدارة", en: "Admin", icon: Crown },
];

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({
    meta: [
      { title: "بوابة الموظفين | Delish Staff Portal" },
      {
        name: "description",
        content: "بوابة ديليش الموحدة للموظفين: المبيعات، المطبخ، السوشال ميديا والإدارة بحسب صلاحية كل حساب.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "بوابة الموظفين | Delish Staff Portal" },
      { property: "og:description", content: "Unified role-aware staff portal for Delish Cake & Bake." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search) => {
    const raw = (search as { tab?: unknown }).tab;
    const tab = TABS.find((item) => item.value === raw)?.value;
    return tab ? { tab } : {};
  },
  component: StaffPortalPage,
  errorComponent: StaffErrorScreen,
});

/** Any panel failure shows a readable message instead of a blank screen. */
function StaffErrorScreen({ error }: { error: unknown }) {
  const navigate = useNavigate();
  // A thrown non-Error (or undefined) must not crash the boundary itself.
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string" && error
        ? error
        : "خطأ غير معروف · Unknown error";
  const leave = async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  };
  return (
    <main dir="rtl" className="grid min-h-dvh place-items-center bg-[#F9FBFC] px-4">
      <div className="max-w-sm rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-lg">
        <h1 className="font-display text-lg font-bold text-[#3E2723]">تعذّر تحميل هذا القسم</h1>
        <p className="mt-2 text-sm text-[#7A6458]">This section could not be loaded.</p>
        <p className="mt-3 rounded-xl bg-slate-50 p-2 text-xs text-[#7A6458]">{error.message}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-bold text-[#5D2E17] hover:bg-slate-50"
          >
            إعادة المحاولة · Retry
          </button>
          <button
            type="button"
            onClick={() => void leave()}
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#8B4513] px-5 text-sm font-bold text-white shadow-sm hover:bg-[#5D2E17]"
          >
            تسجيل الخروج · Sign out
          </button>
        </div>
      </div>
    </main>
  );
}

function StaffPortalPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = useSearch({ from: "/_authenticated/staff" });

  const roles = useQuery({
    queryKey: ["staff", "roles"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getUser();
      if (!session.user) return [] as string[];
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => row.role as string);
    },
    staleTime: 60_000,
  });

  /** Only the panels this account is authorised for ever reach the tab bar. */
  const allowed = useMemo(() => {
    const list = roles.data ?? [];
    const isAdmin = list.includes("admin");
    return TABS.filter((tab) =>
      isAdmin || (tab.roles ? tab.roles.some((role) => list.includes(role)) : list.includes(tab.value)),
    );
  }, [roles.data]);

  const active = allowed.find((tab) => tab.value === search.tab)?.value ?? allowed[0]?.value;

  useEffect(() => {
    if (active && search.tab !== active) {
      void navigate({ to: "/staff", search: { tab: active }, replace: true });
    }
  }, [active, navigate, search.tab]);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  };

  if (roles.isPending) {
    return (
      <main dir="rtl" className="grid min-h-dvh place-items-center bg-[#F9FBFC]">
        <Loader2 className="h-6 w-6 animate-spin text-[#B8860B]" aria-label="جاري التحميل" />
      </main>
    );
  }

  if (!active) {
    return (
      <main dir="rtl" className="grid min-h-dvh place-items-center bg-[#F9FBFC] px-4">
        <div className="max-w-sm rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-lg">
          <h1 className="font-display text-lg font-bold text-[#3E2723]">لم يتم منح هذا الحساب أي صلاحية بعد</h1>
          <p className="mt-2 text-sm text-[#7A6458]">This account has no staff role yet. Ask an admin to grant one.</p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-4 inline-flex min-h-12 items-center justify-center rounded-full bg-[#8B4513] px-5 text-sm font-bold text-white shadow-sm transition-transform hover:scale-[1.02] hover:bg-[#5D2E17] active:scale-[0.98]"
          >
            تسجيل الخروج · Sign out
          </button>
        </div>
      </main>
    );
  }

  return (
    <div dir="rtl" className="min-h-dvh w-full max-w-full overflow-x-hidden bg-[#F9FBFC] text-[#3E2723]">
      <div className="sticky top-0 z-30 border-b border-[#F1F5F9] bg-white/95 backdrop-blur-md shadow-xs">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-2.5 sm:flex sm:flex-wrap">
          <div className="flex min-w-0 items-center gap-2 sm:me-auto">
            <span className="font-serif text-xl font-bold uppercase tracking-widest text-[#B8860B]">DELISH</span>
            <span className="-mt-1 font-script text-xl italic text-[#8B4513]">Bakes</span>
          </div>
          <nav className="no-scrollbar col-span-2 row-start-2 flex w-full max-w-full gap-2 overflow-x-auto overscroll-x-contain sm:order-none sm:w-auto sm:flex-wrap sm:overflow-visible" aria-label="أقسام بوابة الموظفين">
            {allowed.map((tab) => {
              const Icon = tab.icon;
              const on = tab.value === active;
              return (
                <button
                  key={tab.value}
                  type="button"
                  aria-current={on}
                  onClick={() => void navigate({ to: "/staff", search: { tab: tab.value } })}
                  className={`inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 text-xs font-bold transition-transform hover:scale-[1.02] active:scale-[0.98] ${
                    on
                      ? "bg-[#8B4513] text-white shadow-sm"
                      : "border border-slate-200 bg-white text-[#5D2E17] hover:bg-slate-50"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {tab.ar} · {tab.en}
                </button>
              );
            })}
          </nav>
          <button
            type="button"
            onClick={() => void signOut()}
            aria-label="تسجيل الخروج"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-slate-200 text-[#5D2E17] transition-transform hover:scale-[1.02] hover:bg-slate-50 active:scale-[0.98]"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {active === "sales" && <SalesPanel />}
      {active === "kitchen" && <KitchenPanel />}
      {active === "social" && <SocialPanel />}
      {active === "history" && <HistoryPanel />}
      {active === "messages" && <MessagesPanel />}
      {active === "admin" && <AdminPanel />}
    </div>
  );
}
