import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, CheckCircle2, ChefHat, Clock3, LogOut, RefreshCw, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getKitchenAccess, getKitchenOrders, markOrderReady, type KdsOrder } from "@/lib/kds.functions";

export const Route = createFileRoute("/_authenticated/kds")({
  head: () => ({
    meta: [
      { title: "شاشة المطبخ | Delish Kitchen Display" },
      { name: "description", content: "شاشة تجهيز طلبات مطبخ ديليش مع أولويات ملوّنة وتنبيه صوتي." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "شاشة المطبخ | Delish Kitchen Display" },
      { property: "og:description", content: "Live kitchen preparation display for Delish Cake & Bake." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: KdsPage,
});

type Tier = "multi" | "buffet" | "special" | "mini" | "box" | "standard";

const tierMeta: Record<Tier, { ar: string; en: string; card: string; chip: string; rank: number }> = {
  multi: { ar: "متعدد الطوابق", en: "Multi-tier", card: "border-r-8 border-r-[oklch(0.42_0.16_25)] bg-[oklch(0.42_0.16_25)]/8", chip: "bg-[oklch(0.42_0.16_25)] text-white", rank: 0 },
  buffet: { ar: "بوفيه", en: "Buffet", card: "border-r-8 border-r-[oklch(0.68_0.16_52)] bg-[oklch(0.68_0.16_52)]/10", chip: "bg-[oklch(0.68_0.16_52)] text-white", rank: 1 },
  special: { ar: "تصميم خاص", en: "Special custom", card: "border-r-8 border-r-[oklch(0.82_0.15_88)] bg-[oklch(0.82_0.15_88)]/14", chip: "bg-[oklch(0.82_0.15_88)] text-[oklch(0.25_0.03_88)]", rank: 2 },
  mini: { ar: "كيك ميني", en: "Mini cakes", card: "border-r-8 border-r-[oklch(0.74_0.11_230)] bg-[oklch(0.74_0.11_230)]/12", chip: "bg-[oklch(0.74_0.11_230)] text-white", rank: 3 },
  box: { ar: "علب حلويات", en: "Boxes", card: "border-r-8 border-r-[oklch(0.78_0.11_150)] bg-[oklch(0.78_0.11_150)]/12", chip: "bg-[oklch(0.78_0.11_150)] text-[oklch(0.25_0.03_150)]", rank: 4 },
  standard: { ar: "طلب عادي", en: "Standard", card: "border-r-8 border-r-border bg-card", chip: "bg-secondary text-secondary-foreground", rank: 5 },
};

const has = (haystack: string, needles: string[]) => needles.some((needle) => haystack.includes(needle));

function orderTier(order: KdsOrder): Tier {
  const text = order.items
    .flatMap((item) => [item.name_ar, item.name_en, item.category ?? "", ...item.options_ar, ...item.options_en])
    .join(" ")
    .toLowerCase();

  if (has(text, ["multi", "tier", "طوابق", "طابقين", "دورين"])) return "multi";
  if (has(text, ["buffet", "بوفيه", "ضيافة"])) return "buffet";
  if (order.design_image_url || order.inscription || has(text, ["custom", "خاص", "تصميم"])) return "special";
  if (has(text, ["mini", "ميني", "cupcake", "كب كيك"])) return "mini";
  if (has(text, ["box", "علبة", "علب", "بوكس", "tray", "صينية"])) return "box";
  return "standard";
}

const isoDate = (offsetDays: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
};

type Filter = "today" | "tomorrow" | "all";

const filterMeta: Record<Filter, { ar: string; en: string }> = {
  today: { ar: "طلبات اليوم", en: "Today" },
  tomorrow: { ar: "طلبات الغد", en: "Tomorrow" },
  all: { ar: "كل الطلبات النشطة", en: "All active" },
};

function KdsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchOrders = useServerFn(getKitchenOrders);
  const fetchAccess = useServerFn(getKitchenAccess);
  const markReady = useServerFn(markOrderReady);

  const [filter, setFilter] = useState<Filter>("today");
  const [shiftOn, setShiftOn] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const knownIds = useRef<Set<string> | null>(null);

  const access = useQuery({ queryKey: ["kds-access"], queryFn: () => fetchAccess({}) });
  const orders = useQuery({
    queryKey: ["kds-orders"],
    queryFn: () => fetchOrders({}),
    refetchInterval: 20000,
    enabled: access.data?.allowed === true,
  });

  const chime = useCallback(() => {
    const context = audioRef.current;
    if (!context) return;
    void context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.setValueAtTime(920, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(640, context.currentTime + 0.35);
    gain.gain.setValueAtTime(0.2, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.5);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.5);
  }, []);

  const startShift = () => {
    const AudioContextClass =
      window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioRef.current) audioRef.current = new AudioContextClass();
    void audioRef.current.resume();
    setShiftOn(true);
    chime();
  };

  // New arrivals ring the bell once the shift has started.
  useEffect(() => {
    const list = orders.data;
    if (!list) return;
    const ids = new Set(list.map((order) => order.id));
    if (knownIds.current === null) {
      knownIds.current = ids;
      return;
    }
    const fresh = list.some((order) => !knownIds.current?.has(order.id));
    knownIds.current = ids;
    if (fresh && shiftOn) chime();
  }, [orders.data, shiftOn, chime]);

  useEffect(() => {
    if (access.data?.allowed !== true) return;
    const channel = supabase
      .channel("kds-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["kds-orders"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [access.data?.allowed, queryClient]);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setZoom(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom]);

  const visible = useMemo(() => {
    const list = orders.data ?? [];
    const day = filter === "today" ? isoDate(0) : filter === "tomorrow" ? isoDate(1) : null;
    return list
      .filter((order) => (day ? order.requested_date === day : true))
      .sort((a, b) => {
        const byDate = a.requested_date.localeCompare(b.requested_date);
        if (byDate !== 0) return byDate;
        const byTime = a.requested_time.localeCompare(b.requested_time);
        if (byTime !== 0) return byTime;
        return tierMeta[orderTier(a)].rank - tierMeta[orderTier(b)].rank;
      });
  }, [orders.data, filter]);

  const onReady = async (id: string) => {
    setPending(id);
    try {
      await markReady({ data: { orderId: id } });
      await queryClient.invalidateQueries({ queryKey: ["kds-orders"] });
    } finally {
      setPending(null);
    }
  };

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  };

  if (access.isLoading) {
    return <p dir="rtl" className="grid min-h-dvh place-items-center bg-background text-sm text-muted-foreground">جارٍ التحقق…</p>;
  }

  if (access.data?.allowed !== true) {
    return (
      <main dir="rtl" className="grid min-h-dvh place-items-center bg-background px-4 text-center">
        <div className="max-w-sm rounded-3xl border border-border bg-card p-6">
          <h1 className="font-display text-xl font-bold text-foreground">لا تملك صلاحية المطبخ</h1>
          <p className="mt-2 text-sm text-muted-foreground">Your account has no kitchen access. Ask an admin to grant the kitchen role.</p>
          <button type="button" onClick={signOut} className="mt-5 min-h-12 w-full rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground">
            تسجيل الخروج · Sign out
          </button>
        </div>
      </main>
    );
  }

  return (
    <div dir="rtl" className="min-h-dvh bg-foreground text-primary-foreground">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-primary-foreground/15 px-4 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary"><ChefHat className="h-6 w-6" /></span>
          <div className="min-w-0">
            <h1 className="truncate font-display text-xl font-bold sm:text-2xl">شاشة المطبخ</h1>
            <p className="text-xs text-primary-foreground/65">{visible.length} طلب للتجهيز · Kitchen Display</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={startShift}
            disabled={shiftOn}
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-4 text-sm font-bold disabled:opacity-70"
          >
            <Bell className="h-4 w-4" />
            {shiftOn ? "الوردية جارية 🔔" : "بدء وردية المطبخ 🔔"}
          </button>
          <button type="button" onClick={() => orders.refetch()} aria-label="تحديث" className="grid h-12 w-12 place-items-center rounded-full border border-primary-foreground/25">
            <RefreshCw className="h-5 w-5" />
          </button>
          <button type="button" onClick={signOut} aria-label="تسجيل الخروج" className="grid h-12 w-12 place-items-center rounded-full border border-primary-foreground/25">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="flex gap-2 overflow-x-auto px-4 py-3">
        {(Object.keys(filterMeta) as Filter[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className={`min-h-12 shrink-0 rounded-full px-4 text-sm font-bold transition-colors ${
              filter === key ? "bg-primary text-primary-foreground" : "border border-primary-foreground/25 text-primary-foreground/80"
            }`}
          >
            {filterMeta[key].ar}
          </button>
        ))}
      </div>

      <main className="grid gap-3 px-3 pb-8 sm:grid-cols-2 xl:grid-cols-3">
        {orders.isLoading && <p className="p-6 text-sm text-primary-foreground/60">جارٍ تحميل الطلبات…</p>}
        {!orders.isLoading && visible.length === 0 && (
          <p className="p-10 text-center text-sm text-primary-foreground/55 sm:col-span-2 xl:col-span-3">لا توجد طلبات لهذا اليوم</p>
        )}
        {visible.map((order) => {
          const tier = orderTier(order);
          const meta = tierMeta[tier];
          return (
            <article key={order.id} className={`rounded-2xl border border-border p-4 text-card-foreground shadow-[var(--shadow-soft)] ${meta.card}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate font-bold">{order.order_number} · {order.customer_name}</h2>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock3 className="h-3.5 w-3.5" />
                    {order.requested_date} · {order.requested_time.slice(0, 5)} · {order.method === "delivery" ? "توصيل" : "استلام"}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${meta.chip}`}>{meta.ar}</span>
              </div>

              <ul className="mt-3 space-y-3 border-y border-border/70 py-3">
                {order.items.map((item) => (
                  <li key={item.id}>
                    <p className="text-sm font-bold">{item.quantity}× {item.name_ar}</p>
                    <p className="text-xs text-muted-foreground">{item.name_en}</p>
                    {item.options_ar.map((option) => (
                      <p key={option} className="mt-0.5 text-xs text-muted-foreground">• {option}</p>
                    ))}
                    {item.notes && <p className="mt-1 text-xs font-bold">ملاحظة: {item.notes}</p>}
                  </li>
                ))}
              </ul>

              {order.inscription && (
                <p className="mt-3 rounded-lg bg-secondary p-2 text-xs font-bold text-secondary-foreground">الكتابة: {order.inscription}</p>
              )}

              {order.design_image_url && (
                <button type="button" onClick={() => setZoom(order.design_image_url)} className="mt-3 block w-full overflow-hidden rounded-xl border border-border">
                  <img src={order.design_image_url} alt={`صورة تصميم الطلب ${order.order_number}`} loading="lazy" className="h-36 w-full object-cover" />
                  <span className="block bg-secondary py-2 text-xs font-bold text-secondary-foreground">تكبير الصورة · Zoom</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => void onReady(order.id)}
                disabled={pending === order.id || order.status === "ready"}
                className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                {order.status === "ready" ? "جاهز ✓ Ready" : "تم التجهيز · Mark as Ready"}
              </button>
            </article>
          );
        })}
      </main>

      {zoom && (
        <div role="dialog" aria-modal="true" aria-label="صورة التصميم" className="fixed inset-0 z-50 grid place-items-center bg-foreground/85 p-4" onClick={() => setZoom(null)}>
          <img src={zoom} alt="صورة تصميم الكيك بالحجم الكامل" className="max-h-[85dvh] w-auto max-w-full rounded-2xl" />
          <button type="button" onClick={() => setZoom(null)} aria-label="إغلاق" className="absolute right-4 top-4 grid h-12 w-12 place-items-center rounded-full bg-card text-card-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
