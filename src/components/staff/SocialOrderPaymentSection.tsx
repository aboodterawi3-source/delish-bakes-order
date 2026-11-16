import { useRef } from "react";
import { Camera, Check, Loader2, Trash2, UploadCloud } from "lucide-react";
import { jd } from "@/lib/currency";
import { IMAGE_ACCEPT } from "@/lib/image-validation";
import type { CliqAccountConfig } from "@/lib/cliq-config";

export type SocialPaymentOption = "cash" | "cliq_full" | "cliq_deposit" | "cliq_pending";
export type CliqAccount = "mahmoud" | "shop" | "staff";

interface SocialOrderPaymentSectionProps {
  paymentOption: SocialPaymentOption;
  cliqAccount: CliqAccount;
  cliqStaffName: string;
  cliqAccountText: string;
  cliqAccounts: readonly CliqAccountConfig[];
  depositPaid: string;
  grandTotal: number;
  receiptUrl: string | null;
  uploadingReceipt: boolean;
  onChangePaymentOption: (option: SocialPaymentOption) => void;
  onChangeCliqAccount: (account: CliqAccount) => void;
  onChangeCliqStaffName: (name: string) => void;
  onChangeDepositPaid: (amount: string) => void;
  onUploadReceipt: (file: File) => void;
  onClearReceipt: () => void;
}

/** Payment selector supporting Cash on delivery/pickup and full/deposit/pending CliQ transfers. */
export function SocialOrderPaymentSection({
  paymentOption,
  cliqAccount,
  cliqStaffName,
  cliqAccountText,
  cliqAccounts,
  depositPaid,
  grandTotal,
  receiptUrl,
  uploadingReceipt,
  onChangePaymentOption,
  onChangeCliqAccount,
  onChangeCliqStaffName,
  onChangeDepositPaid,
  onUploadReceipt,
  onClearReceipt,
}: SocialOrderPaymentSectionProps) {
  const receiptFileRef = useRef<HTMLInputElement>(null);

  return (
    <fieldset className="text-sm font-bold text-[#3E2723]">
      <legend>طريقة الدفع · Payment method</legend>
      <div className="mt-1 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChangePaymentOption("cash")}
          aria-pressed={paymentOption === "cash"}
          className={`flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-bold transition-all ${
            paymentOption === "cash"
              ? "bg-[#8B4513] text-white shadow-sm"
              : "border border-slate-200 bg-white text-[#5D2E17] hover:bg-slate-50"
          }`}
        >
          <span>💵</span>
          <span>كاش عند الاستلام</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (paymentOption === "cash") {
              onChangePaymentOption("cliq_full");
            }
          }}
          aria-pressed={paymentOption !== "cash"}
          className={`flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-bold transition-all ${
            paymentOption !== "cash"
              ? "bg-[#8B4513] text-white shadow-sm ring-2 ring-[#B8860B]/40"
              : "border border-slate-200 bg-white text-[#5D2E17] hover:bg-slate-50"
          }`}
        >
          <span>⚡</span>
          <span>دفع عبر كليك · CliQ</span>
          <span className="text-[10px] opacity-80">{paymentOption !== "cash" ? "▼" : "◀"}</span>
        </button>
      </div>

      {paymentOption !== "cash" && (
        <div className="mt-3 animate-in space-y-3.5 rounded-2xl border-2 border-[#B8860B]/40 bg-[#FFFDF7] p-3.5 shadow-sm fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between border-b border-amber-100 pb-1">
            <span className="flex items-center gap-1.5 text-xs font-black text-[#5D2E17]">
              ⚡ تفاصيل وخيارات كليك · CliQ Options
            </span>
            <span className="rounded-full border border-amber-200 bg-[#FDE2CF]/70 px-2.5 py-0.5 text-[11px] font-bold text-[#8B4513]">
              {cliqAccountText}
            </span>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-[#5D2E17]">
              نوع عملية كليك · CliQ Payment Type
            </label>
            <select
              value={paymentOption}
              onChange={(e) => {
                const nextOpt = e.target.value as "cliq_full" | "cliq_deposit" | "cliq_pending";
                onChangePaymentOption(nextOpt);
                if (nextOpt === "cliq_pending") {
                  onChangeDepositPaid("");
                  onClearReceipt();
                }
              }}
              className="min-h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-[#3E2723] focus:ring-2 focus:ring-[#B8860B] focus:outline-none"
            >
              <option value="cliq_full">💳 كليك دفع كامل (سداد كامل المبلغ)</option>
              <option value="cliq_deposit">🪙 عربون عبر كليك (دفعة مقدمة / عربون)</option>
              <option value="cliq_pending">⏳ بانتظار الكليك (لم يتم التحويل بعد)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-[#5D2E17]">
              حساب كليك المستلم · CliQ Account Destination
            </label>
            <select
              value={cliqAccount}
              onChange={(e) => onChangeCliqAccount(e.target.value as CliqAccount)}
              className="min-h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-[#3E2723] focus:ring-2 focus:ring-[#B8860B] focus:outline-none"
            >
              {cliqAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.icon} {acc.label}
                </option>
              ))}
            </select>
          </div>

          {cliqAccount === "staff" && (
            <div className="animate-in pt-0.5 fade-in">
              <label className="block text-xs font-bold text-[#5D2E17]">
                اسم الموظفة / كود الحساب
                <input
                  type="text"
                  required
                  value={cliqStaffName}
                  onChange={(e) => onChangeCliqStaffName(e.target.value)}
                  placeholder="اكتب اسم الموظفة (مثال: ريم، سارة...)"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-[#3E2723] focus:ring-2 focus:ring-[#B8860B] focus:outline-none"
                />
              </label>
            </div>
          )}

          {paymentOption === "cliq_pending" ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs font-bold text-amber-900">
              ⏳ تم تحديد الطلب كـ «بانتظار الكليك» — سيتم تسجيل المبلغ وإرفاق صورة الحوالة لاحقاً
              من شاشة الطلبات فور استلام التحويل.
            </div>
          ) : (
            <>
              <label className="block text-xs font-bold text-[#3E2723]">
                <div className="mb-1 flex items-center justify-between">
                  <span>
                    {paymentOption === "cliq_full"
                      ? "المبلغ الكامل المدفوع عبر كليك (د.أ)"
                      : "قيمة العربون المدفوع عبر كليك (د.أ)"}
                  </span>
                  {grandTotal > 0 && paymentOption === "cliq_full" && (
                    <button
                      type="button"
                      onClick={() => onChangeDepositPaid(grandTotal.toFixed(2))}
                      className="cursor-pointer text-[10px] font-bold text-[#8B4513] hover:underline"
                    >
                      تعبئة كامل المبلغ ({jd(grandTotal)})
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  dir="ltr"
                  value={depositPaid}
                  onChange={(event) => onChangeDepositPaid(event.target.value)}
                  placeholder="0.00"
                  className="mt-1 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm focus:ring-2 focus:ring-[#B8860B] focus:outline-none"
                />
              </label>

              <div
                id="cliq-receipt-upload-section"
                className="space-y-2 border-t border-amber-200/70 pt-2.5"
              >
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs font-black text-[#5D2E17]">
                    <Camera className="h-4 w-4 text-[#8B4513]" />
                    <span>صورة إشعار / حوالة كليك (اختياري — تُرفع عند الدفع) · CliQ Receipt</span>
                  </label>
                  {receiptUrl && (
                    <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                      <Check className="h-3 w-3" /> تم الإرفاق
                    </span>
                  )}
                </div>

                <input
                  ref={receiptFileRef}
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
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-300 bg-white p-3 shadow-2xs">
                    <img
                      src={receiptUrl}
                      alt="إشعار حوالة كليك"
                      className="h-16 w-16 shrink-0 cursor-pointer rounded-lg border border-slate-200 object-cover transition hover:opacity-90"
                      onClick={() => window.open(receiptUrl, "_blank", "noopener,noreferrer")}
                      title="اضغط لفتح الصورة بحجم كامل"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-slate-800">
                        صورة الحوالة مرفقة بنجاح ✅
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        سواء كان كليك كامل أو عربون
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => receiptFileRef.current?.click()}
                          className="cursor-pointer text-[11px] font-bold text-primary hover:underline"
                        >
                          تغيير الصورة
                        </button>
                        <span className="text-muted-foreground">•</span>
                        <button
                          type="button"
                          onClick={onClearReceipt}
                          className="flex cursor-pointer items-center gap-1 text-[11px] font-bold text-rose-600 hover:underline"
                        >
                          <Trash2 className="h-3 w-3" /> حذف
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label="اختيار أو تصوير صورة حوالة كليك"
                    onClick={() => {
                      if (!uploadingReceipt) receiptFileRef.current?.click();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        if (!uploadingReceipt) receiptFileRef.current?.click();
                      }
                    }}
                    className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 text-center transition-all ${
                      uploadingReceipt
                        ? "cursor-wait border-amber-300 bg-amber-50/50"
                        : "border-amber-300/80 bg-white/80 hover:border-[#8B4513] hover:bg-amber-50/40"
                    }`}
                  >
                    {uploadingReceipt ? (
                      <div className="flex flex-col items-center gap-2 py-2">
                        <Loader2 className="h-7 w-7 animate-spin text-[#8B4513]" />
                        <span className="text-xs font-black text-[#5D2E17]">
                          جاري معالجة ورفع صورة الحوالة...
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100/70 text-[#8B4513] transition group-hover:scale-110">
                          <UploadCloud className="h-5 w-5" />
                        </div>
                        <p className="mt-2 text-xs font-black text-[#5D2E17]">
                          اضغط هنا لاختيار أو تصوير صورة حوالة كليك 📸
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#7A6458]">
                          (لقطة شاشة من البنك أو وصل التحويل — يدعم JPG / PNG حتى 5MB)
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </fieldset>
  );
}
