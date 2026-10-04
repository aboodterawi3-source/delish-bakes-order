/**
 * Unified WhatsApp service for Delish Bakery.
 * Manages official store phone constants, phone sanitization for Jordan numbers,
 * and wa.me chat URL generation.
 */

/** Official Delish store WhatsApp number (Jordanian international format, no "+"). */
export const WHATSAPP_STORE_NUMBER = "962779179995";
/** Alias for backwards compatibility */
export const WHATSAPP = WHATSAPP_STORE_NUMBER;

/**
 * Normalizes phone numbers into standard Jordanian WhatsApp format (e.g. 9627XXXXXXXX).
 * Handles inputs like '0791234567', '+962 79 123 4567', '791234567', '962791234567'.
 */
export function formatJordanianPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("962")) {
    return digits;
  }
  if (digits.startsWith("07") && digits.length >= 10) {
    return `962${digits.slice(1)}`;
  }
  if (digits.startsWith("0") && digits.length >= 9) {
    return `962${digits.slice(1)}`;
  }
  if (digits.startsWith("7") && digits.length === 9) {
    return `962${digits}`;
  }
  return digits;
}

/** Backwards-compatible alias for existing imports */
export const waNumber = formatJordanianPhone;
export const getCleanPhone = formatJordanianPhone;
export const formatWhatsappPhone = formatJordanianPhone;

/**
 * Generates a direct WhatsApp link.
 * If phone is omitted or empty, defaults to the official bakery WhatsApp number.
 */
export function getWhatsAppChatUrl(
  phone?: string | null,
  text?: string | null,
): string {
  const cleanPhone = phone ? formatJordanianPhone(phone) : WHATSAPP_STORE_NUMBER;
  const target = cleanPhone || WHATSAPP_STORE_NUMBER;
  const query = text && text.trim() ? `?text=${encodeURIComponent(text.trim())}` : "";
  return `https://wa.me/${target}${query}`;
}
