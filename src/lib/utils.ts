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
    .replace(/\[\s*(?:رابط التصميم|صورة التصميم):\s*https?:\/\/[^\]]+\s*\]/gi, "[تصميم الكيكة مرفق 🎨]")
    .replace(/\[\s*صورة مرفقة:\s*https?:\/\/[^\]]+\s*\]/gi, "[صورة مرفقة 🖼️]")
    .replace(/https?:\/\/[^\s"'<>]+\.(?:webp|png|jpg|jpeg|gif)(?:\?[^\s"'<>]*)?/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
