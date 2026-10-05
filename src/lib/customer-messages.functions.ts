/**
 * Customer comments / issues submitted from the public website. Anyone can send
 * one (through this server function only, using the privileged client after
 * validation); sales, social and admin staff read and resolve them.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRole } from "@/lib/role-guard";
import type { StaffRoleName } from "@/lib/role-guard";
import { publicError } from "@/lib/public-error";

const DESK_ROLES: StaffRoleName[] = ["admin", "sales", "social"];

export type CustomerMessage = {
  id: string;
  name: string;
  phone: string;
  message: string;
  status: "new" | "handled";
  created_at: string;
};

const MESSAGE_SELECT = "id, name, phone, message, status, created_at";

const clean = (value: unknown, max: number, label: string) => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) throw new Error(`${label} مطلوب · ${label} is required`);
  if (trimmed.length > max) throw new Error(`${label} طويل جداً · ${label} is too long`);
  return trimmed;
};

// In-memory rate limiting: prevent spam submissions (max 1 message per 60s per phone number)
const messageRateLimitMap = new Map<string, number>();
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkRateLimit(phone: string): boolean {
  const normalized = phone.replace(/[^0-9]/g, "");
  const now = Date.now();
  const lastSubmitted = messageRateLimitMap.get(normalized);

  if (lastSubmitted && now - lastSubmitted < RATE_LIMIT_WINDOW_MS) {
    return false;
  }

  messageRateLimitMap.set(normalized, now);

  // Periodic cleanup if map grows
  if (messageRateLimitMap.size > 2000) {
    for (const [key, timestamp] of messageRateLimitMap.entries()) {
      if (now - timestamp > RATE_LIMIT_WINDOW_MS) {
        messageRateLimitMap.delete(key);
      }
    }
  }

  return true;
}

export const submitCustomerMessage = createServerFn({ method: "POST" })
  .inputValidator((input: { name: string; phone: string; message: string; honeypot?: string }) => {
    const isBot = Boolean(input?.honeypot && input.honeypot.trim().length > 0);
    const phone = clean(input?.phone, 25, "رقم الهاتف");
    if (!/^[0-9+\s-]{7,25}$/.test(phone))
      throw new Error("رقم هاتف غير صحيح · Invalid phone number");
    return {
      name: clean(input?.name, 80, "الاسم"),
      phone,
      message: clean(input?.message, 1500, "الرسالة"),
      isBot,
    };
  })
  .handler(async ({ data }) => {
    // Silent rejection for bots trap: return success so bots don't retry, but discard payload
    if (data.isBot) {
      return { ok: true };
    }

    // Rate limit: 1 message per 60 seconds per phone number
    if (!checkRateLimit(data.phone)) {
      throw new Error(
        "يرجى الانتظار 60 ثانية قبل إرسال رسالة أخرى · Please wait 60 seconds before sending another message",
      );
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("customer_messages").insert({
      name: data.name,
      phone: data.phone,
      message: data.message,
    });
    if (error) {
      throw publicError(
        "messages.insert",
        error,
        "تعذّر إرسال الرسالة · Could not send your message",
      );
    }
    return { ok: true };
  });

export const listCustomerMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CustomerMessage[]> => {
    await assertRole(context, DESK_ROLES);
    const { data, error } = await context.supabase
      .from("customer_messages")
      .select(MESSAGE_SELECT)
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as CustomerMessage[];
  });

export const setCustomerMessageStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: "new" | "handled" }) => {
    if (!input?.id) throw new Error("id is required");
    return { id: input.id, status: input.status === "handled" ? "handled" : "new" };
  })
  .handler(async ({ data, context }): Promise<CustomerMessage> => {
    await assertRole(context, DESK_ROLES);
    const { data: saved, error } = await context.supabase
      .from("customer_messages")
      .update({
        status: data.status,
        handled_by: data.status === "handled" ? context.userId : null,
        handled_at: data.status === "handled" ? new Date().toISOString() : null,
      } as never)
      .eq("id", data.id)
      .select(MESSAGE_SELECT)
      .single();
    if (error) throw new Error(error.message);
    return saved as unknown as CustomerMessage;
  });
