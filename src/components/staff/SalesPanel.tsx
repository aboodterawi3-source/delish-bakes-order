import { useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { 
  ClipboardList, 
  Globe, 
  Inbox, 
  Loader2, 
  LogOut, 
  Pencil, 
  ShoppingBag,
  Sparkles
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { getSalesAccess } from "@/lib/sales.functions";
import { OrdersWorkspace } from "@/components/staff/OrdersWorkspace";
import { ModificationsPanel } from "@/components/staff/ModificationsPanel";
import { PosOrderEntry } from "@/components/staff/PosOrderEntry";
import { MessagesPanel } from "@/components/staff/MessagesPanel";
import { CmsPanel } from "@/components/delish/CmsPanel";

export function SalesPanel() {
  const navigate = useNavigate();
  const accessFn = useServerFn(getSalesAccess);
  const [view, setView] = useState<"pos" | "orders" | "modifications" | "messages" | "site">("pos");

  const access = useQuery({
    queryKey: ["sales-access"],
    queryFn: () => accessFn({}),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    retry: 1,
  });

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }, [navigate]);

  if (access.isPending) {
    return (
      <main dir="rtl" className="grid min-h-dvh place-items-center bg-[#FDFBF7]">
        <Loader2 className="h-8 w-8 animate-spin text-[#B8801C]" aria-label="جاري التحميل" />
      </main>
    );
  }

  if (!access.data?.allowed) {
    return (
      <main dir="rtl" className="grid min-h-dvh place-items-center bg-[#FDFBF7] px-4 text-center">
        <div className="max-w-sm space-y-4 rounded-3xl border border-[#EFE8DC] bg-white p-8 shadow-lg">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-[#B8801C]">
            <ShoppingBag className="h-7 w-7" />
          </div>
          <h1 className="font-display text-xl font-bold text-[#26160F]">لا تملك صلاحية المبيعات</h1>
          <p className="text-xs text-[#4A3B32]/80 leading-relaxed">
            هذا الحساب غير مخول للوصول إلى واجهة المبيعات. يرجى مراجعة إدارة المخبز لمنح الصلاحية.
          </p>
          <button 
            type="button" 
            onClick={signOut} 
            className="min-h-12 w-full rounded-2xl bg-[#6E3917] px-6 text-xs font-bold text-white shadow-sm hover:bg-[#5A2E12] cursor-pointer active:scale-98 transition"
          >
            تسجيل الخروج · Sign out
          </button>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen w-full bg-[#FDFBF7] text-[#26160F] pb-16 font-sans">
      {/* Sleek Sub-Navigation Strip (Integrated with Master Brand) */}
      <div className="border-b border-[#EFE8DC] bg-white/80 backdrop-blur-md px-4 py-2.5 shadow-2xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <nav className="no-scrollbar flex items-center gap-1.5 overflow-x-auto" aria-label="أقسام واجهة المبيعات">
            {[
              { value: "pos" as const, ar: "نقطة البيع الكاشير", icon: ShoppingBag },
              { value: "orders" as const, ar: "جدول الطلبات", icon: ClipboardList },
              { value: "modifications" as const, ar: "تعديل الطلبات", icon: Pencil },
              { value: "site" as const, ar: "إدارة الموقع والبانر", icon: Globe },
              { value: "messages" as const, ar: "رسائل الزبائن", icon: Inbox },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = view === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  aria-current={isActive}
                  onClick={() => setView(item.value)}
                  className={`inline-flex min-h-[42px] shrink-0 items-center gap-2 rounded-xl px-4 text-xs font-extrabold transition-all cursor-pointer ${
                    isActive
                      ? "bg-[#6E3917] text-white shadow-sm scale-[1.01]"
                      : "border border-[#EFE8DC] bg-[#FAF5EB]/60 text-[#4A3B32] hover:bg-[#FEF7EB] hover:text-[#26160F]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.ar}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Workspace Render */}
      <div className="mx-auto w-full max-w-7xl min-w-0 px-3 sm:px-5 py-4">
        {view === "pos" ? (
          <PosOrderEntry />
        ) : view === "orders" ? (
          <OrdersWorkspace showShiftReport />
        ) : view === "modifications" ? (
          <ModificationsPanel />
        ) : view === "site" ? (
          <CmsPanel />
        ) : (
          <MessagesPanel />
        )}
      </div>
    </main>
  );
}