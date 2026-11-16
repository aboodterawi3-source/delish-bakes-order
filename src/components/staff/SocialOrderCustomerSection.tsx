import { Gift, User } from "lucide-react";

interface SocialOrderCustomerSectionProps {
  isGift: boolean;
  customerName: string;
  customerPhone: string;
  senderName: string;
  senderPhone: string;
  recipientName: string;
  recipientPhone: string;
  orderName: string;
  onChangeIsGift: (isGift: boolean) => void;
  onChangeField: (
    field:
      | "customer_name"
      | "customer_phone"
      | "sender_name"
      | "sender_phone"
      | "recipient_name"
      | "recipient_phone"
      | "order_name",
    value: string,
  ) => void;
}

const normalFieldClass =
  "mt-1 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm focus:ring-2 focus:ring-[#B8860B] focus:outline-none";
const giftFieldClass =
  "mt-1 min-h-12 w-full rounded-xl border border-rose-200 bg-white px-3.5 text-sm focus:ring-2 focus:ring-[#B8860B] focus:outline-none";

/** Normal vs Gift order type toggle and customer/sender/recipient identity inputs. */
export function SocialOrderCustomerSection({
  isGift,
  customerName,
  customerPhone,
  senderName,
  senderPhone,
  recipientName,
  recipientPhone,
  orderName,
  onChangeIsGift,
  onChangeField,
}: SocialOrderCustomerSectionProps) {
  return (
    <>
      <div className="rounded-2xl border border-[#B8860B]/30 bg-[#FFFDF9] p-3.5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="block text-xs font-black text-[#5D2E17]">نوع الطلب · Order Type</span>
            <p className="text-[11px] text-[#7A6458]">
              {isGift
                ? "طلب هدية: يتطلب رقم وبيانات المرسل والمستلم بشكل منفصل"
                : "طلب شخصي عادي: إدخال رقم هاتف العميل مرة واحدة فقط دون تكرار"}
            </p>
          </div>

          <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => onChangeIsGift(false)}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${
                !isGift
                  ? "bg-[#8B4513] text-white shadow-xs"
                  : "text-[#5D2E17] hover:text-[#3E2723]"
              }`}
            >
              <User className="h-3.5 w-3.5" />
              <span>طلب عادي / شخصي</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeIsGift(true)}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${
                isGift ? "bg-rose-600 text-white shadow-xs" : "text-[#5D2E17] hover:text-[#3E2723]"
              }`}
            >
              <Gift className="h-3.5 w-3.5" />
              <span>طلب هدية 🎁</span>
            </button>
          </div>
        </div>
      </div>

      {!isGift ? (
        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-[#F9FBFC] p-4 sm:grid-cols-2">
          <label className="block text-sm font-bold text-[#3E2723]">
            اسم العميل · Customer name
            <input
              required
              value={customerName}
              onChange={(event) => onChangeField("customer_name", event.target.value)}
              placeholder="مثال: رنا العبدالله"
              className={normalFieldClass}
            />
          </label>

          <label className="block text-sm font-bold text-[#3E2723]">
            رقم الهاتف (الواتساب) · Phone
            <input
              required
              dir="ltr"
              inputMode="tel"
              value={customerPhone}
              onChange={(event) => onChangeField("customer_phone", event.target.value)}
              placeholder="07XXXXXXXX"
              className={normalFieldClass}
            />
          </label>

          <label className="block text-sm font-bold text-[#3E2723] sm:col-span-2">
            اسم الطلب / وصف مختصر (اختياري)
            <input
              value={orderName}
              onChange={(event) => onChangeField("order_name", event.target.value)}
              placeholder="مثال: كيكة شوكولاتة لعيد ميلاد"
              className={normalFieldClass}
            />
          </label>
        </div>
      ) : (
        <div className="grid gap-4 rounded-2xl border border-rose-200/80 bg-rose-50/40 p-4 sm:grid-cols-2">
          <div className="flex items-center gap-2 border-b border-rose-200 pb-1 text-xs font-black text-rose-900 sm:col-span-2">
            <Gift className="h-4 w-4 text-rose-600" />
            <span>بيانات إرسال الهدية (المرسل والمستلم)</span>
          </div>

          <label className="block text-sm font-bold text-[#3E2723]">
            اسم المرسل (صاحب الطلب)
            <input
              required
              value={senderName}
              onChange={(event) => onChangeField("sender_name", event.target.value)}
              placeholder="مثال: أحمد خالد"
              className={giftFieldClass}
            />
          </label>

          <label className="block text-sm font-bold text-[#3E2723]">
            رقم هاتف المرسل · Sender phone
            <input
              required
              dir="ltr"
              inputMode="tel"
              value={senderPhone}
              onChange={(event) => onChangeField("sender_phone", event.target.value)}
              placeholder="07XXXXXXXX"
              className={giftFieldClass}
            />
          </label>

          <label className="block text-sm font-bold text-[#3E2723]">
            اسم المستلم (المُهدى إليه)
            <input
              required
              value={recipientName}
              onChange={(event) => onChangeField("recipient_name", event.target.value)}
              placeholder="مثال: ريم السالم"
              className={giftFieldClass}
            />
          </label>

          <label className="block text-sm font-bold text-[#3E2723]">
            رقم هاتف المستلم للتوصيل · Recipient phone
            <input
              required
              dir="ltr"
              inputMode="tel"
              value={recipientPhone}
              onChange={(event) => onChangeField("recipient_phone", event.target.value)}
              placeholder="07XXXXXXXX"
              className={giftFieldClass}
            />
          </label>

          <label className="block text-sm font-bold text-[#3E2723] sm:col-span-2">
            اسم الطلب / التسمية (اختياري)
            <input
              value={orderName}
              onChange={(event) => onChangeField("order_name", event.target.value)}
              placeholder="مثال: هدية كيكة وزهور لريم"
              className={giftFieldClass}
            />
          </label>
        </div>
      )}
    </>
  );
}
