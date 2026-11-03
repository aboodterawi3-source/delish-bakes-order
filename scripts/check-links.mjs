// ==============================================================================
// LINKINATOR — LIVE STOREFRONT & ASSETS LINK CRAWLER
// https://github.com/JustinBeckwith/linkinator
// Scans storefront pages, scripts, styles, and images for broken links (404/500)
// ==============================================================================

import { LinkChecker } from "linkinator";
import assert from "node:assert/strict";

console.log("================================================================================");
console.log("🔗 LINKINATOR — LIVE STOREFRONT LINK & ASSET INTEGRITY SCANNER");
console.log("================================================================================\n");

const targetUrl = process.env.STOREFRONT_URL || "https://delish-bakes-order.aboodterawi3.workers.dev";
console.log(`  🎯 Target Base URL: ${targetUrl}\n`);

const checker = new LinkChecker();

checker.on("pagestart", (url) => {
  console.log(`  🔎 Crawling: ${url}`);
});

checker.on("link", (result) => {
  const icon = result.state === "OK" ? "✅" : result.state === "SKIPPED" ? "⏭️" : "❌";
  console.log(`    ${icon} [${result.status || result.state}] ${result.url}`);
});

const result = await checker.check({
  path: targetUrl,
  recurse: false, // Scan all links referenced on the home storefront
  timeout: 10000,
  concurrency: 5,
  linksToSkip: [
    "^mailto:",
    "^tel:",
    "^javascript:",
    "instagram.com",
    "facebook.com",
    "wa.me",
    "api.whatsapp.com",
    "fonts.googleapis.com",
    "fonts.gstatic.com"
  ],
});

const passed = result.links.filter((l) => l.state === "OK");
const broken = result.links.filter((l) => l.state === "BROKEN");
const skipped = result.links.filter((l) => l.state === "SKIPPED");

console.log("\n================================================================================");
console.log(`📊 LINKINATOR SCAN SUMMARY:`);
console.log(`   Total Links Scanned: ${result.links.length}`);
console.log(`   Passed (OK): ${passed.length}`);
console.log(`   Broken: ${broken.length}`);
console.log(`   Skipped (External Social): ${skipped.length}`);
console.log("================================================================================\n");

if (broken.length > 0) {
  console.error("❌ Broken links detected:");
  for (const b of broken) {
    console.error(`   - [${b.status}] ${b.url} (Parent: ${b.parent})`);
  }
}

assert.equal(broken.length, 0, `Expected 0 broken links on live storefront, found ${broken.length}`);
console.log("  🎉 All storefront navigation links and assets are intact and healthy!\n");
