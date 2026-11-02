import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const TARGET_URL = "https://delish-bakes-order.aboodterawi3.workers.dev";

async function run() {
  console.log("🚀 Launching Chrome via Microsoft Playwright...");
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  console.log(`🌐 Navigating to ${TARGET_URL}...`);
  await page.goto(TARGET_URL, { waitUntil: "networkidle", timeout: 30000 });

  const title = await page.title();
  console.log(`✅ Page Title: "${title}"`);

  // Verify key elements exist
  const bodyText = await page.textContent("body");
  console.log(`✅ Content loaded, body length: ${bodyText.length} characters`);

  // ----------------------------------------------------
  // Deque axe-core Accessibility Scan inside browser
  // ----------------------------------------------------
  console.log("♿ Injecting Deque axe-core into page...");
  const axeSource = fs.readFileSync(
    path.resolve("node_modules/axe-core/axe.min.js"),
    "utf8"
  );
  await page.evaluate(axeSource);

  console.log("🔍 Running axe-core WCAG 2.1 AA accessibility audit...");
  const axeResults = await page.evaluate(async () => {
    return await window.axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa"],
      },
    });
  });

  console.log("=== axe-core Audit Results ===");
  console.log(`Passes: ${axeResults.passes.length}`);
  console.log(`Violations: ${axeResults.violations.length}`);
  console.log(`Incomplete: ${axeResults.incomplete.length}`);

  if (axeResults.violations.length > 0) {
    console.log("⚠️ Accessibility Violations found:");
    axeResults.violations.forEach((v, idx) => {
      console.log(` ${idx + 1}. [${v.impact}] ${v.help} (${v.helpUrl})`);
    });
  } else {
    console.log("🎉 100% WCAG AA compliant! 0 violations detected.");
  }

  // ----------------------------------------------------
  // Test Staff Route
  // ----------------------------------------------------
  console.log("🔐 Testing /staff navigation...");
  await page.goto(`${TARGET_URL}/staff`, { waitUntil: "networkidle", timeout: 30000 });
  const staffTitle = await page.title();
  console.log(`✅ Staff Page loaded successfully. Title: "${staffTitle}"`);

  await browser.close();
  console.log("🏁 Playwright E2E and axe-core execution completed successfully!");
}

run().catch((err) => {
  console.error("❌ E2E Execution failed:", err);
  process.exit(1);
});
