import { useNavigate } from "@tanstack/react-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Bell,
  BellRing,
  Cake,
  Calendar,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChefHat,
  Clock,
  Clock3,
  Download,
  Eye,
  FileText,
  Filter,
  Flame,
  Layers,
  LayoutGrid,
  Loader2,
  LogOut,
  Maximize2,
  PencilLine,
  Play,
  Printer,
  RefreshCw,
  Sparkles,
  Timer,
  Undo2,
  Volume2,
  VolumeX,
  X,
  Zap,
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
  type OrderModification,
} from "@/lib/kds.functions";
import { OrdersCalendar } from "@/components/staff/OrdersCalendar";
import type { SalesOrder, SalesStatus } from "@/lib/sales.functions";
import { PRIORITY_META, type PriorityColor } from "@/lib/priority";
import { formatTimeSlotArabic, printKitchenTicket } from "@/lib/receipt-templates";
import bellAsset from "@/assets/Bell.mp3.asset.json";
import { orderLabel } from "@/lib/order-label";
import { isoDay, matchesDateFilter, type CustomRange, type DateFilterKey } from "@/lib/date-filter";
import { formatArabicDate } from "@/lib/confirmation-message";

/** Strips out marketing, communication channel tags (WhatsApp, Instagram, etc.), and payment meta from kitchen views */
function isChannelOrMeta(text: string): boolean {
  if (!text) return false;
  const t = text.trim();
  return (
    t.startsWith("المصدر:") ||
    t.startsWith("مصدر:") ||
    t.includes("المصدر: ") ||
    t.includes("واتساب") ||
    t.includes("انستغرام") ||
    t.includes("فيسبوك") ||
    t.includes("تيك توك") ||
    t.includes("كليك") ||
    t.includes("حوالة") ||
    t.includes("gift") ||
    t.includes("source") ||
    t.startsWith("طلب هدية")
  );
}

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


/** Audio synth chime fallback to guarantee alert sound */
function playKitchenChimeSound() {
  try {
    const ctx = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )();
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

/** Distinctive double-tone chime for kitchen order modifications */
function playKitchenModificationChimeSound() {
  try {
    const ctx = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )();
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    // Tone 1
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, ctx.currentTime);
    gain1.gain.setValueAtTime(0.35, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.2);

    // Tone 2 (higher frequency chime)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(987.77, ctx.currentTime + 0.15);
    gain2.gain.setValueAtTime(0.35, ctx.currentTime + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.45);
  } catch (e) {
    console.error("Audio synth mod error:", e);
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


const ORDERS_KEY = ["kds-orders"] as const;

const STAGES: {
  key: KitchenStage;
  ar: string;
  en: string;
  icon: string;
  border: string;
  bgBadge: string;
}[] = [
  {
    key: "new",
    ar: "طلبات جديدة بانتظار البدء",
    en: "Incoming Queue",
    icon: "🆕",
    border: "border-t-4 border-t-amber-500",
    bgBadge: "bg-amber-100 text-amber-900 border-amber-300",
  },
  {
    key: "baking",
    ar: "قيد الخبز والتزيين والكريمة",
    en: "In Baking / Decorating",
    icon: "👩‍🍳",
    border: "border-t-4 border-t-blue-500",
    bgBadge: "bg-blue-100 text-blue-900 border-blue-300",
  },
  {
    key: "ready",
    ar: "جاهزة ومكتملة للتسليم",
    en: "Ready for Handover",
    icon: "✨",
    border: "border-t-4 border-t-emerald-500",
    bgBadge: "bg-emerald-100 text-emerald-900 border-emerald-300",
  },
];

const stageOf = (status: string): KitchenStage =>
  status === "ready" ? "ready" : status === "baking" ? "baking" : "new";

/** Formats time remaining with exact SLA color indicators: Safe (>45m), Urgent (<20m), Overdue (Late) */
function getCountdownText(requestedDate: string, requestedTime: string) {
  if (!requestedDate || !requestedTime)
    return { text: "الموعد غير محدد", status: "normal" as const };

  try {
    const timeClean = requestedTime.slice(0, 5);
    const target = new Date(`${requestedDate}T${timeClean}:00`);
    const now = new Date();
    const diffMs = target.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / 60000);

    if (diffMins < 0) {
      const lateMins = Math.abs(diffMins);
      const lateStr =
        lateMins >= 60 ? `${Math.floor(lateMins / 60)}س ${lateMins % 60}د` : `${lateMins}د`;
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
    return {
      text: `باقي: ${hours > 0 ? `${hours}س ` : ""}${remMins}د`,
      status: "safe" as const,
      mins: diffMins,
    };
  } catch {
    return { text: requestedTime.slice(0, 5), status: "normal" as const, mins: 999 };
  }
}

/** Resolves visual priority styles for cards */
function getPriorityStyles(color: PriorityColor) {
  switch (color) {
    case "dark_red":
      return {
        cardBg: "bg-card border-orange-400/80 shadow-xs",
        badgeBg: "bg-orange-100 text-orange-950 border-orange-300",
        badgeText: "أولوية قصوى",
      };
    case "warm_orange":
      return {
        cardBg: "bg-card border-amber-400/80 shadow-xs",
        badgeBg: "bg-amber-100 text-amber-950 border-amber-300",
        badgeText: "توصيل سريع",
      };
    case "sky_blue":
      return {
        cardBg: "bg-card border-emerald-400/80 shadow-xs",
        badgeBg: "bg-emerald-100 text-emerald-950 border-emerald-300",
        badgeText: "تجهيز عادي",
      };
    case "golden_yellow":
      return {
        cardBg: "bg-card border-yellow-400 shadow-xs",
        badgeBg: "bg-yellow-100 text-yellow-950 border-yellow-400",
        badgeText: "VIP خاص",
      };
    case "soft_green":
    default:
      return {
        cardBg: "bg-card border-border/80 shadow-xs",
        badgeBg: "bg-secondary text-foreground border-border",
        badgeText: "طلب عادي",
      };
  }
}

/**
 * Checks if a modification is relevant to kitchen / cake preparation staff.
 * Strictly filters out financial, billing, payment, and channel metadata changes.
 */
function isKitchenRelevantModification(mod: OrderModification): boolean {
  const f = (mod.field || "").toLowerCase();
  const irrelevant = [
    "عربون",
    "العربون",
    "مبلغ",
    "المبلغ",
    "إجمالي",
    "الاجمالي",
    "دفع",
    "الدفع",
    "كليك",
    "حوالة",
    "سعر",
    "رسوم",
    "توصيل_fee",
    "مصدر",
    "المصدر",
    "واتساب",
    "انستغرام",
    "هاتف",
    "موبايل",
    "تواصل",
    "total",
    "deposit",
    "payment",
    "price",
    "fee",
    "source",
    "phone",
    "الطلب الأساسي",
    "النسخة الأصلية",
    "حالة الطلب",
    "موظفين",
    "staff_notes",
  ];
  // Also filter records where both values are generic/empty noise
  const isGenericNoise =
    (mod.newValue ?? "").includes("تم حفظ وتحديث") ||
    (mod.newValue ?? "").includes("تم إجراء أول تعديل") ||
    (mod.oldValue ?? "").includes("البيانات السابقة للطلب");
  if (isGenericNoise) return false;
  return !irrelevant.some((kw) => f.includes(kw));
}

const KdsCleanCard = memo(function KdsCleanCard({
  order,
  busy,
  alerted = false,
  onAck,
  onStage,
  onZoom,
  onOpenDetails,
}: {
  order: KdsOrder;
  stageBorder: string;
  busy: boolean;
  alerted?: boolean;
  onAck: (id: string) => void;
  onStage: (id: string, stage: KitchenStage) => void;
  onZoom: (url: string) => void;
  onOpenDetails: (order: KdsOrder) => void;
}) {
  const stage = stageOf(order.status);
  const priorityMeta =
    PRIORITY_META[order.priority_color ?? "soft_green"] || PRIORITY_META["soft_green"];
  const orderPrio = getPriorityStyles(order.priority_color ?? "soft_green");
  const countdown = useMemo(
    () => getCountdownText(order.requested_date, order.requested_time),
    [order.requested_date, order.requested_time],
  );

  // Filter modifications to only include kitchen preparation relevant changes
  const kitchenMods = useMemo(() => {
    return (order.modifications ?? []).filter(isKitchenRelevantModification);
  }, [order.modifications]);

  const unackMods = kitchenMods.filter((m) => !m.acknowledgedAt);
  const hasUnack = unackMods.length > 0;
  const isEdited = hasUnack || kitchenMods.length > 0;

  // Filter out packaging accessories to show as a compact secondary summary
  const packagingKeywords = [
    "شمعة",
    "شموع",
    "بالون",
    "بالونات",
    "توبر",
    "كرت",
    "topper",
    "candle",
    "balloon",
  ];
  const mainItems = order.items.filter(
    (it) => !packagingKeywords.some((kw) => (it.name_ar || "").toLowerCase().includes(kw)),
  );
  const accessoryItems = order.items.filter((it) =>
    packagingKeywords.some((kw) => (it.name_ar || "").toLowerCase().includes(kw)),
  );

  return (
    <article
      className={`relative flex flex-col justify-between rounded-3xl border p-4 shadow-sm hover:shadow-md transition-all ${orderPrio.cardBg} ${
        hasUnack ? "ring-2 ring-amber-500 border-amber-400 shadow-md shadow-amber-500/20" : ""
      }`}
    >
      {/* Top Priority Accent Strip */}
      <div
        className="absolute top-0 inset-x-0 h-2 rounded-t-3xl"
        style={{ backgroundColor: priorityMeta.swatch || priorityMeta.bg }}
      />

      <div className="space-y-3 pt-1.5">
        {/* Card Header: Order Number, Method, SLA countdown, Delivery Time */}
        <div
          onClick={() => onOpenDetails(order)}
          className="flex items-start justify-between gap-2 border-b border-border/80 pb-3 cursor-pointer group/hdr hover:opacity-95 transition"
          title="اضغط لفتح صفحة وتفاصيل الطلب كاملة"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-black text-lg sm:text-xl text-foreground leading-tight group-hover/hdr:text-primary transition">
                {orderLabel(order.order_number, order.staff_code)}
              </h2>
              {isEdited && (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-black border shadow-2xs ${
                    hasUnack
                      ? "bg-amber-500 text-white border-amber-400 animate-pulse"
                      : "bg-amber-100 text-amber-900 border-amber-300"
                  }`}
                >
                  <PencilLine className="h-3.5 w-3.5" />
                  {hasUnack ? "⚠️ طلب معدّل - انتبه!" : "معدّل ✓"}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-bold text-muted-foreground">
                العميل: <strong className="text-foreground">{order.customer_name}</strong>
              </span>
              <span className="text-[11px] font-black px-2 py-0.5 rounded-lg bg-secondary text-foreground border border-border/70">
                {order.method === "delivery" ? "توصيل 🛵" : "استلام 🏪"}
              </span>
            </div>
          </div>

          {/* Delivery Time & SLA Countdown Badge */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black border shadow-2xs ${
                countdown.status === "overdue"
                  ? "bg-red-600 text-white border-red-500 animate-pulse text-sm"
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
            <span className="text-xs font-black text-foreground flex items-center gap-1">
              ⏰ {formatTimeSlotArabic(order.requested_time)}
            </span>
          </div>
        </div>

        {/* 1. ORIGINAL ORDER PREPARATION SPECS (الأصناف، الحشوات، الكتابة، التصميم) */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs font-black text-foreground/80 border-b border-border/50 pb-1">
            <span className="flex items-center gap-1.5">
              <Cake className="h-4 w-4 text-amber-600" />
              <span>مواصفات وتجهيز الطلب:</span>
            </span>
            <span className="text-[11px] text-muted-foreground font-bold">
              {mainItems.length} صنف
            </span>
          </div>

          {/* Cake Items List */}
          {(mainItems.length > 0 ? mainItems : order.items).map((item) => (
            <div
              key={item.id}
              className="rounded-2xl bg-secondary/50 p-3.5 border border-border/80 shadow-2xs space-y-2"
            >
              <div className="flex items-baseline justify-between gap-1">
                <span className="font-black text-lg sm:text-xl text-foreground leading-snug">
                  {item.quantity} × {item.name_ar}
                </span>
                {item.category && (
                  <span className="text-[11px] font-bold text-muted-foreground bg-card px-2.5 py-0.5 rounded-full border border-border/60">
                    {item.category}
                  </span>
                )}
              </div>

              {(() => {
                const cleanOptions = item.options_ar.filter((opt) => !isChannelOrMeta(opt));
                if (cleanOptions.length === 0) return null;
                return (
                  <ul className="space-y-1 text-xs font-bold text-foreground/90 pt-1 pr-1 border-r-2 border-amber-400/60 mr-0.5">
                    {cleanOptions.map((option, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 leading-snug">
                        <span className="text-amber-800 dark:text-amber-300 font-black">•</span>
                        <span>{option}</span>
                      </li>
                    ))}
                  </ul>
                );
              })()}

              {item.notes && (
                <p className="text-xs font-black text-amber-900 dark:text-amber-200 bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
                  ملاحظة الصنف: {item.notes}
                </p>
              )}
            </div>
          ))}

          {/* Simple compact card / cake writing line among order info */}
          {order.inscription && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-2.5 text-xs border border-amber-500/20">
              <span className="font-black text-amber-900 dark:text-amber-200 shrink-0 flex items-center gap-1">
                <span>🎂</span>
                <span>الكتابة المطلوبة / الكرت:</span>
              </span>
              <span className="font-bold text-foreground break-words select-all">
                "{order.inscription}"
              </span>
            </div>
          )}

          {order.card_note && order.card_note !== order.inscription && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-2.5 text-xs border border-amber-500/20">
              <span className="font-black text-amber-900 dark:text-amber-200 shrink-0 flex items-center gap-1">
                <span>💌</span>
                <span>الكتابة على الكرت:</span>
              </span>
              <span className="font-bold text-foreground break-words select-all">
                "{order.card_note}"
              </span>
            </div>
          )}

          {/* PACKAGING ACCESSORIES SUMMARY (Candles, Toppers, Balloons) */}
          {accessoryItems.length > 0 && (
            <div className="text-xs font-bold text-muted-foreground bg-secondary/50 p-2.5 rounded-2xl border border-border/70">
              <span className="font-black text-foreground">ملحقات التغليف والشموع: </span>
              {accessoryItems.map((acc) => `${acc.quantity} × ${acc.name_ar}`).join(" • ")}
            </div>
          )}

          {/* REFERENCE DESIGN IMAGE THUMBNAIL */}
          {order.design_image_url && (
            <div className="flex items-center justify-between gap-2 rounded-2xl bg-card p-2.5 border border-border shadow-2xs">
              <button
                type="button"
                onClick={() => onZoom(order.design_image_url as string)}
                className="flex items-center gap-2.5 text-xs font-black text-primary hover:underline cursor-pointer min-h-[46px]"
              >
                <img
                  src={order.design_image_url}
                  alt="تصميم الكيك"
                  className="h-11 w-11 rounded-xl object-cover border border-border shrink-0 shadow-xs"
                />
                <span>صورة التصميم المرجعية (عرض وتكبير كامل) 🔍</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  void downloadDesignImage(order.design_image_url as string, order.order_number)
                }
                title="تنزيل للطباعة الغذائية"
                className="grid h-11 w-11 place-items-center rounded-xl border border-border text-foreground hover:bg-secondary cursor-pointer"
              >
                <Download className="h-4 w-4" />
              </button>
            </div>
          )}

          {order.notes && (
            <div className="text-xs text-muted-foreground bg-secondary/40 p-2.5 rounded-xl border border-border/60">
              <span className="font-black text-foreground">ملاحظات العميل: </span>
              <span>{order.notes}</span>
            </div>
          )}
        </div>

        {/* شريط تنبيه التعديلات الإنتاجية المدمج والأنيق للمطبخ */}
        {kitchenMods.length > 0 && hasUnack && (
          <div className="rounded-2xl border border-amber-400/80 bg-amber-500/10 p-2.5 sm:p-3 space-y-2 animate-in fade-in duration-150 shadow-2xs">
            <div className="flex items-center justify-between gap-2 border-b border-amber-400/30 pb-1.5">
              <div className="flex items-center gap-1.5 text-xs font-black text-amber-950 dark:text-amber-200">
                <span className="text-amber-600 animate-pulse">⚠️</span>
                <span>تعديل في مواصفات الطلب:</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAck(order.id);
                }}
                className="min-h-[30px] px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-[11px] shadow-xs transition-all flex items-center gap-1 cursor-pointer shrink-0"
                title="اعتماد التعديل في المطبخ"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>اعتمدت ✓</span>
              </button>
            </div>

            <div className="space-y-1.5 text-xs">
              {kitchenMods.map((mod, idx) => (
                <div
                  key={idx}
                  className="flex flex-wrap items-center gap-1.5 font-bold text-foreground"
                >
                  <span className="font-black text-amber-900 dark:text-amber-300">
                    🔹 {mod.field}:
                  </span>
                  {mod.newValue && mod.newValue !== "— (تم حذفه)" && (
                    <span className="font-black text-emerald-800 dark:text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-lg">
                      {mod.newValue}
                    </span>
                  )}
                  {(mod.newValue === "— (تم حذفه)" || !mod.newValue) && mod.oldValue && (
                    <span className="font-black text-rose-700 dark:text-rose-400 bg-rose-500/10 border border-rose-400/30 px-2 py-0.5 rounded-lg line-through opacity-70">
                      {mod.oldValue}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* FOOTER & ACTIONS (Large tactile touch buttons) */}
      <div className="mt-4 pt-3 border-t border-border/80 space-y-2">
        {/* Open Order Details Modal Button */}
        <button
          type="button"
          onClick={() => onOpenDetails(order)}
          title="عرض تفاصيل ومواصفات الطلب كاملة"
          className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-950 dark:text-amber-100 border border-amber-500/30 text-xs font-black shadow-2xs active:scale-[0.98] transition cursor-pointer"
        >
          <Eye className="h-4 w-4 text-amber-700 dark:text-amber-300" />
          <span>📋 فتح صفحة الطلب</span>
        </button>

        <button
          type="button"
          onClick={() => printKitchenTicket(order)}
          title="طباعة تذكرة المطبخ"
          className="w-full min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-secondary/70 text-foreground border border-border text-xs font-black shadow-2xs hover:bg-secondary active:scale-95 cursor-pointer"
        >
          <Printer className="h-4 w-4" />
          🖨️ طباعة تذكرة حرارية للمطبخ
        </button>

        {/* Stage Transition Action Button (52px high) */}
        {stage === "new" && (
          <button
            type="button"
            onClick={() => void onStage(order.id, "baking")}
            disabled={busy}
            className="w-full min-h-[52px] inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-600 text-white font-black text-sm shadow-md hover:bg-amber-700 active:scale-95 disabled:opacity-60 cursor-pointer"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}[
            بدء الخبز والتزيين والكريمة 👩‍🍳 ]
          </button>
        )}

        {stage === "baking" && (
          <button
            type="button"
            onClick={() => void onStage(order.id, "ready")}
            disabled={busy}
            className="w-full min-h-[52px] inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 text-white font-black text-sm shadow-md hover:bg-blue-700 active:scale-95 disabled:opacity-60 cursor-pointer"
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-5 w-5" />
            )}
            [ تم الانتهاء وجاهز للتسليم ✨ ]
          </button>
        )}

        {stage === "ready" && (
          <div className="flex gap-2">
            <span className="flex-1 min-h-[52px] inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-white font-black text-xs shadow-xs">
              <CheckCircle2 className="h-4 w-4" /> جاهز للتسليم بالمحل ✓
            </span>
            <button
              type="button"
              onClick={() => void onStage(order.id, "baking")}
              disabled={busy}
              title="تراجع إلى قيد التجهيز"
              className="min-h-[52px] px-4 inline-flex items-center justify-center rounded-2xl bg-card text-foreground border border-border text-xs font-black hover:bg-secondary cursor-pointer"
            >
              <Undo2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </article>
  );
});

/**
 * Detailed Order Page / Modal for Kitchen Staff
 * Displays preparation specifications smoothly like the confirmation message / structured list
 * without communication channels or fragmented keywords.
 */
function KitchenOrderDetailsModal({
  order,
  onClose,
  onStage,
  onPrintTicket,
  onZoom,
}: {
  order: KdsOrder;
  onClose: () => void;
  onStage: (id: string, stage: KitchenStage) => void;
  onPrintTicket: (order: KdsOrder) => void;
  onZoom: (url: string) => void;
}) {
  const stage = stageOf(order.status);
  const kitchenMods = useMemo(() => {
    return (order.modifications ?? []).filter(isKitchenRelevantModification);
  }, [order.modifications]);
  const packagingKeywords = [
    "شمعة",
    "شموع",
    "بالون",
    "بالونات",
    "توبر",
    "كرت",
    "topper",
    "candle",
    "balloon",
  ];
  const mainItems = order.items.filter(
    (it) => !packagingKeywords.some((kw) => (it.name_ar || "").toLowerCase().includes(kw)),
  );
  const accessoryItems = order.items.filter((it) =>
    packagingKeywords.some((kw) => (it.name_ar || "").toLowerCase().includes(kw)),
  );

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl bg-card border border-border shadow-2xl overflow-hidden"
      >
        {/* Modal Sticky Header */}
        <div className="flex items-center justify-between border-b border-border p-4 bg-secondary/30 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-500 text-white shadow-xs">
              <Cake className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-black text-lg text-foreground">
                  طلب {orderLabel(order.order_number, order.staff_code)}
                </h2>
                <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-secondary text-foreground border border-border">
                  {order.method === "delivery" ? "توصيل 🛵" : "استلام من المحل 🏪"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-bold">
                العميل: <strong className="text-foreground">{order.customer_name}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-foreground hover:bg-secondary/80 transition cursor-pointer"
            title="إغلاق"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Scrollable Body formatted smoothly like Confirmation Message */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-foreground">
          {/* 1. Time & Fulfilment Banner */}
          <div className="rounded-2xl border border-amber-300/80 bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-amber-500/10 p-3.5 space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-black text-amber-950 dark:text-amber-100">
              <span className="flex items-center gap-1.5 text-sm">
                <span>📅</span>
                <span>موعد التجهيز والتسليم:</span>
              </span>
              <span className="text-sm font-black text-amber-900 dark:text-amber-200">
                {formatArabicDate(order.requested_date)} ⏰{" "}
                {formatTimeSlotArabic(order.requested_time)}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs font-bold text-muted-foreground pt-1 border-t border-amber-300/40">
              <span>
                🚗 طريقة التسليم:{" "}
                <strong className="text-foreground">
                  {order.method === "delivery" ? "توصيل" : "استلام من المحل"}
                </strong>
              </span>
              <span>•</span>
              <span>
                👤 العميل: <strong className="text-foreground">{order.customer_name}</strong>
              </span>
            </div>
          </div>

          {/* Modifications Notice (if any) */}
          {kitchenMods.length > 0 && (
            <div className="rounded-2xl border border-amber-400 bg-amber-500/10 p-3.5 space-y-2 text-xs">
              <span className="font-black text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                <span>📝</span>
                <span>تعديلات الطلب المعتمدة للتجهيز بالمطبخ:</span>
              </span>
              <div className="space-y-1.5">
                {kitchenMods.map((mod, idx) => (
                  <div
                    key={idx}
                    className="flex flex-wrap items-center gap-1.5 font-bold text-foreground"
                  >
                    <span className="font-black text-amber-900 dark:text-amber-300">
                      • {mod.field}:
                    </span>
                    {mod.oldValue && (
                      <span className="line-through text-muted-foreground text-[11px] bg-secondary/80 px-1.5 py-0.5 rounded">
                        {mod.oldValue}
                      </span>
                    )}
                    {mod.oldValue && mod.newValue && (
                      <span className="text-amber-700 dark:text-amber-400 font-black">⬅️</span>
                    )}
                    {mod.newValue && (
                      <span className="font-black text-emerald-800 dark:text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-lg">
                        {mod.newValue}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. Items & Preparation Specs List */}
          <div className="rounded-2xl border border-border bg-secondary/30 p-4 space-y-3">
            <h3 className="font-black text-sm text-[#5D2E17] dark:text-amber-300 flex items-center gap-2 border-b border-border/60 pb-2">
              <span>🎂</span>
              <span>تفاصيل ومواصفات الطلب للتجهيز:</span>
            </h3>

            <div className="space-y-3">
              {(mainItems.length > 0 ? mainItems : order.items).map((item, idx) => {
                const cleanOptions = item.options_ar.filter((opt) => !isChannelOrMeta(opt));
                return (
                  <div
                    key={item.id || idx}
                    className="rounded-xl bg-card p-3 border border-border/80 space-y-2 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-base text-foreground">
                        {item.quantity} × {item.name_ar}
                      </span>
                      {item.category && (
                        <span className="text-[11px] font-bold text-muted-foreground bg-secondary px-2.5 py-0.5 rounded-full">
                          {item.category}
                        </span>
                      )}
                    </div>

                    {cleanOptions.length > 0 && (
                      <ul className="space-y-1 text-xs font-bold text-foreground/90 pr-2 border-r-2 border-amber-400">
                        {cleanOptions.map((opt, oIdx) => (
                          <li key={oIdx} className="flex items-start gap-1.5">
                            <span className="text-amber-800 dark:text-amber-300 font-black">•</span>
                            <span>{opt}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {item.notes && (
                      <p className="text-xs font-bold text-amber-950 dark:text-amber-100 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                        <span className="font-black text-amber-800 dark:text-amber-300">
                          ملاحظة الصنف:{" "}
                        </span>
                        <span>{item.notes}</span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Inscription / Card Writing */}
          {(order.inscription || order.card_note) && (
            <div className="rounded-2xl border border-amber-300/80 bg-amber-50/70 dark:bg-amber-950/20 p-3.5 space-y-2">
              <h3 className="font-black text-xs text-amber-950 dark:text-amber-100 flex items-center gap-1.5">
                <span>🎀</span>
                <span>الكتابة المطلوبة على الكرت أو الكيكة:</span>
              </h3>
              {order.inscription && (
                <p className="font-black text-foreground bg-card p-2.5 rounded-xl border border-amber-300/60 text-sm select-all">
                  "{order.inscription}"
                </p>
              )}
              {order.card_note && order.card_note !== order.inscription && (
                <p className="font-black text-foreground bg-card p-2.5 rounded-xl border border-amber-300/60 text-sm select-all">
                  <span className="text-xs text-muted-foreground block mb-0.5">نص الكرت:</span>"
                  {order.card_note}"
                </p>
              )}
            </div>
          )}

          {/* 4. Accessories */}
          {accessoryItems.length > 0 && (
            <div className="rounded-2xl border border-border bg-secondary/40 p-3 text-xs">
              <span className="font-black text-foreground block mb-1">
                📦 ملحقات التغليف والشموع:
              </span>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground font-bold">
                {accessoryItems.map((acc, aIdx) => (
                  <li key={aIdx}>
                    {acc.quantity} × {acc.name_ar}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 5. Reference Design Image */}
          {order.design_image_url && (
            <div className="rounded-2xl border border-border bg-card p-3 flex items-center justify-between gap-3">
              <div
                onClick={() => onZoom(order.design_image_url as string)}
                className="flex items-center gap-3 cursor-pointer group"
              >
                <img
                  src={order.design_image_url}
                  alt="تصميم الكيك"
                  className="h-16 w-16 rounded-xl object-cover border border-border shadow-xs group-hover:scale-105 transition"
                />
                <div>
                  <span className="font-black text-xs text-primary group-hover:underline block">
                    صورة التصميم المرجعية (اضغط للتكبير) 🔍
                  </span>
                  <span className="text-[11px] text-muted-foreground font-bold">
                    معاينة الشكل والديكور المعتمد
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  void downloadDesignImage(order.design_image_url as string, order.order_number)
                }
                className="grid h-10 w-10 place-items-center rounded-xl border border-border text-foreground hover:bg-secondary cursor-pointer"
                title="تنزيل للطباعة"
              >
                <Download className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* 6. Customer Notes */}
          {order.notes && (
            <div className="rounded-2xl border border-border/70 bg-secondary/30 p-3 text-xs">
              <span className="font-black text-foreground block mb-0.5">💬 ملاحظات العميل:</span>
              <span className="text-muted-foreground font-bold">{order.notes}</span>
            </div>
          )}
        </div>

        {/* Modal Sticky Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border p-3.5 bg-card shrink-0">
          <button
            type="button"
            onClick={() => onPrintTicket(order)}
            className="min-h-[44px] px-4 rounded-xl bg-secondary text-foreground hover:bg-secondary/80 border border-border text-xs font-black flex items-center gap-1.5 transition cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            <span>طباعة تذكرة المطبخ</span>
          </button>

          <div className="flex items-center gap-2">
            {stage === "new" && (
              <button
                type="button"
                onClick={() => {
                  void onStage(order.id, "baking");
                  onClose();
                }}
                className="min-h-[44px] px-5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-sm transition active:scale-95 cursor-pointer"
              >
                [ بدء الخبز والتزيين والكريمة 👨‍🍳 ]
              </button>
            )}

            {stage === "baking" && (
              <button
                type="button"
                onClick={() => {
                  void onStage(order.id, "ready");
                  onClose();
                }}
                className="min-h-[44px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-sm transition active:scale-95 cursor-pointer"
              >
                [ تم تجهيز الكيكة بالكامل والتغليف ✅ ]
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 rounded-xl border border-border bg-background text-foreground hover:bg-secondary text-xs font-bold transition cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function KitchenPanel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchOrders = useServerFn(getKitchenOrders);
  const fetchAccess = useServerFn(getKitchenAccess);
  const applyStage = useServerFn(setKitchenStage);
  const ackModFn = useServerFn(acknowledgeOrderModification);

  const [filter, setFilter] = useState<DateFilterKey>("today");
  const [custom, setCustom] = useState<CustomRange>({ from: isoDay(0), to: isoDay(0) });
  const [viewMode, setViewMode] = useState<"board" | "calendar">("board");
  const [pending, setPending] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [zoom, setZoom] = useState<string | null>(null);
  const [selectedKitchenOrder, setSelectedKitchenOrder] = useState<KdsOrder | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    try {
      const audio = new Audio(bellAsset.url);
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
    staleTime: 15_000,
    refetchInterval: 60_000,
  });

  // Realtime subscription (refetches the kitchen queue on any order change)
  useOrdersRealtime(ORDERS_KEY, true, "kitchen-live");

  // Any newly appearing order or modification raises an alert and rings the kitchen chime.
  const knownIds = useRef<Set<string> | null>(null);
  const knownModTimestamps = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const rows = orders.data;
    if (!rows) return;
    const ids = rows.map((row) => row.id);

    if (!knownIds.current) {
      knownIds.current = new Set(ids);
      rows.forEach((r) => {
        const unack = (r.modifications || [])
          .filter(isKitchenRelevantModification)
          .filter((m) => !m.acknowledgedAt);
        if (unack.length > 0) {
          knownModTimestamps.current.set(r.id, unack[0]?.updatedAt || r.last_edited_at || "init");
        }
      });
      return;
    }

    const fresh = ids.filter((id) => !knownIds.current!.has(id));
    knownIds.current = new Set(ids);

    // Detect newly modified orders with unacknowledged changes relevant to kitchen
    const newlyModified: string[] = [];
    rows.forEach((r) => {
      const unack = (r.modifications || [])
        .filter(isKitchenRelevantModification)
        .filter((m) => !m.acknowledgedAt);
      if (unack.length > 0) {
        const timeKey = unack[0]?.updatedAt || r.last_edited_at || r.schedule_updated_at || "mod";
        if (knownModTimestamps.current.get(r.id) !== timeKey) {
          newlyModified.push(r.id);
          knownModTimestamps.current.set(r.id, timeKey);
        }
      }
    });

    const toAlert = [...fresh, ...newlyModified];
    if (toAlert.length === 0) return;

    if (soundEnabled) {
      if (newlyModified.length > 0) {
        playKitchenModificationChimeSound();
      } else {
        if (audioRef.current) audioRef.current.play().catch(() => playKitchenChimeSound());
        else playKitchenChimeSound();
      }
    }
    setAlerts((curr) => [...curr, ...toAlert.filter((id) => !curr.includes(id))]);
  }, [orders.data, soundEnabled]);

  const rawOrdersList = useMemo(() => orders.data ?? [], [orders.data]);

  const adaptedOrders: SalesOrder[] = useMemo(() => {
    return rawOrdersList.map((k) => ({
      id: k.id,
      order_number: k.order_number,
      staff_code: k.staff_code,
      order_name: null,
      sender_phone: null,
      recipient_phone: null,
      last_edited_at: k.last_edited_at ?? null,
      queue_rank: null,
      customer_name: k.customer_name,
      customer_phone: "—",
      method: k.method,
      area: null,
      address: null,
      requested_date: k.requested_date,
      requested_time: k.requested_time,
      notes: k.notes,
      staff_notes: null,
      inscription: k.inscription,
      design_image_url: k.design_image_url,
      subtotal: 0,
      delivery_fee: 0,
      discount_amount: 0,
      discount_percent: 0,
      total: 0,
      deposit_paid: 0,
      payment_method: null,
      driver_name: null,
      driver_phone: null,
      cancel_reason: null,
      card_note: null,
      final_photo_requested: false,
      confirmation_message: null,
      status: (k.status === "ready"
        ? "ready"
        : k.status === "baking"
          ? "baking"
          : "new") as SalesStatus,
      schedule_updated_at: k.schedule_updated_at ?? null,
      created_at: k.requested_date || new Date().toISOString(),
      updated_at: k.requested_date || new Date().toISOString(),
      modifications: k.modifications ?? null,
      items: (k.items || []).map((it) => ({
        id: it.id,
        order_id: k.id,
        product_id: null,
        item_name: it.name_ar || it.name_en,
        name_ar: it.name_ar,
        name_en: it.name_en,
        options_ar: it.options_ar || [],
        quantity: it.quantity,
        unit_price: 0,
        total_price: 0,
        notes: it.notes,
        flavor: (it.options_ar || []).join(", "),
        size: null,
        category: it.category,
        color: null,
        filling: null,
        photo_url: null,
        priority_color: it.priority_color,
        order_index: 0,
      })),
    })) as unknown as SalesOrder[];
  }, [rawOrdersList]);

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
            className="min-h-[44px] rounded-xl bg-primary px-6 text-xs font-black text-primary-foreground shadow-sm hover:opacity-90 cursor-pointer"
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
      className="min-h-screen w-full bg-background text-foreground pb-20 font-sans select-none"
    >
      {/* 1. MASTER PRODUCTION COMMAND BAR */}
      <header className="sticky top-0 z-30 border-b border-border/80 bg-card/95 backdrop-blur-md px-4 py-3 shadow-xs">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500 text-white shadow-sm shrink-0">
              <ChefHat className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-black text-lg text-foreground leading-none">
                  شاشة المطبخ والإنتاج • Delish Bakery KDS
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-black text-amber-600 border border-amber-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                  مباشر FIFO
                </span>
                {unackModsCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 text-white px-2.5 py-0.5 text-[11px] font-black animate-pulse shadow-sm">
                    ⚠️ {unackModsCount} طلب معدّل بانتظار الاعتماد
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-muted-foreground mt-1">
                ترتيب زمني تلقائي • الأقرب موعداً في الصدارة دائماً • إبراز فوري للعبارة المكتوبة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Switcher */}
            <div className="flex rounded-2xl bg-secondary/80 p-1 border border-border/70">
              <button
                type="button"
                onClick={() => setViewMode("board")}
                className={`min-h-[38px] px-3.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === "board"
                    ? "bg-card text-foreground shadow-xs border border-border/80"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>لوحة التجهيز</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("calendar")}
                className={`min-h-[38px] px-3.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === "calendar"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                <span>تقويم الطلبات</span>
              </button>
            </div>

            {/* Quick Date Filter Chips (shown when in board view) */}
            {viewMode === "board" && (
              <div className="flex rounded-2xl bg-secondary/60 p-1 border border-border/70">
                <button
                  type="button"
                  onClick={() => setFilter("today")}
                  className={`min-h-[38px] px-3.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    filter === "today"
                      ? "bg-card text-foreground shadow-xs border border-border/80"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  طلبات اليوم
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("tomorrow")}
                  className={`min-h-[38px] px-3.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    filter === "tomorrow"
                      ? "bg-card text-foreground shadow-xs border border-border/80"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  غداً
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className={`min-h-[38px] px-3.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    filter === "all"
                      ? "bg-card text-foreground shadow-xs border border-border/80"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  جميع الطلبات
                </button>
              </div>
            )}

            {/* Sound Toggle Button */}
            <button
              type="button"
              onClick={() => setSoundEnabled((v) => !v)}
              className={`min-h-[44px] px-3.5 rounded-xl border text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${
                soundEnabled
                  ? "bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30"
                  : "bg-secondary text-muted-foreground border-border"
              }`}
            >
              {soundEnabled ? (
                <BellRing className="h-4 w-4 text-amber-500" />
              ) : (
                <Bell className="h-4 w-4" />
              )}
              <span>{soundEnabled ? "رنين التنبيهات شغال" : "صامت"}</span>
            </button>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => void queryClient.invalidateQueries({ queryKey: ORDERS_KEY })}
              title="تحديث الطلبات"
              className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-card text-foreground hover:bg-secondary cursor-pointer"
            >
              <RefreshCw
                className={`h-4 w-4 ${orders.isFetching ? "animate-spin text-primary" : ""}`}
              />
            </button>
          </div>
        </div>
      </header>

      {/* 2. MAIN CONTENT: CALENDAR OR THREE-STAGE PRODUCTION BOARD */}
      {viewMode === "calendar" ? (
        <main className="mx-auto max-w-7xl px-3 sm:px-4 py-4">
          <OrdersCalendar
            orders={adaptedOrders}
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
        <main className="mx-auto max-w-7xl px-3 sm:px-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
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
                  className={`flex flex-col rounded-3xl bg-card border border-border/80 shadow-xs overflow-hidden ${stage.border}`}
                >
                  {/* Stage Header */}
                  <div className="flex items-center justify-between p-3.5 border-b border-border/60 bg-secondary/30">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{stage.icon}</span>
                      <h3 className="font-black text-sm text-foreground">{stage.ar}</h3>
                      <span className="grid h-6 min-w-6 place-items-center px-2 rounded-full bg-primary text-[11px] font-black text-primary-foreground shadow-2xs">
                        {list.length}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground">{stage.en}</span>
                  </div>

                  {/* Orders Column List */}
                  <div className="p-3 space-y-3.5 min-h-[58vh]">
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
                          onOpenDetails={setSelectedKitchenOrder}
                        />
                      ))
                    ) : (
                      <div className="grid h-48 place-items-center rounded-2xl border border-dashed border-border/80 text-center text-xs font-bold text-muted-foreground/60 p-4">
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

      {/* 3. FULLSCREEN REFERENCE DESIGN IMAGE MODAL */}
      {zoom && (
        <div
          onClick={() => setZoom(null)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-lg p-4 animate-in fade-in duration-200"
        >
          <div
            className="relative w-full max-w-4xl max-h-[92vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={zoom}
              alt="صورة التصميم المرجعية بملء الشاشة"
              className="max-h-[80vh] max-w-full rounded-3xl object-contain shadow-2xl border border-white/20"
            />
            <button
              type="button"
              onClick={() => setZoom(null)}
              className="mt-4 min-h-[50px] px-8 rounded-full bg-white text-slate-950 font-black text-sm shadow-2xl hover:bg-slate-100 active:scale-95 transition cursor-pointer flex items-center gap-2"
            >
              <X className="h-5 w-5" />
              إغلاق العرض (العودة إلى شاشة المطبخ)
            </button>
          </div>
        </div>
      )}

      {/* 4. DETAILED ORDER SPECIFICATIONS MODAL (Clean list & Confirmation style) */}
      {selectedKitchenOrder && (
        <KitchenOrderDetailsModal
          order={selectedKitchenOrder}
          onClose={() => setSelectedKitchenOrder(null)}
          onStage={onStage}
          onPrintTicket={printKitchenTicket}
          onZoom={setZoom}
        />
      )}
    </div>
  );
}
