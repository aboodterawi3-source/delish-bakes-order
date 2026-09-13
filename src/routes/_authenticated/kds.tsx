import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bell,
  CheckCircle2,
  ChefHat,
  Clock3,
  Loader2,
  LogOut,
  RefreshCw,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrdersRealtime } from "@/hooks/use-orders-realtime";
import {
  getKitchenAccess,
  getKitchenOrders,
  markOrderReady,
  type KdsOrder,
  type PriorityColor,
} from "@/lib/kds.functions";

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

const tierMeta: Record<
  Tier,
  {
    ar: string;
    en: string;
    rank: number;
    bg: string;
    fg: string;
    fgMuted: string;
    glow: string;
  }
> = {
  multi: {
    ar: "متعدد الطوابق",
    en: "Multi-tier",
    rank: 0,
    bg: "oklch(0.52 0.17 25)",
    fg: "#ffffff",
    fgMuted: "rgba(255,255,255,0.82)",
    glow: "0 0 28px -6px oklch(0.52 0.17 25 / 0.65)",
  },
  buffet: {
    ar: "بوفيه",
    en: "Buffet",
    rank: 1,
    bg: "oklch(0.66 0.17 52)",
    fg: "#ffffff",
    fgMuted: "rgba(255,255,255,0.85)",
    glow: "0 0 26px -6px oklch(0.66 0.17 52 / 0.6)",
  },
  special: {
    ar: "تصميم خاص",
    en: "Special custom",
    rank: 2,
    bg: "oklch(0.82 0.16 88)",
    fg: "#2a220f",
    fgMuted: "rgba(42,34,15,0.82)",
    glow: "0 0 26px -6px oklch(0.82 0.16 88 / 0.55)",
  },
  mini: {
    ar: "كيك ميني",
    en: "Mini cakes",
    rank: 3,
    bg: "oklch(0.7 0.11 230)",
    fg: "#ffffff",
    fgMuted: "rgba(255,255,255,0.85)",
    glow: "0 0 24px -6px oklch(0.7 0.11 230 / 0.55)",
  },
  box: {
    ar: "علب حلويات",
    en: "Boxes",
    rank: 4,
    bg: "oklch(0.75 0.11 150)",
    fg: "#122a1a",
    fgMuted: "rgba(18,42,26,0.82)",
    glow: "0 0 24px -6px oklch(0.75 0.11 150 / 0.5)",
  },
  standard: {
    ar: "طلب عادي",
    en: "Standard",
    rank: 5,
    bg: "oklch(0.62 0.06 250)",
    fg: "#ffffff",
    fgMuted: "rgba(255,255,255,0.85)",
    glow: "0 0 22px -6px oklch(0.62 0.06 250 / 0.45)",
  },
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

const ORDERS_KEY = ["kds-orders"] as const;

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
  const [view, setView] = useState<"board" | "menu">("board");
  const [shiftOn, setShiftOn] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const knownIds = useRef<Set<string> | null>(null);

  const access = useQuery({
    queryKey: ["kds-access"],
    queryFn: () => fetchAccess({}),
    staleTime: 5 * 60_000,
  });
  const allowed = access.data?.allowed === true;
  const orders = useQuery({
    queryKey: ORDERS_KEY,
    queryFn: () => fetchOrders({}),
    // Realtime drives updates; the interval is only a safety net.
    refetchInterval: 30_000,
    staleTime: 10_000,
    enabled: allowed,
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

  const startShift = useCallback(() => {
    const AudioContextClass =
      window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioRef.current) audioRef.current = new AudioContextClass();
    void audioRef.current.resume();
    setShiftOn(true);
    chime();
  }, [chime]);

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

  useOrdersRealtime(ORDERS_KEY, allowed, "kds-orders-live");

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

  /** Flips the card to Ready instantly, then confirms with the server. */
  const onReady = useCallback(
    async (id: string) => {
      const previous = queryClient.getQueryData<KdsOrder[]>(ORDERS_KEY);
      queryClient.setQueryData<KdsOrder[]>(ORDERS_KEY, (rows) =>
        (rows ?? []).map((order) => (order.id === id ? { ...order, status: "ready" } : order)),
      );
      setPending(id);
      try {
        await markReady({ data: { orderId: id } });
      } catch {
        if (previous) queryClient.setQueryData(ORDERS_KEY, previous);
      } finally {
        setPending(null);
      }
    },
    [markReady, queryClient],
  );

  const signOut = useCallback(async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }, [navigate, queryClient]);

  if (access.isLoading) {
    return (
      <p dir="rtl" className="grid min-h-dvh place-items-center bg-[#F9FBFC] text-sm text-[#7A6458]">
        جارٍ التحقق…
      </p>
    );
  }

  if (!allowed) {
    return (
      <main dir="rtl" className="grid min-h-dvh place-items-center bg-[#F9FBFC] px-4 text-center">
        <div className="max-w-sm rounded-3xl border border-slate-200 bg-white p-6 text-[#3E2723] shadow-xl">
          <h1 className="font-display text-xl font-bold">لا تملك صلاحية المطبخ</h1>
          <p className="mt-2 text-sm text-[#7A6458]">Your account has no kitchen access. Ask an admin to grant the kitchen role.</p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-5 min-h-12 w-full rounded-full bg-[#8B4513] px-5 text-sm font-bold text-white shadow-sm hover:bg-[#5D2E17]"
          >
            تسجيل الخروج · Sign out
          </button>
        </div>
      </main>
    );
  }

  return (
    <div dir="rtl" className="min-h-dvh bg-[#F9FBFC] text-[#3E2723] bg-delish-pattern pb-16">
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-[#F1F5F9] bg-white/95 px-4 py-3.5 backdrop-blur-md shadow-xs">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#FDE2CF] text-[#7B3F00] shadow-sm">
            <ChefHat className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-serif text-xl font-bold text-[#3E2723] sm:text-2xl">شاشة المطبخ</h1>
              <span className="font-script text-2xl text-[#8B4513] -mt-1 hidden sm:inline">Delish</span>
            </div>
            <p className="text-xs text-[#7A6458] font-medium">{visible.length} طلب للتجهيز · Kitchen Display</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={startShift}
            disabled={shiftOn}
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#FDE2CF] px-5 text-sm font-bold text-[#7B3F00] shadow-xs hover:bg-[#fed6bc] disabled:opacity-70"
          >
            <Bell className="h-4 w-4 text-[#B8860B]" />
            {shiftOn ? "الوردية جارية 🔔" : "بدء وردية المطبخ 🔔"}
          </button>
          <button
            type="button"
            onClick={() => void orders.refetch()}
            aria-label="تحديث"
            className="grid h-12 w-12 place-items-center rounded-full border border-slate-200 bg-white text-[#5D2E17] shadow-xs hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${orders.isFetching ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            aria-label="تسجيل الخروج"
            className="grid h-12 w-12 place-items-center rounded-full border border-slate-200 bg-white text-[#5D2E17] shadow-xs hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex gap-2 overflow-x-auto px-4 py-3.5 no-scrollbar">
            {(Object.keys(filterMeta) as Filter[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                aria-pressed={filter === key}
                className={`min-h-11 shrink-0 rounded-full px-4 text-xs font-bold transition-all ${
                  filter === key
                    ? "bg-[#8B4513] text-white shadow-sm"
                    : "border border-slate-200 bg-white text-[#5D2E17] hover:bg-slate-50"
                }`}
              >
                {filterMeta[key].ar}
              </button>
            ))}
          </div>

          <main className="grid gap-4 px-4 pb-8 sm:grid-cols-2 xl:grid-cols-3">
            {orders.isLoading && <p className="p-6 text-sm text-[#7A6458]">جارٍ تحميل الطلبات…</p>}
            {!orders.isLoading && visible.length === 0 && (
              <div className="p-12 text-center text-sm text-[#7A6458] sm:col-span-2 xl:col-span-3 rounded-3xl bg-white/70 border border-slate-100">
                لا توجد طلبات لهذا اليوم
              </div>
            )}
            {visible.map((order) => (
              <KdsCard key={order.id} order={order} busy={pending === order.id} onReady={onReady} onZoom={setZoom} />
            ))}
          </main>

      {zoom && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="صورة التصميم"
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setZoom(null)}
        >
          <img src={zoom} alt="صورة تصميم الكيك بالحجم الكامل" className="max-h-[85dvh] w-auto max-w-full rounded-2xl shadow-2xl" />
          <button
            type="button"
            onClick={() => setZoom(null)}
            aria-label="إغلاق"
            className="absolute right-4 top-4 grid h-12 w-12 place-items-center rounded-full bg-white text-[#3E2723] shadow-lg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}

/** Memoized so one status flip never repaints the whole board. */
const KdsCard = memo(function KdsCard({
  order,
  busy,
  onReady,
  onZoom,
}: {
  order: KdsOrder;
  busy: boolean;
  onReady: (id: string) => void;
  onZoom: (url: string) => void;
}) {
  const meta = tierMeta[orderTier(order)];
  const isReady = order.status === "ready";
  return (
    <article
      className="relative overflow-hidden rounded-3xl border border-card/40 p-5 transition-transform hover:-translate-y-0.5"
      style={{ backgroundColor: meta.bg, color: meta.fg, boxShadow: meta.glow }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate font-sans text-base font-extrabold">
            {order.order_number} · {order.customer_name}
          </h2>
          <p className="mt-1 flex items-center gap-1 text-xs" style={{ color: meta.fgMuted }}>
            <Clock3 className="h-3.5 w-3.5 text-[#B8860B]" />
            {order.requested_date} · {order.requested_time.slice(0, 5)} · {order.method === "delivery" ? "توصيل" : "استلام"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {/* Gold / Amber status chip */}
          <span
            className={`rounded-full px-3.5 py-1 text-xs font-extrabold shadow-xs ${
              isReady
                ? "bg-[#B8860B] text-white"
                : "bg-[#FDE2CF] text-[#7B3F00]"
            }`}
          >
            {isReady ? "جاهز · Ready" : "قيد التجهيز · Preparing"}
          </span>
           <span className="rounded-full bg-card/85 px-2.5 py-0.5 text-[10px] font-bold text-foreground">
            {meta.ar}
          </span>
        </div>
      </div>

      <ul className="mt-4 space-y-2 border-y border-card/30 py-3">
        {order.items.map((item) => (
          <li key={item.id} className="rounded-2xl border border-card/25 bg-card/15 p-3">
            <p className="text-sm font-bold">
              {item.quantity}× {item.name_ar}
            </p>
            <p className="text-xs" style={{ color: meta.fgMuted }}>
              {item.name_en}
            </p>
            {item.options_ar.map((option) => (
              <p key={option} className="mt-0.5 text-xs font-medium">
                • {option}
              </p>
            ))}
            {item.notes && (
              <p className="mt-1 rounded-md bg-amber-50 p-1.5 text-xs font-bold text-amber-900 border border-amber-200/60">
                ملاحظة: {item.notes}
              </p>
            )}
          </li>
        ))}
      </ul>

      {order.inscription && (
        <p className="mt-3 rounded-xl bg-[#FDE2CF]/50 p-2.5 text-xs font-bold text-[#7B3F00] border border-[#EFA781]/40">
          الكتابة على الكيك: {order.inscription}
        </p>
      )}

      {order.design_image_url && (
        <button
          type="button"
          onClick={() => onZoom(order.design_image_url as string)}
          className="mt-3 block w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 transition hover:opacity-95"
        >
          <img
            src={order.design_image_url}
            alt={`صورة تصميم الطلب ${order.order_number}`}
            loading="lazy"
            className="h-36 w-full object-cover"
          />
          <span className="block py-2 text-xs font-bold bg-[#FDE2CF]/70 text-[#7B3F00]">
            تكبير الصورة · Zoom Design
          </span>
        </button>
      )}

      <button
        type="button"
        onClick={() => void onReady(order.id)}
        disabled={busy || isReady}
        className={`mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold transition-all shadow-sm ${
          isReady
            ? "bg-amber-100 text-amber-900 border border-amber-300 opacity-90 cursor-default"
            : "bg-[#8B4513] text-white hover:bg-[#5D2E17] hover:shadow-md active:scale-98"
        }`}
      >
        <CheckCircle2 className="h-4 w-4" />
        {isReady ? "تم التجهيز وهو جاهز ✓" : "تم التجهيز · Mark as Ready"}
      </button>
    </article>
  );
});
