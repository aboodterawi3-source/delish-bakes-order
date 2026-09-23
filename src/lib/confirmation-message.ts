/**
 * Official Delish Cake order-confirmation message.
 *
 * One builder shared by the social portal and the sales desk so the customer
 * always receives the exact same wording, with the money lines computed from a
 * single place (price → delivery → total → paid → remaining).
 */
export type ConfirmationInput = {
  orderNumber: string;
  customerName: string;
  /** Delivery date and time, already formatted for the customer. */
  when: string;
  /** "توصيل: منطقة" or "استلام من المحل". */
  fulfilment: string;
  /** One line per item / the full custom request. */
  items: string[];
  cakeWriting: string;
  cardWriting: string;
  /** Optional dynamic note line (extras, urgency…). */
  extraNote?: string | undefined;
  notes: string;
  /** Legacy: final-photo line, no longer set from the social portal. */
  finalPhoto?: boolean | undefined;
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
};

const money = (value: number) => `${(Number.isFinite(value) ? value : 0).toFixed(2)} د.أ`;
const orDash = (value: string | undefined | null) => (value && value.trim() ? value.trim() : "—");

/** Paid amount can never exceed the total when showing the remaining balance. */
export const remainingBalance = (total: number, paid: number) =>
  Math.max((Number(total) || 0) - (Number(paid) || 0), 0);

const TERMS = `⚠️ ملاحظات هامة لضمان جودة طلبك:

1️⃣ التعديل والإلغاء: يدخل الطلب جدول الإنتاج خلال ساعة من التثبيت، وبعدها يتعذر التعديل، والطلبات في نفس اليوم لا يمكن إلغائها.

2️⃣ موقع التوصيل: أي تغيير في الموقع يجب أن يتم قبل 8 ساعات على الأقل (رسوم تعديل الموقع داخل عمان 3 دنانير).

3️⃣ فشل التوصيل: في حال عدم رد المستلم (مرتين)، يتحمل المرسل قيمة التوصيل وإعادته للفرع، ويتعذر إعادة التوصيل في نفس اليوم.

4️⃣ مراقبة الجودة: يرجى فحص الطلب فور وصوله وقبل استلامه من السائق. استلامك للطلب هو إقرار بسلامته ومطابقته للمواصفات.

5️⃣ تنويه: قد تختلف درجات الألوان طفيفاً عن الصور بسبب الإضاءة والتصوير.

نحن ملتزمون بتقديم الأفضل لك دوماً! ✨ فريق Delish Cake 🎈`;

export function buildConfirmationMessage(input: ConfirmationInput): string {
  const remaining = remainingBalance(input.total, input.paid);
  const lines: string[] = [
    "👑 رسالة تأكيد الطلب (Delish Cake)",
    "",
    "شكراً لاختيارك دلش كيك Delish Cake 🎂 تم تثبيت طلبك :",
    "",
    "________نشكرك على التعامل معنا",
    "",
    "نود اعلامك تم تثبيت طلبك بنجاح وإليك التفاصيل",
    "",
    `رقم الاوردر: ${orDash(input.orderNumber)}`,
    "",
    `الاسم  : ${orDash(input.customerName)}`,
    "",
    `الوقت : ${orDash(input.when)}`,
    "",
    `توصيل او استلام : ${orDash(input.fulfilment)}`,
    "",
    `تفاصيل الاوردر: ${input.items.filter(Boolean).join(" · ") || "—"}`,
    "",
    `الكتابة على الكيك: ${orDash(input.cakeWriting)}`,
    "",
    `الكتابه على الكرت  : ${orDash(input.cardWriting)}`,
  ];

  if (input.orderSource?.trim()) {
    lines.push("", `قناة التواصل : ${input.orderSource.trim()}`);
  }

  if (input.extraNote?.trim()) {
    lines.push("", `ملاحظات إضافية: ${input.extraNote.trim()}`);
  }

  lines.push("", `ملاحظات: ${orDash(input.notes)}`);

  if (input.finalPhoto) {
    lines.push("", "بس بدي الصوره النهائيه لو سمحت");
  }

  const paymentDesc = input.cliqAccount
    ? `${input.paymentMethod} (${input.cliqAccount})`
    : input.paymentMethod;

  lines.push(
    "",
    `المبلغ : ${money(input.price)}`,
    "",
    `التوصيل : ${money(input.deliveryFee)}`,
    "",
    `الحساب كامل : ${money(input.total)}`,
    "",
    `المبلغ المدفوع (عربون/كليك) : ${money(input.paid)}`,
    "",
    `المبلغ المتبقي : ${money(remaining)}`,
    "",
    `طريقة الدفع : ${orDash(paymentDesc)}`,
  );

  if (input.isGift || (input.recipientPhone && input.recipientPhone.trim() && input.recipientPhone.trim() !== input.senderPhone?.trim())) {
    lines.push(
      "",
      `رقم المستلم : ${orDash(input.recipientPhone)}`,
      "",
      `رقم المرسل : ${orDash(input.senderPhone || input.customerPhone)}`,
    );
  } else {
    lines.push(
      "",
      `رقم الهاتف : ${orDash(input.customerPhone || input.senderPhone)}`,
    );
  }

  lines.push("", TERMS);

  return lines.join("\n");
}
