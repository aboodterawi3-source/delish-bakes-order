import { useMemo } from "react";
import {
  generateAvailableSlots,
  calculateRequiredLeadTime,
  type SlotMethod,
} from "@/lib/delivery-slots";
import { todayIso, isoDay } from "@/lib/date-filter";
import { Clock, AlertCircle } from "lucide-react";

export interface TimeSlotPickerProps {
  date: string;
  time: string;
  method: SlotMethod;
  cartItems?: { name_ar?: string; name_en?: string; options_ar?: string[] }[];
  onDateChange: (date: string) => void;
  onTimeChange: (time: string, slotId: string) => void;
  lang?: "ar" | "en";
  className?: string;
  error?: boolean;
}

export function TimeSlotPicker({
  date,
  time,
  method,
  cartItems = [],
  onDateChange,
  onTimeChange,
  lang = "ar",
  className = "",
  error = false,
}: TimeSlotPickerProps) {
  const isAr = lang === "ar";
  const today = todayIso();

  // 1. Calculate required lead time for items in cart
  const leadTimeHours = useMemo(() => calculateRequiredLeadTime(cartItems), [cartItems]);

  // 2. Generate next 5 calendar days
  const availableDays = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => {
      const d = isoDay(i);
      const dateObj = new Date(d);
      let label = "";
      if (i === 0) label = isAr ? "اليوم" : "Today";
      else if (i === 1) label = isAr ? "غداً" : "Tomorrow";
      else {
        label = new Intl.DateTimeFormat(isAr ? "ar-JO" : "en-US", {
          weekday: "short",
          month: "numeric",
          day: "numeric",
        }).format(dateObj);
      }
      return { iso: d, label };
    });
  }, [isAr]);

  // 3. Ensure a valid active date is set
  const activeDate = date || today;

  // 4. Generate available slots for active date and method
  const slots = useMemo(() => {
    return generateAvailableSlots({
      date: activeDate,
      method,
      leadTimeHours,
    });
  }, [activeDate, method, leadTimeHours]);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Lead Time Assurance Note for Cakes */}
      {leadTimeHours > 1 && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-800 dark:text-amber-200">
          <Clock className="h-4 w-4 shrink-0 text-amber-600" />
          <span>
            {isAr
              ? `يتطلب طلبك ${leadTimeHours} ساعات تحضير وتزيين مسبقة لضمان أعلى جودة وطزاجة.`
              : `Your bakes require a ${leadTimeHours}-hour preparation lead time for supreme freshness.`}
          </span>
        </div>
      )}

      {/* Day Selector Pills */}
      <div>
        <label className="mb-1.5 block text-xs font-bold text-foreground/80">
          {isAr ? "موعد الاستلام / التوصيل" : "Preferred Date"}
        </label>
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {availableDays.map((day) => {
            const isSelected = activeDate === day.iso;
            return (
              <button
                key={day.iso}
                type="button"
                onClick={() => onDateChange(day.iso)}
                className={`flex-1 shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                  isSelected
                    ? "bg-[#2C1A11] text-[#FAF6F0] shadow-sm dark:bg-[#FAF6F0] dark:text-[#2C1A11]"
                    : "border border-border bg-card/60 text-foreground hover:bg-muted"
                }`}
              >
                {day.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Time Slot Grid */}
      <div>
        <label className="mb-1.5 block text-xs font-bold text-foreground/80">
          {isAr
            ? method === "delivery"
              ? "فترة التوصيل (عمّان)"
              : "فترة الاستلام من الفرع"
            : method === "delivery"
              ? "Delivery Window"
              : "Pickup Window"}
        </label>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {slots.map((slot) => {
            const isSelected = time === slot.startTime;
            const disabled = !slot.isAvailable;

            let badgeText = "";
            if (slot.reasonUnavailable === "capacity") badgeText = isAr ? "مكتملة" : "Full";
            else if (slot.reasonUnavailable === "lead_time") badgeText = isAr ? "تحضير" : "Baking";
            else if (slot.reasonUnavailable === "past") badgeText = isAr ? "مضت" : "Past";

            return (
              <button
                key={slot.id}
                type="button"
                disabled={disabled}
                onClick={() => onTimeChange(slot.startTime, slot.id)}
                className={`relative flex min-h-[46px] flex-col items-center justify-center rounded-xl border p-2 text-center text-xs font-semibold transition-all ${
                  isSelected
                    ? "border-[#2C1A11] bg-[#2C1A11] text-[#FAF6F0] shadow-sm dark:border-white dark:bg-white dark:text-black"
                    : disabled
                      ? "cursor-not-allowed border-dashed border-border/50 bg-muted/40 text-muted-foreground/60"
                      : "border-border bg-card hover:border-[#C59B27] hover:bg-accent/40"
                }`}
              >
                <span>{isAr ? slot.labelAr : slot.labelEn}</span>
                {badgeText && (
                  <span className="mt-0.5 text-[10px] font-normal text-muted-foreground">
                    ({badgeText})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {error && !time && (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          {isAr ? "يرجى تحديد فترة زمنية للاستلام أو التوصيل" : "Please select an available time window"}
        </p>
      )}
    </div>
  );
}
