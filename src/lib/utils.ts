import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Sanitizes staff notes for clean UI and receipt display, removing raw storage image URLs
 * and replacing them with a concise label so long URLs never clutter the display.
 */
export function formatStaffNotes(notes?: string | null): string {
  if (!notes) return "";
  return notes
    .replace(/\[\s*صورة الحوالة:\s*https?:\/\/[^\]]+\s*\]/gi, "[صورة الحوالة مرفقة 📄]")
    .replace(
      /\[\s*(?:رابط التصميم|صورة التصميم):\s*https?:\/\/[^\]]+\s*\]/gi,
      "[تصميم الكيكة مرفق 🎨]",
    )
    .replace(/\[\s*صورة مرفقة:\s*https?:\/\/[^\]]+\s*\]/gi, "[صورة مرفقة 🖼️]")
    .replace(/https?:\/\/[^\s"'<>]+\.(?:webp|png|jpg|jpeg|gif)(?:\?[^\s"'<>]*)?/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const RECEIPT_TAG_REGEX = /\[\s*صورة الحوالة:\s*(https?:\/\/[^\]]+?)\s*\]/i;

/**
 * Extracts the stored CliQ / payment receipt image URL from `staff_notes` if present.
 */
export function extractReceiptImageUrl(notes?: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(RECEIPT_TAG_REGEX);
  return match?.[1]?.trim() || null;
}

/**
 * Attaches or updates the CliQ / payment receipt image URL inside `staff_notes`
 * without disturbing other staff metadata tags.
 */
export function attachReceiptImageUrl(
  notes: string | null | undefined,
  url: string | null,
): string {
  const cleaned = (notes || "")
    .replace(/\[\s*صورة الحوالة:\s*https?:\/\/[^\]]+\s*\]/gi, "")
    .replace(/\[صورة الحوالة مرفقة\s*📄?\]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!url) return cleaned;
  return [cleaned, `[صورة الحوالة: ${url.trim()}]`].filter(Boolean).join(" ").trim();
}
