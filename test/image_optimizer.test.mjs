// ==============================================================================
// SHARP IMAGE OPTIMIZATION TEST SUITE
// Validates resizing, WebP conversion, thumbnail generation, and metadata extraction
// ==============================================================================

import assert from "node:assert/strict";
import sharp from "sharp";
import { optimizeImage, generateThumbnail, getImageMetadata } from "../src/lib/image-optimizer.ts";

console.log("================================================================================");
console.log("🖼️  SHARP IMAGE OPTIMIZER — VERIFICATION SUITE");
console.log("================================================================================\n");

let passed = 0;
let total = 0;

async function test(name, fn) {
  total++;
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// Generate an in-memory sample high-res test image (1600x1200 SVG cake graphic)
const testSvg = `
<svg width="1600" height="1200" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#fff0f5"/>
  <circle cx="800" cy="600" r="400" fill="#e75480"/>
  <text x="800" y="620" font-size="70" font-family="Arial" text-anchor="middle" fill="#ffffff">Delish Cake</text>
</svg>
`;
const originalPngBuffer = await sharp(Buffer.from(testSvg)).png().toBuffer();

// ------------------------------------------------------------------------------
// TEST 1: Image Metadata Inspection
// ------------------------------------------------------------------------------
await test("1. getImageMetadata(): accurately reads dimensions and format", async () => {
  const meta = await getImageMetadata(originalPngBuffer);
  assert.equal(meta.width, 1600);
  assert.equal(meta.height, 1200);
  assert.equal(meta.format, "png");
});

// ------------------------------------------------------------------------------
// TEST 2: High-Resolution Optimization to WebP
// ------------------------------------------------------------------------------
await test("2. optimizeImage(): downscales to max bounds and encodes to WebP", async () => {
  const optimized = await optimizeImage(originalPngBuffer, {
    maxWidth: 800,
    maxHeight: 800,
    quality: 85,
    format: "webp",
  });

  assert.equal(optimized.format, "webp");
  assert.equal(optimized.width, 800);
  assert.equal(optimized.height, 600); // Maintained 4:3 ratio
  assert.ok(
    optimized.sizeBytes < originalPngBuffer.length,
    "Optimized WebP must be smaller than original PNG",
  );
});

// ------------------------------------------------------------------------------
// TEST 3: Thumbnail Generation
// ------------------------------------------------------------------------------
await test("3. generateThumbnail(): crops to square thumbnail (200x200)", async () => {
  const thumbBuffer = await generateThumbnail(originalPngBuffer, 200);
  const thumbMeta = await sharp(thumbBuffer).metadata();

  assert.equal(thumbMeta.width, 200);
  assert.equal(thumbMeta.height, 200);
  assert.equal(thumbMeta.format, "webp");
});

console.log("\n================================================================================");
console.log(`🏁 SHARP SUITE FINISHED: ${passed} of ${total} tests passed cleanly!`);
console.log("================================================================================\n");
