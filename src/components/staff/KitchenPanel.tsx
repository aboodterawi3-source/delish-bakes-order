import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bell,
  BellRing,
  Calendar as CalendarIcon,
  ChefHat,
  LayoutGrid,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useOrdersRealtime } from "@/hooks/use-orders-realtime";
import { useScreenWakeLock } from "@/hooks/use-screen-wake-lock";
import { useStaffAccess } from "@/hooks/use-staff-access";
import {
  acknowledgeOrderModification,
  getKitchenAccess,
  getKitchenOrders,
  setKitchenStage,
  type KdsOrder,
  type KitchenStage,
} from "@/lib/kds.functions";
import { OrdersCalendar } from "@/components/staff/OrdersCalendar";
import { ImageLightbox } from "@/components/staff/ImageLightbox";
import { KdsOrderCard } from "@/components/staff/KdsOrderCard";
import { KitchenOrderDetailsModal } from "@/components/staff/KitchenOrderDetailsModal";
import {
  getSharedAudioCtx,
  playKitchenChimeSound,
  playKitchenModificationChimeSound,
} from "@/components/staff/kds-audio";
import { downloadDesignImage, stageOf } from "@/components/staff/kds-helpers";
import { printKitchenTicket } from "@/lib/receipt-templates";
import { computeUnackModKey, isKitchenRelevantModification } from "@/lib/order-modifications";
import { matchesDateFilter, type DateFilterKey } from "@/lib/date-filter";

const ORDERS_KEY = ["kds-orders"] as const;

const STAGES: {
  key: KitchenStage;
  ar: string;
  en: string;
  icon: string;
  border: string;
}[] = [
  {
    key: "new",
    ar: "طلبات جديدة بانتظار البدء",
    en: "Incoming Queue",
    icon: "🆕",
    border: "border-t-4 border-t-amber-500",
  },
  {
    key: "baking",
    ar: "قيد الخبز والتزيين والكريمة",
    en: "In Baking / Decorating",
    icon: "👩‍🍳",
    border: "border-t-4 border-t-blue-500",
  },
  {
    key: "ready",
    ar: "جاهزة ومكتملة للتسليم",
    en: "Ready for Handover",
    icon: "✨",
    border: "border-t-4 border-t-emerald-500",
  },
];

export function KitchenPanel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchOrders = useServerFn(getKitchenOrders);
  const fetchAccess = useServerFn(getKitchenAccess);
  const applyStage = useServerFn(setKitchenStage);
  const ackModFn = useServerFn(acknowledgeOrderModification);

  const [filter, setFilter] = useState<DateFilterKey>("today");
  const [viewMode, setViewMode] = useState<"board" | "calendar">("board");
  const [pending, setPending] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const [selectedKitchenOrder, setSelectedKitchenOrder] = useState<KdsOrder | null>(null);

  const enableAudio = useCallback(() => {
    try {
      const ctx = getSharedAudioCtx();
      if (ctx && ctx.state === "suspended") {
        void ctx.resume();
      }
      playKitchenChimeSound();
    } catch (err) {
      console.warn("[KitchenPanel] enableAudio error:", err);
    }
    setAudioUnlocked(true);
    setSoundEnabled(true);
  }, []);

  // Unlock browser audio context automatically on user's first interaction
  useEffect(() => {
    const handleFirstInteraction = () => {
      setAudioUnlocked(true);
      try {
        const ctx = getSharedAudioCtx();
        if (ctx && ctx.state === "suspended") void ctx.resume();
      } catch (err) {
        console.warn("[KitchenPanel] audio unlock error:", err);
      }
      window.removeEventListener("click", handleFirstInteraction);
      window.removeEventListener("touchstart", handleFirstInteraction);
      window.removeEventListener("keydown", handleFirstInteraction);
    };

    window.addEventListener("click", handleFirstInteraction, { once: true });
    window.addEventListener("touchstart", handleFirstInteraction, { once: true });
    window.addEventListener("keydown", handleFirstInteraction, { once: true });

    return () => {
      window.removeEventListener("click", handleFirstInteraction);
      window.removeEventListener("touchstart", handleFirstInteraction);
      window.removeEventListener("keydown", handleFirstInteraction);
    };
  }, []);

  const access = useStaffAccess(["kitchen-access"], () => fetchAccess({}), ["kitchen", "admin"]);

  useScreenWakeLock(true);
  const realtime = useOrdersRealtime(ORDERS_KEY, true, "kitchen-live");

  const orders = useQuery({
    queryKey: ORDERS_KEY,
    queryFn: () => fetchOrders({}),
    staleTime: 15_000,
    refetchInterval: realtime.isConnected ? false : 10_000,
  });

  const knownIds = useRef<Set<string> | null>(null);
  const knownModTimestamps = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const rows = orders.data;
    if (!rows) return;
    const ids = rows.map((row) => row.id);

    if (!knownIds.current) {
      knownIds.current = new Set(ids);
      rows.forEach((r) => {
        const unackKey = computeUnackModKey(r);
        if (unackKey) {
          knownModTimestamps.current.set(r.id, unackKey);
        }
      });
      return;
    }

    const fresh = ids.filter((id) => !knownIds.current!.has(id));
    knownIds.current = new Set(ids);

    const newlyModified: string[] = [];
    rows.forEach((r) => {
      const unackKey = computeUnackModKey(r);
      if (unackKey) {
        if (knownModTimestamps.current.get(r.id) !== unackKey) {
          newlyModified.push(r.id);
          knownModTimestamps.current.set(r.id, unackKey);
        }
      } else {
        knownModTimestamps.current.delete(r.id);
      }
    });

    const toAlert = [...fresh, ...newlyModified];
    if (toAlert.length === 0) return;

    if (soundEnabled) {
      try {
        if (newlyModified.length > 0) {
          playKitchenModificationChimeSound();
        } else {
          playKitchenChimeSound();
        }
      } catch (err) {
        console.warn("[KitchenPanel] chime playback error:", err);
      }
    }
    setAlerts((curr) => [...curr, ...toAlert.filter((id) => !curr.includes(id))]);
  }, [orders.data, soundEnabled]);

  const rawOrdersList = useMemo(() => orders.data ?? [], [orders.data]);

  const activeKitchenOrder = useMemo(() => {
    if (!selectedKitchenOrder) return null;
    return rawOrdersList.find((o) => o.id === selectedKitchenOrder.id) ?? selectedKitchenOrder;
  }, [rawOrdersList, selectedKitchenOrder]);

  // FIFO sorting by nearest requested date/time, then queue rank
  const visible = useMemo(() => {
    return rawOrdersList
      .filter((order) => matchesDateFilter(order.requested_date, filter))
      .sort((a, b) => {
        const byDate = (a.requested_date || "").localeCompare(b.requested_date || "");
        if (byDate !== 0) return byDate;
        const byTime = (a.requested_time || "").localeCompare(b.requested_time || "");
        if (byTime !== 0) return byTime;
        const rankA = a.queue_rank ?? Number.MAX_SAFE_INTEGER;
        const rankB = b.queue_rank ?? Number.MAX_SAFE_INTEGER;
        return rankA - rankB;
      });
  }, [rawOrdersList, filter]);

  const onStage = useCallback(
    async (id: string, stage: KitchenStage) => {
      const previous = queryClient.getQueryData<KdsOrder[]>(ORDERS_KEY);
      queryClient.setQueryData<KdsOrder[]>(ORDERS_KEY, (rows) =>
        (rows ?? []).map((order) => (order.id === id ? { ...order, status: stage } : order)),
      );
      setPending(id);
      try {
        await applyStage({ data: { orderId: id, stage } });
      } catch (err) {
        if (previous) queryClient.setQueryData(ORDERS_KEY, previous);
        console.error("[KitchenPanel] setKitchenStage error:", err);
        toast.error(err instanceof Error ? err.message : "تعذر تحديث مرحلة الطلب في المطبخ");
      } finally {
        setPending(null);
      }
    },
    [applyStage, queryClient],
  );

  const acknowledge = useCallback(
    async (id: string, modIds?: string[]) => {
      try {
        await ackModFn({ data: { orderId: id, ...(modIds ? { modIds } : {}) } });
        setAlerts((curr) => curr.filter((v) => v !== id));
        void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
      } catch (e) {
        console.error("Ack error:", e);
        toast.error(e instanceof Error ? e.message : "تعذر اعتماد التعديل");
      }
    },
    [ackModFn, queryClient],
  );

  const unackModsCount = useMemo(() => {
    return rawOrdersList.filter((ord) => {
      const unack = (ord.modifications || [])
        .filter(isKitchenRelevantModification)
        .filter((m) => !m.acknowledgedAt);
      return unack.length > 0 || alerts.includes(ord.id);
    }).length;
  }, [rawOrdersList, alerts]);

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
          <h1 className="text-xl font-black text-foreground">لا تملك صلاحية المطبخ</h1>
          <p className="text-xs text-muted-foreground">
            هذا الحساب لا يملك صلاحيات الوصول لشاشة المطبخ (KDS).
          </p>
          <button
            type="button"
            onClick={signOut}
            className="min-h-[44px] cursor-pointer rounded-xl bg-primary px-6 text-xs font-black text-primary-foreground shadow-sm hover:opacity-90"
          >
            تسجيل الخروج
          </button>
        </div>
      </main>
    );
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen w-full bg-background pb-20 font-sans text-foreground select-none"
    >
      <header className="sticky top-0 z-30 border-b border-border/80 bg-card/95 px-4 py-3 shadow-xs backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-500 text-white shadow-sm">
              <ChefHat className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg leading-none font-black text-foreground">
                  شاشة المطبخ والإنتاج • Delish Bakery KDS
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-black text-amber-600">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                  مباشر FIFO
                </span>
                {unackModsCount > 0 && (
                  <span className="inline-flex animate-pulse items-center gap-1.5 rounded-full bg-amber-500 px-2.5 py-0.5 text-[11px] font-black text-white shadow-sm">
                    ⚠️ {unackModsCount} طلب معدّل بانتظار الاعتماد
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs font-bold text-muted-foreground">
                ترتيب زمني تلقائي • الأقرب موعداً في الصدارة دائماً • إبراز فوري للعبارة المكتوبة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-2xl border border-border/70 bg-secondary/80 p-1">
              <button
                type="button"
                onClick={() => setViewMode("board")}
                className={`flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-xl px-3.5 text-xs font-black transition-all ${
                  viewMode === "board"
                    ? "border border-border/80 bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>لوحة التجهيز</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("calendar")}
                className={`flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-xl px-3.5 text-xs font-black transition-all ${
                  viewMode === "calendar"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                <span>تقويم الطلبات</span>
              </button>
            </div>

            {viewMode === "board" && (
              <div className="flex rounded-2xl border border-border/70 bg-secondary/60 p-1">
                <button
                  type="button"
                  onClick={() => setFilter("today")}
                  className={`min-h-[38px] cursor-pointer rounded-xl px-3.5 text-xs font-black transition-all ${
                    filter === "today"
                      ? "border border-border/80 bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  طلبات اليوم
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("tomorrow")}
                  className={`min-h-[38px] cursor-pointer rounded-xl px-3.5 text-xs font-black transition-all ${
                    filter === "tomorrow"
                      ? "border border-border/80 bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  غداً
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className={`min-h-[38px] cursor-pointer rounded-xl px-3.5 text-xs font-black transition-all ${
                    filter === "all"
                      ? "border border-border/80 bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  جميع الطلبات
                </button>
              </div>
            )}

            {!audioUnlocked ? (
              <button
                type="button"
                onClick={enableAudio}
                className="flex min-h-[44px] animate-pulse cursor-pointer items-center gap-1.5 rounded-xl border border-amber-500 bg-amber-500 px-3.5 text-xs font-black text-white shadow-md transition-all hover:bg-amber-600 active:scale-95"
                title="اضغط هنا لتفعيل صوت جرس التنبيهات في المتصفح"
              >
                <BellRing className="h-4 w-4 animate-bounce" />
                <span>تفعيل جرس التنبيهات 🔔</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setSoundEnabled((v) => !v)}
                className={`flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl border px-3.5 text-xs font-black transition ${
                  soundEnabled
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                    : "border-border bg-secondary text-muted-foreground"
                }`}
              >
                {soundEnabled ? (
                  <BellRing className="h-4 w-4 text-amber-500" />
                ) : (
                  <Bell className="h-4 w-4" />
                )}
                <span>{soundEnabled ? "رنين التنبيهات شغال" : "صامت"}</span>
              </button>
            )}

            <div
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-bold ${
                realtime.isConnected
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                  : "animate-pulse border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
              }`}
              title={
                orders.dataUpdatedAt
                  ? `آخر مزامنة ناجحة: ${new Date(orders.dataUpdatedAt).toLocaleTimeString("ar-JO")}`
                  : "جلب دوري كل 10 ثوانٍ وبث تحديثات المطبخ"
              }
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  realtime.isConnected ? "animate-pulse bg-emerald-500" : "bg-amber-500"
                }`}
              />
              <span>
                {realtime.isConnected ? "تحديث دوري (10ث) + بث مباشر" : "جارِ المزامنة..."}
              </span>
            </div>

            <button
              type="button"
              onClick={() => void queryClient.invalidateQueries({ queryKey: ORDERS_KEY })}
              title="تحديث الطلبات"
              className="grid h-11 w-11 cursor-pointer place-items-center rounded-xl border border-border bg-card text-foreground hover:bg-secondary"
            >
              <RefreshCw
                className={`h-4 w-4 ${orders.isFetching ? "animate-spin text-primary" : ""}`}
              />
            </button>
          </div>
        </div>
      </header>

      {viewMode === "calendar" ? (
        <main className="mx-auto max-w-7xl px-3 py-4 sm:px-4">
          <OrdersCalendar
            orders={rawOrdersList}
            isKitchen={true}
            onOpen={(id) => {
              const k = rawOrdersList.find((x) => x.id === id);
              if (k) setSelectedKitchenOrder(k);
            }}
            onKitchenStage={(id, stage) => {
              void onStage(id, stage);
            }}
            onPrintKitchenTicket={(ord) => {
              const k = rawOrdersList.find((x) => x.id === ord.id);
              if (k) printKitchenTicket(k);
            }}
          />
        </main>
      ) : (
        <main className="mx-auto max-w-7xl px-3 py-4 sm:px-4">
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-3">
            {STAGES.map((stage) => {
              const list = visible
                .filter((o) => stageOf(o.status) === stage.key)
                .sort((a, b) => {
                  const aHasUnack =
                    (a.modifications || [])
                      .filter(isKitchenRelevantModification)
                      .some((m) => !m.acknowledgedAt) || alerts.includes(a.id);
                  const bHasUnack =
                    (b.modifications || [])
                      .filter(isKitchenRelevantModification)
                      .some((m) => !m.acknowledgedAt) || alerts.includes(b.id);
                  if (aHasUnack && !bHasUnack) return -1;
                  if (!aHasUnack && bHasUnack) return 1;
                  return 0;
                });
              return (
                <section
                  key={stage.key}
                  className={`flex flex-col overflow-hidden rounded-3xl border border-border/80 bg-card shadow-xs ${stage.border}`}
                >
                  <div className="flex items-center justify-between border-b border-border/60 bg-secondary/30 p-3.5">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{stage.icon}</span>
                      <h3 className="text-sm font-black text-foreground">{stage.ar}</h3>
                      <span className="grid h-6 min-w-6 place-items-center rounded-full bg-primary px-2 text-[11px] font-black text-primary-foreground shadow-2xs">
                        {list.length}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground">{stage.en}</span>
                  </div>

                  <div className="min-h-[58vh] space-y-3.5 p-3">
                    {list.length > 0 ? (
                      list.map((order) => (
                        <KdsOrderCard
                          key={order.id}
                          order={order}
                          busy={pending === order.id}
                          onAck={acknowledge}
                          onStage={onStage}
                          onZoom={setZoom}
                          onOpenDetails={setSelectedKitchenOrder}
                        />
                      ))
                    ) : (
                      <div className="grid h-48 place-items-center rounded-2xl border border-dashed border-border/80 p-4 text-center text-xs font-bold text-muted-foreground/60">
                        لا توجد طلبات في هذه المرحلة حالياً
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </main>
      )}

      <ImageLightbox
        src={zoom}
        onClose={() => setZoom(null)}
        alt="صورة التصميم المرجعية بملء الشاشة"
        onDownload={(url) => void downloadDesignImage(url, "design")}
      />

      {activeKitchenOrder && (
        <KitchenOrderDetailsModal
          order={activeKitchenOrder}
          onClose={() => setSelectedKitchenOrder(null)}
          onStage={onStage}
          onPrintTicket={printKitchenTicket}
          onZoom={setZoom}
        />
      )}
    </div>
  );
}
