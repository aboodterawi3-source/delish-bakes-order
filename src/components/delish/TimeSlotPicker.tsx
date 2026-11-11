import { useMemo, useRef } from "react";
import { type SlotMethod } from "@/lib/delivery-slots";
import { todayIso } from "@/lib/date-filter";
import { Calendar as CalendarIcon, Clock, AlertCircle } from "lucide-react";

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

const ARABIC_MONTH_NAMES_MAP: Record<number, string> = {
  0: "كانون الثاني (يناير)",
  1: "شباط (فبراير)",
  2: "آذار (مارس)",
  3: "نيسان (أبريل)",
  4: "أيار (مايو)",
  5: "حزيران (يونيو)",
  6: "تموز (يوليو)",
  7: "آب (أغسطس)",
  8: "أيلول (سبتمبر)",
  9: "تشرين الأول (أكتوبر)",
  10: "تشرين الثاني (نوفمبر)",
  11: "كانون الأول (ديسمبر)",
};

export function TimeSlotPicker({
  date,
  time,
  method,
  onDateChange,
  onTimeChange,
  lang = "ar",
  className = "",
  error = false,
}: TimeSlotPickerProps) {
  const isAr = lang === "ar";
  const today = todayIso();
  const activeDate = date || today;

  const dateInputRef = useRef<HTMLInputElement>(null);
  const timeInputRef = useRef<HTMLInputElement>(null);

  // Parse and format selected date
  const { displayDateHeading, displayDateSub } = useMemo(() => {
    try {
      const parts = activeDate.split("-");
      const year = parseInt(parts[0] || "2026", 10);
      const month = parseInt(parts[1] || "1", 10) - 1;
      const day = parseInt(parts[2] || "1", 10);
      const dateObj = new Date(year, month, day, 12, 0, 0);

      const weekday = new Intl.DateTimeFormat(isAr ? "ar-JO" : "en-US", {
        weekday: "long",
      }).format(dateObj);

      const monthNameAr = new Intl.DateTimeFormat("ar-JO", {
        month: "long",
      }).format(dateObj);
      const monthNameEn = new Intl.DateTimeFormat("en-US", {
        month: "short",
      }).format(dateObj);

      const heading = `${weekday} ${day}`;
      const sub = isAr ? ARABIC_MONTH_NAMES_MAP[month] || monthNameAr : `${monthNameEn} ${year}`;

      return { displayDateHeading: heading, displayDateSub: sub };
    } catch {
      return {
        displayDateHeading: activeDate,
        displayDateSub: isAr ? "تاريخ التوصيل" : "Delivery Date",
      };
    }
  }, [activeDate, isAr]);

  // Format selected time
  const displayTimeHeading = useMemo(() => {
    if (!time) {
      return isAr ? "اختر الساعة" : "Select Time";
    }
    const clean = time.trim();
    const parts = clean.split(":");
    if (parts.length >= 2 && parts[0] !== undefined && parts[1] !== undefined) {
      let hours = parseInt(parts[0], 10);
      const minutes = parts[1].padStart(2, "0");
      if (!isNaN(hours)) {
        const period = isAr ? (hours >= 12 ? "م" : "ص") : hours >= 12 ? "PM" : "AM";
        const h12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
        return `${String(h12).padStart(2, "0")}:${minutes} ${period}`;
      }
    }
    return clean;
  }, [time, isAr]);

  const dateLabel = isAr
    ? method === "delivery"
      ? "تاريخ التوصيل"
      : "تاريخ الاستلام"
    : method === "delivery"
      ? "Delivery Date"
      : "Pickup Date";

  const timeLabel = isAr
    ? method === "delivery"
      ? "ساعة التوصيل"
      : "ساعة الاستلام"
    : method === "delivery"
      ? "Delivery Time"
      : "Pickup Time";

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Dual Luxury Pods */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Pod 1: Date */}
        <div
          onClick={() => {
            if (dateInputRef.current && "showPicker" in dateInputRef.current) {
              try {
                dateInputRef.current.showPicker();
              } catch {
                dateInputRef.current.focus();
              }
            }
          }}
          className={`group relative flex cursor-pointer flex-col justify-between rounded-2xl border bg-card p-3.5 text-start transition-all hover:border-primary/60 hover:shadow-2xs active:scale-[0.99] ${
            error && !date ? "border-destructive" : "border-border"
          }`}
        >
          <input
            ref={dateInputRef}
            type="date"
            min={today}
            value={activeDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="pointer-events-auto absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={dateLabel}
          />
          <div>
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-primary">
              <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
              {dateLabel}
            </span>
            <div className="mt-1.5 font-display text-base font-bold tracking-tight text-foreground sm:text-lg">
              {displayDateHeading}
            </div>
          </div>
          <div className="mt-1 text-xs font-medium text-muted-foreground">{displayDateSub}</div>
        </div>

        {/* Pod 2: Time */}
        <div
          onClick={() => {
            if (timeInputRef.current && "showPicker" in timeInputRef.current) {
              try {
                timeInputRef.current.showPicker();
              } catch {
                timeInputRef.current.focus();
              }
            }
          }}
          className={`group relative flex cursor-pointer flex-col justify-between rounded-2xl border bg-card p-3.5 text-start transition-all hover:border-primary/60 hover:shadow-2xs active:scale-[0.99] ${
            error && !time ? "border-destructive" : "border-border"
          }`}
        >
          <input
            ref={timeInputRef}
            type="time"
            min="10:00"
            max="23:00"
            value={time}
            onChange={(e) => {
              const val = e.target.value;
              onTimeChange(val, `time-${val}`);
            }}
            className="pointer-events-auto absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={timeLabel}
          />
          <div className="flex h-full flex-col justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-primary">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              {timeLabel}
            </span>
            <div className="mt-1.5 font-display text-base font-bold tracking-tight text-foreground sm:text-lg">
              {displayTimeHeading}
            </div>
          </div>
        </div>
      </div>

      {/* Error Feedback */}
      {error && !time && (
        <p className="flex items-center gap-1.5 pt-0.5 text-start text-xs font-semibold text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>
            {isAr ? "يرجى تحديد وقت التسليم بالساعة" : "Please select your preferred time"}
          </span>
        </p>
      )}
    </div>
  );
}
