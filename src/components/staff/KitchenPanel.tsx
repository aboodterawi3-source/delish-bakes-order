import { useNavigate } from "@tanstack/react-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bell,
  CheckCircle2,
  ChefHat,
  Clock3,
  Download,
  Loader2,
  LogOut,
  Play,
  Printer,
  RefreshCw,
  Undo2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrdersRealtime } from "@/hooks/use-orders-realtime";
import {
  getKitchenAccess,
  getKitchenOrders,
  setKitchenStage,
  type KdsOrder,
  type KitchenStage,
} from "@/lib/kds.functions";
import { PRIORITY_META } from "@/lib/priority";
import bellAsset from "@/assets/Bell.mp3.asset.json";


/**
 * Saves the original, uncompressed reference image so the kitchen can send it
 * straight to the edible printer.
 */
async function downloadDesignImage(url: string, orderNumber: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("download failed");
    const blob = await response.blob();
    const extension = (blob.type.split("/")[1] ?? "jpg").replace("jpeg", "jpg");
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `delish-${orderNumber}.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    // Signed URL expired or blocked: open it so the cook can still save manually.
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/**
 * Kitchen ticket: preparation details only. No prices, totals, payment or
 * customer contact data, so it stays fully separate from the cashier receipt
 * and can be sent to the kitchen printer on its own.
 */
function printKitchenTicket(order: KdsOrder) {
  const lines = order.items
    .map(
      (item) =>
        `<div class="item"><b>${item.quantity} × ${item.name_ar}</b>` +
        (item.options_ar.length ? `<div class="opt">${item.options_ar.map((o) => `• ${o}`).join("<br>")}</div>` : "") +
        (item.notes ? `<div class="note">ملاحظة: ${item.notes}</div>` : "") +
        `</div>`,
    )
    .join("");
  const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<title>تذكرة مطبخ ${order.order_number}</title>
<style>@page{size:80mm auto;margin:4mm}body{font-family:system-ui,sans-serif;width:72mm;font-size:13px;color:#000}
h1{font-size:16px;margin:0 0 2px;text-align:center}.line{border-top:1px dashed #000;margin:6px 0}
.item{margin:6px 0}.opt{font-size:12px}.note{font-size:12px;font-weight:700}
.row{display:flex;justify-content:space-between}</style></head>
<body><h1>تذكرة مطبخ · KITCHEN</h1>
<div class="row"><b>${order.order_number}</b><span>${order.method === "delivery" ? "توصيل" : "استلام"}</span></div>
<div class="row"><span>${order.requested_date}</span><span>${order.requested_time.slice(0, 5)}</span></div>
<div>${order.customer_name}</div>
${order.schedule_updated_at ? `<div><b>تم تعديل الموعد 🔄</b></div>` : ""}
<div class="line"></div>${lines}<div class="line"></div>
${order.inscription ? `<div><b>الكتابة على الكيك:</b> ${order.inscription}</div>` : ""}
${order.notes ? `<div><b>ملاحظات:</b> ${order.notes}</div>` : ""}
<div class="line"></div><div style="text-align:center">للمطبخ فقط — لا يحتوي أسعار</div>
<script>window.onload=function(){window.print();}</script></body></html>`;
  const win = window.open("", "_blank", "width=380,height=640");
  if (!win) return;
  win.document.write(html);
  win.document.close();
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

export function KitchenPanel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchOrders = useServerFn(getKitchenOrders);
  const fetchAccess = useServerFn(getKitchenAccess);
  const applyStage = useServerFn(setKitchenStage);

  const [filter, setFilter] = useState<Filter>("today");
  const [view, setView] = useState<"board" | "menu">("board");
  const [shiftOn, setShiftOn] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
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

  const chime = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return false;
    try {
      audio.currentTime = 0;
      await audio.play();
      return true;
    } catch {
      // Browsers can revoke autoplay permission after a reload/background tab.
      // Requiring Start Shift again provides the user gesture needed to unlock it.
      setShiftOn(false);
      return false;
    }
  }, []);

  const startShift = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio(bellAsset.url);
      audio.preload = "auto";
      audio.volume = 1;
      audioRef.current = audio;
    }
    void chime().then((played) => setShiftOn(played));
  }, [chime]);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      audioRef.current = null;
    },
    [],
  );

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
    if (fresh && shiftOn) void chime();
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
        return PRIORITY_META[a.priority_color].rank - PRIORITY_META[b.priority_color].rank;
      });
  }, [orders.data, filter]);

  /** Moves the card between stages instantly, then confirms with the server. */
  const onStage = useCallback(
    async (id: string, stage: KitchenStage) => {
      const previous = queryClient.getQueryData<KdsOrder[]>(ORDERS_KEY);
      queryClient.setQueryData<KdsOrder[]>(ORDERS_KEY, (rows) =>
        (rows ?? []).map((order) => (order.id === id ? { ...order, status: stage } : order)),
      );
      setPending(id);
      try {
        await applyStage({ data: { orderId: id, stage } });
      } catch {
        if (previous) queryClient.setQueryData(ORDERS_KEY, previous);
      } finally {
        setPending(null);
      }
    },
    [applyStage, queryClient],
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
    <div dir="rtl" className="min-h-dvh w-full max-w-full overflow-x-hidden bg-[#F9FBFC] text-[#3E2723] bg-delish-pattern pb-16">
      <header className="sticky top-0 z-20 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[#F1F5F9] bg-white/95 px-4 py-3.5 backdrop-blur-md shadow-xs sm:flex sm:flex-wrap sm:justify-between">
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
        <div className="col-span-2 flex w-full flex-wrap gap-2 sm:col-auto sm:w-auto">
          <button
            type="button"
            onClick={startShift}
            disabled={shiftOn}
            className="inline-flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-[#FDE2CF] px-3 text-center text-xs font-bold text-[#7B3F00] shadow-xs hover:bg-[#fed6bc] disabled:opacity-70 sm:flex-none sm:px-5 sm:text-sm"
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

      <div className="no-scrollbar flex w-full max-w-full gap-2 overflow-x-auto overscroll-x-contain px-4 py-3.5">
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

          <main className="w-full min-w-0 px-4 pb-8">
            {orders.isLoading && <p className="p-6 text-sm text-[#7A6458]">جارٍ تحميل الطلبات…</p>}
            {!orders.isLoading && visible.length === 0 && (
              <div className="p-12 text-center text-sm text-[#7A6458] rounded-3xl bg-white/70 border border-slate-100">
                لا توجد طلبات لهذا اليوم
              </div>
            )}
            {!orders.isLoading &&
              visible.length > 0 &&
              STAGES.map(({ key, ar, en, chip }) => {
                const rows = visible.filter((order) => stageOf(order.status) === key);
                return (
                  <section key={key} className="mb-8">
                    <div className="mb-3 flex items-center gap-2">
                      <span className={`rounded-full px-3.5 py-1 text-xs font-extrabold shadow-xs ${chip}`}>{ar}</span>
                      <span className="text-xs font-bold text-[#7A6458]">
                        {en} · {rows.length}
                      </span>
                    </div>
                    {rows.length === 0 ? (
                      <p className="rounded-3xl border border-slate-100 bg-white/70 p-6 text-center text-xs text-[#7A6458]">
                        لا يوجد طلبات في هذه المرحلة
                      </p>
                    ) : (
                      <div className="grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {rows.map((order) => (
                          <KdsCard
                            key={order.id}
                            order={order}
                            busy={pending === order.id}
                            onStage={onStage}
                            onZoom={setZoom}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
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
  const meta = PRIORITY_META[order.priority_color];
  const isReady = order.status === "ready";
  return (
    <article
       className="relative min-w-0 overflow-hidden rounded-3xl border border-card/40 p-4 transition-transform hover:-translate-y-0.5 sm:p-5"
      style={{ backgroundColor: meta.bg, color: meta.fg, boxShadow: meta.glow }}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="min-w-0">
          <h2 className="truncate font-sans text-base font-extrabold">
            {order.order_number} · {order.customer_name}
          </h2>
           <p className="mt-1 flex min-w-0 flex-wrap items-center gap-1 break-words text-xs" style={{ color: meta.fgMuted }}>
            <Clock3 className="h-3.5 w-3.5 text-[#B8860B]" />
            {order.requested_date} · {order.requested_time.slice(0, 5)} · {order.method === "delivery" ? "توصيل" : "استلام"}
          </p>
          {order.schedule_updated_at && (
            <p className="mt-2 inline-flex rounded-full bg-[#B8860B] px-3 py-1 text-[11px] font-extrabold text-white shadow-sm">
              تم تعديل الموعد 🔄
            </p>
          )}
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

      {order.notes && (
        <p className="mt-3 rounded-xl border border-card/30 bg-card/20 p-2.5 text-xs font-bold">
          ملاحظات الطلب: {order.notes}
        </p>
      )}

      {order.design_image_url && (
        <div className="mt-3 space-y-2">
          <button
            type="button"
            onClick={() => onZoom(order.design_image_url as string)}
            className="block w-full overflow-hidden rounded-2xl border border-card/40 bg-card/20 transition-transform hover:scale-[1.01] active:scale-95"
          >
            <img
              src={order.design_image_url}
              alt={`صورة تصميم الطلب ${order.order_number}`}
              loading="lazy"
              className="h-36 w-full object-cover"
            />
            <span className="block bg-peach-coral/80 py-2 text-xs font-bold text-primary">
              تكبير الصورة · Zoom Design
            </span>
          </button>
          <button
            type="button"
            onClick={() => void downloadDesignImage(order.design_image_url as string, order.order_number)}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-card/90 px-4 text-xs font-bold text-primary shadow-sm transition-transform hover:scale-[1.02] active:scale-95"
          >
            <Download className="h-4 w-4" />
            تحميل الصورة للطباعة · Download for printing
          </button>
        </div>
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
