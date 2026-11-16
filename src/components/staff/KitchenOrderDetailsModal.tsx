import { useMemo } from "react";
import { Cake, Printer, X } from "lucide-react";

import type { KdsOrder, KitchenStage } from "@/lib/kds.functions";
import { formatTimeSlotArabic } from "@/lib/receipt-templates";
import { orderLabel } from "@/lib/order-label";
import { consolidateModifications } from "@/lib/order-modifications";
import { formatArabicDate } from "@/lib/confirmation-message";
import { DesignGallery } from "@/components/staff/DesignGallery";
import { ModificationsSummary } from "@/components/staff/ModificationsSummary";
import {
  downloadDesignImage,
  isChannelOrMeta,
  splitKitchenItems,
  stageOf,
} from "@/components/staff/kds-helpers";

interface KitchenOrderDetailsModalProps {
  order: KdsOrder;
  onClose: () => void;
  onStage: (id: string, stage: KitchenStage) => void;
  onPrintTicket: (order: KdsOrder) => void;
  onZoom: (url: string) => void;
}

/** Detailed preparation specifications modal for kitchen staff. */
export function KitchenOrderDetailsModal({
  order,
  onClose,
  onStage,
  onPrintTicket,
  onZoom,
}: KitchenOrderDetailsModalProps) {
  const stage = stageOf(order.status);
  const kitchenMods = useMemo(
    () => consolidateModifications(order.modifications, { isKitchen: true }),
    [order.modifications],
  );
  const { mainItems, accessoryItems } = useMemo(
    () => splitKitchenItems(order.items),
    [order.items],
  );

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex animate-in items-center justify-center overflow-y-auto bg-black/75 p-3 backdrop-blur-sm duration-150 fade-in sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-secondary/30 p-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-500 text-white shadow-xs">
              <Cake className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-foreground">
                  طلب {orderLabel(order.order_number, order.staff_code)}
                </h2>
                <span className="rounded-full border border-border bg-secondary px-2.5 py-0.5 text-[11px] font-black text-foreground">
                  {order.method === "delivery" ? "توصيل 🛵" : "استلام من المحل 🏪"}
                </span>
              </div>
              <p className="text-xs font-bold text-muted-foreground">
                العميل: <strong className="text-foreground">{order.customer_name}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-secondary text-foreground transition hover:bg-secondary/80"
            title="إغلاق"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-4 text-foreground sm:p-6">
          <div className="space-y-1.5 rounded-2xl border border-amber-300/80 bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-amber-500/10 p-3.5">
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
            <div className="flex items-center gap-3 border-t border-amber-300/40 pt-1 text-xs font-bold text-muted-foreground">
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

          <div className="space-y-3 rounded-2xl border border-border bg-secondary/30 p-4">
            <h3 className="flex items-center gap-2 border-b border-border/60 pb-2 text-sm font-black text-[#5D2E17] dark:text-amber-300">
              <span>🎂</span>
              <span>تفاصيل ومواصفات الطلب للتجهيز:</span>
            </h3>

            <div className="space-y-3">
              {(mainItems.length > 0 ? mainItems : order.items).map((item, idx) => {
                const cleanOptions = item.options_ar.filter((opt) => !isChannelOrMeta(opt));
                return (
                  <div
                    key={item.id || idx}
                    className="space-y-2 rounded-xl border border-border/80 bg-card p-3 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-base font-black text-foreground">
                        {item.quantity} × {item.name_ar}
                      </span>
                      {item.category && (
                        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">
                          {item.category}
                        </span>
                      )}
                    </div>

                    {cleanOptions.length > 0 && (
                      <ul className="space-y-1 border-r-2 border-amber-400 pr-2 text-xs font-bold text-foreground/90">
                        {cleanOptions.map((opt, oIdx) => (
                          <li key={oIdx} className="flex items-start gap-1.5">
                            <span className="font-black text-amber-800 dark:text-amber-300">•</span>
                            <span>{opt}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {item.notes && (
                      <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-xs font-bold text-amber-950 dark:text-amber-100">
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

          {(order.inscription || order.card_note) && (
            <div className="space-y-2 rounded-2xl border border-amber-300/80 bg-amber-50/70 p-3.5 dark:bg-amber-950/20">
              <h3 className="flex items-center gap-1.5 text-xs font-black text-amber-950 dark:text-amber-100">
                <span>🎀</span>
                <span>الكتابة المطلوبة على الكرت أو الكيكة:</span>
              </h3>
              {order.inscription && (
                <p className="rounded-xl border border-amber-300/60 bg-card p-2.5 text-sm font-black text-foreground select-all">
                  "{order.inscription}"
                </p>
              )}
              {order.card_note && order.card_note !== order.inscription && (
                <p className="rounded-xl border border-amber-300/60 bg-card p-2.5 text-sm font-black text-foreground select-all">
                  <span className="mb-0.5 block text-xs text-muted-foreground">نص الكرت:</span>"
                  {order.card_note}"
                </p>
              )}
            </div>
          )}

          {accessoryItems.length > 0 && (
            <div className="rounded-2xl border border-border bg-secondary/40 p-3 text-xs">
              <span className="mb-1 block font-black text-foreground">
                📦 ملحقات التغليف والشموع:
              </span>
              <ul className="list-inside list-disc space-y-0.5 font-bold text-muted-foreground">
                {accessoryItems.map((acc, aIdx) => (
                  <li key={aIdx}>
                    {acc.quantity} × {acc.name_ar}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-3 empty:hidden">
            <DesignGallery
              designImageUrl={order.design_image_url}
              onZoom={onZoom}
              onDownload={(url, idx) =>
                void downloadDesignImage(url, `${order.order_number}-${idx + 1}`)
              }
              subtitle="معاينة الشكل والديكور المعتمد"
            />
          </div>

          {order.notes && (
            <div className="rounded-2xl border border-border/70 bg-secondary/30 p-3 text-xs">
              <span className="mb-0.5 block font-black text-foreground">💬 ملاحظات العميل:</span>
              <span className="font-bold text-muted-foreground">{order.notes}</span>
            </div>
          )}

          <ModificationsSummary modifications={kitchenMods} />
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border bg-card p-3.5">
          <button
            type="button"
            onClick={() => onPrintTicket(order)}
            className="flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-secondary px-4 text-xs font-black text-foreground transition hover:bg-secondary/80"
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
                className="min-h-[44px] cursor-pointer rounded-xl bg-amber-600 px-5 text-xs font-black text-white shadow-sm transition hover:bg-amber-700 active:scale-95"
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
                className="min-h-[44px] cursor-pointer rounded-xl bg-emerald-600 px-5 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 active:scale-95"
              >
                [ تم تجهيز الكيكة بالكامل والتغليف ✅ ]
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] cursor-pointer rounded-xl border border-border bg-background px-4 text-xs font-bold text-foreground transition hover:bg-secondary"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
