import { useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, LogOut } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { getSalesAccess } from "@/lib/sales.functions";
import { CmsPanel } from "@/components/delish/CmsPanel";
import { OrdersWorkspace } from "@/components/staff/OrdersWorkspace";
import { ModificationsPanel } from "@/components/staff/ModificationsPanel";
import { SocialOrderEntryForm } from "@/components/staff/SocialOrderEntryForm";
import { MessagesPanel } from "@/components/staff/MessagesPanel";

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
      <main dir="rtl" className="grid min-h-dvh place-items-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="جار التحميل" />
      </main>
    );
  }

  if (!access.data?.allowed) {
    return (
      <main dir="rtl" className="grid min-h-dvh place-items-center bg-background px-4 text-center">
        <div className="max-w-sm space-y-3">
          <h1 className="font-display text-2xl font-bold text-foreground">لا تملك صلاحية المبيعات</h1>
          <p className="text-sm text-muted-foreground">This account has no sales access. Ask an admin to grant the sales role.</p>
          <button type="button" onClick={signOut} className="min-h-12 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground">
            تسجيل الخروج · Sign out
          </button>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-dvh w-full max-w-full overflow-x-hidden bg-background pb-16">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3 sm:gap-3">
          <div className="min-w-0 me-auto">
            <h1 className="truncate font-display text-lg font-bold text-foreground sm:text-xl">
              واجهة المبيعات <span className="delish-wordmark">Delish</span>
            </h1>
            <p className="text-xs text-muted-foreground">Sales &amp; POS Desk · نقطة البيع وحجز الطلبات</p>
          </div>
          <button
            type="button"
            onClick={signOut}
            aria-label="تسجيل الخروج"
            className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-full border border-border text-foreground"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl min-w-0 px-4 py-5">
        <nav className="no-scrollbar mb-5 flex max-w-full gap-2 overflow-x-auto" aria-label="أقسام واجهة المبيعات">
          {([
            { value: "pos" as const, ar: "طلب جديد", en: "New Order" },
            { value: "orders" as const, ar: "جدول الطلبات", en: "Orders" },
            { value: "modifications" as const, ar: "تعديلات", en: "Modifications" },
            { value: "messages" as const, ar: "رسائل العملاء", en: "Messages" },
            { value: "site" as const, ar: "إدارة الموقع", en: "Website" },
          ]).map((item) => (
            <button
              key={item.value}
              type="button"
              aria-current={view === item.value}
              onClick={() => setView(item.value)}
              className={`min-h-12 shrink-0 whitespace-nowrap rounded-full px-6 text-sm font-bold transition ${
                view === item.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border border-border bg-card text-foreground hover:bg-secondary/40"
              }`}
            >
              {item.ar} · {item.en}
            </button>
          ))}
        </nav>

        {view === "pos" ? (
          <SocialOrderEntryForm title="طلب جديد (المبيعات) · Sales Order Entry" />
        ) : view === "messages" ? (
          <MessagesPanel />
        ) : view === "site" ? (
          <CmsPanel />
        ) : view === "modifications" ? (
          <ModificationsPanel />
        ) : (
          <OrdersWorkspace showShiftReport />
        )}
      </div>
    </main>
  );
}
