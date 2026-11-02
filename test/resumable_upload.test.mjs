// ==============================================================================
// TUS RESUMABLE UPLOAD TEST SUITE
// Validates tus-js-client configuration, endpoint generation, and progress triggers
// ==============================================================================

import assert from "node:assert/strict";
import { createResumableUpload } from "../src/lib/resumable-upload.ts";

console.log("================================================================================");
console.log("📤 TUS-JS-CLIENT RESUMABLE UPLOADS — VERIFICATION SUITE");
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

// ------------------------------------------------------------------------------
// TEST 1: TUS Upload Instance Construction & Supabase Headers
// ------------------------------------------------------------------------------
await test("1. createResumableUpload(): properly configures TUS headers & 6MB chunks", () => {
  const dummyBuffer = Buffer.from("Delish Cake Custom Design File Mock Data");

  const upload = createResumableUpload({
    supabaseUrl: "https://xyz.supabase.co",
    supabaseAnonKey: "mock-anon-key-12345",
    bucketName: "designs",
    fileName: "custom-wedding-cake.webp",
    file: dummyBuffer,
    onProgress: (up, tot, pct) => {},
    onSuccess: (url) => {},
  });

  assert.ok(upload, "Upload instance must be created");
  assert.equal(upload.options.endpoint, "https://xyz.supabase.co/storage/v1/upload/resumable");
  assert.equal(upload.options.headers.apikey, "mock-anon-key-12345");
  assert.equal(upload.options.headers.authorization, "Bearer mock-anon-key-12345");
  assert.equal(upload.options.chunkSize, 6 * 1024 * 1024);
  assert.equal(upload.options.metadata.bucketName, "designs");
  assert.equal(upload.options.metadata.objectName, "custom-wedding-cake.webp");
});

// ------------------------------------------------------------------------------
// TEST 2: Progress Callback & Percentage Calculation
// ------------------------------------------------------------------------------
await test("2. onProgress callback correctly calculates integer percentage", () => {
  let reportedPercent = 0;
  const upload = createResumableUpload({
    supabaseUrl: "https://xyz.supabase.co",
    supabaseAnonKey: "mock-key",
    bucketName: "designs",
    fileName: "cake.webp",
    file: Buffer.from("test"),
    onProgress: (up, tot, pct) => {
      reportedPercent = pct;
    },
  });

  upload.options.onProgress(2500, 10000);
  assert.equal(reportedPercent, 25, "Percentage should be 25%");

  upload.options.onProgress(10000, 10000);
  assert.equal(reportedPercent, 100, "Percentage should be 100%");
});

console.log("\n================================================================================");
console.log(`🏁 TUS RESUMABLE SUITE FINISHED: ${passed} of ${total} tests passed cleanly!`);
console.log("================================================================================\n");
