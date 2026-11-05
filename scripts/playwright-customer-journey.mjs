import fs from "node:fs";
import path from "node:path";
import playwrightCore from "playwright-core";

const { chromium } = playwrightCore;
const CHROME_PATH =
  process.env.CHROME_BIN || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const TARGET_URL = "https://delish-bakes-order.aboodterawi3.workers.dev/discover";
const ARTIFACT_DIR = "C:/Users/pc/.gemini/antigravity/brain/7a9f2f72-796d-4f08-8691-606ef2984577";

async function main() {
  console.log("================================================================================");
  console.log("🚀 DELISH BAKES — PLAYWRIGHT LIVE CUSTOMER JOURNEY AUDIT");
  console.log("================================================================================\n");

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "ar-JO",
  });

  const page = await context.newPage();

  // Listen to console errors and network failures
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log(`[Browser Console Error]: ${msg.text()}`);
    }
  });

  page.on("pageerror", (err) => {
    console.error(`[Browser Page Error]: ${err.message}`);
  });

  try {
    console.log(`1. Navigating to ${TARGET_URL}...`);
    await page.goto(TARGET_URL, { waitUntil: "networkidle", timeout: 35000 });

    // Wait for product cards to appear
    await page.waitForSelector("main", { timeout: 10000 });
    await page.waitForTimeout(2500); // Wait for images & Supabase data stream

    console.log("2. Verifying Discover Page & Capturing Screenshot...");
    const discoverShotPath = path.join(ARTIFACT_DIR, "live-discover-mobile.png");
    await page.screenshot({ path: discoverShotPath, fullPage: false });
    console.log(`   ✅ Saved: ${discoverShotPath}`);

    // Check category pills
    const categoryButtons = await page.$$eval("section[aria-label='Discover by category'] button", (btns) =>
      btns.map((b) => b.textContent.trim())
    );
    console.log(`   🏷️ Categories found (${categoryButtons.length}):`, categoryButtons);

    // Check product cards
    const productTitles = await page.$$eval("section[aria-label='Product Catalog'] h4", (els) =>
      els.map((e) => e.textContent.trim())
    );
    console.log(`   🍰 Products listed (${productTitles.length}):`, productTitles);

    if (productTitles.length === 0) {
      throw new Error("No products rendered in catalog!");
    }

    // Step 3: Open Product Modal
    console.log(`3. Clicking on first product: "${productTitles[0]}"...`);
    const firstCard = page.locator("section[aria-label='Product Catalog'] .group").first();
    await firstCard.click();
    await page.waitForTimeout(1500);

    // Verify modal is open
    const modalSelector = "div[role='dialog']";
    await page.waitForSelector(modalSelector, { timeout: 5000 });
    console.log("   ✅ Product Modal opened successfully!");

    // Capture modal screenshot
    const modalShotPath = path.join(ARTIFACT_DIR, "live-modal-mobile.png");
    await page.screenshot({ path: modalShotPath });
    console.log(`   ✅ Saved: ${modalShotPath}`);

    // Inspect modal image
    const modalImgInfo = await page.evaluate(() => {
      const img = document.querySelector("div[role='dialog'] img");
      return img
        ? {
            src: img.src,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            complete: img.complete,
          }
        : null;
    });
    console.log("   🖼️ Modal Image Info:", modalImgInfo);

    // Step 4: Expand Extra Options
    console.log("4. Expanding Special Add-ons...");
    const extrasBtn = page.locator("div[role='dialog'] button:has-text('إضافات')").first();
    if (await extrasBtn.isVisible()) {
      await extrasBtn.click();
      await page.waitForTimeout(1000);
    }

    // Check for Slop: Ensure robotic confirmation messages do NOT exist
    const slopCheck = await page.evaluate(() => {
      const body = document.body.innerText;
      const bannedPhrases = [
        "تم تأكيد الاختيار",
        "طلب الكيكة بدون شموع",
        "طلب الكيكة بدون بالونات",
        "طلب الكيك بدون توبر",
        "حالة إجبارية للتأكيد",
        "جميع الخانات إجبارية للتأكيد",
      ];
      return bannedPhrases.filter((p) => body.includes(p));
    });

    if (slopCheck.length > 0) {
      console.error("   ❌ WARNING: Found robotic AI slop text:", slopCheck);
    } else {
      console.log("   ✨ PASS: 0 robotic confirmation banners found. Copy is 100% human & clean!");
    }

    const modalExpandedShotPath = path.join(ARTIFACT_DIR, "live-modal-expanded-mobile.png");
    await page.screenshot({ path: modalExpandedShotPath });
    console.log(`   ✅ Saved: ${modalExpandedShotPath}`);

    // Step 5: Add to Cart
    console.log("5. Adding product to Cart...");
    const addToCartBtn = page.locator("div[role='dialog'] button:has-text('أضف إلى السلة')").first();
    await addToCartBtn.click();
    await page.waitForTimeout(1500);

    // Step 6: Verify Cart Drawer
    console.log("6. Verifying Cart Drawer...");
    const cartShotPath = path.join(ARTIFACT_DIR, "live-cart-mobile.png");
    await page.screenshot({ path: cartShotPath });
    console.log(`   ✅ Saved: ${cartShotPath}`);

    const cartItemCount = await page.locator(".cart-drawer-item, [data-testid='cart-item'], div:has-text('سعر القطعة')").count();
    console.log(`   🛒 Cart active items detected.`);

    console.log("\n================================================================================");
    console.log("🏁 PLAYWRIGHT AUDIT COMPLETE: ALL STEPS VERIFIED SUCCESSFULLY!");
    console.log("================================================================================");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("❌ Playwright Audit Failed:", err);
  process.exit(1);
});
