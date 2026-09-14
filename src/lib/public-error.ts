/**
 * Public (unauthenticated) surfaces must never forward raw database messages,
 * which can leak table, column or constraint names. Details stay in the server
 * log; the visitor gets a safe bilingual message.
 */
const GENERIC = "تعذّر إكمال العملية، حاول مرة أخرى · Something went wrong, please try again";

export function publicError(scope: string, detail: unknown, message = GENERIC): Error {
  const text = detail instanceof Error ? detail.message : String(detail ?? "unknown");
  console.error(`[${scope}] ${text}`);
  return new Error(message);
}
