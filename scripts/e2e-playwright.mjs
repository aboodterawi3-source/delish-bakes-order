import fs from "node:fs";
import path from "node:path";

console.log("================================================================================");
console.log("🎭 PLAYWRIGHT & AXE ACCESSIBILITY AUDIT RUNNER");
console.log("================================================================================\n");

let playwright;
try {
  playwright = await import("playwright-core");
} catch {
  console.log("ℹ️  NOTICE (J7 Audit Resolution):");
  console.log("   playwright-core is not in standard production dependencies.");
  console.log("   To run local headless browser scans, install playwright-core and axe-core:");
  console.log("   npm i --save-dev playwright-core axe-core");
  console.log("   Skipping optional local browser automation cleanly.\n");
  process.exit(0);
}

const { chromium } = playwright;
const CHROME_PATH = process.env.CHROME_BIN || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const TARGET_URL = process.env.TEST_URL || "https://delish-bakes-order.aboodterawi3.workers.dev";

if (!fs.existsSync(CHROME_PATH)) {
  console.log(`ℹ️  Chrome binary not found at "${CHROME_PATH}". Skipping browser audit.`);
  process.exit(0);
}

async function run() {
  console.log("🚀 Launching Chrome via Microsoft Playwright...");
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
  });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log(`🌐 Navigating to ${TARGET_URL}...`);
    await page.goto(TARGET_URL, { waitUntil: "networkidle", timeout: 30000 });

    const title = await page.title();
    console.log(`✅ Page Title: "${title}"`);

    const bodyText = await page.textContent("body");
    console.log(`✅ Content loaded, body length: ${bodyText.length} characters`);

    const axePath = path.resolve("node_modules/axe-core/axe.min.js");
    if (fs.existsSync(axePath)) {
      console.log("🔍 Running axe-core WCAG 2.1 AA accessibility audit...");
      const axeSource = fs.readFileSync(axePath, "utf8");
      await page.evaluate(axeSource);

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
        console.log("⚠️ Accessibility Violations found (logged for review):");
        axeResults.violations.forEach((v, idx) => {
          console.log(` ${idx + 1}. [${v.impact}] ${v.help} (${v.helpUrl})`);
        });
      } else {
        console.log("🎉 0 WCAG AA violations detected on scanned page.");
      }
    } else {
      console.log("ℹ️  axe-core is not present in node_modules. Skipping in-browser WCAG evaluation.");
    }
  } finally {
    await browser.close();
    console.log("🏁 Browser session closed cleanly.");
  }
}

await run();
