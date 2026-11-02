// ==============================================================================
// REACT-I18NEXT LOCALIZATION TEST SUITE
// Validates Arabic RTL default, English translations, and language switching
// ==============================================================================

import assert from "node:assert/strict";
import i18n from "../src/lib/i18n-client.ts";

console.log("================================================================================");
console.log("🌐 REACT-I18NEXT LOCALIZATION — VERIFICATION SUITE");
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
// TEST 1: Default Arabic Language & Key Translation
// ------------------------------------------------------------------------------
await test("1. i18n initializes with Arabic ('ar') as default language", () => {
  assert.equal(i18n.language, "ar");
  const heroTitle = i18n.t("heroTitle");
  assert.equal(heroTitle, "كل قطمة، لحظة فرح");
  assert.equal(i18n.t("cartTitle"), "سلة الطلبات");
});

// ------------------------------------------------------------------------------
// TEST 2: Dynamic Language Switching to English ('en')
// ------------------------------------------------------------------------------
await test("2. i18n switches to English and resolves English catalog", async () => {
  await i18n.changeLanguage("en");
  assert.equal(i18n.language, "en");
  assert.equal(i18n.t("heroTitle"), "Every bite, a little celebration");
  assert.equal(i18n.t("cartTitle"), "Shopping Cart");

  // Restore Arabic
  await i18n.changeLanguage("ar");
  assert.equal(i18n.language, "ar");
});

// ------------------------------------------------------------------------------
// TEST 3: Fallback Behavior for Missing Keys
// ------------------------------------------------------------------------------
await test("3. Missing key gracefully returns requested key string", () => {
  const missing = i18n.t("nonExistentKey");
  assert.equal(missing, "nonExistentKey");
});

console.log("\n================================================================================");
console.log(`🏁 I18NEXT SUITE FINISHED: ${passed} of ${total} tests passed cleanly!`);
console.log("================================================================================\n");
