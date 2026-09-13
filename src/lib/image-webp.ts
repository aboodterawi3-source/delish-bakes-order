/**
 * Client-side "smart" WebP conversion.
 *
 * Reference photos from phones are often 6–10 MB. We decode them in the browser,
 * downscale the longest edge and re-encode as WebP at 90% quality, then step the
 * scale down until the result comfortably fits the ~500 KB budget. Kitchen staff
 * still get a crisp reference, and storage/bandwidth stay small.
 */

const TARGET_BYTES = 520_000;
const MAX_EDGE = 2000;
const QUALITY = 0.9;

export type ConvertedImage = {
  dataUrl: string;
  bytes: number;
  originalBytes: number;
  width: number;
  height: number;
};

const approxBytes = (dataUrl: string) => Math.floor((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);

async function loadBitmap(file: File): Promise<{ width: number; height: number; draw: CanvasImageSource }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return { width: bitmap.width, height: bitmap.height, draw: bitmap };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode failed"));
      el.src = url;
    });
    return { width: img.naturalWidth, height: img.naturalHeight, draw: img };
  } finally {
    // The bitmap is already drawn synchronously by the caller.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

export async function convertToWebp(file: File): Promise<ConvertedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("الملف ليس صورة · The file is not an image");
  }

  const { width, height, draw } = await loadBitmap(file);
  if (!width || !height) throw new Error("تعذّر قراءة الصورة · Could not read the image");

  let scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  let best: ConvertedImage | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("تعذّر معالجة الصورة · Could not process the image");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(draw, 0, 0, w, h);

    const dataUrl = canvas.toDataURL("image/webp", QUALITY);
    if (!dataUrl.startsWith("data:image/webp")) {
      // Very old browsers without WebP encoding: fall back to JPEG at the same quality.
      const jpeg = canvas.toDataURL("image/jpeg", QUALITY);
      best = { dataUrl: jpeg, bytes: approxBytes(jpeg), originalBytes: file.size, width: w, height: h };
      if (best.bytes <= TARGET_BYTES) break;
    } else {
      best = { dataUrl, bytes: approxBytes(dataUrl), originalBytes: file.size, width: w, height: h };
      if (best.bytes <= TARGET_BYTES) break;
    }
    scale *= 0.8;
  }

  if (!best) throw new Error("تعذّر معالجة الصورة · Could not process the image");
  return best;
}

export const formatBytes = (bytes: number) =>
  bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`;
