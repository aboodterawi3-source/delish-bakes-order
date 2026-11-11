/**
 * Delish Cake & Bake — Delivery & Pickup Slots Engine
 * Governs scheduled time slots, lead time calculation for artisan cakes,
 * slot capacities, and KDS preparation deadlines.
 * Enforces strict Asia/Amman timezone invariants.
 */

export type SlotMethod = "pickup" | "delivery";

export const BAKERY_OPEN_HOUR = 10; // 10:00 AM
export const BAKERY_CLOSE_HOUR = 23; // 11:00 PM
export const DEFAULT_MAX_SLOT_CAPACITY = 4;

export interface TimeSlot {
  id: string; // e.g. "pickup-14:00" or "delivery-14:00"
  startTime: string; // "14:00"
  endTime: string; // "15:00" (pickup) or "16:00" (delivery)
  labelAr: string;
  labelEn: string;
  method: SlotMethod;
  isAvailable: boolean;
  bookedCount: number;
  maxCapacity: number;
  reasonUnavailable?: "lead_time" | "past" | "capacity" | undefined;
}

export interface KdsUrgency {
  status: "normal" | "warning" | "critical";
  color: "emerald" | "amber" | "rose";
  minutesRemaining: number;
  labelAr: string;
  labelEn: string;
}

/**
 * Safely extracts Jordan date (YYYY-MM-DD), 24-hour hour, and minute.
 * Respects Asia/Amman timezone when extracting from real current instant,
 * or parses simulated ISO string without browser skew.
 */
export function getJordanDateTime(input?: string | Date): {
  dateStr: string;
  hour: number;
  minute: number;
} {
  if (!input) {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Amman",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    let year = "2026";
    let month = "01";
    let day = "01";
    let hour = 12;
    let minute = 0;
    for (const p of parts) {
      if (p.type === "year") year = p.value;
      if (p.type === "month") month = p.value;
      if (p.type === "day") day = p.value;
      if (p.type === "hour") hour = parseInt(p.value, 10);
      if (p.type === "minute") minute = parseInt(p.value, 10);
    }
    if (hour === 24) hour = 0;
    return { dateStr: `${year}-${month}-${day}`, hour, minute };
  }

  if (typeof input === "string") {
    const match = input.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
    if (match) {
      return {
        dateStr: match[1] ?? "2026-01-01",
        hour: match[2] ? parseInt(match[2], 10) : 0,
        minute: match[3] ? parseInt(match[3], 10) : 0,
      };
    }
    return getJordanDateTime(new Date(input));
  }

  // Input is a Date object: extract via Asia/Amman formatter
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Amman",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(input);
  let year = "2026";
  let month = "01";
  let day = "01";
  let hour = 12;
  let minute = 0;
  for (const p of parts) {
    if (p.type === "year") year = p.value;
    if (p.type === "month") month = p.value;
    if (p.type === "day") day = p.value;
    if (p.type === "hour") hour = parseInt(p.value, 10);
    if (p.type === "minute") minute = parseInt(p.value, 10);
  }
  if (hour === 24) hour = 0;
  return { dateStr: `${year}-${month}-${day}`, hour, minute };
}

/**
 * Converts 24-hour hour number to formatted 12-hour Arabic & English string.
 */
function formatHourLabel(hour: number): { ar: string; en: string } {
  const periodAr = hour >= 12 ? "م" : "ص";
  const periodEn = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return {
    ar: `${h12}:00 ${periodAr}`,
    en: `${h12}:00 ${periodEn}`,
  };
}

/**
 * Calculates required preparation lead time in hours based on order items.
 * Celebration / custom cakes require 4 hours lead time; ready bakes require 1 hour.
 */
export function calculateRequiredLeadTime(
  items: { name_ar?: string; name_en?: string; options_ar?: string[] }[],
): number {
  if (!items || items.length === 0) return 1;

  for (const item of items) {
    const nameAr = (item.name_ar || "").toLowerCase();
    const nameEn = (item.name_en || "").toLowerCase();
    const hasOptions = item.options_ar && item.options_ar.length > 0;

    // Any cake or customized item requires artisan preparation lead time
    if (nameAr.includes("كيك") || nameEn.includes("cake") || hasOptions) {
      return 4;
    }
  }

  return 1;
}

export interface SlotGeneratorOptions {
  date: string; // YYYY-MM-DD
  method: SlotMethod;
  leadTimeHours?: number;
  slotBookings?: Record<string, number>;
  maxCapacity?: number;
  currentJordanTime?: string | Date;
}

/**
 * Generates all available slots for a given day and order method.
 * Enforces lead time for today's orders and slot capacity bounds.
 */
export function generateAvailableSlots(options: SlotGeneratorOptions): TimeSlot[] {
  const {
    date,
    method,
    leadTimeHours = 1,
    slotBookings = {},
    maxCapacity = DEFAULT_MAX_SLOT_CAPACITY,
    currentJordanTime,
  } = options;

  const {
    dateStr: currentDateStr,
    hour: currentHour,
    minute: currentMinute,
  } = getJordanDateTime(currentJordanTime);

  const isToday = date === currentDateStr;
  const isPastDay = date < currentDateStr;

  const slots: TimeSlot[] = [];
  const stepHours = method === "delivery" ? 2 : 1;

  for (
    let startH = BAKERY_OPEN_HOUR;
    startH + stepHours <= BAKERY_CLOSE_HOUR;
    startH += stepHours
  ) {
    const endH = startH + stepHours;
    const startStr = `${String(startH).padStart(2, "0")}:00`;
    const endStr = `${String(endH).padStart(2, "0")}:00`;
    const slotId = `${method}-${startStr}`;

    const startLabel = formatHourLabel(startH);
    const endLabel = formatHourLabel(endH);

    const labelAr = `${startLabel.ar} - ${endLabel.ar}`;
    const labelEn = `${startLabel.en} - ${endLabel.en}`;

    const booked = slotBookings[slotId] || 0;
    let isAvailable = true;
    let reasonUnavailable: TimeSlot["reasonUnavailable"] = undefined;

    if (isPastDay) {
      isAvailable = false;
      reasonUnavailable = "past";
    } else if (isToday) {
      // Check if slot has already passed
      if (startH < currentHour || (startH === currentHour && currentMinute > 0)) {
        isAvailable = false;
        reasonUnavailable = "past";
      } else {
        // Check lead time against current time
        const hoursUntilSlot = (startH * 60 - (currentHour * 60 + currentMinute)) / 60;
        if (hoursUntilSlot < leadTimeHours) {
          isAvailable = false;
          reasonUnavailable = "lead_time";
        }
      }
    }

    // Check capacity limit
    if (isAvailable && booked >= maxCapacity) {
      isAvailable = false;
      reasonUnavailable = "capacity";
    }

    slots.push({
      id: slotId,
      startTime: startStr,
      endTime: endStr,
      labelAr,
      labelEn,
      method,
      isAvailable,
      bookedCount: booked,
      maxCapacity,
      reasonUnavailable,
    });
  }

  return slots;
}

/**
 * Evaluates urgency of an order for KDS kitchen screens based on scheduled deadline.
 */
export function getKdsUrgency(
  orderDate: string,
  orderTime: string,
  currentJordanTime?: Date | string,
): KdsUrgency {
  const {
    dateStr: currentDateStr,
    hour: currentHour,
    minute: currentMinute,
  } = getJordanDateTime(currentJordanTime);

  const timeMatch = orderTime.match(/^(\d{2}):(\d{2})/);
  const orderHour = timeMatch ? parseInt(timeMatch[1] ?? "12", 10) : 12;
  const orderMinute = timeMatch ? parseInt(timeMatch[2] ?? "00", 10) : 0;

  const dateDiffMs =
    new Date(`${orderDate}T00:00:00Z`).getTime() -
    new Date(`${currentDateStr}T00:00:00Z`).getTime();
  const dateDiffDays = Math.round(dateDiffMs / (24 * 60 * 60 * 1000));

  const totalCurrentMinutes = currentHour * 60 + currentMinute;
  const totalOrderMinutes = dateDiffDays * 24 * 60 + orderHour * 60 + orderMinute;

  const minutesRemaining = totalOrderMinutes - totalCurrentMinutes;

  if (minutesRemaining < 60) {
    return {
      status: "critical",
      color: "rose",
      minutesRemaining,
      labelAr: minutesRemaining < 0 ? "متأخر!" : "أقل من ساعة!",
      labelEn: minutesRemaining < 0 ? "Overdue!" : "< 1 Hour!",
    };
  }

  if (minutesRemaining <= 120) {
    return {
      status: "warning",
      color: "amber",
      minutesRemaining,
      labelAr: "1 - 2 ساعة",
      labelEn: "1 - 2 Hours",
    };
  }

  return {
    status: "normal",
    color: "emerald",
    minutesRemaining,
    labelAr: "وقت كافٍ",
    labelEn: "On Schedule",
  };
}
