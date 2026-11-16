import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, LogOut, RefreshCw } from "lucide-react";

import { AdminAnalyticsTab } from "@/components/staff/AdminAnalyticsTab";
import { AdminStaffTab } from "@/components/staff/AdminStaffTab";
import { StoreCmsPanel, StoreOperationsPanel } from "@/components/staff/AdminStoreTab";
import { useOrdersRealtime } from "@/hooks/use-orders-realtime";
import { useStaffAccess } from "@/hooks/use-staff-access";
import { supabase } from "@/integrations/supabase/client";
import { getAdminAccess, getAdminAnalytics } from "@/lib/admin.functions";
import { ADMIN_ANALYTICS_KEY } from "@/lib/staff-orders-shared";

type MainTab = "analytics" | "staff" | "menu" | "settings";

const ADMIN_TABS: ReadonlyArray<{ id: MainTab; label: string }> = [
  { id: "analytics", label: "📊 لوحة المؤشرات والتقارير" },
  { id: "staff", label: "👥 الموظفون والصلاحيات وسجل التدقيق" },
  { id: "menu", label: "🎂 إعدادات المتجر ومنيو الكيك" },
  { id: "settings", label: "⚙️ إعدادات النظام والدفع والتوصيل" },
];

export function AdminPanel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<MainTab>("analytics");

  const accessFn = useServerFn(getAdminAccess);
  const access = useStaffAccess(["admin", "access"], () => accessFn({}), ["admin"]);

  const analyticsFn = useServerFn(getAdminAnalytics);
  const analytics = useQuery({
    queryKey: ADMIN_ANALYTICS_KEY,
    queryFn: () => analyticsFn({}),
    enabled: access.data?.allowed === true,
    staleTime: 30_000,
  });

  useOrdersRealtime(ADMIN_ANALYTICS_KEY, access.data?.allowed === true, "admin-analytics-live");

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  };

  if (access.isLoading) {
    return (
      <main dir="rtl" className="grid min-h-dvh place-items-center bg-[#FDFBF7]">
        <Loader2 className="h-7 w-7 animate-spin text-[#B8801C]" aria-label="جاري التحميل" />
      </main>
    );
  }

  if (!access.data?.allowed) {
    return (
      <main dir="rtl" className="grid min-h-dvh place-items-center bg-[#FDFBF7] px-4">
        <div className="max-w-sm rounded-3xl border border-[#EFE8DC] bg-white p-6 text-center shadow-lg">
          <h1 className="font-display text-lg font-bold text-[#26160F]">هذه اللوحة للمديرين فقط</h1>
          <p className="mt-2 text-sm text-[#4A3B32]">
            This dashboard is limited to admin accounts.
          </p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-4 inline-flex min-h-12 items-center justify-center rounded-full bg-[#B8801C] px-5 text-sm font-bold text-white shadow-sm hover:bg-[#9E6C14]"
          >
            تسجيل الخروج · Sign out
          </button>
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-dvh w-full overflow-x-hidden bg-[#FDFBF7] pb-16 text-[#4A3B32]"
    >
      <header className="sticky top-0 z-20 border-b border-[#EFE8DC] bg-white/95 shadow-xs backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="font-serif text-2xl font-bold tracking-wider text-[#B8801C] uppercase">
                DELISH
              </span>
              <span className="-mt-1.5 font-script text-xl text-[#6E3917] italic">
                Bakes Admin Center
              </span>
            </div>
            <span className="hidden rounded-full border border-[#EFE8DC] bg-[#FEF7EB] px-3 py-1 text-xs font-extrabold text-[#B8801C] sm:inline-block">
              مركز الإدارة والتحكم الشامل
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="inline-flex h-9 items-center rounded-full border border-[#EFE8DC] bg-[#FAF5EB] px-4 text-xs font-bold text-[#6E3917] shadow-xs hover:bg-[#FEF7EB]"
            >
              المتجر الرئيسية 🛒
            </Link>
            <button
              type="button"
              onClick={() => void analytics.refetch()}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#EFE8DC] bg-white px-3.5 text-xs font-bold text-[#26160F] shadow-xs hover:bg-[#FEF7EB]"
            >
              <RefreshCw className="h-3.5 w-3.5 text-[#B8801C]" aria-hidden />
              <span>تحديث البيانات</span>
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#6E3917] px-4 text-xs font-bold text-white shadow-xs hover:bg-[#5A2E12]"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              <span>خروج</span>
            </button>
          </div>
        </div>

        <nav
          aria-label="أقسام اللوحة"
          className="mx-auto no-scrollbar flex w-full max-w-7xl gap-2 overflow-x-auto overscroll-x-contain px-4 pt-1 pb-3 sm:px-6"
        >
          {ADMIN_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => setActiveTab(tab.id)}
                className={`flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition-all sm:text-sm ${
                  active
                    ? "scale-[1.01] bg-[#B8801C] text-white shadow-md"
                    : "border border-[#EFE8DC] bg-white text-[#26160F] hover:border-[#B8801C]/40 hover:bg-[#FEF7EB]"
                }`}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </header>

      <div className="mx-auto w-full max-w-7xl space-y-8 px-4 pt-6 sm:px-6">
        {activeTab === "analytics" && (
          <AdminAnalyticsTab
            data={analytics.data}
            isLoading={analytics.isLoading}
            isError={analytics.isError}
            error={analytics.error}
            onRefetch={() => void analytics.refetch()}
          />
        )}
        {activeTab === "staff" && <AdminStaffTab />}
        {activeTab === "menu" && <StoreCmsPanel />}
        {activeTab === "settings" && <StoreOperationsPanel />}
      </div>
    </main>
  );
}
