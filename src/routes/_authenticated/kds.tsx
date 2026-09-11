import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bell,
  CheckCircle2,
  ChefHat,
  Clock3,
  LayoutGrid,
  Loader2,
  LogOut,
  NotebookPen,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrdersRealtime } from "@/hooks/use-orders-realtime";
import {
  deleteMenuItem,
  getKitchenAccess,
  getKitchenOrders,
  listMenuItems,
  markOrderReady,
  saveMenuItem,
  type KdsOrder,
  type MenuItem,
  type MenuItemInput,
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
      <p dir="rtl" className="grid min-h-dvh place-items-center bg-[oklch(0.13_0.06_250)] text-sm text-white/70">
        جارٍ التحقق…
      </p>
    );
  }

  if (!allowed) {
    return (
      <main dir="rtl" className="grid min-h-dvh place-items-center bg-[oklch(0.13_0.06_250)] px-4 text-center">
        <div className="max-w-sm rounded-3xl border border-white/10 bg-[oklch(0.22_0.04_255)] p-6 text-white shadow-xl">
          <h1 className="font-display text-xl font-bold">لا تملك صلاحية المطبخ</h1>
          <p className="mt-2 text-sm text-white/70">Your account has no kitchen access. Ask an admin to grant the kitchen role.</p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-5 min-h-12 w-full rounded-full bg-[oklch(0.65_0.12_230)] px-5 text-sm font-bold text-white"
          >
            تسجيل الخروج · Sign out
          </button>
        </div>
      </main>
    );
  }

  return (
    <div dir="rtl" className="min-h-dvh bg-[oklch(0.13_0.06_250)] text-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[oklch(0.65_0.12_230)]">
            <ChefHat className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate font-display text-xl font-bold sm:text-2xl">شاشة المطبخ</h1>
            <p className="text-xs text-white/65">{visible.length} طلب للتجهيز · Kitchen Display</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={startShift}
            disabled={shiftOn}
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[oklch(0.65_0.12_230)] px-4 text-sm font-bold disabled:opacity-70"
          >
            <Bell className="h-4 w-4" />
            {shiftOn ? "الوردية جارية 🔔" : "بدء وردية المطبخ 🔔"}
          </button>
          <button
            type="button"
            onClick={() => void orders.refetch()}
            aria-label="تحديث"
            className="grid h-12 w-12 place-items-center rounded-full border border-white/25"
          >
            <RefreshCw className={`h-5 w-5 ${orders.isFetching ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            aria-label="تسجيل الخروج"
            className="grid h-12 w-12 place-items-center rounded-full border border-white/25"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
        <nav aria-label="أقسام شاشة المطبخ" className="flex w-full gap-2 overflow-x-auto pt-1 no-scrollbar">
          {(
            [
              ["board", "شاشة الطلبات", LayoutGrid],
              ["menu", "المنتجات والأسعار", NotebookPen],
            ] as ["board" | "menu", string, typeof LayoutGrid][]
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              aria-current={view === key ? "page" : undefined}
              onClick={() => setView(key)}
              className={`inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-bold transition-colors ${
                view === key ? "bg-[oklch(0.65_0.12_230)] text-white" : "border border-white/25 text-white/80"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden /> {label}
            </button>
          ))}
        </nav>
      </header>

      {view === "menu" ? (
        <MenuPanel />
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto px-4 py-3 no-scrollbar">
            {(Object.keys(filterMeta) as Filter[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                aria-pressed={filter === key}
                className={`min-h-12 shrink-0 rounded-full px-4 text-sm font-bold transition-colors ${
                  filter === key ? "bg-[oklch(0.65_0.12_230)] text-white" : "border border-white/25 text-white/80"
                }`}
              >
                {filterMeta[key].ar}
              </button>
            ))}
          </div>

          <main className="grid gap-4 px-3 pb-8 sm:grid-cols-2 xl:grid-cols-3">
            {orders.isLoading && <p className="p-6 text-sm text-white/60">جارٍ تحميل الطلبات…</p>}
            {!orders.isLoading && visible.length === 0 && (
              <p className="p-10 text-center text-sm text-white/55 sm:col-span-2 xl:col-span-3">لا توجد طلبات لهذا اليوم</p>
            )}
            {visible.map((order) => (
              <KdsCard key={order.id} order={order} busy={pending === order.id} onReady={onReady} onZoom={setZoom} />
            ))}
          </main>
        </>
      )}

      {zoom && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="صورة التصميم"
          className="fixed inset-0 z-50 grid place-items-center bg-[oklch(0.13_0.06_250)]/90 p-4"
          onClick={() => setZoom(null)}
        >
          <img src={zoom} alt="صورة تصميم الكيك بالحجم الكامل" className="max-h-[85dvh] w-auto max-w-full rounded-2xl" />
          <button
            type="button"
            onClick={() => setZoom(null)}
            aria-label="إغلاق"
            className="absolute right-4 top-4 grid h-12 w-12 place-items-center rounded-full bg-[oklch(0.22_0.04_255)] text-white shadow-lg"
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
  const isLight = meta.fg !== "#ffffff";
  return (
    <article
      className="relative overflow-hidden rounded-2xl shadow-lg"
      style={{
        backgroundColor: meta.bg,
        color: meta.fg,
        boxShadow: `0 10px 28px -10px oklch(0 0 0 / 0.35), ${meta.glow}`,
      }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate font-bold" style={{ color: meta.fg }}>
              {order.order_number} · {order.customer_name}
            </h2>
            <p className="mt-1 flex items-center gap-1 text-xs" style={{ color: meta.fgMuted }}>
              <Clock3 className="h-3.5 w-3.5" />
              {order.requested_date} · {order.requested_time.slice(0, 5)} · {order.method === "delivery" ? "توصيل" : "استلام"}
            </p>
          </div>
          <span
            className="shrink-0 rounded-full px-3 py-1 text-xs font-bold"
            style={{ backgroundColor: meta.fg, color: meta.bg }}
          >
            {meta.ar}
          </span>
        </div>

        <ul
          className="mt-4 space-y-3 border-y py-3"
          style={{ borderColor: isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.15)" }}
        >
          {order.items.map((item) => (
            <li key={item.id}>
              <p className="text-sm font-bold" style={{ color: meta.fg }}>
                {item.quantity}× {item.name_ar}
              </p>
              <p className="text-xs" style={{ color: meta.fgMuted }}>
                {item.name_en}
              </p>
              {item.options_ar.map((option) => (
                <p key={option} className="mt-0.5 text-xs" style={{ color: meta.fgMuted }}>
                  • {option}
                </p>
              ))}
              {item.notes && (
                <p
                  className="mt-1 text-xs font-bold"
                  style={{ color: isLight ? "#3a2a0a" : "#fff7cc" }}
                >
                  ملاحظة: {item.notes}
                </p>
              )}
            </li>
          ))}
        </ul>

        {order.inscription && (
          <p
            className="mt-3 rounded-lg p-2 text-xs font-bold"
            style={{
              backgroundColor: isLight ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.22)",
              color: meta.fg,
            }}
          >
            الكتابة: {order.inscription}
          </p>
        )}

        {order.design_image_url && (
          <button
            type="button"
            onClick={() => onZoom(order.design_image_url as string)}
            className="mt-3 block w-full overflow-hidden rounded-xl"
            style={{ border: `1px solid ${isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.2)"}` }}
          >
            <img
              src={order.design_image_url}
              alt={`صورة تصميم الطلب ${order.order_number}`}
              loading="lazy"
              className="h-36 w-full object-cover"
            />
            <span
              className="block py-2 text-xs font-bold"
              style={{
                backgroundColor: isLight ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.25)",
                color: meta.fg,
              }}
            >
              تكبير الصورة · Zoom
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => void onReady(order.id)}
          disabled={busy || order.status === "ready"}
          className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold disabled:opacity-60"
          style={{ backgroundColor: meta.fg, color: meta.bg }}
        >
          <CheckCircle2 className="h-4 w-4" />
          {order.status === "ready" ? "جاهز ✓ Ready" : "تم التجهيز · Mark as Ready"}
        </button>
      </div>
    </article>
  );
});

/* --------------------- products & menu management (kitchen) --------------------- */

const emptyMenuItem: MenuItemInput = {
  slug: "",
  name_ar: "",
  name_en: "",
  description_ar: "",
  description_en: "",
  category: "",
  price: 0,
  image_url: "",
  is_available: true,
  is_featured: false,
  priority_color: null,
  sort_order: 0,
};

/** Priority colour tiers offered when an item is marked featured. */
const PRIORITY_OPTIONS: {
  value: PriorityColor;
  label: string;
  hint: string;
  swatch: string;
  text: string;
}[] = [
  {
    value: "dark_red",
    label: "أحمر داكن · Dark Red",
    hint: "أولوية قصوى · للكيكات الطوابق",
    swatch: "oklch(0.42_0.16_25)",
    text: "#fff",
  },
  {
    value: "warm_orange",
    label: "برتقالي دافئ · Warm Orange",
    hint: "أولوية عالية · للبوفيهات",
    swatch: "oklch(0.68_0.16_55)",
    text: "#fff",
  },
  {
    value: "golden_yellow",
    label: "أصفر ذهبي · Golden Yellow",
    hint: "أولوية 3 · للسبيشل كيك فقط",
    swatch: "oklch(0.85_0.15_92)",
    text: "#1b1200",
  },
  {
    value: "sky_blue",
    label: "أزرق سماوي · Sky Blue",
    hint: "أولوية 4 · للميني كيك",
    swatch: "oklch(0.80_0.10_230)",
    text: "#0c1a2a",
  },
  {
    value: "soft_green",
    label: "أخضر هادئ · Soft Green",
    hint: "أولوية أساسية · للبوكسات والجاهز",
    swatch: "oklch(0.82_0.11_150)",
    text: "#0a1f14",
  },
];

const priorityOption = (value: PriorityColor | null | undefined) =>
  PRIORITY_OPTIONS.find((option) => option.value === value) ?? null;

const jod = (value: number) => `${value.toFixed(2)} د.أ`;

/** Kitchen-facing menu manager: add, edit, price and retire items fast. */
function MenuPanel() {
  const queryClient = useQueryClient();
  const list = useServerFn(listMenuItems);
  const save = useServerFn(saveMenuItem);
  const remove = useServerFn(deleteMenuItem);
  const [draft, setDraft] = useState<MenuItemInput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const items = useQuery({ queryKey: ["kds-menu"], queryFn: () => list({}), staleTime: 60_000 });
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["kds-menu"] });

  const saveMutation = useMutation({
    mutationFn: (input: MenuItemInput) => save({ data: input }),
    onSuccess: () => {
      setDraft(null);
      setError(null);
      invalidate();
    },
    onError: (caught: Error) => setError(caught.message),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: invalidate,
    onError: (caught: Error) => setError(caught.message),
  });

  const field = (key: keyof MenuItemInput, value: unknown) =>
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));

  const grouped = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of items.data ?? []) {
      const bucket = map.get(item.category) ?? [];
      bucket.push(item);
      map.set(item.category, bucket);
    }
    return [...map.entries()];
  }, [items.data]);

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 pb-10 pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="me-auto">
          <h2 className="font-display text-lg font-bold">إدارة المنتجات والأسعار</h2>
          <p className="text-xs text-white/60">Products &amp; menu management · {(items.data ?? []).length} منتج</p>
        </div>
        <button
          type="button"
          onClick={() => setDraft({ ...emptyMenuItem })}
          className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[oklch(0.65_0.12_230)] px-5 text-sm font-bold text-white"
        >
          <Plus className="h-4 w-4" aria-hidden /> منتج جديد
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-[oklch(0.52_0.17_25)]/25 p-3 text-xs font-bold text-white">
          {error}
        </p>
      )}

      {draft && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            saveMutation.mutate(draft);
          }}
          className="grid gap-3 rounded-2xl border border-white/12 bg-[oklch(0.22_0.04_255)] p-4 sm:grid-cols-2"
        >
          <MenuField label="الاسم بالعربية" value={draft.name_ar} onChange={(v) => field("name_ar", v)} required />
          <MenuField label="الاسم بالإنجليزية" value={draft.name_en} onChange={(v) => field("name_en", v)} required />
          <MenuField label="التصنيف · Category" value={draft.category} onChange={(v) => field("category", v)} required />
          <MenuField
            label="السعر (د.أ)"
            type="number"
            value={String(draft.price)}
            onChange={(v) => field("price", Number(v))}
            required
          />
          <MenuField label="الوصف بالعربية" value={draft.description_ar ?? ""} onChange={(v) => field("description_ar", v)} />
          <MenuField label="الوصف بالإنجليزية" value={draft.description_en ?? ""} onChange={(v) => field("description_en", v)} />
          <MenuField
            label="ترتيب العرض"
            type="number"
            value={String(draft.sort_order)}
            onChange={(v) => field("sort_order", Number(v))}
          />
          <div className="sm:col-span-2">
            <MenuImageField
              value={draft.image_url ?? ""}
              onChange={(v) => field("image_url", v)}
              onError={setError}
            />
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-2 text-sm font-bold">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.is_available}
                onChange={(event) => field("is_available", event.target.checked)}
                className="h-5 w-5"
              />
              متاح
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.is_featured}
                onChange={(event) =>
                  setDraft((prev) =>
                    prev
                      ? {
                          ...prev,
                          is_featured: event.target.checked,
                          priority_color: event.target.checked ? prev.priority_color : null,
                        }
                      : prev,
                  )
                }
                className="h-5 w-5"
              />
              مميز · Featured
            </label>
          </div>

          {draft.is_featured && (
            <fieldset className="sm:col-span-2 rounded-2xl border border-white/12 bg-white/[0.03] p-3">
              <legend className="px-1 text-xs font-bold text-white/80">
                لون الأولوية · Priority colour
              </legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {PRIORITY_OPTIONS.map((option) => {
                  const active = draft.priority_color === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => field("priority_color", active ? null : option.value)}
                      className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2 text-start transition-colors ${
                        active ? "border-white/80 bg-white/10" : "border-white/15 hover:bg-white/5"
                      }`}
                    >
                      <span
                        aria-hidden
                        className="h-6 w-6 shrink-0 rounded-full border border-white/40"
                        style={{ background: option.swatch.replace(/_/g, " ") }}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold">{option.label}</span>
                        <span className="block truncate text-xs text-white/60">{option.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
          <div className="flex gap-2 sm:col-span-2">
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[oklch(0.65_0.12_230)] px-5 text-sm font-bold text-white disabled:opacity-60"
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} حفظ
            </button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="inline-flex min-h-12 items-center rounded-full border border-white/25 px-5 text-sm font-bold"
            >
              إلغاء
            </button>
          </div>
        </form>
      )}

      {items.isLoading && <p className="text-sm text-white/60">جارٍ تحميل المنتجات…</p>}
      {!items.isLoading && grouped.length === 0 && (
        <p className="rounded-2xl border border-white/12 p-8 text-center text-sm text-white/60">
          لا توجد منتجات بعد · أضف أول منتج
        </p>
      )}

      {grouped.map(([category, rows]) => (
        <section key={category} aria-label={category} className="space-y-3">
          <h3 className="font-display text-base font-bold text-white/90">{category}</h3>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((item) => (
              <article key={item.id} className="rounded-2xl border border-white/12 bg-[oklch(0.22_0.04_255)] p-4">
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={`صورة ${item.name_ar}`}
                    loading="lazy"
                    className="mb-3 h-36 w-full rounded-xl object-cover"
                  />
                ) : (
                  <div className="mb-3 grid h-36 w-full place-items-center rounded-xl border border-dashed border-white/20 text-xs text-white/45">
                    لا توجد صورة · No image
                  </div>
                )}
                <h4 className="font-display text-base font-bold">{item.name_ar}</h4>
                <p className="text-xs text-white/60">{item.name_en}</p>
                <p className="mt-2 text-lg font-bold">{jod(item.price)}</p>
                <p className="mt-1 text-xs text-white/60">
                  {item.is_available ? "متاح" : "غير متاح"}
                  {item.is_featured ? " · مميز" : ""}
                </p>
                {item.is_featured && priorityOption(item.priority_color) && (
                  <p
                    className="mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold"
                    style={{
                      background: priorityOption(item.priority_color)!.swatch.replace(/_/g, " "),
                      color: priorityOption(item.priority_color)!.text,
                    }}
                  >
                    {priorityOption(item.priority_color)!.label}
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDraft({ ...item })}
                    className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full border border-white/25 text-sm font-bold"
                  >
                    تعديل
                  </button>
                  <button
                    type="button"
                    onClick={() => removeMutation.mutate(item.id)}
                    aria-label={`حذف ${item.name_ar}`}
                    className="grid h-12 w-12 place-items-center rounded-full border border-[oklch(0.52_0.17_25)]/60 text-[oklch(0.75_0.14_25)]"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}

function MenuField({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-xs font-bold text-white/75">
      {label}
      <input
        type={type}
        value={value}
        required={required}
        step={type === "number" ? "0.01" : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-12 w-full rounded-xl border border-white/20 bg-[oklch(0.16_0.05_252)] px-3 text-sm font-normal text-white outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.65_0.12_230)]"
      />
    </label>
  );
}

/** Ten years of validity so a stored signed link keeps working on the storefront. */
const IMAGE_LINK_TTL = 60 * 60 * 24 * 3650;

/** Upload a photo from the device, or paste an image link; both fill image_url. */
function MenuImageField({
  value,
  onChange,
  onError,
}: {
  value: string;
  onChange: (value: string) => void;
  onError: (message: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    setUploading(true);
    onError(null);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `products/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
      if (uploadError) throw new Error(uploadError.message);
      const { data, error: signError } = await supabase.storage
        .from("product-images")
        .createSignedUrl(path, IMAGE_LINK_TTL);
      if (signError || !data?.signedUrl) throw new Error(signError?.message ?? "تعذّر إنشاء رابط الصورة");
      onChange(data.signedUrl);
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "تعذّر رفع الصورة · Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/15 p-3">
      <p className="text-xs font-bold text-white/75">صورة المنتج · Item photo</p>
      <div className="mt-2 flex flex-wrap items-start gap-3">
        {value ? (
          <img src={value} alt="معاينة صورة المنتج" className="h-24 w-24 rounded-xl object-cover" />
        ) : (
          <div className="grid h-24 w-24 place-items-center rounded-xl border border-dashed border-white/25 text-[11px] text-white/45">
            بدون صورة
          </div>
        )}
        <div className="flex min-w-52 flex-1 flex-col gap-2">
          <label className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full border border-white/25 px-4 text-sm font-bold">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
            {uploading ? "جارٍ الرفع…" : "رفع صورة من الجهاز"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void upload(file);
              }}
            />
          </label>
          <input
            type="url"
            value={value}
            placeholder="أو الصق رابط صورة · or paste image URL"
            onChange={(event) => onChange(event.target.value)}
            className="min-h-12 w-full rounded-xl border border-white/20 bg-[oklch(0.16_0.05_252)] px-3 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.65_0.12_230)]"
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[oklch(0.52_0.17_25)]/60 px-4 text-sm font-bold text-[oklch(0.75_0.14_25)]"
            >
              <Trash2 className="h-4 w-4" aria-hidden /> إزالة الصورة
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
