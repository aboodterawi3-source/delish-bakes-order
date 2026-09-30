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

const money = (value: number) => `${(Number.isFinite(value) ? value : 0).toFixed(2)} د.أ`;
const orDash = (value: string | undefined | null) => (value && value.trim() ? value.trim() : "—");

/** Paid amount can never exceed the total when showing the remaining balance. */
export const remainingBalance = (total: number, paid: number) =>
  Math.max((Number(total) || 0) - (Number(paid) || 0), 0);

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
        const now = new Date();
        const isToday = now.getFullYear() === y && now.getMonth() === m - 1 && now.getDate() === d;
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

  const fullAddress = [input.area?.trim(), input.address?.trim()].filter(Boolean).join(" — ");

  const lines: string[] = [
    "📌 تثبيت الأوردر",
    "",
    `🔢 رقم الأوردر: ${orDash(input.orderNumber)}`,
    `📅 التاريخ: ${dateText || "—"}`,
    `⏰ الوقت: ${timeText || "—"}`,
    `🚗 توصيل أو استلام: ${isDelivery ? "توصيل" : "استلام من المحل"}`,
  ];

  if (isDelivery) {
    lines.push(`📍 العنوان: ${orDash(fullAddress || input.fulfilment)}`);
    lines.push(
      `📦 التوصيل: ${input.deliveryFee > 0 ? `${input.deliveryFee.toFixed(0)} دنانير` : "مجاني"}`,
    );
  }

  lines.push("", "🎂 تفاصيل الأوردر:");
  const itemsList = input.items.filter(Boolean);
  if (itemsList.length > 0) {
    lines.push(itemsList.join("\n"));
  } else {
    lines.push("—");
  }

  if (input.filling?.trim()) {
    lines.push(` الحشوة ${input.filling.trim()}`);
  }

  if (input.cakeWriting?.trim()) {
    lines.push(`الكتابة على الكيك: ${input.cakeWriting.trim()}`);
  }

  if (input.cardWriting?.trim()) {
    lines.push("🎀 الكرت: ", "الكرت بنكتب عليه ", input.cardWriting.trim());
  }

  if (input.notes?.trim() && input.notes !== "—") {
    lines.push("", `📝 ملاحظات: ${input.notes.trim()}`);
  }

  if (input.extraNote?.trim()) {
    lines.push(`🚨 ${input.extraNote.trim()}`);
  }

  const paymentDesc = input.cliqAccount
    ? `${input.paymentMethod} (${input.cliqAccount})`
    : input.paymentMethod;

  lines.push(
    "",
    `💰 الحساب كامل: ${money(input.total)}`,
    `💵 المبلغ المدفوع (عربون/كليك): ${money(input.paid)}`,
    `💳 المبلغ المتبقي: ${money(remaining)}`,
    `طريقة الدفع: ${orDash(paymentDesc)}`,
  );

  if (
    input.isGift ||
    (input.recipientPhone &&
      input.recipientPhone.trim() &&
      input.recipientPhone.trim() !== input.senderPhone?.trim())
  ) {
    lines.push(
      `رقم المستلم: ${orDash(input.recipientPhone)}`,
      `رقم المرسل: ${orDash(input.senderPhone || input.customerPhone)}`,
    );
  } else if (input.customerPhone?.trim()) {
    lines.push(`رقم الهاتف: ${orDash(input.customerPhone)}`);
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
