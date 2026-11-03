/**
 * High-Performance Image Optimization Module for Delish Cake & Bake
 * Powered by Sharp (https://github.com/lovell/sharp)
 * Compresses customer cake designs and receipts into modern WebP/AVIF formats.
 */

import sharp, { type Metadata } from "sharp";

export interface OptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: "webp" | "avif" | "jpeg" | "png";
}

export interface OptimizationResult {
  data: Buffer;
  format: string;
  width: number;
  height: number;
  sizeBytes: number;
}

/**
 * Optimizes an uploaded cake design or payment receipt image.
 * Resizes preserving aspect ratio and converts to optimized WebP.
 */
export async function optimizeImage(
  inputBuffer: Buffer,
  options: OptimizationOptions = {},
): Promise<OptimizationResult> {
  const { maxWidth = 1200, maxHeight = 1200, quality = 80, format = "webp" } = options;

  let pipeline = sharp(inputBuffer)
    .rotate() // Auto-orient based on EXIF
    .resize({
      width: maxWidth,
      height: maxHeight,
      fit: "inside",
      withoutEnlargement: true,
    });

  if (format === "webp") {
    pipeline = pipeline.webp({ quality, effort: 4 });
  } else if (format === "avif") {
    pipeline = pipeline.avif({ quality, effort: 4 });
  } else if (format === "jpeg") {
    pipeline = pipeline.jpeg({ quality, mozjpeg: true });
  } else if (format === "png") {
    pipeline = pipeline.png({ compressionLevel: 8 });
  }

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

  return {
    data,
    format: info.format,
    width: info.width,
    height: info.height,
    sizeBytes: info.size,
  };
}

/**
 * Generates an ultra-fast square thumbnail for POS and Kitchen order cards.
 */
export async function generateThumbnail(inputBuffer: Buffer, size = 200): Promise<Buffer> {
  return sharp(inputBuffer)
    .resize(size, size, {
      fit: "cover",
      position: "center",
    })
    .webp({ quality: 75 })
    .toBuffer();
}

/**
 * Retrieves metadata for uploaded media (dimensions, format, channels).
 */
export async function getImageMetadata(inputBuffer: Buffer): Promise<Metadata> {
  return sharp(inputBuffer).metadata();
}
