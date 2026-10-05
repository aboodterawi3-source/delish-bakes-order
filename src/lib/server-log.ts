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

export function logServerEvent(scope: string, context: LogContext = {}): void {
  console.info(JSON.stringify({ level: "info", scope, ...context, at: new Date().toISOString() }));
}

/**
 * Staff endpoints must not forward raw Postgres messages (table/constraint
 * names) to the browser either. Logs the detail, returns a safe bilingual error.
 */
export function staffError(scope: string, error: unknown, safeMessage: string): Error {
  logServerError(scope, error);
  return new Error(safeMessage);
}
