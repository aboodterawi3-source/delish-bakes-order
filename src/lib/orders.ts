import type { CartLine } from "./cart";
import { images } from "./images";

export type OrderStatus = "new" | "confirmed" | "baking" | "ready" | "delivered";

export const statusMeta: Record<OrderStatus, { ar: string; en: string; dot: string }> = {
  new: { ar: "طلب جديد", en: "New", dot: "bg-gold" },
  confirmed: { ar: "مؤكّد", en: "Confirmed", dot: "bg-primary" },
  baking: { ar: "قيد التحضير", en: "Baking", dot: "bg-gold-deep" },
  ready: { ar: "جاهز", en: "Ready", dot: "bg-accent" },
  delivered: { ar: "تم التسليم", en: "Delivered", dot: "bg-muted-foreground" },
};

export const statusOrder: OrderStatus[] = ["new", "confirmed", "baking", "ready", "delivered"];

export type Order = {
  id: string;
  createdAt: string;
  customer: string;
  phone: string;
  method: "delivery" | "pickup";
  area?: string | undefined;
  address?: string | undefined;
  date: string;
  time: string;
  lines: CartLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  notes?: string | undefined;
  inscription?: string | undefined;
  designImage?: string | undefined;
  status: OrderStatus;
};

const KEY = "delish-orders-v1";
export const ORDER_EVENT = "delish-orders-updated";

const today = () => new Date().toISOString().slice(0, 10);
const iso = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60000).toISOString();

export const seedOrders: Order[] = [
  {
    id: "DL-1041",
    createdAt: iso(25),
    customer: "رنا خالد",
    phone: "0791234567",
    method: "delivery",
    area: "عبدون",
    address: "شارع الأمير هاشم، بناية ١٢، طابق ٣",
    date: today(),
    time: "18:30",
    lines: [
      {
        key: "s1",
        ar: "كيك الشوكولاتة البلجيكية",
        en: "Belgian Chocolate Cake",
        unit: 32,
        qty: 1,
        image: images["cake-choc"],
        detailsAr: ["الحجم: وسط (١٠ أشخاص)", "النكهة: نوتيلا وبندق"],
        detailsEn: ["Size: Medium (serves 10)", "Flavor: Nutella & hazelnut"],
      },
    ],
    subtotal: 32,
    deliveryFee: 3,
    total: 35,
    inscription: "عيد ميلاد سعيد يا لين ♥",
    designImage: images["cake-choc"],
    notes: "بدون مكسّرات على الوجه",
    status: "new",
  },
  {
    id: "DL-1040",
    createdAt: iso(95),
    customer: "أحمد مراد",
    phone: "0777889900",
    method: "pickup",
    date: today(),
    time: "16:00",
    lines: [
      {
        key: "s2",
        ar: "كيكة مصمّمة خاصة",
        en: "Custom designed cake",
        unit: 52,
        qty: 1,
        image: images["builder"],
        detailsAr: ["الحجم: ١٦ شخص", "النكهة: فستق حلبي", "الحشوة: لوتس كراميل", "التغليف: ذهبي فاخر"],
        detailsEn: ["Size: Serves 16", "Flavor: Pistachio", "Filling: Lotus caramel", "Frosting: Gold leaf luxe"],
      },
      {
        key: "s3",
        ar: "صندوق كب كيك (٦ حبات)",
        en: "Cupcake Box (6 pcs)",
        unit: 12,
        qty: 2,
        image: images["cupcakes"],
        detailsAr: ["النكهة: تشكيلة مختارة"],
        detailsEn: ["Flavor: Chef's mix"],
      },
    ],
    subtotal: 76,
    deliveryFee: 0,
    total: 76,
    inscription: "Congratulations Dr. Ahmad",
    designImage: images["builder"],
    status: "baking",
  },
  {
    id: "DL-1039",
    createdAt: iso(180),
    customer: "لينا عوض",
    phone: "0785551122",
    method: "delivery",
    area: "الرابية",
    address: "شارع وصفي التل، عمارة ٤٥",
    date: today(),
    time: "20:00",
    lines: [
      {
        key: "s4",
        ar: "كنافة نابلسية",
        en: "Nabulsi Knafeh",
        unit: 14,
        qty: 2,
        image: images["knafeh"],
        detailsAr: [],
        detailsEn: [],
      },
      {
        key: "s5",
        ar: "بقلاوة بالفستق",
        en: "Pistachio Baklava",
        unit: 16,
        qty: 1,
        image: images["baklava"],
        detailsAr: [],
        detailsEn: [],
      },
    ],
    subtotal: 44,
    deliveryFee: 3,
    total: 47,
    notes: "الاتصال قبل الوصول",
    status: "ready",
  },
  {
    id: "DL-1038",
    createdAt: iso(260),
    customer: "سيف الدين ن.",
    phone: "0796543210",
    method: "delivery",
    area: "دابوق",
    address: "مقابل مدارس المشرق",
    date: today(),
    time: "13:00",
    lines: [
      {
        key: "s6",
        ar: "تشيز كيك لوتس",
        en: "Lotus Cheesecake",
        unit: 28,
        qty: 1,
        image: images["cheesecake"],
        detailsAr: ["الحجم: كبير (١٦ شخص)"],
        detailsEn: ["Size: Large (serves 16)"],
      },
    ],
    subtotal: 28,
    deliveryFee: 3,
    total: 31,
    status: "delivered",
  },
  {
    id: "DL-1037",
    createdAt: iso(320),
    customer: "هبة الرمحي",
    phone: "0799001122",
    method: "pickup",
    date: today(),
    time: "11:30",
    lines: [
      {
        key: "s7",
        ar: "كوكيز الشوكولاتة",
        en: "Chocolate Chunk Cookies",
        unit: 10,
        qty: 3,
        image: images["cookies"],
        detailsAr: ["النكهة: دبل شوكولاتة"],
        detailsEn: ["Flavor: Double chocolate"],
      },
    ],
    subtotal: 30,
    deliveryFee: 0,
    total: 30,
    status: "confirmed",
  },
];

export function loadOrders(): Order[] {
  if (typeof window === "undefined") return seedOrders;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return seedOrders;
    const parsed = JSON.parse(raw) as Order[];
    return Array.isArray(parsed) && parsed.length ? parsed : seedOrders;
  } catch {
    return seedOrders;
  }
}

export function saveOrders(orders: Order[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(orders));
    window.dispatchEvent(new CustomEvent(ORDER_EVENT));
  } catch {
    /* storage unavailable */
  }
}

export function appendOrder(order: Order) {
  const next = [order, ...loadOrders()];
  saveOrders(next);
}

export function newOrderId() {
  return `DL-${1042 + Math.floor(Math.random() * 900)}`;
}

export function statusMessage(order: Order, status: OrderStatus) {
  const lines = [
    `مرحباً ${order.customer} 🌸`,
    "",
    `تحديث حالة طلبك من *Delish Cake & Bake*`,
    `رقم الطلب: ${order.id}`,
    `الحالة الحالية: *${statusMeta[status].ar}*`,
    "",
    ...order.lines.map((l) => `• ${l.ar} × ${l.qty}`),
    "",
    order.method === "delivery"
      ? `التوصيل إلى: ${order.area ?? ""} — ${order.date} ${order.time}`
      : `الاستلام من الفرع: ${order.date} ${order.time}`,
    `الإجمالي: ${order.total.toFixed(2)} د.أ`,
    "",
    status === "ready"
      ? "طلبك جاهز الآن! 🎂"
      : status === "delivered"
        ? "تم تسليم طلبك، شكراً لثقتك بنا 💛"
        : "شكراً لطلبك، سنبقيك على اطلاع.",
  ];
  return lines.join("\n");
}
