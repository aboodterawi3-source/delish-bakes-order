import { useRef } from "react";
import {
  BadgeDollarSign,
  Bike,
  Camera,
  Gift,
  Loader2,
  Percent,
  Sparkles,
  Store,
  Truck,
  User,
} from "lucide-react";

import { DeliveryZoneSelect } from "@/components/delish/DeliveryZoneSelect";
import { editorInputClass as inputClass } from "@/components/staff/InteractiveItemEditorCard";
import { jd } from "@/lib/currency";
import { IMAGE_ACCEPT } from "@/lib/image-validation";
import type { OrderPatch, SalesOrder } from "@/lib/sales.functions";

const boxedTextarea =
  "w-full rounded-xl border border-input bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition";

const QUICK_INSCRIPTIONS = [
  "Happy Birthday",
  "مبروك التخرج 🎓",
  "كل عام وأنت بخير 🤍",
  "ألف مبروك الزواج 💍",
  "حمدالله ع السلامة 🌸",
  "Welcome Baby 👶",
];

interface CustomerSectionProps {
  orderName: string;
  customerName: string;
  customerPhone: string;
  isGift: boolean;
  senderPhone: string;
  recipientPhone: string;
  onChangeOrderName: (v: string) => void;
  onChangeCustomerName: (v: string) => void;
  onChangeCustomerPhone: (v: string) => void;
  onChangeIsGift: (v: boolean) => void;
  onChangeSenderPhone: (v: string) => void;
  onChangeRecipientPhone: (v: string) => void;
}

/** Customer identity and optional gift sender/recipient phone section. */
export function MasterOrderCustomerSection({
  orderName,
  customerName,
  customerPhone,
  isGift,
  senderPhone,
  recipientPhone,
  onChangeOrderName,
  onChangeCustomerName,
  onChangeCustomerPhone,
  onChangeIsGift,
  onChangeSenderPhone,
  onChangeRecipientPhone,
}: CustomerSectionProps) {
  return (
    <div className="space-y-4 rounded-3xl border border-border/80 bg-card p-4 shadow-xs sm:p-5">
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
            <User className="h-4 w-4" />
          </div>
          <h3 className="font-display text-sm font-bold text-foreground">
            هوية العميل والمستلم · Customer Identity
          </h3>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-muted-foreground select-none">
          <input
            type="checkbox"
            checked={isGift}
            onChange={(e) => onChangeIsGift(e.target.checked)}
            className="h-4 w-4 rounded text-primary focus:ring-primary/20"
          />
          <Gift className="h-3.5 w-3.5 text-primary" />
          <span>طلب هدية / مستلم مختلف</span>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-xs font-bold text-foreground">
          اسم الطلب · Order Label
          <input
            value={orderName}
            onChange={(e) => onChangeOrderName(e.target.value)}
            placeholder="مثال: كيكة عيد ميلاد سارة"
            className={inputClass}
          />
        </label>

        <label className="block text-xs font-bold text-foreground">
          اسم العميل · Customer Name
          <input
            value={customerName}
            onChange={(e) => onChangeCustomerName(e.target.value)}
            placeholder="الاسم الكامل"
            className={inputClass}
          />
        </label>

        <label className="block text-xs font-bold text-foreground">
          هاتف العميل الأساسي · Phone
          <input
            dir="ltr"
            inputMode="tel"
            value={customerPhone}
            onChange={(e) => onChangeCustomerPhone(e.target.value)}
            placeholder="07XXXXXXXX"
            className={inputClass}
          />
        </label>
      </div>

      {isGift && (
        <div className="animate-fadeIn grid gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-3.5 sm:grid-cols-2">
          <label className="block text-xs font-bold text-foreground">
            رقم هاتف المرسل · Sender Phone
            <input
              dir="ltr"
              inputMode="tel"
              value={senderPhone}
              onChange={(e) => onChangeSenderPhone(e.target.value)}
              placeholder="07XXXXXXXX"
              className={inputClass}
            />
          </label>

          <label className="block text-xs font-bold text-foreground">
            رقم هاتف المستلم (المفاجأة) · Recipient Phone
            <input
              dir="ltr"
              inputMode="tel"
              value={recipientPhone}
              onChange={(e) => onChangeRecipientPhone(e.target.value)}
              placeholder="07XXXXXXXX"
              className={inputClass}
            />
          </label>
        </div>
      )}
    </div>
  );
}

interface LogisticsSectionProps {
  order: SalesOrder;
  date: string;
  time: string;
  address: string;
  onChangeDate: (v: string) => void;
  onChangeTime: (v: string) => void;
  onChangeAddress: (v: string) => void;
  onSetQuickDate: (offsetDays: number) => void;
  onPatch: (patch: Omit<OrderPatch, "orderId">) => void;
}

/** Fulfillment method, date/time presets, delivery zone, and address section. */
export function MasterOrderLogisticsSection({
  order,
  date,
  time,
  address,
  onChangeDate,
  onChangeTime,
  onChangeAddress,
  onSetQuickDate,
  onPatch,
}: LogisticsSectionProps) {
  return (
    <div className="space-y-4 rounded-3xl border border-border/80 bg-card p-4 shadow-xs sm:p-5">
      <div className="flex items-center gap-2 border-b border-border/60 pb-3">
        <div className="grid h-8 w-8 place-items-center rounded-xl bg-orange-100 text-orange-700">
          <Truck className="h-4 w-4" />
        </div>
        <h3 className="font-display text-sm font-bold text-foreground">
          التوقيت وطريقة التسليم اللوجستية · Logistics &amp; Schedule
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onPatch({ method: "pickup", delivery_fee: 0 })}
          className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border text-xs font-bold transition sm:text-sm ${
            order.method === "pickup"
              ? "border-primary bg-primary text-primary-foreground shadow-sm"
              : "border-border bg-background text-foreground hover:bg-secondary"
          }`}
        >
          <Store className="h-4 w-4" />
          <span>🏪 استلام من المحل (مجاني)</span>
        </button>

        <button
          type="button"
          onClick={() => onPatch({ method: "delivery" })}
          className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border text-xs font-bold transition sm:text-sm ${
            order.method === "delivery"
              ? "border-primary bg-primary text-primary-foreground shadow-sm"
              : "border-border bg-background text-foreground hover:bg-secondary"
          }`}
        >
          <Bike className="h-4 w-4" />
          <span>🛵 توصيل منازل</span>
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-foreground">
              تاريخ التسليم المطلوب · Date
            </label>
            <div className="flex items-center gap-1 text-[11px]">
              <button
                type="button"
                onClick={() => onSetQuickDate(0)}
                className="rounded-lg bg-secondary px-2 py-0.5 font-bold hover:bg-secondary/80"
              >
                اليوم
              </button>
              <button
                type="button"
                onClick={() => onSetQuickDate(1)}
                className="rounded-lg bg-secondary px-2 py-0.5 font-bold hover:bg-secondary/80"
              >
                غداً
              </button>
              <button
                type="button"
                onClick={() => onSetQuickDate(2)}
                className="rounded-lg bg-secondary px-2 py-0.5 font-bold hover:bg-secondary/80"
              >
                بعد يومين
              </button>
            </div>
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => onChangeDate(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-foreground">وقت التسليم المحدد · Time</label>
            <div className="flex items-center gap-1 text-[11px]">
              {["12:00", "15:00", "18:00", "20:00"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onChangeTime(t)}
                  className="rounded-lg bg-secondary px-2 py-0.5 font-bold hover:bg-secondary/80"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <input
            type="time"
            value={time}
            onChange={(e) => onChangeTime(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {order.method === "delivery" && (
        <div className="animate-fadeIn grid gap-3 rounded-2xl border border-orange-200 bg-orange-50/40 p-3.5 sm:grid-cols-2">
          <label className="block text-xs font-bold text-foreground">
            منطقة التوصيل وأجرتها · Delivery Zone
            <DeliveryZoneSelect
              value={order.area ?? ""}
              onChange={(area) => {
                onPatch(area ? { area } : { area: null, delivery_fee: 0 });
              }}
              className={inputClass}
              placeholder="— اختر منطقة التوصيل —"
              noteClassName="mt-1 block text-[11px] font-bold text-orange-900"
            />
          </label>

          <label className="block text-xs font-bold text-foreground">
            العنوان بالتفصيل · Delivery Address
            <input
              value={address}
              onChange={(e) => onChangeAddress(e.target.value)}
              placeholder="الشارع، البناية، رقم الطابق، معالم قريبة"
              className={inputClass}
            />
          </label>
        </div>
      )}
    </div>
  );
}

interface NotesSectionProps {
  inscription: string;
  cardNote: string;
  notes: string;
  staffNotes: string;
  onChangeInscription: (v: string) => void;
  onChangeCardNote: (v: string) => void;
  onChangeNotes: (v: string) => void;
  onChangeStaffNotes: (v: string) => void;
}

/** Cake writing, quick phrases, card note, customer notes, and secret staff notes. */
export function MasterOrderNotesSection({
  inscription,
  cardNote,
  notes,
  staffNotes,
  onChangeInscription,
  onChangeCardNote,
  onChangeNotes,
  onChangeStaffNotes,
}: NotesSectionProps) {
  return (
    <div className="space-y-4 rounded-3xl border border-border/80 bg-card p-4 shadow-xs sm:p-5">
      <div className="flex items-center gap-2 border-b border-border/60 pb-3">
        <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-100 text-amber-700">
          <Sparkles className="h-4 w-4" />
        </div>
        <h3 className="font-display text-sm font-bold text-foreground">
          الكتابة على الكيك والكرت وملاحظات المطبخ · Writing &amp; Notes
        </h3>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-bold text-foreground">
          الكتابة على الكيك (بالكريمة أو الأكريليك) · Cake Writing
          <input
            value={inscription}
            onChange={(e) => onChangeInscription(e.target.value)}
            placeholder="مثال: Happy Birthday Sarah 🎂"
            className={inputClass}
          />
        </label>

        <div className="flex flex-wrap gap-1.5 pt-1">
          {QUICK_INSCRIPTIONS.map((phrase) => (
            <button
              key={phrase}
              type="button"
              onClick={() => onChangeInscription(phrase)}
              className="cursor-pointer rounded-full border border-amber-300 bg-amber-50/80 px-2.5 py-1 text-[11px] font-bold text-amber-900 transition hover:bg-amber-100"
            >
              + {phrase}
            </button>
          ))}
        </div>

        {inscription && (
          <div className="rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 via-amber-100/50 to-amber-50 p-3 text-center shadow-xs">
            <span className="mb-1 block text-[10px] font-bold tracking-wider text-amber-700 uppercase">
              معاينة النص على سطح الكيك
            </span>
            <p className="font-display text-base font-black text-amber-950">
              ✨ « {inscription} » ✨
            </p>
          </div>
        )}
      </div>

      <div className="grid gap-3 pt-2 sm:grid-cols-3">
        <label className="block text-xs font-bold text-foreground">
          الكتابة على الكرت · Card Note
          <textarea
            rows={3}
            value={cardNote}
            onChange={(e) => onChangeCardNote(e.target.value)}
            placeholder="نص بطاقة المعايدة المرفقة بالهدية..."
            className={boxedTextarea}
          />
        </label>

        <label className="block text-xs font-bold text-foreground">
          ملاحظات خاصة من العميل · Customer Notes
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => onChangeNotes(e.target.value)}
            placeholder="حساسية طعام، تقليل سكر، تفاصيل تسليم..."
            className={boxedTextarea}
          />
        </label>

        <label className="block text-xs font-bold text-amber-950">
          ملاحظات داخلية سرية للمطبخ · Secret Staff Notes
          <textarea
            rows={3}
            value={staffNotes}
            onChange={(e) => onChangeStaffNotes(e.target.value)}
            placeholder="ملاحظات الموظفين (لا تطبع للعميل)..."
            className={`${boxedTextarea} border-amber-300 bg-amber-50/50`}
          />
        </label>
      </div>
    </div>
  );
}

interface FinancialsSectionProps {
  order: SalesOrder;
  deposit: string;
  remaining: number;
  receiptUrl: string | null;
  uploadingReceipt: boolean;
  mayDiscount: boolean;
  discountCap: number;
  discountPercent: string;
  discountReason: string;
  onChangeDiscountPercent: (v: string) => void;
  onChangeDiscountReason: (v: string) => void;
  onQuickAddPayment: (amount: number, type: "deposit" | "remainder" | "full") => void;
  onUploadReceipt: (file: File) => void;
  onApplyDiscount: (percent: number, reason: string) => void;
}

/** Financials breakdown, quick ledger payments, CliQ receipt upload, and admin discount box. */
export function MasterOrderFinancialsSection({
  order,
  deposit,
  remaining,
  receiptUrl,
  uploadingReceipt,
  mayDiscount,
  discountCap,
  discountPercent,
  discountReason,
  onChangeDiscountPercent,
  onChangeDiscountReason,
  onQuickAddPayment,
  onUploadReceipt,
  onApplyDiscount,
}: FinancialsSectionProps) {
  const receiptInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4 rounded-3xl border border-border/80 bg-card p-4 shadow-xs sm:p-5">
      <div className="flex items-center gap-2 border-b border-border/60 pb-3">
        <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
          <BadgeDollarSign className="h-4 w-4" />
        </div>
        <h3 className="font-display text-sm font-bold text-foreground">
          الحسابات والخصومات والمدفوعات · Financials &amp; Payments
        </h3>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2 rounded-2xl border border-border/70 bg-secondary/20 p-4 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>المجموع الفرعي للأصناف</span>
            <span className="font-bold text-foreground">{jd(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>أجرة التوصيل</span>
            <span className="font-bold text-foreground">
              {jd(order.method === "delivery" ? order.delivery_fee : 0)}
            </span>
          </div>

          {order.discount_amount > 0 && (
            <div className="flex justify-between font-bold text-rose-600">
              <span>الخصم المطبق ({order.discount_percent}%)</span>
              <span>− {jd(order.discount_amount)}</span>
            </div>
          )}

          <div className="flex justify-between border-t border-border pt-2 text-base font-black text-foreground">
            <span>الإجمالي الكلي النهائي</span>
            <span>{jd(order.total)}</span>
          </div>

          {order.deposit_paid > order.total ? (
            <div className="flex justify-between rounded-lg border border-purple-500/20 bg-purple-500/10 p-2 pt-1 text-xs font-black text-purple-600">
              <span>مستحق إرجاع للزبون 🔄</span>
              <span>{jd(order.deposit_paid - order.total)}</span>
            </div>
          ) : (
            <div
              className={`flex justify-between pt-1 text-sm font-black ${
                remaining > 0 ? "text-rose-600" : "text-emerald-600"
              }`}
            >
              <span>المتبقي للتحصيل</span>
              <span>{remaining > 0 ? jd(remaining) : "0.00 د.أ (مسدد بالكامل)"}</span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <label className="block text-xs font-bold text-foreground">
            المبلغ المدفوع كعربون / كاش · Deposit Paid
            <input
              type="number"
              min="0"
              step="0.25"
              value={deposit}
              readOnly
              disabled
              className={`${inputClass} cursor-not-allowed bg-muted`}
            />
          </label>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => onQuickAddPayment(5, "remainder")}
              className="cursor-pointer rounded-lg bg-secondary px-2.5 py-1 text-xs font-bold hover:bg-secondary/80"
            >
              + تسجيل 5 د.أ
            </button>
            <button
              type="button"
              onClick={() => onQuickAddPayment(10, "remainder")}
              className="cursor-pointer rounded-lg bg-secondary px-2.5 py-1 text-xs font-bold hover:bg-secondary/80"
            >
              + تسجيل 10 د.أ
            </button>
            {remaining > 0 && (
              <button
                type="button"
                onClick={() => onQuickAddPayment(remaining, "full")}
                className="cursor-pointer rounded-lg border border-emerald-300 bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-900 hover:bg-emerald-200"
              >
                تسجيل دفع المتبقي كاملاً ({jd(remaining)})
              </button>
            )}
          </div>

          <div className="space-y-2 rounded-2xl border border-amber-200/80 bg-amber-50/40 p-3 dark:border-amber-800/40 dark:bg-amber-950/20">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-1.5 text-foreground">
                <Camera className="h-3.5 w-3.5 text-amber-700" />
                <span>صورة إشعار حوالة كليك · CliQ Receipt</span>
              </span>
              {receiptUrl && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  مرفقة ✅
                </span>
              )}
            </div>

            <input
              ref={receiptInputRef}
              type="file"
              accept={IMAGE_ACCEPT}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.currentTarget.value = "";
                if (file) onUploadReceipt(file);
              }}
            />

            {receiptUrl ? (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-card p-2">
                <img
                  src={receiptUrl}
                  alt="صورة حوالة كليك"
                  onClick={() => window.open(receiptUrl, "_blank")}
                  className="h-14 w-14 shrink-0 cursor-pointer rounded-lg border border-border object-cover"
                  title="اضغط لفتح الصورة"
                />
                <div className="flex flex-1 items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => window.open(receiptUrl, "_blank")}
                    className="cursor-pointer text-xs font-bold text-primary hover:underline"
                  >
                    عرض الصورة 🔍
                  </button>
                  <button
                    type="button"
                    onClick={() => receiptInputRef.current?.click()}
                    disabled={uploadingReceipt}
                    className="cursor-pointer rounded-lg border border-border bg-secondary px-2.5 py-1 text-[11px] font-bold hover:bg-secondary/80"
                  >
                    {uploadingReceipt ? "جاري الرفع..." : "تغيير الصورة"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => receiptInputRef.current?.click()}
                disabled={uploadingReceipt}
                className="flex min-h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-amber-400 bg-background px-3 text-xs font-bold text-amber-900 hover:bg-amber-50 dark:text-amber-200"
              >
                {uploadingReceipt ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
                <span>
                  {uploadingReceipt ? "جاري رفع صورة الحوالة..." : "📸 تحميل صورة إشعار حوالة كليك"}
                </span>
              </button>
            )}
          </div>

          <div className="space-y-2 rounded-2xl border border-dashed border-border p-3">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-1.5 text-foreground">
                <Percent className="h-3.5 w-3.5 text-primary" />
                <span>تطبيق خصم إداري خاص</span>
              </span>
              {mayDiscount ? (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                  مصرح حتى {discountCap}%
                </span>
              ) : (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  يتطلب صلاحية مدير
                </span>
              )}
            </div>

            {mayDiscount ? (
              <div className="grid gap-2 sm:grid-cols-3">
                <input
                  type="number"
                  min="0"
                  max={discountCap}
                  step="1"
                  placeholder="نسبة %"
                  value={discountPercent}
                  onChange={(e) => onChangeDiscountPercent(e.target.value)}
                  className="h-10 rounded-xl border border-input bg-background px-3 text-xs text-foreground"
                />
                <input
                  value={discountReason}
                  onChange={(e) => onChangeDiscountReason(e.target.value)}
                  placeholder="سبب الخصم..."
                  className="h-10 rounded-xl border border-input bg-background px-3 text-xs text-foreground sm:col-span-2"
                />
                <button
                  type="button"
                  onClick={() => onApplyDiscount(Number(discountPercent) || 0, discountReason)}
                  className="min-h-10 cursor-pointer rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground transition hover:bg-primary/90 sm:col-span-3"
                >
                  تطبيق الخصم على الطلب · Apply Discount
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                لا تملك صلاحية تطبيق خصومات مخصصة. يرجى مراجعة إدارة المحل.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
