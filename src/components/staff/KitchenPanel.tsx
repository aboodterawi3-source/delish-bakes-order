import { useNavigate } from "@tanstack/react-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
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
import { reorderRanks, setQueueRanks } from "@/lib/queue.functions";

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

/** Audio synth chime fallback to guarantee alert sound without browser block issues */
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

/** Kitchen thermal ticket generator */
function printKitchenTicket(order: KdsOrder) {
  const lines = order.items.length
    ? order.items
        .map(
          (item) =>
            `<div class="item"><b style="font-size:16px;">${item.quantity} × ${esc(item.name_ar)}</b>` +
            (item.options_ar.length
              ? `<div class="opt">${item.options_ar.map((o) => `• ${esc(o)}`).join("<br>")}</div>`
              : "") +
            (item.notes ? `<div class="note">ملاحظة: ${esc(item.notes)}</div>` : "") +
            `</div>`,
        )
        .join("")
    : `<div class="item">لا توجد أصناف مسجلة</div>`;

  const body = `<h1 style="text-align:center;">تذكرة مطبخ · KITCHEN</h1>
<div class="row" style="font-size:18px;"><b>${esc(orderLabel(order.order_number, order.staff_code))}</b><span>${order.method === "delivery" ? "توصيل" : "استلام"}</span></div>
<div class="row"><b>${order.method === "delivery" ? "موعد التوصيل" : "موعد الاستلام"}</b><b>${esc(order.requested_date ?? "")} ${esc((order.requested_time ?? "").slice(0, 5))}</b></div>
<div><b>العميل:</b> ${esc(order.customer_name)}</div>
${order.schedule_updated_at ? `<div><b>تم تعديل الموعد 🔄</b></div>` : ""}
<div class="line"></div>${lines}<div class="line"></div>
${order.inscription ? `<div style="background:#FFF3CD;padding:8px;border-radius:6px;margin-top:6px;"><b>الكتابة على الكيك:</b> ${esc(order.inscription)}</div>` : ""}
${order.notes ? `<div style="margin-top:6px;"><b>ملاحظات:</b> ${esc(order.notes)}</div>` : ""}`;

  printDocument(`تذكرة مطبخ ${order.order_number}`, body, "body{font-size:14px}");
}

const ORDERS_KEY = ["kds-orders"] as const;

const STAGES: { key: KitchenStage; ar: string; en: string; badge: string; border: string }[] = [
  { key: "new", ar: "طلبات جديدة", en: "New", badge: "bg-amber-100 text-amber-900 border-amber-300", border: "border-t-4 border-t-amber-500" },
  { key: "baking", ar: "قيد التجهيز", en: "In Preparation", badge: "bg-blue-100 text-blue-900 border-blue-300", border: "border-t-4 border-t-blue-500" },
  { key: "ready", ar: "جاهزة بالمحل", en: "Ready", badge: "bg-emerald-100 text-emerald-900 border-emerald-300", border: "border-t-4 border-t-emerald-500" },
];

const stageOf = (status: string): KitchenStage =>
  status === "ready" ? "ready" : status === "baking" ? "baking" : "new";

/** Formats time remaining until requested deadline */
function getCountdownText(requestedDate: string, requestedTime: string) {
  if (!requestedDate || !requestedTime) return { text: "موعد غير محدد", status: "normal" as const };
  
  try {
    const target = new Date(`${requestedDate}T${requestedTime.slice(0, 5)}:00`);
    const now = new Date();
    const diffMs = target.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / 60000);

    if (diffMins < 0) {
      const lateMins = Math.abs(diffMins);
      if (lateMins > 120) return { text: `متأخر بـ ${Math.round(lateMins / 60)} ساعة`, status: "urgent" as const };
      return { text: `متأخر بـ ${lateMins} دقيقة`, status: "urgent" as const };
    }

    if (diffMins <= 60) {
      return { text: `باقي ${diffMins} دقيقة`, status: "warning" as const };
    }

    if (diffMins <= 180) {
      return { text: `باقي ${Math.round(diffMins / 60)} ساعة`, status: "normal" as const };
    }

    return { text: `موعد: ${requestedTime.slice(0, 5)}`, status: "normal" as const };
  } catch {
    return { text: requestedTime.slice(0, 5), status: "normal" as const };
  }
}

/** Resolves visual priority styles for cards based on category or item color */
function getPriorityStyles(color: PriorityColor) {
  switch (color) {
    case "deep_orange":
      return {
        cardBg: "bg-[#FFF8F6] border-orange-300",
        badgeBg: "bg-orange-100 text-orange-950 border-orange-300",
        badgeText: "أولوية قصوى · High Priority",
      };
    case "warm_amber":
      return {
        cardBg: "bg-[#FFFBF2] border-amber-300",
        badgeBg: "bg-amber-100 text-amber-950 border-amber-300",
        badgeText: "توصيل سريع · Express",
      };
    case "fresh_mint":
      return {
        cardBg: "bg-[#F4FBF7] border-emerald-300",
        badgeBg: "bg-emerald-100 text-emerald-950 border-emerald-300",
        badgeText: "تجهيز عادي · Standard",
      };
    case "royal_gold":
      return {
        cardBg: "bg-[#FFFCF0] border-yellow-400",
        badgeBg: "bg-yellow-100 text-yellow-950 border-yellow-400",
        badgeText: "VIP · كيك خاص",
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
  stageBorder,
  busy,
  alerted = false,
  onAck,
  onStage,
  onMove,
  onZoom,
}: {
  order: KdsOrder;
  stageBorder: string;
  busy: boolean;
  alerted?: boolean;
  onAck: (id: string) => void;
  onStage: (id: string, stage: KitchenStage) => void;
  onMove: (id: string, direction: -1 | 1) => void;
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

  return (
    <article
      className={`relative flex flex-col justify-between rounded-2xl border p-4 shadow-sm hover:shadow-md transition-all overflow-hidden text-slate-900 ${orderPrio.cardBg}`}
    >
      {/* Top Priority Accent Strip */}
      <div
        className="absolute top-0 inset-x-0 h-1.5"
        style={{ backgroundColor: priorityMeta.swatch || priorityMeta.bg }}
      />

      <div className="space-y-3 pt-1">
        {/* CARD HEADER */}
        <div className="flex items-start justify-between gap-2 border-b border-slate-200/60 pb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-extrabold text-lg text-slate-900 leading-tight">
                {orderLabel(order.order_number, order.staff_code)}
              </h2>
              {isEdited && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-black shadow-xs border ${
                    hasUnack
                      ? "bg-amber-500 text-white border-amber-300 animate-pulse"
                      : "bg-amber-100 text-amber-900 border-amber-300"
                  }`}
                >
                  <PencilLine className="h-3 w-3" />
                  طلب معدّل
                </span>
              )}
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-black border ${orderPrio.badgeBg}`}
              >
                {(orderPrio.badgeText.split("·")[0] ?? orderPrio.badgeText).trim()}
              </span>
            </div>
            <p className="text-xs font-extrabold text-slate-700 truncate mt-1">
              العميل: {order.customer_name}
            </p>
          </div>

          {/* Countdown & Fulfilment Badge */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-black border ${
                countdown.status === "urgent"
                  ? "bg-red-600 text-white border-red-400 animate-pulse"
                  : countdown.status === "warning"
                    ? "bg-amber-400 text-amber-950 border-amber-300"
                    : "bg-white/90 text-slate-800 border-slate-200"
              }`}
            >
              <Clock3 className="h-3 w-3" />
              {countdown.text}
            </span>
            <span className="text-[11px] font-bold text-slate-600">
              {order.method === "delivery" ? "🚀 توصيل" : "🏬 استلام"} · {(order.requested_time ?? "").slice(0, 5)}
            </span>
          </div>
        </div>

        {/* Alert badge if edited/new */}
        {alerted && !hasUnack && (
          <div className="flex items-center justify-between rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-amber-950 shadow-2xs">
            <span className="text-xs font-extrabold flex items-center gap-1.5">
              <PencilLine className="h-4 w-4 text-amber-700" />
              تم تعديل تفاصيل الطلب حديثاً
            </span>
            <button
              type="button"
              onClick={() => onAck(order.id)}
              className="text-[11px] font-black text-amber-900 underline hover:text-amber-950"
            >
              تأكيد ✕
            </button>
          </div>
        )}

        {/* ORDER ITEMS & CAKE SPECS */}
        <div className="space-y-2">
          {order.items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl bg-white p-3 border border-slate-200/80 shadow-2xs space-y-1"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-black text-sm text-slate-900">
                  {item.quantity} × {item.name_ar}
                </span>
                {item.category && (
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    {item.category}
                  </span>
                )}
              </div>

              {item.options_ar.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {item.options_ar.map((option, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-900 border border-amber-200/60"
                    >
                      {option}
                    </span>
                  ))}
                </div>
              )}

              {item.notes && (
                <p className="text-xs font-bold text-[#8B4513] bg-[#FFF8EE] p-2 rounded-lg border border-[#B8860B]/20">
                  ملاحظة الصنف: {item.notes}
                </p>
              )}
            </div>
          ))}

          {/* INSCRIPTION / CAKE WRITING */}
          {order.inscription && (
            <div className="rounded-xl bg-amber-100/70 border border-amber-300 p-2.5 text-xs">
              <span className="font-extrabold text-amber-950 block mb-0.5">✍️ الكتابة على الكيك:</span>
              <p className="font-black text-slate-950 bg-white p-2 rounded-lg border border-amber-200">
                "{order.inscription}"
              </p>
            </div>
          )}

          {/* NOTES & DESIGN ATTACHMENTS */}
          {order.notes && (
            <div className="rounded-xl bg-slate-100 p-2.5 text-xs">
              <span className="font-bold text-slate-700 block mb-0.5">📝 ملاحظات عامة:</span>
              <p className="font-extrabold text-slate-900">{order.notes}</p>
            </div>
          )}

          {/* DESIGN IMAGE ATTACHMENT */}
          {order.design_image_url ? (
            <div className="flex items-center gap-3 rounded-xl bg-white p-2 border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => onZoom(order.design_image_url as string)}
                className="h-14 w-14 overflow-hidden rounded-lg border border-slate-200 shrink-0 hover:opacity-90"
              >
                <img
                  src={order.design_image_url}
                  alt="تصميم الكيك"
                  className="h-full w-full object-cover"
                />
              </button>
              <div className="text-xs">
                <span className="font-bold text-slate-700 block">صورة التصميم المرفقة</span>
                <button
                  type="button"
                  onClick={() => onZoom(order.design_image_url as string)}
                  className="font-extrabold text-amber-800 underline hover:text-amber-900"
                >
                  اضغط للتكبير 🔍
                </button>
              </div>
            </div>
          ) : null}

          {/* DEDICATED KITCHEN ORDER MODIFICATIONS (HISTORICAL AUDIT & APPROVED NEW ORDER) */}
          {order.modifications && order.modifications.length > 0 ? (
            <div className="mt-3 space-y-2">
              {/* TOP WIDE PROMINENT ORANGE BADGE FOR UNACKNOWLEDGED MODIFICATIONS */}
              {hasUnack ? (
                <div className="rounded-xl bg-orange-500 text-white p-2.5 font-black text-xs text-center shadow-md animate-pulse flex items-center justify-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>⚠️ تنبيه: تم تعديل الطلب من السوشيال ميديا / المبيعات</span>
                </div>
              ) : (
                <div className="rounded-xl bg-emerald-700 text-white p-2 font-black text-xs text-center shadow-2xs flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>تم استلام ومطابقة التعديل ✓</span>
                </div>
              )}

              {/* UPPER FRAME: PREVIOUS CANCELLED ORDER */}
              <div className="rounded-xl bg-slate-100 border border-slate-300 p-3 text-slate-700 space-y-1.5 text-xs shadow-2xs">
                <span className="font-black text-slate-900 block border-b border-slate-200 pb-1 text-[11px]">
                  🗑️ الطلب السابق الذي تم إلغاؤه:
                </span>
                {order.modifications.map((mod, idx) => (
                  <div key={idx} className="rounded-lg bg-red-50 p-2 text-xs border border-red-200/80">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-0.5">
                      <span className="font-black text-red-900">تغيير {mod.field}:</span>
                      <span>{formatRelativeTime(mod.updatedAt)}</span>
                    </div>
                    <p className="line-through text-red-700 font-bold leading-tight">
                      {mod.oldValue}
                    </p>
                  </div>
                ))}
              </div>

              {/* LOWER FRAME: APPROVED NEW ORDER */}
              <div className="rounded-xl bg-emerald-50 border-2 border-emerald-500 p-3 text-emerald-950 space-y-1.5 text-xs shadow-xs">
                <span className="font-black text-emerald-950 block border-b border-emerald-200 pb-1 text-[11px]">
                  ✨ الطلب الجديد المعتمد للمطبخ:
                </span>
                {order.modifications.map((mod, idx) => (
                  <div key={idx} className="rounded-lg bg-white p-2 text-xs border border-emerald-300 font-extrabold text-emerald-950 shadow-2xs">
                    <span className="text-[10px] text-slate-500 block mb-0.5">{mod.field} الجديد:</span>
                    <p className="leading-tight">{mod.newValue}</p>
                  </div>
                ))}
              </div>

              {/* CHEF ACKNOWLEDGMENT BUTTON */}
              {hasUnack && (
                <button
                  type="button"
                  onClick={() => onAck(order.id)}
                  className="mt-2 w-full min-h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-extrabold text-xs shadow-md transition-all"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  تم استلام ومطابقة التعديل (تأكيد علم الشيف)
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* FOOTER & ACTIONS */}
      <div className="mt-4 pt-3 border-t border-slate-200/60 space-y-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => printKitchenTicket(order)}
            title="طباعة تذكرة المطبخ"
            className="flex-1 inline-flex min-h-10 items-center justify-center gap-1 rounded-xl bg-white/90 text-slate-800 border border-slate-200 text-xs font-black shadow-2xs hover:bg-white active:scale-95"
          >
            <Printer className="h-3.5 w-3.5" /> 🖨️ تذكرة
          </button>

          {order.design_image_url ? (
            <button
              type="button"
              onClick={() => void downloadDesignImage(order.design_image_url as string, order.order_number)}
              title="تحميل صورة التصميم"
              className="inline-flex min-h-10 px-3 items-center justify-center gap-1 rounded-xl bg-white/90 text-slate-800 border border-slate-200 text-xs font-black shadow-2xs hover:bg-white active:scale-95"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          ) : null}

          {/* Queue reorder buttons */}
          <div className="flex gap-0.5">
            <button
              type="button"
              onClick={() => onMove(order.id, -1)}
              title="تقديم الطلب"
              className="grid h-10 w-9 place-items-center rounded-xl bg-white/90 text-slate-800 border border-slate-200 shadow-2xs hover:bg-white active:scale-95"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onMove(order.id, 1)}
              title="تأخير الطلب"
              className="grid h-10 w-9 place-items-center rounded-xl bg-white/90 text-slate-800 border border-slate-200 shadow-2xs hover:bg-white active:scale-95"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Main Stage Action Button */}
        {stage === "new" && (
          <button
            type="button"
            onClick={() => void onStage(order.id, "baking")}
            disabled={busy}
            className="w-full min-h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 text-white font-black text-sm shadow-md hover:bg-amber-700 active:scale-95 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            👨‍🍳 بدء التجهيز / Start
          </button>
        )}

        {stage === "baking" && (
          <button
            type="button"
            onClick={() => void onStage(order.id, "ready")}
            disabled={busy}
            className="w-full min-h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 text-white font-black text-sm shadow-md hover:bg-blue-700 active:scale-95 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            ✅ تم التجهيز / Ready
          </button>
        )}

        {stage === "ready" && (
          <div className="flex gap-2">
            <span className="flex-1 min-h-11 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-white font-black text-xs shadow-xs">
              <CheckCircle2 className="h-4 w-4" /> جاهز بالمحل ✓
            </span>
            <button
              type="button"
              onClick={() => void onStage(order.id, "baking")}
              disabled={busy}
              title="تراجع إلى قيد التجهيز"
              className="min-h-11 px-3 inline-flex items-center justify-center rounded-xl bg-white/90 text-slate-800 border border-slate-200 text-xs font-black hover:bg-white"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
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
  const reorderFn = useServerFn(setQueueRanks);
  const ackModFn = useServerFn(acknowledgeOrderModification);

  const [filter, setFilter] = useState<DateFilterKey>("today");
  const [custom] = useState<CustomRange>({ from: isoDay(0), to: isoDay(7) });
  const [shiftOn, setShiftOn] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const knownIds = useRef<Set<string> | null>(null);
  const [alerts, setAlerts] = useState<string[]>([]);
  const editStamps = useRef<Map<string, string | null> | null>(null);

  const access = useQuery({
    queryKey: ["kds-access"],
    queryFn: () => fetchAccess({}),
    staleTime: 5 * 60_000,
  });

  const allowed = access.data?.allowed === true;

  const orders = useQuery({
    queryKey: ORDERS_KEY,
    queryFn: () => fetchOrders({}),
    refetchInterval: 30_000,
    staleTime: 10_000,
    enabled: allowed,
  });

  const chime = useCallback(async () => {
    playKitchenChimeSound();
    const audio = audioRef.current;
    if (!audio) return true;
    try {
      audio.currentTime = 0;
      await audio.play();
      return true;
    } catch {
      return true;
    }
  }, []);

  const toggleShiftAudio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio(bellAsset.url);
      audio.preload = "auto";
      audio.volume = 1;
      audioRef.current = audio;
    }
    
    if (shiftOn) {
      setShiftOn(false);
      if (audioRef.current) audioRef.current.pause();
    } else {
      setShiftOn(true);
      void chime();
    }
  }, [chime, shiftOn]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  // New arrivals alert trigger
  useEffect(() => {
    const list = orders.data;
    if (!list) return;
    const ids = new Set(list.map((order) => order.id));
    if (knownIds.current === null) {
      knownIds.current = ids;
      return;
    }
    const fresh = list.filter((order) => !knownIds.current?.has(order.id)).map((order) => order.id);
    knownIds.current = ids;
    if (fresh.length) {
      setAlerts((current) => [...new Set([...current, ...fresh])]);
      if (shiftOn) void chime();
    }
  }, [orders.data, chime, shiftOn]);

  // Edit alerts trigger
  useEffect(() => {
    const list = orders.data;
    if (!list) return;
    const stamps = new Map(list.map((order) => [order.id, order.last_edited_at]));
    if (editStamps.current === null) {
      editStamps.current = stamps;
      return;
    }
    const changed = list
      .filter((order) => {
        const previous = editStamps.current?.get(order.id);
        const hasUnack = (order.modifications ?? []).some((m) => !m.acknowledgedAt);
        return (previous !== undefined && order.last_edited_at && order.last_edited_at !== previous) || hasUnack;
      })
      .map((order) => order.id);
    editStamps.current = stamps;
    if (changed.length) {
      setAlerts((current) => [...new Set([...current, ...changed])]);
      if (shiftOn) void chime();
    }
  }, [orders.data, chime, shiftOn]);

  useOrdersRealtime(ORDERS_KEY, allowed, "kds-orders-live");

  useEffect(() => {
    if (!zoom) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setZoom(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.clearTimeout(timer);
  }, [zoom]);

  const rawOrdersList = useMemo(() => orders.data ?? [], [orders.data]);

  // Date filter counts
  const filterCounts = useMemo(() => {
    const counts = { today: 0, tomorrow: 0, week: 0, upcoming: 0, all: rawOrdersList.length };
    for (const o of rawOrdersList) {
      if (matchesDateFilter(o.requested_date, "today", custom)) counts.today++;
      if (matchesDateFilter(o.requested_date, "tomorrow", custom)) counts.tomorrow++;
      if (matchesDateFilter(o.requested_date, "week", custom)) counts.week++;
      if (matchesDateFilter(o.requested_date, "upcoming", custom)) counts.upcoming++;
    }
    return counts;
  }, [rawOrdersList, custom]);

  const visible = useMemo(() => {
    return rawOrdersList
      .filter((order) => matchesDateFilter(order.requested_date, filter, custom))
      .sort((a, b) => {
        const rankA = a.queue_rank ?? Number.MAX_SAFE_INTEGER;
        const rankB = b.queue_rank ?? Number.MAX_SAFE_INTEGER;
        if (rankA !== rankB) return rankA - rankB;
        const byDate = a.requested_date.localeCompare(b.requested_date);
        if (byDate !== 0) return byDate;
        const byTime = a.requested_time.localeCompare(b.requested_time);
        if (byTime !== 0) return byTime;
        return PRIORITY_META[a.priority_color].rank - PRIORITY_META[b.priority_color].rank;
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

  const onMove = useCallback(
    async (id: string, direction: -1 | 1) => {
      const stage = visible.find((order) => order.id === id)?.status;
      const siblings = visible.filter((order) => stageOf(order.status) === stageOf(stage ?? "new"));
      const items = reorderRanks(siblings, id, direction);
      if (items.length === 0) return;
      const ranks = new Map(items.map((item) => [item.orderId, item.queue_rank]));
      queryClient.setQueryData<KdsOrder[]>(ORDERS_KEY, (rows) =>
        (rows ?? []).map((order) =>
          ranks.has(order.id) ? { ...order, queue_rank: ranks.get(order.id)! } : order,
        ),
      );
      try {
        await reorderFn({ data: { items } });
      } catch {
        void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
      }
    },
    [queryClient, reorderFn, visible],
  );

  const acknowledge = useCallback(
    async (id: string) => {
      setAlerts((current) => current.filter((value) => value !== id));
      queryClient.setQueryData<KdsOrder[]>(ORDERS_KEY, (rows) =>
        (rows ?? []).map((order) => {
          if (order.id !== id) return order;
          const now = new Date().toISOString();
          return {
            ...order,
            modifications: (order.modifications ?? []).map((m) => ({
              ...m,
              acknowledgedAt: m.acknowledgedAt || now,
            })),
          };
        }),
      );
      try {
        await ackModFn({ data: { orderId: id } });
      } catch (err) {
        console.error("Failed to acknowledge order modification:", err);
      }
    },
    [ackModFn, queryClient],
  );

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  const signOut = useCallback(async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }, [navigate, queryClient]);

  if (access.isLoading) {
    return (
      <p dir="rtl" className="grid min-h-dvh place-items-center bg-slate-100 text-sm font-bold text-slate-600">
        جارٍ التحقق من الصلاحيات…
      </p>
    );
  }

  if (!allowed) {
    return (
      <main dir="rtl" className="grid min-h-dvh place-items-center bg-slate-100 px-4 text-center">
        <div className="max-w-sm rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl">
          <h1 className="font-display text-xl font-bold">لا تملك صلاحية المطبخ</h1>
          <p className="text-sm text-slate-600 mt-2">يتطلب هذا القسم صلاحية حساب المطبخ.</p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-5 min-h-12 w-full rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground shadow-sm"
          >
            تسجيل الخروج · Sign out
          </button>
        </div>
      </main>
    );
  }

  return (
    <div dir="rtl" className="min-h-dvh bg-[#F4F5F7] text-slate-900 flex flex-col font-sans">
      {/* KITCHEN TOP BAR */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md px-4 py-3 shadow-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-600 text-white shadow-xs">
              <ChefHat className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-extrabold text-base text-slate-900 leading-tight">شاشة المطبخ KDS</h1>
              <p className="text-[11px] font-semibold text-amber-800">متابعة تحضير الكيك وتأكيد التعديلات</p>
            </div>
          </div>

          {/* DATE FILTER BUTTONS */}
          <div className="flex rounded-full bg-slate-100 p-1 border border-slate-200 text-xs font-black">
            <button
              type="button"
              onClick={() => setFilter("today")}
              className={`px-3 py-1.5 rounded-full transition-all ${
                filter === "today" ? "bg-amber-600 text-white shadow-xs" : "text-slate-700 hover:bg-white"
              }`}
            >
              اليوم ({filterCounts.today})
            </button>
            <button
              type="button"
              onClick={() => setFilter("tomorrow")}
              className={`px-3 py-1.5 rounded-full transition-all ${
                filter === "tomorrow" ? "bg-amber-600 text-white shadow-xs" : "text-slate-700 hover:bg-white"
              }`}
            >
              غداً ({filterCounts.tomorrow})
            </button>
            <button
              type="button"
              onClick={() => setFilter("week")}
              className={`px-3 py-1.5 rounded-full transition-all ${
                filter === "week" ? "bg-amber-600 text-white shadow-xs" : "text-slate-700 hover:bg-white"
              }`}
            >
              هذا الأسبوع ({filterCounts.week})
            </button>
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 rounded-full transition-all ${
                filter === "all" ? "bg-amber-600 text-white shadow-xs" : "text-slate-700 hover:bg-white"
              }`}
            >
              الكل ({filterCounts.all})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleShiftAudio}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold transition-all border ${
                shiftOn
                  ? "bg-amber-500 text-white border-amber-400 shadow-xs"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {shiftOn ? <BellRing className="h-4 w-4 animate-bounce" /> : <Bell className="h-4 w-4" />}
              {shiftOn ? "التنبيهات مفعلة 🔔" : "تفعيل التنبيهات"}
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              title="ملء الشاشة"
              className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 transition"
            >
              <Maximize2 className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => void signOut()}
              title="تسجيل الخروج"
              className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* STAGE COLUMNS WORKSPACE */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-4">
        <div className="grid gap-4 md:grid-cols-3 items-start">
          {STAGES.map((stage) => {
            const list = visible.filter((o) => stageOf(o.status) === stage.key);
            return (
              <section
                key={stage.key}
                className={`rounded-3xl border bg-white p-4 shadow-2xs space-y-3 ${stage.border}`}
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <h2 className="font-extrabold text-base text-slate-900">{stage.ar}</h2>
                    <span className="text-[11px] font-bold text-slate-500">{stage.en}</span>
                  </div>
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-black ${stage.badge}`}>
                    {list.length}
                  </span>
                </div>

                <div className="space-y-3 min-h-[300px]">
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
                        onMove={onMove}
                        onZoom={setZoom}
                      />
                    ))
                  ) : (
                    <div className="grid h-48 place-items-center rounded-2xl border border-dashed border-slate-200 text-center text-xs font-bold text-slate-400">
                      لا توجد طلبات في هذه المرحلة
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </main>

      {/* ZOOM IMAGE MODAL */}
      {zoom && (
        <div
          onClick={() => setZoom(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
        >
          <div className="relative max-w-3xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img src={zoom} alt="تصميم الكيك" className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl" />
            <button
              type="button"
              onClick={() => setZoom(null)}
              className="absolute -top-3 -right-3 grid h-9 w-9 place-items-center rounded-full bg-white text-slate-900 shadow-lg hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
