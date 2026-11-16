import { todayIso } from "./date-filter.ts";

/**
 * Single source of truth for server-side input cleaning. Replaces the
 * copy-pasted `clean`/`text` helpers so every endpoint enforces the same rules.
 */

export const PHONE_PATTERN = /^[0-9+\s-]{7,25}$/;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validates that a value is a canonical 36-char UUID before filter interpolation. */
export function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value.trim());
}

/** Validates required/optional string fields with uniform trimming and length checks. */
export function cleanFieldText(
  value: unknown,
  max: number,
  label: string,
  required = false,
): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    if (required) throw new Error(`${label} مطلوب · ${label} is required`);
    return null;
  }
  if (trimmed.length > max) throw new Error(`${label} طويل جداً · ${label} is too long`);
  return trimmed;
}

/** Trims, strips line breaks and enforces a maximum length. Returns null when empty. */
export function cleanText(value: unknown, max: number): string | null {
  const trimmed = typeof value === "string" ? value.replace(/[\r\n]+/g, " ").trim() : "";
  if (!trimmed) return null;
  if (trimmed.length > max) throw new Error("نص طويل جداً · Text is too long");
  return trimmed;
}

/** Real calendar date check: rejects 2026-99-99 and 2026-02-31. */
export function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** HH:MM or HH:MM:SS with valid ranges. */
export function isValidTime(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return false;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] ?? 0);
  return hours < 24 && minutes < 60 && seconds < 60;
}

/** Customer-facing date window: from yesterday (clock skew) up to one year ahead. */
export function isReasonableOrderDate(value: string, now: Date = new Date()): boolean {
  if (!isValidIsoDate(value)) return false;
  const today = new Date(`${todayIso(now)}T00:00:00Z`).getTime();
  const target = new Date(`${value}T00:00:00Z`).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  return target >= today - dayMs && target <= today + 365 * dayMs;
}

/** Validates schedule date/time strings and integer item quantity before SQL RPCs run. */
export function validateSocialOrderScheduleAndQuantity(input: {
  requested_date: unknown;
  requested_time: unknown;
  quantity: unknown;
}): void {
  if (!isValidIsoDate(input.requested_date)) {
    throw new Error("تاريخ التسليم غير صالح · Invalid requested date");
  }
  if (!isValidTime(input.requested_time)) {
    throw new Error("وقت التسليم غير صالح · Invalid requested time");
  }
  const qty = Number(input.quantity);
  if (!Number.isInteger(qty) || qty < 1 || qty > 10000) {
    throw new Error("الكمية غير صحيحة · Quantity must be a whole number");
  }
}

export type AdminStatsSourceRow = {
  customer_phone?: string | null;
  customer_name?: string | null;
  total?: number | string | null;
  created_at?: string | null;
  created_by?: string | null;
  status?: string | null;
};

export type CustomerStatsEntry = {
  phone: string;
  name: string;
  orders: number;
  spend: number;
  last_order: string;
};

/**
 * Aggregates per-customer and per-agent metrics across all non-cancelled order rows
 * without truncating at the UI recent-logs slice limit.
 */
export function aggregateAdminCustomerAndAgentStats(
  rows: ReadonlyArray<AdminStatsSourceRow>,
  target?: {
    customerMap: Map<string, CustomerStatsEntry>;
    agentMap: Map<string, { orders: number; volume: number }>;
  },
): {
  customerMap: Map<string, CustomerStatsEntry>;
  agentMap: Map<string, { orders: number; volume: number }>;
} {
  const customerMap = target?.customerMap ?? new Map<string, CustomerStatsEntry>();
  const agentMap = target?.agentMap ?? new Map<string, { orders: number; volume: number }>();

  for (const row of rows) {
    if (row.status === "cancelled") continue;

    const total = Number(row.total ?? 0);
    const createdAt = String(row.created_at ?? "");
    const phone = String(row.customer_phone ?? "").trim();
    const name = String(row.customer_name ?? "").trim();

    if (phone) {
      const existing = customerMap.get(phone) ?? {
        phone,
        name,
        orders: 0,
        spend: 0,
        last_order: createdAt,
      };
      existing.orders += 1;
      existing.spend += total;
      if (createdAt > existing.last_order) {
        existing.last_order = createdAt;
        if (name) existing.name = name;
      }
      customerMap.set(phone, existing);
    }

    if (row.created_by) {
      const agent = agentMap.get(row.created_by) ?? { orders: 0, volume: 0 };
      agent.orders += 1;
      agent.volume += total;
      agentMap.set(row.created_by, agent);
    }
  }

  return { customerMap, agentMap };
}

export type ShiftPaymentSourceRow = {
  amount?: number | string | null;
  payment_method?: string | null;
  payment_type?: string | null;
};

export type ShiftOrderSourceRow = {
  status?: string | null;
  total?: number | string | null;
  deposit_paid?: number | string | null;
};

const SHIFT_METHODS = ["cash", "cliq", "visa", "unpaid"] as const;
type ShiftPaymentBucketMethod = (typeof SHIFT_METHODS)[number];

/**
 * Aggregates shift payment ledger rows and delivery-date order balances without truncation.
 */
export function aggregateShiftReport(
  paymentRows: ReadonlyArray<ShiftPaymentSourceRow>,
  orderRows: ReadonlyArray<ShiftOrderSourceRow>,
  date: string,
): {
  date: string;
  byMethod: { method: ShiftPaymentBucketMethod; orders: number; collected: number }[];
  orders: number;
  collected: number;
  outstanding: number;
  cancelled: number;
} {
  const buckets = new Map<ShiftPaymentBucketMethod, { orders: number; collected: number }>();
  let collected = 0;

  for (const p of paymentRows) {
    const amt = Number(p.amount ?? 0);
    const net = p.payment_type === "refund" ? -amt : amt;
    collected += net;
    const rawMethod = (p.payment_method || "cash") as ShiftPaymentBucketMethod;
    const m: ShiftPaymentBucketMethod = SHIFT_METHODS.includes(rawMethod) ? rawMethod : "cash";
    const b = buckets.get(m) ?? { orders: 0, collected: 0 };
    b.collected += net;
    b.orders += 1;
    buckets.set(m, b);
  }

  let outstanding = 0;
  let cancelled = 0;
  let orders = 0;

  for (const row of orderRows) {
    if (row.status === "cancelled") {
      cancelled += 1;
    } else {
      orders += 1;
      const paid = Number(row.deposit_paid ?? 0);
      const tot = Number(row.total ?? 0);
      outstanding += Math.max(tot - paid, 0);
    }
  }

  return {
    date,
    byMethod: SHIFT_METHODS.map((method) => ({
      method,
      orders: buckets.get(method)?.orders ?? 0,
      collected: Math.round((buckets.get(method)?.collected ?? 0) * 100) / 100,
    })),
    orders,
    collected: Math.round(collected * 100) / 100,
    outstanding: Math.round(outstanding * 100) / 100,
    cancelled,
  };
}
