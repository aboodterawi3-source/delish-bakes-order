/**
 * Shared upload validation for every image picker in the app
 * (storefront checkout design photos, social portal, staff CMS panels).
 *
 * Rules enforced on BOTH sides:
 *  - only real JPEG / PNG files (extension, MIME type and magic bytes must agree)
 *  - hard 5 MB cap on the file the customer or staff member picks
 *
 * Anything else — SVG, GIF, HEIC, PDF, scripts, renamed executables — is
 * rejected before it can reach storage.
 */

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png"] as const;
export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png"] as const;
/** Value for the `accept` attribute of every file input. */
export const IMAGE_ACCEPT = "image/jpeg,image/png,.jpg,.jpeg,.png";

const err = (ar: string, en: string) => new Error(`${ar} · ${en}`);

export const UPLOAD_TYPE_ERROR = () =>
  err("يُسمح بصور JPG أو PNG فقط", "Only JPG or PNG images are allowed");
export const UPLOAD_SIZE_ERROR = () =>
  err("الحد الأقصى لحجم الصورة 5 ميغابايت", "Maximum image size is 5MB");

/** Detects the real type from the file header, ignoring name and MIME claims. */
export function sniffImageType(bytes: Uint8Array): "jpeg" | "png" | "webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }
  return null;
}

/**
 * Browser-side gate. Throws a bilingual error when the picked file is not a
 * genuine JPG/PNG under 5 MB.
 */
export async function assertSafeImageFile(file: File): Promise<void> {
  const name = (file.name ?? "").toLowerCase();
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1) : "";
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) throw UPLOAD_TYPE_ERROR();
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes((file.type ?? "").toLowerCase())) {
    throw UPLOAD_TYPE_ERROR();
  }
  if (!file.size) throw UPLOAD_TYPE_ERROR();
  if (file.size > MAX_UPLOAD_BYTES) throw UPLOAD_SIZE_ERROR();

  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const sniffed = sniffImageType(head);
  if (sniffed !== "jpeg" && sniffed !== "png") throw UPLOAD_TYPE_ERROR();
}

/**
 * Server-side gate for base64 data URLs. Verifies the declared type, the
 * decoded size and the real magic bytes, and returns storage-ready binary.
 * `webp` is accepted only because the browser re-encodes validated JPG/PNG
 * files to WebP before upload — the header must still prove it.
 */
export function decodeValidatedImage(
  dataUrl: unknown,
  maxBytes: number = MAX_UPLOAD_BYTES,
): { binary: Uint8Array; ext: "jpg" | "png" | "webp"; contentType: string } {
  const raw = typeof dataUrl === "string" ? dataUrl.trim() : "";
  const match = /^data:image\/(webp|png|jpe?g);base64,([A-Za-z0-9+/=]+)$/.exec(raw);
  if (!match) throw UPLOAD_TYPE_ERROR();

  const base64 = match[2]!;
  if (Math.floor(base64.length * 0.75) > maxBytes) throw UPLOAD_SIZE_ERROR();

  let binary: Uint8Array;
  try {
    binary = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  } catch {
    throw UPLOAD_TYPE_ERROR();
  }
  if (!binary.length) throw UPLOAD_TYPE_ERROR();
  if (binary.length > maxBytes) throw UPLOAD_SIZE_ERROR();

  const declared = match[1] === "jpg" ? "jpeg" : match[1]!;
  const sniffed = sniffImageType(binary);
  if (!sniffed || sniffed !== declared) throw UPLOAD_TYPE_ERROR();

  const ext = sniffed === "jpeg" ? "jpg" : sniffed;
  return { binary, ext, contentType: `image/${sniffed}` };
}
