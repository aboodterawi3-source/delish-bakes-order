import { memo, useEffect, useMemo, useState } from "react";
import {
  Cake,
  CheckCircle2,
  Clock3,
  Eye,
  Loader2,
  PencilLine,
  Play,
  Printer,
  Undo2,
} from "lucide-react";

import type { KdsOrder, KitchenStage } from "@/lib/kds.functions";
import { PRIORITY_META } from "@/lib/priority";
import { formatTimeSlotArabic, printKitchenTicket } from "@/lib/receipt-templates";
import { orderLabel } from "@/lib/order-label";
import { consolidateModifications } from "@/lib/order-modifications";
import { DesignGallery } from "@/components/staff/DesignGallery";
import {
  downloadDesignImage,
  getCountdownText,
  getPriorityStyles,
  isChannelOrMeta,
  splitKitchenItems,
  stageOf,
} from "@/components/staff/kds-helpers";

interface KdsOrderCardProps {
  order: KdsOrder;
  busy: boolean;
  onAck: (id: string, modIds?: string[]) => void;
  onStage: (id: string, stage: KitchenStage) => void;
  onZoom: (url: string) => void;
  onOpenDetails: (order: KdsOrder) => void;
}

export const KdsOrderCard = memo(function KdsOrderCard({
  order,
  busy,
  onAck,
  onStage,
  onZoom,
  onOpenDetails,
}: KdsOrderCardProps) {
  const stage = stageOf(order.status);
  const priorityMeta =
    PRIORITY_META[order.priority_color ?? "soft_green"] || PRIORITY_META["soft_green"];
  const orderPrio = getPriorityStyles(order.priority_color ?? "soft_green");
  const [countdownTick, setCountdownTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCountdownTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const countdown = useMemo(
    () => getCountdownText(order.requested_date, order.requested_time),
    [order.requested_date, order.requested_time, countdownTick],
  );

  const kitchenMods = useMemo(
    () => consolidateModifications(order.modifications, { isKitchen: true }),
    [order.modifications],
  );

  const unackMods = kitchenMods.filter((m) => !m.acknowledgedAt);
  const hasUnack = unackMods.length > 0;
  const isEdited = hasUnack || kitchenMods.length > 0;

  const { mainItems, accessoryItems } = useMemo(
    () => splitKitchenItems(order.items),
    [order.items],
  );

  return (
    <article
      className={`group relative flex flex-col justify-between rounded-3xl border p-4 transition-all duration-200 hover:shadow-md ${orderPrio.cardBg} ${
        hasUnack
          ? "border-amber-400 shadow-lg ring-4 ring-amber-400/50"
          : isEdited
            ? "ring-2 ring-amber-300/60"
            : ""
      }`}
    >
      <div
        className="absolute inset-x-0 top-0 h-2 rounded-t-3xl"
        style={{ backgroundColor: priorityMeta.swatch || priorityMeta.bg }}
      />

      <div className="space-y-3 pt-1.5">
        <div
          onClick={() => onOpenDetails(order)}
          className="group/hdr flex cursor-pointer items-start justify-between gap-2 border-b border-border/80 pb-3 transition hover:opacity-95"
          title="اضغط لفتح صفحة وتفاصيل الطلب كاملة"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg leading-tight font-black text-foreground transition group-hover/hdr:text-primary sm:text-xl">
                {orderLabel(order.order_number, order.staff_code)}
              </h2>
              {isEdited && (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-black shadow-2xs ${
                    hasUnack
                      ? "animate-pulse border-amber-400 bg-amber-500 text-white"
                      : "border-amber-300 bg-amber-100 text-amber-900"
                  }`}
                >
                  <PencilLine className="h-3.5 w-3.5" />
                  {hasUnack ? "⚠️ طلب معدّل - انتبه!" : "معدّل ✓"}
                </span>
              )}
            </div>

            <div className="mt-1 flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground">
                العميل: <strong className="text-foreground">{order.customer_name}</strong>
              </span>
              <span className="rounded-lg border border-border/70 bg-secondary px-2 py-0.5 text-[11px] font-black text-foreground">
                {order.method === "delivery" ? "توصيل 🛵" : "استلام 🏪"}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black shadow-2xs ${
                countdown.status === "overdue"
                  ? "animate-pulse border-red-500 bg-red-600 text-sm text-white"
                  : countdown.status === "urgent"
                    ? "animate-pulse border-amber-400 bg-amber-500 text-white"
                    : countdown.status === "safe"
                      ? "border-emerald-500 bg-emerald-600 text-white"
                      : "border-amber-300 bg-amber-100 font-bold text-amber-950"
              }`}
            >
              <Clock3 className="h-3.5 w-3.5" />
              {countdown.text}
            </span>
            <span className="flex items-center gap-1 text-xs font-black text-foreground">
              ⏰ {formatTimeSlotArabic(order.requested_time)}
            </span>
          </div>
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between border-b border-border/50 pb-1 text-xs font-black text-foreground/80">
            <span className="flex items-center gap-1.5">
              <Cake className="h-4 w-4 text-amber-600" />
              <span>مواصفات وتجهيز الطلب:</span>
            </span>
            <span className="text-[11px] font-bold text-muted-foreground">
              {mainItems.length} صنف
            </span>
          </div>

          {(mainItems.length > 0 ? mainItems : order.items).map((item) => {
            const cleanOptions = item.options_ar.filter((opt) => !isChannelOrMeta(opt));
            return (
              <div
                key={item.id}
                className="space-y-2 rounded-2xl border border-border/80 bg-secondary/50 p-3.5 shadow-2xs"
              >
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-lg leading-snug font-black text-foreground sm:text-xl">
                    {item.quantity} × {item.name_ar}
                  </span>
                  {item.category && (
                    <span className="rounded-full border border-border/60 bg-card px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">
                      {item.category}
                    </span>
                  )}
                </div>

                {cleanOptions.length > 0 && (
                  <ul className="mr-0.5 space-y-1 border-r-2 border-amber-400/60 pt-1 pr-1 text-xs font-bold text-foreground/90">
                    {cleanOptions.map((option, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 leading-snug">
                        <span className="font-black text-amber-800 dark:text-amber-300">•</span>
                        <span>{option}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {item.notes && (
                  <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-2 text-xs font-black text-amber-900 dark:text-amber-200">
                    ملاحظة الصنف: {item.notes}
                  </p>
                )}
              </div>
            );
          })}

          {order.inscription && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs">
              <span className="flex shrink-0 items-center gap-1 font-black text-amber-900 dark:text-amber-200">
                <span>🎂</span>
                <span>الكتابة المطلوبة / الكرت:</span>
              </span>
              <span className="font-bold break-words text-foreground select-all">
                "{order.inscription}"
              </span>
            </div>
          )}

          {order.card_note && order.card_note !== order.inscription && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs">
              <span className="flex shrink-0 items-center gap-1 font-black text-amber-900 dark:text-amber-200">
                <span>💌</span>
                <span>الكتابة على الكرت:</span>
              </span>
              <span className="font-bold break-words text-foreground select-all">
                "{order.card_note}"
              </span>
            </div>
          )}

          {accessoryItems.length > 0 && (
            <div className="rounded-2xl border border-border/70 bg-secondary/50 p-2.5 text-xs font-bold text-muted-foreground">
              <span className="font-black text-foreground">ملحقات التغليف والشموع: </span>
              {accessoryItems.map((acc) => `${acc.quantity} × ${acc.name_ar}`).join(" • ")}
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-2.5 shadow-2xs empty:hidden">
            <DesignGallery
              designImageUrl={order.design_image_url}
              onZoom={onZoom}
              onDownload={(url, idx) =>
                void downloadDesignImage(
                  url,
                  idx === 0 ? order.order_number : `${order.order_number}-${idx + 1}`,
                )
              }
            />
          </div>

          {order.notes && (
            <div className="rounded-xl border border-border/60 bg-secondary/40 p-2.5 text-xs text-muted-foreground">
              <span className="font-black text-foreground">ملاحظات العميل: </span>
              <span>{order.notes}</span>
            </div>
          )}
        </div>

        {kitchenMods.length > 0 && hasUnack && (
          <div className="animate-in space-y-2 rounded-2xl border border-amber-400/80 bg-amber-500/10 p-2.5 shadow-2xs duration-150 fade-in sm:p-3">
            <div className="flex items-center justify-between gap-2 border-b border-amber-400/30 pb-1.5">
              <div className="flex items-center gap-1.5 text-xs font-black text-amber-950 dark:text-amber-200">
                <span className="animate-pulse text-amber-600">⚠️</span>
                <span>تعديل في مواصفات الطلب:</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const targetModIds = unackMods
                    .map((m) => m.id || m.updatedAt)
                    .filter((v): v is string => Boolean(v));
                  onAck(order.id, targetModIds);
                }}
                className="flex min-h-[30px] shrink-0 cursor-pointer items-center gap-1 rounded-lg bg-emerald-600 px-3 text-[11px] font-black text-white shadow-xs transition-all hover:bg-emerald-700 active:scale-95"
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
                    <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 font-black text-emerald-800 dark:text-emerald-300">
                      {mod.newValue}
                    </span>
                  )}
                  {(mod.newValue === "— (تم حذفه)" || !mod.newValue) && mod.oldValue && (
                    <span className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-2 py-0.5 font-black text-rose-700 line-through opacity-70 dark:text-rose-400">
                      {mod.oldValue}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 space-y-2 border-t border-border/80 pt-3">
        <button
          type="button"
          onClick={() => onOpenDetails(order)}
          title="عرض تفاصيل ومواصفات الطلب كاملة"
          className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/15 text-xs font-black text-amber-950 shadow-2xs transition hover:bg-amber-500/25 active:scale-[0.98] dark:text-amber-100"
        >
          <Eye className="h-4 w-4 text-amber-700 dark:text-amber-300" />
          <span>📋 فتح صفحة الطلب</span>
        </button>

        <button
          type="button"
          onClick={() => printKitchenTicket(order)}
          title="طباعة تذكرة المطبخ"
          className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-border bg-secondary/70 text-xs font-black text-foreground shadow-2xs hover:bg-secondary active:scale-95"
        >
          <Printer className="h-4 w-4" />
          🖨️ طباعة تذكرة حرارية للمطبخ
        </button>

        {stage === "new" && (
          <button
            type="button"
            onClick={() => void onStage(order.id, "baking")}
            disabled={busy}
            className="inline-flex min-h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-amber-600 text-sm font-black text-white shadow-md hover:bg-amber-700 active:scale-95 disabled:opacity-60"
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
            className="inline-flex min-h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-blue-600 text-sm font-black text-white shadow-md hover:bg-blue-700 active:scale-95 disabled:opacity-60"
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
            <span className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-xs font-black text-white shadow-xs">
              <CheckCircle2 className="h-4 w-4" /> جاهز للتسليم بالمحل ✓
            </span>
            <button
              type="button"
              onClick={() => void onStage(order.id, "baking")}
              disabled={busy}
              title="تراجع إلى قيد التجهيز"
              className="inline-flex min-h-[52px] cursor-pointer items-center justify-center rounded-2xl border border-border bg-card px-4 text-xs font-black text-foreground hover:bg-secondary"
            >
              <Undo2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </article>
  );
});
