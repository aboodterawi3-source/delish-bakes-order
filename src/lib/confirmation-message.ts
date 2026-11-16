import { jod } from "./currency.ts";
import { todayIso } from "./date-filter.ts";

/**
 * Official Delish Cake order-confirmation and modification messages.
 *
 * Shared by the social portal and the sales desk so the customer
 * always receives the exact requested wording and structure.
 */

export type ConfirmationInput = {
  orderNumber: string;
  customerName: string;
  /** Delivery date and time, already formatted or raw. */
  when: string;
  date?: string | undefined;
  time?: string | undefined;
  address?: string | undefined;
  area?: string | undefined;
  filling?: string | undefined;
  /** "توصيل: منطقة" or "استلام من المحل". */
  fulfilment: string;
  /** One line per item / the full custom request. */
  items: string[];
  cakeWriting: string;
  cardWriting: string;
  /** Optional dynamic note line (extras, urgency…). */
  extraNote?: string | undefined;
  notes: string;
  price: number;
  deliveryFee: number;
  total: number;
  paid: number;
  paymentMethod: string;
  recipientPhone?: string | undefined;
  senderPhone?: string | undefined;
  customerPhone?: string | undefined;
  isGift?: boolean | undefined;
  orderSource?: string | undefined;
  cliqAccount?: string | undefined;
  finalPhoto?: boolean | undefined;
};

export type ModificationMessageInput = {
  orderNumber: string;
  time?: string | undefined;
  fulfilment?: string | undefined;
  orderDetails?: string | undefined;
  designNotes?: string | string[] | undefined;
  modifications?: string[] | undefined;
  editedAt?: string | undefined;
};

const money = (value: number) => jod(value);
const orDash = (value: string | undefined | null) => (value && value.trim() ? value.trim() : "—");

/** Paid amount can never exceed the total when showing the remaining balance. */
export const remainingBalance = (total: number, paid: number) =>
  Math.max((Number(total) || 0) - (Number(paid) || 0), 0);

export const calculateFinancials = (total: number, paid: number) => {
  const t = Number(total) || 0;
  const p = Number(paid) || 0;
  const diff = p - t;
  return {
    total: t,
    paid: p,
    remaining: Math.max(t - p, 0),
    refundDue: Math.max(diff, 0),
    isOverpaid: diff > 0.001,
    isFullyPaid: Math.abs(diff) <= 0.001,
  };
};

export function formatArabicDate(dateStr?: string | null): string {
  if (!dateStr || !dateStr.trim()) return "—";
  try {
    const clean = dateStr.trim();
    const parts = clean.split("-");
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        const date = new Date(y, m - 1, d);
        const days = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
        const dayName = days[date.getDay()];
        const ammanToday = todayIso();
        const targetIso = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const isToday = ammanToday === targetIso;
        const prefix = isToday ? "اليوم " : "";
        return `${prefix}${dayName} ${d}/${m}/${y}`;
      }
    }
    return clean;
  } catch {
    return dateStr;
  }
}

export function formatArabicTime(timeStr?: string | null): string {
  if (!timeStr || !timeStr.trim()) return "—";
  try {
    const clean = timeStr.trim();
    const parts = clean.split(":");
    if (parts.length >= 2 && parts[0] !== undefined && parts[1] !== undefined) {
      let hours = parseInt(parts[0], 10);
      const minutes = parts[1].padStart(2, "0");
      if (!isNaN(hours)) {
        const period = hours >= 12 ? "مساءً" : "صباحاً";
        if (hours === 0) hours = 12;
        else if (hours > 12) hours -= 12;
        return `${hours}:${minutes} ${period}`;
      }
    }
    return clean;
  } catch {
    return timeStr;
  }
}

const TERMS = `⚠️ ملاحظات هامة لضمان جودة طلبك:
1️⃣ التعديل والإلغاء: يدخل الطلب جدول الإنتاج خلال ساعة من التثبيت، وبعدها يتعذر التعديل، والطلبات في نفس اليوم لا يمكن إلغائها.
2️⃣ موقع التوصيل: أي تغيير في الموقع يجب أن يتم قبل 8 ساعات على الأقل.
3️⃣ مراقبة الجودة: يرجى فحص الطلب فور وصوله وقبل استلامه من السائق.
نحن ملتزمون بتقديم الأفضل لك دوماً! ✨ فريق Delish Cake 🎈`;

/**
 * 1. مسج تثبيت الأوردر للزبون
 * نمط الرسالة الرسمية المعتمدة لتثبيت الطلب وإرسالها للزبون
 */
export function buildConfirmationMessage(input: ConfirmationInput): string {
  const remaining = remainingBalance(input.total, input.paid);

  // Extract or format date and time
  let dateText = input.date ? formatArabicDate(input.date) : "";
  let timeText = input.time ? formatArabicTime(input.time) : "";

  if (!dateText && input.when) {
    const whenParts = input.when.split(" ");
    if (whenParts[0] && whenParts[0].includes("-")) {
      dateText = formatArabicDate(whenParts[0]);
      timeText = formatArabicTime(whenParts.slice(1).join(" "));
    } else {
      dateText = input.when;
    }
  }

  const isDelivery =
    input.fulfilment.includes("توصيل") ||
    Boolean(input.address?.trim()) ||
    Boolean(input.area?.trim());

  const fullAddress =
    input.area?.trim() && input.address?.trim() && input.area.trim() !== input.address.trim()
      ? `${input.area.trim()} — ${input.address.trim()}`
      : input.address?.trim() || input.area?.trim() || "";

  const RLM = "\u200F";
  const lines: string[] = [
    `${RLM}*📌 تثبيت الأوردر*`,
    "",
    `${RLM}🔢 رقم الأوردر: *${orDash(input.orderNumber)}*`,
    `${RLM}📅 التاريخ: *${dateText || "—"}*`,
    `${RLM}⏰ الوقت: *${timeText || "—"}*`,
    `${RLM}🚗 توصيل أو استلام: *${isDelivery ? "توصيل" : "استلام من المحل"}*`,
  ];

  if (isDelivery) {
    lines.push(`${RLM}📍 العنوان: ${orDash(fullAddress || input.fulfilment)}`);
    lines.push(
      `${RLM}📦 التوصيل: *${input.deliveryFee > 0 ? `${input.deliveryFee % 1 === 0 ? input.deliveryFee.toFixed(0) : input.deliveryFee.toFixed(2)} دنانير` : "مجاني"}*`,
    );
  }

  lines.push("", `${RLM}*🎂 تفاصيل الأوردر:*`);
  const INTERNAL_ITEM_LINE =
    /^\s*(?:—\s*)?(?:المصدر:|كليك:|صورة حوالة كليك|صورة مرجعية:|طلب هدية)/;
  const itemsList = input.items.filter(
    (line) => Boolean(line) && !INTERNAL_ITEM_LINE.test(line),
  );
  if (itemsList.length > 0) {
    lines.push(itemsList.map((line) => `${RLM}${line}`).join("\n"));
  } else {
    lines.push(`${RLM}—`);
  }

  const itemsText = itemsList.join("\n");
  if (input.filling?.trim() && !itemsText.includes("الحشوة")) {
    lines.push(`${RLM}— الحشوة: ${input.filling.trim()}`);
  }

  if (input.cakeWriting?.trim() && !itemsText.includes(input.cakeWriting.trim())) {
    lines.push(`${RLM}— الكتابة على الكيك: ${input.cakeWriting.trim()}`);
  }

  if (input.cardWriting?.trim()) {
    lines.push(`${RLM}🎀 الكرت: ${input.cardWriting.trim()}`);
  }

  if (input.notes?.trim() && input.notes !== "—" && !itemsText.includes(input.notes.trim())) {
    lines.push("", `${RLM}📝 ملاحظات: ${input.notes.trim()}`);
  }

  if (input.extraNote?.trim()) {
    lines.push(`${RLM}🚨 ${input.extraNote.trim()}`);
  }

  const fin = calculateFinancials(input.total, input.paid);

  lines.push(
    "",
    `${RLM}*💰 الملخص المالي:*`,
    `${RLM}• الحساب كامل: *${money(input.total)}*`,
    `${RLM}• المبلغ المدفوع (عربون/كليك): *${money(input.paid)}*`,
  );

  if (fin.isOverpaid) {
    lines.push(`${RLM}• مبلغ مستحق الإرجاع للزبون: *${money(fin.refundDue)}*`);
  } else if (fin.remaining > 0) {
    lines.push(`${RLM}• المبلغ المتبقي: *${money(fin.remaining)}*`);
  } else {
    lines.push(`${RLM}• المبلغ المتبقي: *0.00 د.أ* (مسدد بالكامل ✅)`);
  }

  lines.push(`${RLM}• طريقة الدفع: ${orDash(input.paymentMethod)}`);

  if (
    input.isGift ||
    (input.recipientPhone &&
      input.recipientPhone.trim() &&
      input.recipientPhone.trim() !== input.senderPhone?.trim())
  ) {
    lines.push(
      `${RLM}• رقم المستلم: ${orDash(input.recipientPhone)}`,
      `${RLM}• رقم المرسل: ${orDash(input.senderPhone || input.customerPhone)}`,
    );
  } else if (input.customerPhone?.trim()) {
    lines.push(`${RLM}• رقم الهاتف: ${orDash(input.customerPhone)}`);
  }

  lines.push("", TERMS);

  return lines.join("\n");
}

/**
 * 2. مسج تثبيت الطلب مع التعديل (🛑🛑🛑تعديل)
 * نمط الرسالة المعتمدة عند تعديل طلب مسجل وإرساله للمطبخ أو الواتساب
 */
export function buildModificationMessage(input: ModificationMessageInput): string {
  const lines: string[] = [
    "تم تثبيت الطلب بنجاح ✨",
    "🛑🛑🛑تعديل ",
    `🔢 رقم الأوردر:${input.orderNumber}`,
    "",
    "",
    `⏰ الوقت: ${input.time || "—"}`,
    "",
    `🚗 توصيل أو استلام:${input.fulfilment || "—"}`,
    "",
    `🎂 تفاصيل الأوردر:${input.orderDetails || "نفس البكج يلي بالصوره"}`,
  ];

  if (input.designNotes) {
    if (Array.isArray(input.designNotes)) {
      lines.push(...input.designNotes.map((n) => `🛑${n.replace(/^🛑\s*/, "")}`));
    } else if (input.designNotes.trim()) {
      const parts = input.designNotes.split("\n").filter(Boolean);
      for (const p of parts) {
        lines.push(`🛑${p.replace(/^🛑\s*/, "")}`);
      }
    }
  }

  if (input.modifications && input.modifications.length > 0) {
    const timeStr =
      input.editedAt ||
      new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    const now = new Date();
    const dateStr = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;
    lines.push(
      "",
      `[${timeStr}, ${dateStr}] delish cake: التعديلات `,
      ...input.modifications.map((m) => `* ${m.replace(/^\*\s*/, "")}`),
    );
  }

  return lines.join("\n");
}
