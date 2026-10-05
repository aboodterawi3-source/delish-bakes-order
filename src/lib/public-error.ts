import { logServerError } from "@/lib/server-log";

/**
 * Public (unauthenticated) surfaces must never forward raw database messages,
 * which can leak table, column or constraint names. Details stay in the server
 * log; the visitor gets a safe bilingual message.
 */
const GENERIC = "تعذّر إكمال العملية، حاول مرة أخرى · Something went wrong, please try again";

export function publicError(scope: string, detail: unknown, message = GENERIC): Error {
  // Structured log (scope + truncated stack) instead of a bare text line.
  logServerError(scope, detail);
  return new Error(message);
}
