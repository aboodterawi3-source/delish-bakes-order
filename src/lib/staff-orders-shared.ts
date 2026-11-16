import { ORDER_STATUS_META, type PaymentMethod } from "@/lib/order-status";

export const ORDERS_KEY = ["sales-orders"] as const;
export const ADMIN_ANALYTICS_KEY = ["admin", "analytics"] as const;

export const statusMeta = ORDER_STATUS_META;

export const payMeta: Record<PaymentMethod, { ar: string; en: string }> = {
  cash: { ar: "نقدي", en: "Cash" },
  cliq: { ar: "كليك", en: "CliQ" },
  visa: { ar: "فيزا", en: "Visa" },
};
