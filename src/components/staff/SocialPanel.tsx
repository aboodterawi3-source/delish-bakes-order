import { useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, LogOut, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSocialAccess } from "@/lib/social.functions";
import { OrdersWorkspace } from "@/components/staff/OrdersWorkspace";
import { ModificationsPanel } from "@/components/staff/ModificationsPanel";
import { SocialOrderEntryForm } from "@/components/staff/SocialOrderEntryForm";

export function SocialPanel() {
  const navigate = useNavigate();
  const accessFn = useServerFn(getSocialAccess);
  const [view, setView] = useState<"new" | "orders" | "modifications">("new");

  const access = useQuery({ queryKey: ["social-access"], queryFn: () => accessFn({}) });

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/social-login", replace: true });
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
          <h1 className="font-display text-2xl font-bold text-foreground">لا تملك صلاحية السوشال</h1>
          <p className="text-sm text-muted-foreground">This account has no social portal access. Ask an admin to grant the social role.</p>
          <button type="button" onClick={signOut} className="min-h-12 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground">
            تسجيل الخروج · Sign out
          </button>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-dvh w-full max-w-full overflow-x-hidden bg-[#F9FBFC] text-[#3E2723] bg-delish-pattern pb-16">
      <header className="border-b border-[#F1F5F9] bg-white/95 backdrop-blur-md shadow-xs">
        <div className="mx-auto grid max-w-3xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#FDE2CF] text-[#7B3F00] shadow-sm">
            <Sparkles className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-serif text-lg font-bold text-[#3E2723] sm:text-xl">بوابة السوشال ميديا</h1>
              <span className="-mt-1 hidden font-script text-2xl italic text-[#8B4513] sm:inline">Delish</span>
            </div>
            <p className="truncate text-xs font-bold text-[#7A6458]">
              إدخال الطلبات فوراً للمبيعات والمطبخ · Social Order Entry
            </p>
          </div>
          <button
            type="button"
            onClick={signOut}
            aria-label="تسجيل الخروج"
            className="grid h-11 w-11 place-items-center rounded-full border border-slate-200 bg-white text-[#5D2E17] hover:bg-slate-50 shadow-xs"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6">
        <nav className="no-scrollbar mb-5 flex max-w-full gap-2 overflow-x-auto" aria-label="أقسام بوابة السوشال">
          {([
            { value: "new" as const, label: "طلب جديد · New order" },
            { value: "orders" as const, label: "إدارة الطلبات · Orders" },
            { value: "modifications" as const, label: "تعديلات · Modifications" },
          ]).map((item) => (
            <button
              key={item.value}
              type="button"
              aria-current={view === item.value}
              onClick={() => setView(item.value)}
              className={`min-h-12 shrink-0 whitespace-nowrap rounded-full px-6 text-sm font-bold transition ${
                view === item.value
                  ? "bg-[#8B4513] text-white shadow-sm"
                  : "border border-slate-200 bg-white text-[#5D2E17] hover:bg-slate-50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {view === "new" ? (
          <SocialOrderEntryForm />
        ) : view === "modifications" ? (
          <ModificationsPanel />
        ) : (
          <OrdersWorkspace />
        )}
      </div>
    </main>
  );
}

