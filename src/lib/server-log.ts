/**
 * Structured server logging. One JSON line per event so the log pipeline can
 * filter by scope/level and correlate failures after release.
 */

type LogContext = Record<string, unknown>;

export function logServerError(scope: string, error: unknown, context: LogContext = {}): void {
  const err = error instanceof Error ? error : new Error(String(error ?? "unknown"));
  console.error(
    JSON.stringify({
      level: "error",
      scope,
      message: err.message,
      // Truncated stack: enough to locate the failure without flooding the log.
      stack: err.stack?.split("\n").slice(0, 6).join("\n"),
      ...context,
      at: new Date().toISOString(),
    }),
  );
}

const KNOWN_SAFE_STAFF_PATTERNS = [
  "OCC_VERSION_MISMATCH",
  "تعارض",
  "conflict",
  "غير مصرّح",
  "الطلب غير موجود",
  "البند غير موجود",
  "الخصم المطلوب",
  "مبلغ الخصم",
  "سبب الإلغاء",
  "سعر الصنف",
  "الكمية",
  "لا يمكن",
  "مرحلة غير صالحة",
  "يجب تسجيل الدخول",
] as const;

const RAW_PG_LEAK_RE =
  /\b(relation|column|constraint|violates|syntax error|permission denied for|pg_|sqlstate)\b/i;

/**
 * Extracts a safe Error from a staff RPC failure: preserves explicit bilingual domain / OCC
 * errors needed by UI retry/conflict handlers while masking raw SQL/schema error details.
 */
export function sanitizeStaffRpcError(error: unknown, fallbackMessage: string): Error {
  const msg =
    error instanceof Error
      ? error.message
      : typeof (error as { message?: unknown } | null)?.message === "string"
        ? String((error as { message: string }).message)
        : "";
  const trimmed = msg.trim();
  if (
    trimmed &&
    !RAW_PG_LEAK_RE.test(trimmed) &&
    KNOWN_SAFE_STAFF_PATTERNS.some((pattern) => trimmed.includes(pattern))
  ) {
    return new Error(trimmed);
  }
  return new Error(fallbackMessage);
}

/**
 * Logs unexpected RPC/DB failures server-side while preserving intentional OCC/domain errors.
 */
export function staffRpcError(scope: string, error: unknown, fallbackMessage: string): Error {
  logServerError(scope, error);
  return sanitizeStaffRpcError(error, fallbackMessage);
}
