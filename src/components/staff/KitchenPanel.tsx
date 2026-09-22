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
    let h = parseInt(parts[0] ?? "", 10);
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
            `<div class="item" style="padding:4px 0;border-bottom:1px dashed #bbb;"><b style="font-size:18px;">${item.quantity} × ${esc(item.name_ar)}</b>` +
            (item.options_ar.length
              ? `<div class="opt" style="font-size:14px;color:#222;font-weight:bold;margin-top:2px;">${item.options_ar.map((o) => `• ${esc(o)}`).join("<br>")}</div>`
              : "") +
            (item.notes ? `<div class="note" style="font-size:13px;color:#8b4513;font-weight:bold;margin-top:2px;">ملاحظة: ${esc(item.notes)}</div>` : "") +
            `</div>`,
        )
        .join("")
    : `<div class="item">لا توجد أصناف مسجلة</div>`;

  const body = `<h1 style="text-align:center;font-size:22px;margin-bottom:6px;font-weight:900;">Delish Bakery • تذكرة المطبخ</h1>
<div style="font-size:18px;font-weight:bold;display:flex;justify-content:space-between;margin-bottom:6px;border-bottom:2px dashed #000;padding-bottom:4px;">
  <span>${esc(orderLabel(order.order_number, order.staff_code))}</span>
  <span>${order.method === "delivery" ? "توصيل 🛵" : "استلام 🏪"}</span>
</div>
<div style="font-size:16px;font-weight:bold;margin-bottom:6px;"><b>الموعد المطلوب:</b> ${esc(order.requested_date ?? "")} | ${esc(formatTimeSlotArabic(order.requested_time ?? ""))}</div>
<div style="font-size:15px;margin-bottom:6px;"><b>العميل:</b> ${esc(order.customer_name)}</div>
${order.schedule_updated_at ? `<div style="color:red;font-weight:bold;margin-bottom:4px;">⚠️ تنبيه: تم تعديل موعد الطلب مسبقاً</div>` : ""}
<div style="border-top:2px dashed #000;margin:6px 0;"></div>
${lines}
<div style="border-top:2px dashed #000;margin:6px 0;"></div>
${order.inscription ? `<div style="background:#FFF3CD;padding:8px;border:2px solid #000;border-radius:6px;margin:8px 0;font-size:18px;font-weight:bold;">✍️ الكتابة على الكيك:<br><span style="font-size:20px;">${esc(order.inscription)}</span></div>` : ""}
${order.notes ? `<div style="margin-top:6px;font-size:13px;background:#f5f5f5;padding:6px;border-radius:4px;"><b>ملاحظات العميل:</b> ${esc(order.notes)}</div>` : ""}`;

  printDocument(`تذكرة مطبخ ${order.order_number}`, body, "body{font-family:sans-serif;font-size:14px;}");
}

const ORDERS_KEY = ["kds-orders"] as const;

const STAGES: { key: KitchenStage; ar: string; en: string; icon: string; border: string; bgBadge: string }[] = [
  { key: "new", ar: "طلبات جديدة بانتظار البدء", en: "Incoming Queue", icon: "🆕", border: "border-t-4 border-t-amber-500", bgBadge: "bg-amber-100 text-amber-900 border-amber-300" },
  { key: "baking", ar: "قيد الخبز والتزيين والكريمة", en: "In Baking / Decorating", icon: "👩‍🍳", border: "border-t-4 border-t-blue-500", bgBadge: "bg-blue-100 text-blue-900 border-blue-300" },
  { key: "ready", ar: "جاهزة ومكتملة للتسليم", en: "Ready for Handover", icon: "✨", border: "border-t-4 border-t-emerald-500", bgBadge: "bg-emerald-100 text-emerald-900 border-emerald-300" },
];

const stageOf = (status: string): KitchenStage =>
  status === "ready" ? "ready" : status === "baking" ? "baking" : "new";

/** Formats time remaining with exact SLA color indicators: Safe (>45m), Urgent (<20m), Overdue (Late) */
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

/** Resolves visual priority styles for cards */
function getPriorityStyles(color: PriorityColor) {
  switch (color) {
    case "dark_red":
      return {
        cardBg: "bg-card border-orange-400/80 shadow-xs",
        badgeBg: "bg-orange-100 text-orange-950 border-orange-300",
        badgeText: "أولوية قصوى",
      };
    case "warm_amber":
      return {
        cardBg: "bg-card border-amber-400/80 shadow-xs",
        badgeBg: "bg-amber-100 text-amber-950 border-amber-300",
        badgeText: "توصيل سريع",
      };
    case "fresh_mint":
      return {
        cardBg: "bg-card border-emerald-400/80 shadow-xs",
        badgeBg: "bg-emerald-100 text-emerald-950 border-emerald-300",
        badgeText: "تجهيز عادي",
      };
    case "royal_gold":
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

  // Filter out packaging accessories to show as a compact secondary summary
  const packagingKeywords = ["شمعة", "شموع", "بالون", "بالونات", "توبر", "كرت", "topper", "candle", "balloon"];
  const mainItems = order.items.filter(
    (it) => !packagingKeywords.some((kw) => (it.name_ar || "").toLowerCase().includes(kw)),
  );
  const accessoryItems = order.items.filter((it) =>
    packagingKeywords.some((kw) => (it.name_ar || "").toLowerCase().includes(kw)),
  );

  return (
    <article
      className={`relative flex flex-col justify-between rounded-3xl border p-4 shadow-sm hover:shadow-md transition-all ${orderPrio.cardBg}`}
    >
      {/* Top Priority Accent Strip */}
      <div
        className="absolute top-0 inset-x-0 h-2 rounded-t-3xl"
        style={{ backgroundColor: priorityMeta.swatch || priorityMeta.bg }}
      />

      <div className="space-y-3 pt-1.5">
        {/* Card Header: Order Number, Method, SLA countdown, Delivery Time */}
        <div className="flex items-start justify-between gap-2 border-b border-border/80 pb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-black text-lg sm:text-xl text-foreground leading-tight">
                {orderLabel(order.order_number, order.staff_code)}
              </h2>
              {isEdited && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black border ${
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

        {/* MODIFICATIONS DIFF ALERT BOX */}
        {order.modifications && order.modifications.length > 0 && (
          <div className="rounded-2xl border-2 border-amber-400 bg-amber-500/10 p-3 text-xs space-y-2 shadow-xs animate-in fade-in duration-150">
            <div className="flex items-center justify-between font-black">
              <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                تعديل على الطلب:
              </span>
              {hasUnack ? (
                <span className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full font-black animate-pulse">
                  تعديل غير مؤكد بالمطبخ
                </span>
              ) : (
                <span className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
                  تمت المراجعة ✓
                </span>
              )}
            </div>

            <div className="space-y-1.5">
              {order.modifications.map((mod, idx) => (
                <div key={idx} className="rounded-xl bg-card p-2 border border-border/80 text-[11px]">
                  <div className="flex justify-between font-bold text-muted-foreground mb-1">
                    <span>{mod.field}:</span>
                    <span>{formatRelativeTime(mod.updatedAt)}</span>
                  </div>
                  {mod.oldValue && (
                    <div className="flex items-center gap-1 text-red-600 bg-red-500/10 p-1 rounded-lg font-bold">
                      <span className="shrink-0">❌ السابق:</span>
                      <span className="line-through">{mod.oldValue}</span>
                    </div>
                  )}
                  {mod.newValue && (
                    <div className="flex items-center gap-1 text-emerald-700 bg-emerald-500/10 p-1 rounded-lg font-black mt-0.5">
                      <span className="shrink-0">➕ الجديد:</span>
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
                className="w-full min-h-[44px] rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-black text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4" />
                [ تمت مراجعة التعديل في المطبخ ✓ ]
              </button>
            )}
          </div>
        )}

        {/* ORDER ITEMS: Cake Name, Options, Fillings (Large font legible from 2 meters) */}
        <div className="space-y-2">
          {(mainItems.length > 0 ? mainItems : order.items).map((item) => (
            <div
              key={item.id}
              className="rounded-2xl bg-secondary/40 p-3 border border-border/80 shadow-2xs space-y-1.5"
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

              {item.options_ar.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {item.options_ar.map((option, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center rounded-xl bg-amber-500/15 px-2.5 py-1 text-xs font-black text-amber-900 dark:text-amber-200 border border-amber-500/30"
                    >
                      {option}
                    </span>
                  ))}
                </div>
              )}

              {item.notes && (
                <p className="text-xs font-black text-amber-900 dark:text-amber-200 bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
                  ملاحظة الصنف: {item.notes}
                </p>
              )}
            </div>
          ))}

          {/* THE GOLDEN CAKE RIBBON: Highlighted Inscription Banner */}
          {order.inscription && (
            <div className="rounded-2xl border-2 border-amber-400 bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-amber-500/20 p-3.5 text-xs shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-amber-950 dark:text-amber-100 font-black">
                <span className="flex items-center gap-1.5 text-sm">
                  <span>🎂</span>
                  <span>الكتابة المطلوبة على الكيكة:</span>
                </span>
                <span className="bg-amber-600 text-white text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase">
                  مهم جداً للكريمة
                </span>
              </div>
              <p className="font-black text-foreground bg-card p-3 rounded-xl border-2 border-amber-400 text-lg sm:text-xl leading-relaxed select-all shadow-xs text-center">
                "{order.inscription}"
              </p>
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
                onClick={() => void downloadDesignImage(order.design_image_url as string, order.order_number)}
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
      </div>

      {/* FOOTER & ACTIONS (Large tactile touch buttons) */}
      <div className="mt-4 pt-3 border-t border-border/80 space-y-2">
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
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
            [ بدء الخبز والتزيين والكريمة 👩‍🍳 ]
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
          <p className="text-xs text-muted-foreground">هذا الحساب لا يملك صلاحيات الوصول لشاشة المطبخ (KDS).</p>
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
    <div dir="rtl" className="min-h-screen w-full bg-background text-foreground pb-20 font-sans select-none">
      {/* 1. MASTER PRODUCTION COMMAND BAR */}
      <header className="sticky top-0 z-30 border-b border-border/80 bg-card/95 backdrop-blur-md px-4 py-3 shadow-xs">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500 text-white shadow-sm shrink-0">
              <ChefHat className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-lg text-foreground leading-none">
                  شاشة المطبخ والإنتاج • Delish Bakery KDS
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-black text-amber-600 border border-amber-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                  مباشر FIFO
                </span>
              </div>
              <p className="text-xs font-bold text-muted-foreground mt-1">
                ترتيب زمني تلقائي • الأقرب موعداً في الصدارة دائماً • إبراز فوري للعبارة المكتوبة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Date Filter Chips */}
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
              {soundEnabled ? <BellRing className="h-4 w-4 text-amber-500" /> : <Bell className="h-4 w-4" />}
              <span>{soundEnabled ? "رنين التنبيهات شغال" : "صامت"}</span>
            </button>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => void queryClient.invalidateQueries({ queryKey: ORDERS_KEY })}
              title="تحديث الطلبات"
              className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-card text-foreground hover:bg-secondary cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${orders.isFetching ? "animate-spin text-primary" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      {/* 2. THREE-STAGE PRODUCTION BOARD */}
      <main className="mx-auto max-w-7xl px-3 sm:px-4 py-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          {STAGES.map((stage) => {
            const list = visible.filter((o) => stageOf(o.status) === stage.key);
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
    </div>
  );
}