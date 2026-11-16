import { ORDER_STATUS_META, type PaymentMethod } from "@/lib/order-status";

export const ORDERS_KEY = ["sales-orders"] as const;
export const ADMIN_ANALYTICS_KEY = ["admin", "analytics"] as const;

export const statusMeta = ORDER_STATUS_META;

export const payMeta: Record<PaymentMethod, { ar: string; en: string }> = {
  cash: { ar: "نقدي", en: "Cash" },
  cliq: { ar: "كليك", en: "CliQ" },
  visa: { ar: "فيزا", en: "Visa" },
};

export const SAVED_DRIVERS = [
  { label: "سائق 1 - أحمد", name: "أحمد", phone: "0790000001" },
  { label: "سائق 2 - محمد", name: "محمد", phone: "0790000002" },
  { label: "سائق 3 - محمود", name: "محمود", phone: "0790000003" },
  { label: "شركة توصيل خارجية", name: "شركة التوصيل", phone: "" },
] as const;
