import { useNavigate } from "@tanstack/react-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Bell,
  BellRing,
  CheckCircle2,
  ChefHat,
  Clock3,
  Download,
  Loader2,
  LogOut,
  Maximize2,
  PencilLine,
  Play,
  Printer,
  RefreshCw,
  Undo2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrdersRealtime } from "@/hooks/use-orders-realtime";
import {
  acknowledgeOrderModification,
  getKitchenAccess,
  getKitchenOrders,
  setKitchenStage,
  type KdsOrder,
  type KitchenStage,
} from "@/lib/kds.functions";
import { PRIORITY_META, type PriorityColor } from "@/lib/priority";
import { esc, printDocument } from "@/lib/print";
import bellAsset from "@/assets/Bell.mp3.asset.json";
import { orderLabel } from "@/lib/order-label";
import { isoDay, matchesDateFilter, type CustomRange, type DateFilterKey } from "@/lib/date-filter";

/** Formats relative time in Arabic (e.g., قبل 5 دقائق) */
function formatRelativeTime(dateString: string) {
  if (!dateString) return "";
  try {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "قبل لحظات";
    if (diffMins < 60) return `قبل ${diffMins} دقيقة`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `قبل ${diffHours} ساعة`;
    return `قبل ${Math.floor(diffHours / 24)} يوم`;
  } catch {
    return "";
  }
}

/** Formats HH:mm to 12-hour Arabic (e.g. 11:30 ص / 02:00 م) */
function formatTimeSlotArabic(timeStr: string): string {
  if (!timeStr) return "";
  try {
    const parts = timeStr.slice(0, 5).split(":");
    let h = parseInt(parts[0], 10);
    const m = parts[1] || "00";
    if (isNaN(h)) return timeStr.slice(0, 5);
    const period = h >= 12 ? "م" : "ص";
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${period}`;
  } catch {
    return timeStr.slice(0, 5);
  }
}

/** Audio synth chime fallback to guarantee alert sound */
function playKitchenChimeSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {
    console.error("Audio synth error:", e);
  }
}

/** Saves design image for edible printer */
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
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/** Kitchen thermal ticket generator without financial details */
function printKitchenTicket(order: KdsOrder) {
  const lines = order.items.length
    ? order.items
        .map(
          (item) =>
            `<div class="item"><b style="font-size:17px;">${item.quantity} × ${esc(item.name_ar)}</b>` +
            (item.options_ar.length
              ? `<div class="opt" style="font-size:14px;color:#333;">${item.options_ar.map((o) => `• ${esc(o)}`).join("<br>")}</div>`
              : "") +
            (item.notes ? `<div class="note" style="font-size:13px;color:#b8860b;">ملاحظة: ${esc(item.notes)}</div>` : "") +
            `</div>`,
        )
        .join("")
    : `<div class="item">لا توجد أصناف مسجلة</div>`;

  const body = `<h1 style="text-align:center;font-size:20px;margin-bottom:6px;">تذكرة مطبخ • KITCHEN</h1>
<div class="row" style="font-size:18px;font-weight:bold;margin-bottom:4px;"><b>${esc(orderLabel(order.order_number, order.staff_code))}</b><span>${order.method === "delivery" ? "توصيل 🛵" : "استلام 🏪"}</span></div>
<div class="row" style="font-size:16px;font-weight:bold;margin-bottom:6px;"><b>الموعد:</b> <b>${esc(order.requested_date ?? "")} - ${esc(formatTimeSlotArabic(order.requested_time ?? ""))}</b></div>
<div style="font-size:15px;margin-bottom:6px;"><b>العميل:</b> ${esc(order.customer_name)}</div>
${order.schedule_updated_at ? `<div style="color:red;font-weight:bold;">⚠️ تم تعديل الموعد سابقاً</div>` : ""}
<div class="line" style="border-top:2px dashed #000;margin:6px 0;"></div>${lines}<div class="line" style="border-top:2px dashed #000;margin:6px 0;"></div>
${order.inscription ? `<div style="background:#FFF3CD;padding:8px;border:2px solid #000;border-radius:6px;margin:8px 0;font-size:16px;"><b>الكتابة على الكيك:</b> ${esc(order.inscription)}</div>` : ""}
${order.notes ? `<div style="margin-top:6px;font-size:13px;"><b>ملاحظات:</b> ${esc(order.notes)}</div>` : ""}`;

  printDocument(`تذكرة مطبخ ${order.order_number}`, body, "body{font-size:14px}");
}

const ORDERS_KEY = ["kds-orders"] as const;

const STAGES: { key: KitchenStage; ar: string; en: string; badge: string; border: string }[] = [
  { key: "new", ar: "طلبات جديدة", en: "New", badge: "bg-amber-100 text-amber-900 border-amber-300", border: "border-t-4 border-t-amber-500" },
  { key: "baking", ar: "قيد التجهيز", en: "In Preparation", badge: "bg-blue-100 text-blue-900 border-blue-300", border: "border-t-4 border-t-blue-500" },
  { key: "ready", ar: "جاهزة للتسليم", en: "Ready", badge: "bg-emerald-100 text-emerald-900 border-emerald-300", border: "border-t-4 border-t-emerald-500" },
];

const stageOf = (status: string): KitchenStage =>
  status === "ready" ? "ready" : status === "baking" ? "baking" : "new";

/** Formats time remaining with exact SLA color indicators: Green (>45m), Orange (<20m), Red Blinking (Overdue) */
function getCountdownText(requestedDate: string, requestedTime: string) {
  if (!requestedDate || !requestedTime) return { text: "الموعد غير محدد", status: "normal" as const };
  
  try {
    const timeClean = requestedTime.slice(0, 5);
    const target = new Date(`${requestedDate}T${timeClean}:00`);
    const now = new Date();
    const diffMs = target.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / 60000);

    if (diffMins < 0) {
      const lateMins = Math.abs(diffMins);
      const lateStr = lateMins >= 60 ? `${Math.floor(lateMins / 60)}س ${lateMins % 60}د` : `${lateMins}د`;
      return { text: `متأخر: -${lateStr}`, status: "overdue" as const, mins: diffMins };
    }

    if (diffMins <= 20) {
      return { text: `مستعجل: ${diffMins} دقيقة`, status: "urgent" as const, mins: diffMins };
    }

    if (diffMins <= 45) {
      return { text: `باقي: ${diffMins} دقيقة`, status: "normal" as const, mins: diffMins };
    }

    const hours = Math.floor(diffMins / 60);
    const remMins = diffMins % 60;
    return { text: `باقي: ${hours > 0 ? `${hours}س ` : ""}${remMins}د`, status: "safe" as const, mins: diffMins };
  } catch {
    return { text: requestedTime.slice(0, 5), status: "normal" as const, mins: 999 };
  }
}

/** Resolves visual priority styles for cards based on category or item color */
function getPriorityStyles(color: PriorityColor) {
  switch (color) {
    case "deep_orange":
      return {
        cardBg: "bg-[#FFF8F6] border-orange-300",
        badgeBg: "bg-orange-100 text-orange-950 border-orange-300",
        badgeText: "أولوية قصوى",
      };
    case "warm_amber":
      return {
        cardBg: "bg-[#FFFBF2] border-amber-300",
        badgeBg: "bg-amber-100 text-amber-950 border-amber-300",
        badgeText: "توصيل سريع",
      };
    case "fresh_mint":
      return {
        cardBg: "bg-[#F4FBF7] border-emerald-300",
        badgeBg: "bg-emerald-100 text-emerald-950 border-emerald-300",
        badgeText: "تجهيز عادي",
      };
    case "royal_gold":
      return {
        cardBg: "bg-[#FFFCF0] border-yellow-400",
        badgeBg: "bg-yellow-100 text-yellow-950 border-yellow-400",
        badgeText: "VIP خاص",
      };
    case "soft_green":
    default:
      return {
        cardBg: "bg-[#F9FBFC] border-slate-200",
        badgeBg: "bg-slate-100 text-slate-800 border-slate-200",
        badgeText: "طلب عادي",
      };
  }
}
const KdsCleanCard = memo(function KdsCleanCard({
  order,
  busy,
  alerted = false,
  onAck,
  onStage,
  onZoom,
}: {
  order: KdsOrder;
  stageBorder: string;
  busy: boolean;
  alerted?: boolean;
  onAck: (id: string) => void;
  onStage: (id: string, stage: KitchenStage) => void;
  onZoom: (url: string) => void;
}) {
  const stage = stageOf(order.status);
  const priorityMeta = PRIORITY_META[order.priority_color ?? "soft_green"] || PRIORITY_META["soft_green"];
  const orderPrio = getPriorityStyles(order.priority_color ?? "soft_green");
  const countdown = useMemo(
    () => getCountdownText(order.requested_date, order.requested_time),
    [order.requested_date, order.requested_time],
  );

  const unackMods = (order.modifications ?? []).filter((m) => !m.acknowledgedAt);
  const hasUnack = unackMods.length > 0;
  const isEdited = hasUnack || alerted || Boolean(order.last_edited_at || order.schedule_updated_at);

  // Filter out packaging accessories (candles, balloons, toppers) to show as a compact summary
  const packagingKeywords = ["شمعة", "شموع", "بالون", "بالونات", "توبر", "كرت", "topper", "candle", "balloon"];
  const mainItems = order.items.filter(
    (it) => !packagingKeywords.some((kw) => (it.name_ar || "").toLowerCase().includes(kw)),
  );
  const accessoryItems = order.items.filter((it) =>
    packagingKeywords.some((kw) => (it.name_ar || "").toLowerCase().includes(kw)),
  );

  return (
    <article
      className={`relative flex flex-col justify-between rounded-2xl border p-2.5 sm:p-3 shadow-xs hover:shadow-md transition-all text-slate-900 ${orderPrio.cardBg}`}
    >
      {/* Top Priority Accent Strip */}
      <div
        className="absolute top-0 inset-x-0 h-1.5"
        style={{ backgroundColor: priorityMeta.swatch || priorityMeta.bg }}
      />

      <div className="space-y-2 pt-1">
        {/* CARD HEADER: Time (Bold & Big), Countdown SLA, Order Label */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="font-extrabold text-base sm:text-lg text-slate-900 leading-tight">
                {orderLabel(order.order_number, order.staff_code)}
              </h2>
              {isEdited && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black border ${
                    hasUnack
                      ? "bg-amber-500 text-white border-amber-400 animate-pulse"
                      : "bg-amber-100 text-amber-900 border-amber-300"
                  }`}
                >
                  <PencilLine className="h-3 w-3" />
                  معدّل
                </span>
              )}
            </div>
            <p className="text-xs font-bold text-slate-600 truncate mt-0.5">
              العميل: {order.customer_name}
            </p>
          </div>

          {/* Delivery Time & SLA Countdown Badge */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-black border shadow-2xs ${
                countdown.status === "overdue"
                  ? "bg-red-600 text-white border-red-500 animate-pulse"
                  : countdown.status === "urgent"
                    ? "bg-amber-500 text-white border-amber-400 animate-pulse"
                    : countdown.status === "safe"
                      ? "bg-emerald-600 text-white border-emerald-500"
                      : "bg-amber-100 text-amber-950 border-amber-300 font-bold"
              }`}
            >
              <Clock3 className="h-3.5 w-3.5" />
              {countdown.text}
            </span>
            <span className="text-xs font-black text-slate-800 flex items-center gap-1">
              ⏰ {formatTimeSlotArabic(order.requested_time)}
            </span>
          </div>
        </div>

        {/* PROMINENT ALERT DIFF BOX FOR MODIFICATIONS */}
        {order.modifications && order.modifications.length > 0 && (
          <div className="rounded-xl border-2 border-orange-400 bg-orange-50/95 p-2 text-xs space-y-1.5 shadow-xs">
            <div className="flex items-center justify-between text-orange-950 font-black">
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0" />
                تعديل بالطلب:
              </span>
              {hasUnack ? (
                <span className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full font-black animate-pulse">
                  تعديل غير مؤكد
                </span>
              ) : (
                <span className="bg-emerald-700 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
                  تمت المراجعة ✓
                </span>
              )}
            </div>

            <div className="space-y-1">
              {order.modifications.map((mod, idx) => (
                <div key={idx} className="rounded-lg bg-white p-1.5 border border-orange-200 text-[11px]">
                  <div className="flex justify-between font-bold text-slate-500 mb-0.5">
                    <span>{mod.field}:</span>
                    <span>{formatRelativeTime(mod.updatedAt)}</span>
                  </div>
                  {mod.oldValue && (
                    <div className="flex items-center gap-1 text-red-700 bg-red-50 p-1 rounded font-bold">
                      <span className="shrink-0">❌ تم حذفه:</span>
                      <span className="line-through">{mod.oldValue}</span>
                    </div>
                  )}
                  {mod.newValue && (
                    <div className="flex items-center gap-1 text-emerald-800 bg-emerald-50 p-1 rounded font-black">
                      <span className="shrink-0">➕ تمت إضافته:</span>
                      <span>{mod.newValue}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {hasUnack && (
              <button
                type="button"
                onClick={() => onAck(order.id)}
                className="w-full min-h-[48px] rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-black text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4" />
                [ تمت مراجعة التعديل ]
              </button>
            )}
          </div>
        )}

        {/* ORDER ITEMS: Cake Name, Size, Filling in Large Font Legible from 2 meters */}
        <div className="space-y-1.5">
          {(mainItems.length > 0 ? mainItems : order.items).map((item) => (
            <div
              key={item.id}
              className="rounded-xl bg-white p-2.5 border border-slate-200/90 shadow-2xs space-y-1"
            >
              <div className="flex items-baseline justify-between gap-1">
                <span className="font-black text-base sm:text-lg text-slate-950 leading-snug">
                  {item.quantity} × {item.name_ar}
                </span>
                {item.category && (
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    {item.category}
                  </span>
                )}
              </div>

              {item.options_ar.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {item.options_ar.map((option, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center rounded-md bg-amber-100/90 px-2 py-0.5 text-xs font-black text-amber-950 border border-amber-300"
                    >
                      {option}
                    </span>
                  ))}
                </div>
              )}

              {item.notes && (
                <p className="text-xs font-black text-[#8B4513] bg-[#FFF8EE] p-1.5 rounded-lg border border-[#B8860B]/20">
                  ملاحظة الصنف: {item.notes}
                </p>
              )}
            </div>
          ))}

          {/* INSCRIPTION / CAKE WRITING: Prominent Highlighted Box Under Cake Name */}
          {order.inscription && (
            <div className="rounded-xl border-2 border-amber-400 bg-amber-100/80 p-2 text-xs shadow-2xs">
              <span className="font-black text-amber-950 block mb-0.5">✍️ الكتابة على الكيك:</span>
              <p className="font-black text-slate-950 bg-white p-2 rounded-lg border border-amber-300 text-sm sm:text-base leading-snug">
                "{order.inscription}"
              </p>
            </div>
          )}

          {/* PACKAGING ACCESSORIES SUMMARY (Candles, Toppers, Balloons) */}
          {accessoryItems.length > 0 && (
            <div className="text-[11px] font-bold text-slate-600 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
              <span className="font-black text-slate-800">ملحقات التغليف: </span>
              {accessoryItems.map((acc) => `${acc.quantity} × ${acc.name_ar}`).join(" • ")}
            </div>
          )}

          {/* REFERENCE DESIGN IMAGE THUMBNAIL (Tap to zoom full screen) */}
          {order.design_image_url && (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-white p-1.5 border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => onZoom(order.design_image_url as string)}
                className="flex items-center gap-2 text-xs font-black text-amber-800 hover:text-amber-950 cursor-pointer min-h-[48px]"
              >
                <img
                  src={order.design_image_url}
                  alt="تصميم الكيك"
                  className="h-11 w-11 rounded-lg object-cover border border-slate-200 shrink-0"
                />
                <span className="underline">صورة التصميم المرجعية (عرض كامل) 🔍</span>
              </button>
              <button
                type="button"
                onClick={() => void downloadDesignImage(order.design_image_url as string, order.order_number)}
                title="تحميل الصورة"
                className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <Download className="h-4 w-4" />
              </button>
            </div>
          )}

          {order.notes && (
            <div className="text-[11px] text-slate-700 bg-slate-100 p-1.5 rounded-lg">
              <span className="font-bold">ملاحظات عامة: </span>
              <span>{order.notes}</span>
            </div>
          )}
        </div>
      </div>

      {/* FOOTER & ACTIONS (Main Action Button: 52px tall, No arrow reorder buttons) */}
      <div className="mt-3 pt-2 border-t border-slate-200/80 space-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => printKitchenTicket(order)}
            title="طباعة تذكرة المطبخ"
            className="flex-1 min-h-[48px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-white text-slate-800 border border-slate-300 text-xs font-black shadow-2xs hover:bg-slate-50 active:scale-95 cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            🖨️ طباعة تذكرة
          </button>
        </div>

        {/* Main Stage Action Button (52px tall) */}
        {stage === "new" && (
          <button
            type="button"
            onClick={() => void onStage(order.id, "baking")}
            disabled={busy}
            className="w-full min-h-[52px] inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-600 text-white font-black text-sm shadow-md hover:bg-amber-700 active:scale-95 disabled:opacity-60 cursor-pointer"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
            [ بدء التحضير ⬅️ ]
          </button>
        )}

        {stage === "baking" && (
          <button
            type="button"
            onClick={() => void onStage(order.id, "ready")}
            disabled={busy}
            className="w-full min-h-[52px] inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 text-white font-black text-sm shadow-md hover:bg-blue-700 active:scale-95 disabled:opacity-60 cursor-pointer"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
            [ جاهز للتسليم ✓ ]
          </button>
        )}

        {stage === "ready" && (
          <div className="flex gap-2">
            <span className="flex-1 min-h-[52px] inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-white font-black text-xs shadow-xs">
              <CheckCircle2 className="h-4 w-4" /> جاهز بالمحل ✓
            </span>
            <button
              type="button"
              onClick={() => void onStage(order.id, "baking")}
              disabled={busy}
              title="تراجع إلى قيد التجهيز"
              className="min-h-[52px] px-4 inline-flex items-center justify-center rounded-2xl bg-white text-slate-800 border border-slate-200 text-xs font-black hover:bg-slate-100 cursor-pointer"
            >
              <Undo2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </article>
  );
});
export function KitchenPanel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchOrders = useServerFn(getKitchenOrders);
  const fetchAccess = useServerFn(getKitchenAccess);
  const applyStage = useServerFn(setKitchenStage);
  const ackModFn = useServerFn(acknowledgeOrderModification);

  const [filter, setFilter] = useState<DateFilterKey>("today");
  const [custom, setCustom] = useState<CustomRange>({ from: isoDay(0), to: isoDay(0) });
  const [pending, setPending] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [zoom, setZoom] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const knownIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    try {
      const audio = new Audio(bellAsset.dataUri);
      audio.preload = "auto";
      audioRef.current = audio;
    } catch {
      /* ignore audio error */
    }
  }, []);

  const access = useQuery({
    queryKey: ["kitchen-access"],
    queryFn: () => fetchAccess({}),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    retry: 1,
  });

  const orders = useQuery({
    queryKey: ORDERS_KEY,
    queryFn: () => fetchOrders({}),
    staleTime: 5000,
    refetchInterval: 10000,
  });

  // Realtime subscription
  useOrdersRealtime({
    queryKey: ORDERS_KEY,
    filter: (payload) => {
      const status = payload.new?.status ?? payload.old?.status;
      return ["new", "baking", "ready"].includes(status);
    },
    onInsert: (row) => {
      if (soundEnabled) {
        if (audioRef.current) audioRef.current.play().catch(() => playKitchenChimeSound());
        else playKitchenChimeSound();
      }
      setAlerts((curr) => (curr.includes(row.id) ? curr : [...curr, row.id]));
    },
    onUpdate: (row) => {
      if (soundEnabled) playKitchenChimeSound();
      setAlerts((curr) => (curr.includes(row.id) ? curr : [...curr, row.id]));
    },
  });

  const rawOrdersList = useMemo(() => orders.data ?? [], [orders.data]);

  // FIFO AUTOMATIC SORTING: Sort by nearest deadline (requested_date ascending, then requested_time ascending)
  const visible = useMemo(() => {
    return rawOrdersList
      .filter((order) => matchesDateFilter(order.requested_date, filter, custom))
      .sort((a, b) => {
        const byDate = (a.requested_date || "").localeCompare(b.requested_date || "");
        if (byDate !== 0) return byDate;
        const byTime = (a.requested_time || "").localeCompare(b.requested_time || "");
        if (byTime !== 0) return byTime;
        const rankA = a.queue_rank ?? Number.MAX_SAFE_INTEGER;
        const rankB = b.queue_rank ?? Number.MAX_SAFE_INTEGER;
        return rankA - rankB;
      });
  }, [rawOrdersList, filter, custom]);

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

  const acknowledge = useCallback(
    async (id: string) => {
      try {
        await ackModFn({ data: { orderId: id } });
        setAlerts((curr) => curr.filter((v) => v !== id));
        void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
      } catch (e) {
        console.error("Ack error:", e);
      }
    },
    [ackModFn, queryClient],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }, [navigate]);

  if (access.isPending) {
    return (
      <main dir="rtl" className="grid min-h-dvh place-items-center bg-[#F9FBFC]">
        <Loader2 className="h-8 w-8 animate-spin text-[#B8860B]" aria-label="جار التحميل" />
      </main>
    );
  }

  if (!access.data?.allowed) {
    return (
      <main dir="rtl" className="grid min-h-dvh place-items-center bg-[#F9FBFC] px-4 text-center">
        <div className="max-w-sm space-y-3">
          <h1 className="font-display text-2xl font-bold text-slate-900">لا تملك صلاحية المطبخ</h1>
          <p className="text-sm text-slate-600">This account has no kitchen access. Ask an admin to grant the kitchen role.</p>
          <button
            type="button"
            onClick={signOut}
            className="min-h-12 rounded-full bg-[#8B4513] px-6 text-sm font-bold text-white shadow-sm hover:bg-[#5D2E17]"
          >
            تسجيل الخروج · Sign out
          </button>
        </div>
      </main>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#F4F6F8] text-slate-900 pb-16 font-sans">
      {/* KDS TOP HEADER */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md px-4 py-2.5 shadow-xs">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-500 text-white shadow-xs">
              <ChefHat className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-black text-base text-slate-900 flex items-center gap-1.5">
                شاشة المطبخ والتحضير • Delish KDS
              </h1>
              <p className="text-[11px] font-bold text-slate-500">
                ترتيب تلقائي حسب موعد التسليم الأقرب (FIFO) • شاشة لمس مخصصة للتابلت
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled((v) => !v)}
              className={`min-h-[48px] px-3.5 rounded-xl border text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${
                soundEnabled
                  ? "bg-amber-50 text-amber-900 border-amber-300"
                  : "bg-slate-100 text-slate-500 border-slate-200"
              }`}
            >
              {soundEnabled ? <BellRing className="h-4 w-4 text-amber-600" /> : <Bell className="h-4 w-4" />}
              {soundEnabled ? "التنبيهات مفعلة" : "صامت"}
            </button>

            <button
              type="button"
              onClick={() => void queryClient.invalidateQueries({ queryKey: ORDERS_KEY })}
              className="grid h-12 w-12 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${orders.isFetching ? "animate-spin text-amber-600" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      {/* STAGES 3-COLUMN COMPACT VIEW FOR TABLET */}
      <main className="mx-auto max-w-7xl px-3 sm:px-4 py-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-start">
          {STAGES.map((stage) => {
            const list = visible.filter((o) => stageOf(o.status) === stage.key);
            return (
              <section
                key={stage.key}
                className={`flex flex-col rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-hidden ${stage.border}`}
              >
                {/* STAGE HEADER */}
                <div className="flex items-center justify-between p-3 border-b border-slate-100 bg-slate-50/60">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-sm text-slate-900">{stage.ar}</h3>
                    <span className="grid h-6 min-w-6 place-items-center px-1.5 rounded-full bg-slate-900 text-[11px] font-black text-white">
                      {list.length}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500">{stage.en}</span>
                </div>

                {/* COMPACT CARDS COLUMN */}
                <div className="p-2.5 space-y-3 min-h-[50vh]">
                  {list.length > 0 ? (
                    list.map((order) => (
                      <KdsCleanCard
                        key={order.id}
                        order={order}
                        stageBorder={stage.border}
                        busy={pending === order.id}
                        alerted={alerts.includes(order.id)}
                        onAck={acknowledge}
                        onStage={onStage}
                        onZoom={setZoom}
                      />
                    ))
                  ) : (
                    <div className="grid h-40 place-items-center rounded-xl border border-dashed border-slate-200 text-center text-xs font-bold text-slate-400">
                      لا توجد طلبات في هذه المرحلة
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </main>

      {/* FULL-SCREEN TABLET MODAL FOR REFERENCE DESIGN IMAGE */}
      {zoom && (
        <div
          onClick={() => setZoom(null)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-lg p-4 animate-in fade-in duration-200"
        >
          <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={zoom}
              alt="صورة التصميم المرجعية بملء الشاشة"
              className="max-h-[82vh] max-w-full rounded-2xl object-contain shadow-2xl border border-white/20"
            />
            <button
              type="button"
              onClick={() => setZoom(null)}
              className="mt-4 min-h-[52px] px-8 rounded-full bg-white text-slate-950 font-black text-sm shadow-2xl hover:bg-slate-100 active:scale-95 transition cursor-pointer flex items-center gap-2"
            >
              <X className="h-5 w-5" />
              إغلاق وتكبير الشاشة (العودة للمطبخ)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}