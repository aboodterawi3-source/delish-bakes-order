import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Camera,
  Check,
  ClipboardCopy,
  Gift,
  Image as ImageIcon,
  Instagram,
  Loader2,
  MessageCircle,
  PlusCircle,
  Search,
  Send,
  Sparkles,
  Store,
  Trash2,
  UploadCloud,
  User,
  Utensils,
  Zap,
} from "lucide-react";
import { getWhatsAppChatUrl } from "@/lib/whatsapp";
import { createSocialOrder, type SocialOrderInput } from "@/lib/social.functions";
import { jd } from "@/lib/currency";
import { DELIVERY_ZONES, OTHER_GOVERNORATES_AREA, feeForArea } from "@/lib/delivery-zones";
import {
  buildConfirmationMessage,
  buildModificationMessage,
  formatArabicDate,
  formatArabicTime,
  remainingBalance,
} from "@/lib/confirmation-message";
import { useStorefrontContent } from "@/hooks/use-storefront-content";
import type { StorefrontProduct, SizePrice } from "@/lib/storefront-content";
import {
  CakeCustomizationPanel,
  DesignPhotoSection,
  customizationSummary,
  emptyCustomization,
  type CakeCustomizationErrors,
  type Customization,
} from "@/components/delish/CakeCustomizationPanel";
import { useCliqAccounts } from "@/lib/cliq-config";
import { convertToWebp } from "@/lib/image-webp";
import { IMAGE_ACCEPT } from "@/lib/image-validation";
import { uploadPaymentReceipt } from "@/lib/receipt-upload.functions";

export type OrderSource = "instagram" | "whatsapp" | "messenger" | "store";
export type CliqAccount = "mahmoud" | "shop" | "staff";

const emptyForm = {
  // Communication source
  order_source: "instagram" as OrderSource,
  // Is this order a gift?
  is_gift: false,
  // Normal customer details
  customer_name: "",
  customer_phone: "",
  // Gift details
  sender_name: "",
  sender_phone: "",
  recipient_name: "",
  recipient_phone: "",
  // Order label
  order_name: "",
  // Products and specs
  order_details: "",
  quantity: 1,
  unit_price: "",
  card_note: "",
  method: "pickup" as "pickup" | "delivery",
  area: "",
  address: "",
  delivery_fee: "",
  // Payment
  payment_option: "cash" as "cash" | "cliq_full" | "cliq_deposit",
  cliq_account: "mahmoud" as CliqAccount,
  cliq_staff_name: "",
  deposit_paid: "",
  // Timing
  requested_date: "",
  requested_time: "",
  event_date: "",
  is_urgent: false,
  design_notes: "",
  staff_notes: "",
};

const CHANNEL_CONFIG: Record<OrderSource, { ar: string; color: string; icon: typeof Instagram }> = {
  instagram: {
    ar: "انستغرام",
    color: "bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 text-white shadow-xs",
    icon: Instagram,
  },
  whatsapp: {
    ar: "واتساب",
    color: "bg-[#25D366] text-white shadow-xs",
    icon: MessageCircle,
  },
  messenger: {
    ar: "مسنجر",
    color: "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs",
    icon: Zap,
  },
  store: {
    ar: "المحل / مباشر",
    color: "bg-[#8B4513] text-white shadow-xs",
    icon: Store,
  },
};

const CLIQ_ACCOUNTS: { id: CliqAccount; label: string; icon: string }[] = [
  { id: "mahmoud", label: "كليك محمود", icon: "💼" },
  { id: "shop", label: "كليك محل", icon: "🏬" },
  { id: "staff", label: "كليك موظفة معينة", icon: "👩‍💼" },
];

export interface SocialOrderEntryFormProps {
  onSuccessOrder?: (orderNumber: string) => void;
  title?: string;
}

export function SocialOrderEntryForm({
  onSuccessOrder,
  title = "طلب جديد · New order",
}: SocialOrderEntryFormProps) {
  const createFn = useServerFn(createSocialOrder);
  const storefront = useStorefrontContent();
  const whatsappUrl = (text: string) => getWhatsAppChatUrl(undefined, text);

  const [form, setForm] = useState(emptyForm);
  const [customization, setCustomization] = useState<Customization>(emptyCustomization);
  const [copied, setCopied] = useState<"summary" | "confirmation" | "modification" | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<"confirmation" | "modification">("confirmation");
  const [error, setError] = useState<string | null>(null);
  const [customErrors, setCustomErrors] = useState<CakeCustomizationErrors>({});

  // CliQ Receipt Upload state
  const uploadReceiptFn = useServerFn(uploadPaymentReceipt);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const receiptFileRef = useRef<HTMLInputElement>(null);
  const isSubmittingRef = useRef(false);
  const draftRequestIdRef = useRef<string>(crypto.randomUUID());

  const handleReceiptUpload = async (file: File | undefined) => {
    if (!file) return;
    setReceiptError(null);
    setUploadingReceipt(true);
    try {
      const converted = await convertToWebp(file, {
        kind: "cake",
        maxDimension: 800,
        quality: 0.8,
      });
      const saved = await uploadReceiptFn({ data: { data_url: converted.dataUrl } });
      setReceiptUrl(saved.url);
      setError(null);
    } catch (err) {
      setReceiptError(
        err instanceof Error ? err.message : "تعذّر رفع صورة الحوالة · Upload failed",
      );
    } finally {
      setUploadingReceipt(false);
      if (receiptFileRef.current) receiptFileRef.current.value = "";
    }
  };

  // Storefront Menu picker state
  const [showMenuPicker, setShowMenuPicker] = useState(true);
  const [menuSearch, setMenuSearch] = useState("");
  const [menuCategory, setMenuCategory] = useState("all");

  const catalogProducts = useMemo(() => storefront.data?.products ?? [], [storefront.data]);
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    for (const p of catalogProducts) if (p.category?.trim()) set.add(p.category.trim());
    return ["all", ...Array.from(set)];
  }, [catalogProducts]);

  const filteredMenuProducts = useMemo(() => {
    const q = menuSearch.trim().toLowerCase();
    return catalogProducts.filter((p) => {
      const matchCat = menuCategory === "all" || p.category === menuCategory;
      const matchQuery =
        !q ||
        p.name_ar.toLowerCase().includes(q) ||
        p.name_en.toLowerCase().includes(q) ||
        (p.filling_ar && p.filling_ar.toLowerCase().includes(q));
      return matchCat && matchQuery;
    });
  }, [catalogProducts, menuSearch, menuCategory]);

  const selectProductFromMenu = (product: StorefrontProduct, size?: SizePrice) => {
    const priceToSet = size ? size.price : product.price;
    const sizeLabel = size ? ` (${size.label})` : "";
    const fillingText = product.filling_ar ? ` — حشوة: ${product.filling_ar}` : "";
    const nameToSet = `${product.name_ar}${sizeLabel}${fillingText}`;

    setForm((current) => ({
      ...current,
      order_details: nameToSet,
      unit_price: String(priceToSet),
    }));

    if (product.filling_ar) {
      setCustomization((current) => ({ ...current, filling: product.filling_ar || "" }));
    }
  };

  const set = useCallback(
    <K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) => {
      setForm((current) => ({ ...current, [key]: value }));
      setCopied(null);
    },
    [],
  );

  const extras = useMemo(() => customizationSummary(customization), [customization]);

  const areaFee = feeForArea(form.area);
  const deliveryFee =
    form.method === "delivery"
      ? form.delivery_fee !== ""
        ? Math.max(0, Number(form.delivery_fee) || 0)
        : (areaFee ?? 0)
      : 0;

  const { accounts: cliqAccounts } = useCliqAccounts();

  // Selected CliQ account display
  const cliqAccountText = useMemo(() => {
    const currentAcc = cliqAccounts.find((a) => a.id === form.cliq_account);
    const label = currentAcc
      ? currentAcc.label
      : form.cliq_account === "shop"
        ? "كليك محل"
        : form.cliq_account === "staff"
          ? "كليك موظفة معينة"
          : "كليك محمود";
    if (form.cliq_account === "staff") {
      return form.cliq_staff_name.trim() ? `${label}: ${form.cliq_staff_name.trim()}` : label;
    }
    return label;
  }, [cliqAccounts, form.cliq_account, form.cliq_staff_name]);

  const paymentLabel = useMemo(() => {
    if (form.payment_option === "cash") return "كاش عند الاستلام";
    const cliqDetail = `(${cliqAccountText})`;
    if (form.payment_option === "cliq_full") {
      return `كليك دفع كامل ${cliqDetail}: ${(Number(form.deposit_paid) || 0).toFixed(2)} د.أ`;
    }
    return `عربون عبر كليك ${cliqDetail}: ${(Number(form.deposit_paid) || 0).toFixed(2)} د.أ`;
  }, [form.payment_option, form.deposit_paid, cliqAccountText]);

  // Live financial calculator
  const unitPrice = Math.max(Number(form.unit_price) || 0, 0);
  const originalPrice = unitPrice * form.quantity;
  const paidAmount =
    form.payment_option === "cash" ? 0 : Math.max(Number(form.deposit_paid) || 0, 0);
  const grandTotal = originalPrice + deliveryFee;
  const remaining = remainingBalance(grandTotal, paidAmount);

  // Computed customer / sender / recipient names & phones
  const effectiveCustomerName = form.is_gift
    ? form.sender_name.trim() || form.customer_name.trim() || "عميل (هدية)"
    : form.customer_name.trim();

  const effectiveCustomerPhone = form.is_gift
    ? form.sender_phone.trim() || form.customer_phone.trim()
    : form.customer_phone.trim();

  const effectiveSenderPhone = form.is_gift
    ? form.sender_phone.trim() || form.customer_phone.trim()
    : form.customer_phone.trim();

  const effectiveRecipientPhone = form.is_gift ? form.recipient_phone.trim() : "";

  const effectiveOrderName = form.order_name.trim()
    ? form.order_name.trim()
    : form.is_gift
      ? `هدية من ${effectiveCustomerName}${form.recipient_name.trim() ? ` إلى ${form.recipient_name.trim()}` : ""}`
      : "";

  // Official confirmation message
  const confirmationTemplate = useMemo(
    () =>
      buildConfirmationMessage({
        orderNumber: "{{ORDER_NUMBER}}",
        customerName: effectiveCustomerName,
        customerPhone: effectiveCustomerPhone,
        when: `${form.requested_date} ${form.requested_time}`.trim(),
        date: form.requested_date,
        time: form.requested_time,
        address: form.address.trim() || form.area.trim(),
        area: "",
        filling: customization.filling,
        fulfilment:
          form.method === "delivery"
            ? `توصيل · ${form.address.trim() || form.area || "—"}`
            : "استلام من المحل",
        items: [`${form.quantity} × ${form.order_details.trim() || "—"}`, ...extras.ar],
        cakeWriting: customization.topperText || "",
        cardWriting: form.card_note,
        extraNote: form.is_urgent ? "طلب مستعجل · Urgent" : "",
        notes: customization.notes,
        price: originalPrice,
        deliveryFee,
        total: grandTotal,
        paid: paidAmount,
        paymentMethod: paymentLabel,
        isGift: form.is_gift,
        recipientPhone: effectiveRecipientPhone,
        senderPhone: effectiveSenderPhone,
        orderSource: CHANNEL_CONFIG[form.order_source].ar,
        cliqAccount: form.payment_option !== "cash" ? cliqAccountText : undefined,
      }),
    [
      effectiveCustomerName,
      effectiveCustomerPhone,
      form.requested_date,
      form.requested_time,
      form.method,
      form.area,
      form.address,
      form.quantity,
      form.order_details,
      extras.ar,
      form.design_notes,
      customization.topperText,
      customization.notes,
      customization.filling,
      form.card_note,
      form.is_urgent,
      originalPrice,
      deliveryFee,
      grandTotal,
      paidAmount,
      paymentLabel,
      form.is_gift,
      effectiveRecipientPhone,
      effectiveSenderPhone,
      form.order_source,
      form.payment_option,
      cliqAccountText,
    ],
  );

  const confirmationPreview = savedMessage
    ? savedMessage
    : confirmationTemplate.replace("{{ORDER_NUMBER}}", "(يُضاف تلقائياً عند الإرسال)");

  // Official modification message
  const modificationTemplate = useMemo(
    () =>
      buildModificationMessage({
        orderNumber: "{{ORDER_NUMBER}}",
        time: `${formatArabicDate(form.requested_date)} الساعة ${formatArabicTime(form.requested_time)}`.trim(),
        fulfilment:
          form.method === "delivery" ? form.address || form.area || "توصيل" : "استلام من المحل",
        orderDetails: form.order_details.trim() || "نفس البكج يلي بالصوره",
        designNotes: [
          ...(customization.filling ? [`حشوة الكيكة: ${customization.filling}`] : []),
          ...(customization.notes ? [customization.notes] : []),
          ...(form.card_note ? [`الكرت: ${form.card_note}`] : []),
        ],
        modifications: [
          ...(form.method === "delivery" && (form.address || form.area)
            ? [`توصيل ${form.address || form.area}`]
            : []),
          ...(customization.filling ? [`حشوة ${customization.filling}`] : []),
          ...(customization.numberCandles && customization.candleDigits
            ? [`شمع ${customization.candleDigits}`]
            : []),
          ...(customization.topper && customization.topperText
            ? [`توبر: ${customization.topperText}`]
            : []),
        ],
      }),
    [
      form.requested_date,
      form.requested_time,
      form.method,
      form.area,
      form.address,
      form.order_details,
      form.design_notes,
      form.card_note,
      customization,
    ],
  );

  const modificationPreview = modificationTemplate.replace(
    "{{ORDER_NUMBER}}",
    done || "(يُضاف تلقائياً عند الإرسال)",
  );

  const activePreviewText =
    previewTab === "confirmation" ? confirmationPreview : modificationPreview;

  const submit = useMutation({
    mutationFn: (input: SocialOrderInput) => createFn({ data: input }),
    onSuccess: (order) => {
      isSubmittingRef.current = false;
      draftRequestIdRef.current = crypto.randomUUID();
      setDone(order.order_number);
      setError(null);
      setSavedMessage(order.confirmation_message ?? null);
      if (onSuccessOrder) onSuccessOrder(order.order_number);
      setForm((prev) => ({
        ...emptyForm,
        order_source: prev.order_source,
        requested_date: prev.requested_date,
      }));
      setCustomization(emptyCustomization);
      setCustomErrors({});
      setReceiptUrl(null);
      setReceiptError(null);
    },
    onError: (mutationError: Error) => {
      isSubmittingRef.current = false;
      setError(mutationError.message);
    },
  });

  const copy = useCallback(
    async (text: string, which: "summary" | "confirmation" | "modification") => {
      const legacyCopy = () => {
        const area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.insetInlineStart = "-9999px";
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(area);
        if (!ok) throw new Error("copy failed");
      };
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          legacyCopy();
        }
        setCopied(which);
        setError(null);
        window.setTimeout(() => setCopied(null), 2500);
      } catch {
        try {
          legacyCopy();
          setCopied(which);
          setError(null);
          window.setTimeout(() => setCopied(null), 2500);
        } catch {
          setError("تعذّر النسخ · Copy failed — حدّد النص من المعاينة وانسخه يدوياً");
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(() => setDone(null), 7000);
    return () => window.clearTimeout(timer);
  }, [done]);

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    // SEC-02: Double guard pattern - immediate check & synchronous ref lock
    if (isSubmittingRef.current || submit.isPending) return;
    isSubmittingRef.current = true;

    // Validation for Mandatory Customization Fields
    const newErrors: CakeCustomizationErrors = {};
    if (!customization.filling.trim()) {
      newErrors.filling = "⚠️ يرجى كتابة نوع الحشوة للكيكة (خانة إجبارية)";
    }
    if (!customization.candleChoice) {
      newErrors.candles = "⚠️ يرجى تحديد خيار الشموع (اختر نوع الشموع أو 'بدون شموع')";
    } else if (customization.numberCandles && !customization.candleDigits.trim()) {
      newErrors.candles = "⚠️ يرجى كتابة أرقام الشموع المطلوبة أو اختيار 'بدون شموع'";
    }

    if (!customization.balloonChoice) {
      newErrors.balloons = "⚠️ يرجى تحديد خيار البالونات (اختر 'إضافة بالونات' أو 'بدون بالونات')";
    } else if (
      customization.balloons &&
      customization.balloonPicks.length === 0 &&
      !customization.balloonNotes.trim()
    ) {
      newErrors.balloons =
        "⚠️ يرجى اختيار ألوان البالونات أو كتابة تفاصيلها أو اختيار 'بدون بالونات'";
    }

    if (!customization.topperChoice) {
      newErrors.topper = "⚠️ يرجى تحديد خيار التوبر (اختر 'إضافة توبر' أو 'بدون توبر')";
    } else if (customization.topper && !customization.topperText.trim()) {
      newErrors.topper = "⚠️ يرجى كتابة الاسم أو العبارة المطلوبة على التوبر أو اختيار 'بدون توبر'";
    }
    if (!customization.notes.trim()) {
      newErrors.notes =
        "⚠️ يرجى كتابة ملاحظات الكيكة أو الضغط على زر 'لا توجد ملاحظات إضافية' (خانة إجبارية)";
    }

    if (Object.keys(newErrors).length > 0) {
      isSubmittingRef.current = false;
      setCustomErrors(newErrors);
      setError(
        "⚠️ يرجى إكمال خانات تخصيص الكيكة الإجبارية المحددة باللون الأحمر أدناه لتأكيد الطلب.",
      );
      const firstKey = Object.keys(newErrors)[0];
      const targetElem = document.getElementById(`custom-field-${firstKey}`);
      if (targetElem) {
        targetElem.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }
    setCustomErrors({});

    // Validation for Mandatory Delivery Address
    if (form.method === "delivery" && !form.address.trim() && !form.area.trim()) {
      isSubmittingRef.current = false;
      setError("⚠️ يرجى كتابة عنوان التوصيل (خانة إجبارية عند اختيار التوصيل).");
      return;
    }

    // Staff notes enriched with channel & cliq details
    const cliqTag = form.payment_option !== "cash" ? `[كليك: ${cliqAccountText}]` : "";
    const cliqReceiptTag = receiptUrl ? `[صورة الحوالة: ${receiptUrl}]` : "";
    const sourceTag = `[المصدر: ${CHANNEL_CONFIG[form.order_source].ar}]`;
    const giftTag = form.is_gift
      ? `[طلب هدية - المرسل: ${form.sender_name || effectiveCustomerName} (${effectiveSenderPhone}) / المستلم: ${form.recipient_name || "—"} (${effectiveRecipientPhone || "—"})]`
      : "";

    const combinedStaffNotes = [
      sourceTag,
      cliqTag,
      cliqReceiptTag,
      giftTag,
      form.staff_notes.trim(),
    ]
      .filter(Boolean)
      .join(" ");

    const orderNameWithChannel = effectiveOrderName
      ? `[${CHANNEL_CONFIG[form.order_source].ar}] ${effectiveOrderName}`
      : `[${CHANNEL_CONFIG[form.order_source].ar}] طلب ${effectiveCustomerName}`;

    submit.mutate(
      {
        client_request_id: draftRequestIdRef.current,
        recipient_name: form.is_gift ? form.recipient_name?.trim() || form.customer_name : null,
        order_name: orderNameWithChannel,
        sender_phone: effectiveSenderPhone || null,
        recipient_phone: effectiveRecipientPhone || null,
        customer_name: effectiveCustomerName,
        customer_phone: effectiveCustomerPhone,
        order_details: form.order_details,
        quantity: form.quantity,
        unit_price: Number(form.unit_price) || 0,
        card_note: form.card_note,
        confirmation_message: confirmationTemplate,
        method: form.method,
        area: form.method === "delivery" ? form.address.trim() || form.area || null : null,
        address: form.method === "delivery" ? form.address.trim() || form.area || null : null,
        delivery_fee: form.method === "delivery" ? deliveryFee : 0,
        payment_option: form.payment_option,
        deposit_paid: form.payment_option === "cash" ? 0 : Number(form.deposit_paid) || 0,
        requested_date: form.requested_date,
        requested_time: form.requested_time,
        event_date: null,
        is_urgent: form.is_urgent,
        design_notes: customization.notes.trim() || null,
        staff_notes: combinedStaffNotes,
        extras_ar: [
          `المصدر: ${CHANNEL_CONFIG[form.order_source].ar}`,
          ...(form.payment_option !== "cash" ? [`كليك: ${cliqAccountText}`] : []),
          ...(receiptUrl ? ["صورة حوالة كليك مرفقة 📄"] : []),
          ...(form.is_gift ? ["طلب هدية 🎁"] : []),
          ...extras.ar,
        ],
        extras_en: extras.en,
        design_image_url: customization.designImageUrl || null,
        receipt_image_url: receiptUrl,
      },
      {
        onSettled: () => {
          isSubmittingRef.current = false;
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      {done ? (
        <div
          role="status"
          className="flex animate-in flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-amber-100/70 p-4 text-sm font-bold text-amber-950 shadow-md fade-in"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">✨</span>
            <div>
              <p className="text-base font-black text-[#5D2E17]">
                تم تثبيت الطلب بنجاح ✨ (رقم الأوردر: {done})
              </p>
              <p className="text-xs text-[#7A6458]">تم حفظ الطلب وإرساله فوراً للمطبخ والمبيعات</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void copy(savedMessage || confirmationPreview, "confirmation")}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3.5 py-2 text-xs font-black text-[#5D2E17] shadow-2xs transition hover:bg-amber-50"
            >
              {copied === "confirmation" ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <ClipboardCopy className="h-3.5 w-3.5" />
              )}
              <span>
                {copied === "confirmation"
                  ? "تم نسخ رسالة التثبيت ✅"
                  : "📌 نسخ مسج التثبيت للزبون"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => void copy(modificationPreview, "modification")}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-black text-rose-800 shadow-2xs transition hover:bg-rose-100"
            >
              {copied === "modification" ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <ClipboardCopy className="h-3.5 w-3.5" />
              )}
              <span>
                {copied === "modification" ? "تم نسخ مسج التعديل ✅" : "🛑 نسخ مسج التعديل"}
              </span>
            </button>

            <a
              href={whatsappUrl(savedMessage || confirmationPreview)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] px-3.5 py-2 text-xs font-black text-white shadow-2xs transition hover:brightness-95"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span>إرسال واتساب</span>
            </a>
          </div>
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-900 shadow-xs"
        >
          ⚠️ {error}
        </div>
      ) : null}

      <form
        onSubmit={onSubmit}
        className="grid min-w-0 gap-5 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_-8px_rgba(62,39,35,0.06)] sm:p-6"
      >
        {/* HEADER & SOURCE SELECTOR */}
        <div className="border-b border-slate-100 pb-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-[#3E2723]">
              <Sparkles className="h-5 w-5 text-[#B8860B]" />
              {title}
            </h2>

            {/* Communication Source Pills */}
            <div className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-[#F9FBFC] p-1">
              <span className="hidden px-2 text-xs font-bold text-[#7A6458] sm:inline">
                طريقة التواصل:
              </span>
              {(Object.keys(CHANNEL_CONFIG) as OrderSource[]).map((src) => {
                const conf = CHANNEL_CONFIG[src];
                const Icon = conf.icon;
                const active = form.order_source === src;
                return (
                  <button
                    key={src}
                    type="button"
                    onClick={() => set("order_source", src)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                      active ? conf.color : "bg-transparent text-[#5D2E17] hover:bg-slate-200/50"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{conf.ar}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-[#7A6458]">
            إدخال وتثبيت تفاصيل الطلب مع ربط تلقائي بواتساب والمطبخ والمبيعات
          </p>
        </div>

        {/* ORDER TYPE TOGGLE: NORMAL VS GIFT */}
        <div className="rounded-2xl border border-[#B8860B]/30 bg-[#FFFDF9] p-3.5 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="block text-xs font-black text-[#5D2E17]">
                نوع الطلب · Order Type
              </span>
              <p className="text-[11px] text-[#7A6458]">
                {form.is_gift
                  ? "طلب هدية: يتطلب رقم وبيانات المرسل والمستلم بشكل منفصل"
                  : "طلب شخصي عادي: إدخال رقم هاتف العميل مرة واحدة فقط دون تكرار"}
              </p>
            </div>

            <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => set("is_gift", false)}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${
                  !form.is_gift
                    ? "bg-[#8B4513] text-white shadow-xs"
                    : "text-[#5D2E17] hover:text-[#3E2723]"
                }`}
              >
                <User className="h-3.5 w-3.5" />
                <span>طلب عادي / شخصي</span>
              </button>
              <button
                type="button"
                onClick={() => set("is_gift", true)}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${
                  form.is_gift
                    ? "bg-rose-600 text-white shadow-xs"
                    : "text-[#5D2E17] hover:text-[#3E2723]"
                }`}
              >
                <Gift className="h-3.5 w-3.5" />
                <span>طلب هدية 🎁</span>
              </button>
            </div>
          </div>
        </div>

        {/* CUSTOMER / SENDER / RECIPIENT FIELDS */}
        {!form.is_gift ? (
          /* NORMAL ORDER: JUST 1 PHONE NUMBER! */
          <div className="grid gap-4 rounded-2xl border border-slate-200 bg-[#F9FBFC] p-4 sm:grid-cols-2">
            <label className="block text-sm font-bold text-[#3E2723]">
              اسم العميل · Customer name
              <input
                required
                value={form.customer_name}
                onChange={(event) => set("customer_name", event.target.value)}
                placeholder="مثال: رنا العبدالله"
                className="mt-1 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm focus:ring-2 focus:ring-[#B8860B] focus:outline-none"
              />
            </label>

            <label className="block text-sm font-bold text-[#3E2723]">
              رقم الهاتف (الواتساب) · Phone
              <input
                required
                dir="ltr"
                inputMode="tel"
                value={form.customer_phone}
                onChange={(event) => set("customer_phone", event.target.value)}
                placeholder="07XXXXXXXX"
                className="mt-1 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm focus:ring-2 focus:ring-[#B8860B] focus:outline-none"
              />
            </label>

            <label className="block text-sm font-bold text-[#3E2723] sm:col-span-2">
              اسم الطلب / وصف مختصر (اختياري)
              <input
                value={form.order_name}
                onChange={(event) => set("order_name", event.target.value)}
                placeholder="مثال: كيكة شوكولاتة لعيد ميلاد"
                className="mt-1 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm focus:ring-2 focus:ring-[#B8860B] focus:outline-none"
              />
            </label>
          </div>
        ) : (
          /* GIFT ORDER: SENDER & RECIPIENT SEPARATED */
          <div className="grid gap-4 rounded-2xl border border-rose-200/80 bg-rose-50/40 p-4 sm:grid-cols-2">
            <div className="flex items-center gap-2 border-b border-rose-200 pb-1 text-xs font-black text-rose-900 sm:col-span-2">
              <Gift className="h-4 w-4 text-rose-600" />
              <span>بيانات إرسال الهدية (المرسل والمستلم)</span>
            </div>

            <label className="block text-sm font-bold text-[#3E2723]">
              اسم المرسل (صاحب الطلب)
              <input
                required
                value={form.sender_name}
                onChange={(event) => set("sender_name", event.target.value)}
                placeholder="مثال: أحمد خالد"
                className="mt-1 min-h-12 w-full rounded-xl border border-rose-200 bg-white px-3.5 text-sm focus:ring-2 focus:ring-[#B8860B] focus:outline-none"
              />
            </label>

            <label className="block text-sm font-bold text-[#3E2723]">
              رقم هاتف المرسل · Sender phone
              <input
                required
                dir="ltr"
                inputMode="tel"
                value={form.sender_phone}
                onChange={(event) => set("sender_phone", event.target.value)}
                placeholder="07XXXXXXXX"
                className="mt-1 min-h-12 w-full rounded-xl border border-rose-200 bg-white px-3.5 text-sm focus:ring-2 focus:ring-[#B8860B] focus:outline-none"
              />
            </label>

            <label className="block text-sm font-bold text-[#3E2723]">
              اسم المستلم (المُهدى إليه)
              <input
                required
                value={form.recipient_name}
                onChange={(event) => set("recipient_name", event.target.value)}
                placeholder="مثال: ريم السالم"
                className="mt-1 min-h-12 w-full rounded-xl border border-rose-200 bg-white px-3.5 text-sm focus:ring-2 focus:ring-[#B8860B] focus:outline-none"
              />
            </label>

            <label className="block text-sm font-bold text-[#3E2723]">
              رقم هاتف المستلم للتوصيل · Recipient phone
              <input
                required
                dir="ltr"
                inputMode="tel"
                value={form.recipient_phone}
                onChange={(event) => set("recipient_phone", event.target.value)}
                placeholder="07XXXXXXXX"
                className="mt-1 min-h-12 w-full rounded-xl border border-rose-200 bg-white px-3.5 text-sm focus:ring-2 focus:ring-[#B8860B] focus:outline-none"
              />
            </label>

            <label className="block text-sm font-bold text-[#3E2723] sm:col-span-2">
              اسم الطلب / التسمية (اختياري)
              <input
                value={form.order_name}
                onChange={(event) => set("order_name", event.target.value)}
                placeholder="مثال: هدية كيكة وزهور لريم"
                className="mt-1 min-h-12 w-full rounded-xl border border-rose-200 bg-white px-3.5 text-sm focus:ring-2 focus:ring-[#B8860B] focus:outline-none"
              />
            </label>
          </div>
        )}

        {/* DESIGN REFERENCE PHOTO — sits directly under the order name */}
        <DesignPhotoSection
          value={customization}
          onChange={setCustomization}
          errors={customErrors}
          onClearError={(key) => setCustomErrors((prev) => ({ ...prev, [key]: undefined }))}
        />

        {/* STOREFRONT MENU / CATALOG SELECTOR */}
        <div className="space-y-3 rounded-2xl border border-[#B8860B]/30 bg-[#FFFDF9] p-3.5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#B8860B]/20 pb-2">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#8B4513] text-white">
                <Store className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-[#3E2723]">
                  منيو أصناف الموقع · Storefront Menu
                </h3>
                <p className="text-[11px] text-[#7A6458]">
                  اختر أي منتج/حجم من قائمة الموقع لإضافته بضغطة واحدة
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowMenuPicker((v) => !v)}
              className="rounded-full border border-[#B8860B]/40 bg-white px-3.5 py-1.5 text-xs font-bold text-[#8B4513] shadow-2xs transition hover:bg-[#FDE2CF]/30"
            >
              {showMenuPicker ? "إخفاء المنيو ▲" : "عرض منيو المنتجات ▼"}
            </button>
          </div>

          {showMenuPicker && (
            <div className="space-y-3 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px] flex-1">
                  <Search className="absolute top-2.5 right-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    placeholder="بحث بالاسم أو الحشوة في المنيو…"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pr-9 pl-3 text-xs font-semibold text-[#3E2723] focus:ring-2 focus:ring-[#B8860B] focus:outline-none"
                  />
                </div>

                <div className="no-scrollbar flex max-w-full gap-1 overflow-x-auto py-1">
                  {categoriesList.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setMenuCategory(cat)}
                      className={`rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap transition-all ${
                        menuCategory === cat
                          ? "bg-[#8B4513] text-white shadow-xs"
                          : "border border-slate-200 bg-white text-[#5D2E17] hover:bg-slate-100"
                      }`}
                    >
                      {cat === "all" ? "الكل" : cat}
                    </button>
                  ))}
                </div>
              </div>

              {storefront.isLoading ? (
                <div className="flex items-center justify-center py-6 text-xs text-[#7A6458]">
                  <Loader2 className="ml-2 h-4 w-4 animate-spin text-[#8B4513]" />
                  جاري تحميل المنيو…
                </div>
              ) : filteredMenuProducts.length === 0 ? (
                <div className="py-4 text-center text-xs font-bold text-[#7A6458]">
                  لا توجد نتائج مطابقة في المنيو
                </div>
              ) : (
                <div className="grid max-h-72 grid-cols-1 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredMenuProducts.map((prod) => (
                    <div
                      key={prod.id}
                      className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs transition-all hover:border-[#B8860B]"
                    >
                      <div className="flex items-start gap-2">
                        {prod.image_url ? (
                          <img
                            src={prod.image_url}
                            alt={prod.name_ar}
                            className="h-12 w-12 shrink-0 rounded-lg border border-slate-100 object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#FDE2CF]/40 text-[#8B4513]">
                            <Utensils className="h-5 w-5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h4 className="truncate text-xs leading-snug font-bold text-[#3E2723]">
                            {prod.name_ar}
                          </h4>
                          <p className="mt-0.5 text-[11px] font-extrabold text-[#8B4513]">
                            {prod.price_on_request ? "حسب الطلب" : `${prod.price.toFixed(2)} د.أ`}
                          </p>
                          {prod.filling_ar && (
                            <span className="mt-1 inline-block rounded bg-[#FDE2CF]/50 px-1.5 py-0.5 text-[10px] font-bold text-[#7B3F00]">
                              حشوة: {prod.filling_ar}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1 border-t border-slate-100 pt-1">
                        {prod.sizes && prod.sizes.length > 0 ? (
                          prod.sizes.map((sz) => (
                            <button
                              key={sz.label}
                              type="button"
                              onClick={() => selectProductFromMenu(prod, sz)}
                              className="min-w-[60px] flex-1 rounded-lg border border-slate-200 bg-[#F9FBFC] px-1.5 py-1 text-center text-[10px] font-bold transition-all hover:bg-[#8B4513] hover:text-white"
                            >
                              {sz.label} ({sz.price} د.أ)
                            </button>
                          ))
                        ) : (
                          <button
                            type="button"
                            onClick={() => selectProductFromMenu(prod)}
                            className="flex w-full items-center justify-center gap-1 rounded-lg bg-[#8B4513] px-2 py-1 text-xs font-bold text-white shadow-xs transition-all hover:bg-[#5D2E17]"
                          >
                            <PlusCircle className="h-3.5 w-3.5" />
                            اختيار المنتج
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ORDER DETAILS TEXTAREA */}
        <label className="block text-sm font-bold text-[#3E2723]">
          تفاصيل طلب الزبون · Customer Order Details
          <textarea
            required
            rows={3}
            maxLength={2000}
            value={form.order_details}
            onChange={(event) => set("order_details", event.target.value)}
            placeholder="اكتب تفاصيل الطلب كاملة أو اختر صنفاً من منيو الموقع أعلاه…"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] p-3.5 text-sm focus:ring-2 focus:ring-[#B8860B] focus:outline-none"
          />
        </label>

        {/* QUANTITY & UNIT PRICE */}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-bold text-[#3E2723]">
            الكمية · Quantity
            <input
              type="number"
              min="1"
              step="1"
              required
              value={form.quantity}
              onChange={(event) => set("quantity", Math.max(1, Number(event.target.value) || 1))}
              className="mt-1 min-h-12 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:ring-2 focus:ring-[#B8860B] focus:outline-none"
            />
          </label>
          <label className="block text-sm font-bold text-[#3E2723]">
            السعر الأصلي للحبة (د.أ) · Original price
            <input
              type="number"
              min="0"
              step="0.25"
              value={form.unit_price}
              onChange={(event) => set("unit_price", event.target.value)}
              placeholder="0.00"
              className="mt-1 min-h-12 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:ring-2 focus:ring-[#B8860B] focus:outline-none"
            />
          </label>
        </div>

        {/* CAKE CUSTOMIZATION PANEL */}
        <div className="min-w-0 rounded-2xl border border-[#FDE2CF] bg-[#FDE2CF]/20 p-3 sm:p-4">
          <CakeCustomizationPanel
            value={customization}
            onChange={setCustomization}
            hideGift={true}
            hidePhoto={true}
            errors={customErrors}
            onClearError={(key) => setCustomErrors((prev) => ({ ...prev, [key]: undefined }))}
          />
          {extras.ar.length ? (
            <ul className="mt-3 space-y-1 rounded-xl bg-white/80 p-3 text-xs font-bold text-[#5D2E17]">
              {extras.ar.map((line) => (
                <li key={line}>• {line}</li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* FULFILMENT METHOD */}
        <fieldset className="text-sm font-bold text-[#3E2723]">
          <legend>طريقة التسليم · Fulfilment</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {(["pickup", "delivery"] as const).map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => set("method", method)}
                aria-pressed={form.method === method}
                className={`min-h-11 flex-1 rounded-xl px-4 text-xs font-bold transition-all ${
                  form.method === method
                    ? "bg-[#8B4513] text-white shadow-sm"
                    : "border border-slate-200 bg-white text-[#5D2E17] hover:bg-slate-50"
                }`}
              >
                {method === "pickup" ? "استلام من المحل" : "توصيل"}
              </button>
            ))}
          </div>
        </fieldset>

        {form.method === "delivery" ? (
          <div className="space-y-3.5 rounded-2xl border border-blue-200/60 bg-blue-50/30 p-4">
            <label className="block text-sm font-bold text-[#3E2723]">
              عنوان التوصيل · Delivery Address
              <input
                required
                type="text"
                value={form.address}
                onChange={(event) => {
                  const val = event.target.value;
                  set("address", val);
                  set("area", val);
                }}
                placeholder="اسم المنطقة، الشارع، البناية، رقم الشقة أو علامة مميزة..."
                className="mt-1 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm focus:ring-2 focus:ring-[#B8860B] focus:outline-none"
              />
            </label>

            <label className="block text-sm font-bold text-[#3E2723]">
              تحديد سعر التوصيل (د.أ) · Delivery Fee (JOD)
              <input
                type="number"
                step="0.5"
                min="0"
                value={form.delivery_fee}
                onChange={(event) => set("delivery_fee", event.target.value)}
                placeholder="مثال: 3.00"
                className="mt-1 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm focus:ring-2 focus:ring-[#B8860B] focus:outline-none"
              />
            </label>
          </div>
        ) : null}

        {/* PAYMENT METHOD WITH CLIQ ACCOUNTS */}
        <fieldset className="text-sm font-bold text-[#3E2723]">
          <legend>طريقة الدفع · Payment method</legend>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => set("payment_option", "cash")}
              aria-pressed={form.payment_option === "cash"}
              className={`flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-bold transition-all ${
                form.payment_option === "cash"
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
                if (form.payment_option === "cash") {
                  set("payment_option", "cliq_full");
                }
              }}
              aria-pressed={form.payment_option !== "cash"}
              className={`flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-bold transition-all ${
                form.payment_option !== "cash"
                  ? "bg-[#8B4513] text-white shadow-sm ring-2 ring-[#B8860B]/40"
                  : "border border-slate-200 bg-white text-[#5D2E17] hover:bg-slate-50"
              }`}
            >
              <span>⚡</span>
              <span>دفع عبر كليك · CliQ</span>
              <span className="text-[10px] opacity-80">
                {form.payment_option !== "cash" ? "▼" : "◀"}
              </span>
            </button>
          </div>

          {/* CLIQ SUB-CARD WITH DROPDOWN OPTIONS */}
          {form.payment_option !== "cash" && (
            <div className="mt-3 animate-in space-y-3.5 rounded-2xl border-2 border-[#B8860B]/40 bg-[#FFFDF7] p-3.5 shadow-sm fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between border-b border-amber-100 pb-1">
                <span className="flex items-center gap-1.5 text-xs font-black text-[#5D2E17]">
                  ⚡ تفاصيل وخيارات كليك · CliQ Options
                </span>
                <span className="rounded-full border border-amber-200 bg-[#FDE2CF]/70 px-2.5 py-0.5 text-[11px] font-bold text-[#8B4513]">
                  {cliqAccountText}
                </span>
              </div>

              {/* 1. قائمة نوع دفع كليك */}
              <div>
                <label className="mb-1 block text-xs font-bold text-[#5D2E17]">
                  نوع عملية كليك · CliQ Payment Type
                </label>
                <select
                  value={form.payment_option}
                  onChange={(e) =>
                    set("payment_option", e.target.value as "cliq_full" | "cliq_deposit")
                  }
                  className="min-h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-[#3E2723] focus:ring-2 focus:ring-[#B8860B] focus:outline-none"
                >
                  <option value="cliq_full">💳 كليك دفع كامل (سداد كامل المبلغ)</option>
                  <option value="cliq_deposit">🪙 عربون عبر كليك (دفعة مقدمة / عربون)</option>
                </select>
              </div>

              {/* 2. قائمة حساب كليك المستلم */}
              <div>
                <label className="mb-1 block text-xs font-bold text-[#5D2E17]">
                  حساب كليك المستلم · CliQ Account Destination
                </label>
                <select
                  value={form.cliq_account}
                  onChange={(e) => set("cliq_account", e.target.value as CliqAccount)}
                  className="min-h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-[#3E2723] focus:ring-2 focus:ring-[#B8860B] focus:outline-none"
                >
                  {cliqAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.icon} {acc.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* If "Staff Member" CliQ is selected: input for employee name */}
              {form.cliq_account === "staff" && (
                <div className="animate-in pt-0.5 fade-in">
                  <label className="block text-xs font-bold text-[#5D2E17]">
                    اسم الموظفة / كود الحساب
                    <input
                      type="text"
                      required
                      value={form.cliq_staff_name}
                      onChange={(e) => set("cliq_staff_name", e.target.value)}
                      placeholder="اكتب اسم الموظفة (مثال: ريم، سارة...)"
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-[#3E2723] focus:ring-2 focus:ring-[#B8860B] focus:outline-none"
                    />
                  </label>
                </div>
              )}

              {/* 3. المبلغ المدفوع عبر كليك */}
              <label className="block text-xs font-bold text-[#3E2723]">
                <div className="mb-1 flex items-center justify-between">
                  <span>
                    {form.payment_option === "cliq_full"
                      ? "المبلغ الكامل المدفوع عبر كليك (د.أ)"
                      : "قيمة العربون المدفوع عبر كليك (د.أ)"}
                  </span>
                  {grandTotal > 0 && form.payment_option === "cliq_full" && (
                    <button
                      type="button"
                      onClick={() => set("deposit_paid", grandTotal.toFixed(2))}
                      className="cursor-pointer text-[10px] font-bold text-[#8B4513] hover:underline"
                    >
                      تعبئة كامل المبلغ ({grandTotal.toFixed(2)} د.أ)
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  dir="ltr"
                  value={form.deposit_paid}
                  onChange={(event) => set("deposit_paid", event.target.value)}
                  placeholder="0.00"
                  className="mt-1 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm focus:ring-2 focus:ring-[#B8860B] focus:outline-none"
                />
              </label>

              {/* 4. رفع صورة حوالة كليك (اختياري عند الإنشاء — يمكن إرفاقها لاحقاً عند الدفع) */}
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
                    if (file) void handleReceiptUpload(file);
                  }}
                />

                {receiptUrl ? (
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-300 bg-white p-3 shadow-2xs">
                    <img
                      src={receiptUrl}
                      alt="إشعار حوالة كليك"
                      className="h-16 w-16 shrink-0 cursor-pointer rounded-lg border border-slate-200 object-cover transition hover:opacity-90"
                      onClick={() => window.open(receiptUrl, "_blank")}
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
                          onClick={() => setReceiptUrl(null)}
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

                {receiptError && (
                  <p className="mt-1 flex items-center gap-1 text-xs font-bold text-rose-600">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>{receiptError}</span>
                  </p>
                )}
              </div>
            </div>
          )}
        </fieldset>

        {/* DATES & TIME */}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-bold text-[#3E2723]">
            تاريخ التسليم · Date
            <input
              type="date"
              required
              value={form.requested_date}
              onChange={(event) => set("requested_date", event.target.value)}
              className="mt-1 min-h-12 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:ring-2 focus:ring-[#B8860B] focus:outline-none"
            />
          </label>

          <label className="block text-sm font-bold text-[#3E2723]">
            وقت التسليم · Time
            <input
              type="time"
              required
              value={form.requested_time}
              onChange={(event) => set("requested_time", event.target.value)}
              className="mt-1 min-h-12 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:ring-2 focus:ring-[#B8860B] focus:outline-none"
            />
          </label>
        </div>

        {/* URGENT BUTTON */}
        <div>
          <button
            type="button"
            onClick={() => set("is_urgent", !form.is_urgent)}
            aria-pressed={form.is_urgent}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-xs font-bold transition-all ${
              form.is_urgent
                ? "bg-red-600 text-white shadow-sm"
                : "border border-red-300 bg-red-50/50 text-red-700 hover:bg-red-50"
            }`}
          >
            <AlertTriangle className="h-4 w-4" aria-hidden="true" /> 🚨 مستعجل · Urgent
          </button>
        </div>

        {/* CARD NOTE */}
        <label className="block text-sm font-bold text-[#3E2723]">
          الكتابة على الكرت · Card note
          <input
            type="text"
            maxLength={1000}
            value={form.card_note}
            onChange={(event) => set("card_note", event.target.value)}
            placeholder="مثال: كل عام وأنتِ بخير يا أغلى الناس..."
            className="mt-1 min-h-12 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] px-3.5 text-sm focus:ring-2 focus:ring-[#B8860B] focus:outline-none"
          />
        </label>

        {/* FINANCIAL CALCULATOR */}
        <div className="rounded-2xl border border-[#B8860B]/40 bg-[#FFF8EE] p-4">
          <h3 className="text-sm font-bold text-[#5D2E17]">الحساب · السعر، العربون، المتبقي</h3>
          <dl className="mt-2 space-y-1 text-sm text-[#3E2723]">
            <div className="flex justify-between gap-2">
              <dt>
                المبلغ ({form.quantity} × {jd(Number(form.unit_price) || 0)})
              </dt>
              <dd className="font-bold">{jd(originalPrice)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>التوصيل</dt>
              <dd className="font-bold">{jd(deliveryFee)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>الحساب كامل</dt>
              <dd className="font-bold">{jd(grandTotal)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>المبلغ المدفوع</dt>
              <dd className="font-bold">{jd(paidAmount)}</dd>
            </div>
            <div className="flex justify-between gap-2 border-t border-[#B8860B]/30 pt-1 text-[#8B4513]">
              <dt className="font-bold">المبلغ المتبقي</dt>
              <dd className="font-bold">{jd(remaining)}</dd>
            </div>
          </dl>
        </div>

        {/* INTERNAL STAFF NOTES */}
        <label className="block text-sm font-bold text-[#3E2723]">
          ملاحظات داخلية للموظفين · Internal staff notes
          <textarea
            rows={2}
            value={form.staff_notes}
            onChange={(event) => set("staff_notes", event.target.value)}
            placeholder="ملاحظات سرية للإدارة والمبيعات فقط..."
            className="mt-1 w-full rounded-xl border border-slate-200 bg-[#F9FBFC] p-3 text-sm focus:ring-2 focus:ring-[#B8860B] focus:outline-none"
          />
        </label>

        {/* SUBMIT BUTTON */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={submit.isPending || isSubmittingRef.current}
            className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[#8B4513] px-6 text-center text-sm font-bold text-white shadow-sm transition hover:bg-[#5D2E17] disabled:opacity-60"
          >
            {submit.isPending || isSubmittingRef.current ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="h-4 w-4" aria-hidden="true" />
            )}
            إرسال وتثبيت الطلب فورا
          </button>
        </div>
      </form>

      {/* CONFIRMATION / MODIFICATION MESSAGE PREVIEW */}
      <section className="rounded-3xl border border-[#B8860B]/40 bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#B8860B]" />
            <h2 className="font-display text-base font-bold text-foreground">
              معاينة رسائل الواتساب والتثبيت
            </h2>
          </div>

          {/* Toggle between Confirmation and Modification templates */}
          <div className="flex items-center gap-1 rounded-2xl border border-border bg-secondary/70 p-1">
            <button
              type="button"
              onClick={() => setPreviewTab("confirmation")}
              className={`cursor-pointer rounded-xl px-3.5 py-1.5 text-xs font-black transition-all ${
                previewTab === "confirmation"
                  ? "bg-[#8B4513] text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              📌 مسج تثبيت الأوردر (للزبون)
            </button>
            <button
              type="button"
              onClick={() => setPreviewTab("modification")}
              className={`cursor-pointer rounded-xl px-3.5 py-1.5 text-xs font-black transition-all ${
                previewTab === "modification"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              🛑 مسج تثبيت التعديل (🛑 تعديل)
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void copy(activePreviewText, previewTab)}
            className="inline-flex min-h-12 min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full border border-[#B8860B] bg-white px-4 text-sm font-bold text-[#8B4513] shadow-2xs transition hover:bg-[#FDE2CF]/30"
          >
            {copied === previewTab ? (
              <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            ) : (
              <ClipboardCopy className="h-4 w-4" aria-hidden="true" />
            )}
            {copied === previewTab
              ? "تم النسخ بنجاح ✅"
              : previewTab === "confirmation"
                ? "نسخ مسج تثبيت الأوردر للزبون"
                : "نسخ مسج التعديل (🛑🛑🛑تعديل)"}
          </button>
          <a
            href={whatsappUrl(activePreviewText)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="إرسال على واتساب"
            title="إرسال على واتساب"
            className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-sm transition hover:brightness-95"
          >
            <MessageCircle className="h-5 w-5" aria-hidden="true" />
          </a>
        </div>

        <pre className="mt-3.5 max-h-96 overflow-y-auto rounded-2xl border border-border/80 bg-secondary/40 p-4 font-sans text-xs leading-relaxed break-words whitespace-pre-wrap text-foreground sm:text-sm">
          {activePreviewText}
        </pre>
      </section>
    </div>
  );
}
