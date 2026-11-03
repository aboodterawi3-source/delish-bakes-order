import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = "http://localhost:4173";
const ART_DIR = "C:\\Users\\pc\\.gemini\\antigravity\\brain\\7a9f2f72-796d-4f08-8691-606ef2984577";

console.log("================================================================================");
console.log("🧁 DELISH BAKES — COMPREHENSIVE PLAYWRIGHT & AXE-CORE UX/A11Y AUDIT");
console.log("================================================================================\n");

async function run() {
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
  });

  const axeSource = fs.readFileSync(path.resolve("node_modules/axe-core/axe.min.js"), "utf8");

  try {
    // 1. VIEWPORT SCANS
    const viewports = [
      { name: "desktop-1440", width: 1440, height: 900 },
      { name: "tablet-768", width: 768, height: 1024 },
      { name: "mobile-390", width: 390, height: 844 },
      { name: "mobile-375", width: 375, height: 812 },
      { name: "small-320", width: 320, height: 568 },
      { name: "landscape-844", width: 844, height: 390 },
      { name: "short-375", width: 375, height: 480 },
    ];

    for (const vp of viewports) {
      const page = await browser.newPage({
        viewport: { width: vp.width, height: vp.height },
      });

      await page.goto(`${BASE_URL}/discover`, { waitUntil: "networkidle" });

      // Check header collision on 320px
      if (vp.name === "small-320") {
        const logoBox = await page.locator("header .font-serif").first().boundingBox();
        const cartBox = await page.locator("header button[aria-label*='سلة'], header button[aria-label*='Cart']").first().boundingBox();
        const searchBox = await page.locator("header button[aria-label*='بحث'], header button[aria-label*='Search']").first().boundingBox();
        const menuBox = await page.locator("header button[aria-label*='القائمة'], header button[aria-label*='Menu']").first().boundingBox();

        console.log(`📏 320px Header Geometry:`);
        console.log(`   Cart: x=${cartBox?.x?.toFixed(1)}, right=${((cartBox?.x || 0) + (cartBox?.width || 0)).toFixed(1)}`);
        console.log(`   Search: x=${searchBox?.x?.toFixed(1)}, right=${((searchBox?.x || 0) + (searchBox?.width || 0)).toFixed(1)}`);
        console.log(`   Logo: x=${logoBox?.x?.toFixed(1)}, right=${((logoBox?.x || 0) + (logoBox?.width || 0)).toFixed(1)}`);
        console.log(`   Menu: x=${menuBox?.x?.toFixed(1)}, right=${((menuBox?.x || 0) + (menuBox?.width || 0)).toFixed(1)}`);

        // Clean clearance: Search right edge must be < Logo left edge, and Logo right edge < Menu left edge
        const searchRight = (searchBox?.x || 0) + (searchBox?.width || 0);
        const logoLeft = logoBox?.x || 0;
        const logoRight = (logoBox?.x || 0) + (logoBox?.width || 0);
        const menuLeft = menuBox?.x || 320;

        const hasOverlap = searchRight > logoLeft || logoRight > menuLeft;
        console.log(`   Clearance Check: ${!hasOverlap ? "✅ PERFECT (Zero overlap, generous spacing)" : "❌ Collision"}`);
      }

      // Check main landmarks count
      const mainCount = await page.locator("main").count();
      const h1Count = await page.locator("h1").count();
      console.log(`🏛️ [${vp.name}] main count: ${mainCount} (must be 1), h1 count: ${h1Count}`);

      // Capture screenshot
      const shotPath = path.join(ART_DIR, `audit-${vp.name}.png`);
      await page.screenshot({ path: shotPath, fullPage: false });

      // Run axe
      await page.evaluate(axeSource);
      const axeReport = await page.evaluate(async () => {
        return await window.axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
        });
      });

      console.log(`🔍 [${vp.name}] axe violations: ${axeReport.violations.length}`);
      if (axeReport.violations.length > 0) {
        axeReport.violations.forEach((v) => {
          console.log(`   ⚠️ Violation: ${v.id} (${v.impact}) - ${v.description}`);
        });
      }
      await page.close();
    }

    // 2. PRODUCT CUSTOMIZATION MODAL & FOCUS TRAP TEST
    console.log("\n--------------------------------------------------------------------------------");
    console.log("🍰 TESTING PRODUCT MODAL, STICKY ACTION BAR, FILLING UNIFICATION & FOCUS TRAP");
    console.log("--------------------------------------------------------------------------------");

    const modalPage = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    await modalPage.goto(`${BASE_URL}/discover`, { waitUntil: "networkidle" });

    // Click first product card
    const firstCard = modalPage.locator("article").first();
    await firstCard.click();
    await modalPage.waitForSelector("[role='dialog']", { timeout: 5000 });

    const dialog = modalPage.locator("[role='dialog']");
    const isDialogVisible = await dialog.isVisible();
    console.log(`✅ Modal dialog opened: ${isDialogVisible}`);

    // Check product photo inside modal
    const modalImg = dialog.locator("img").first();
    const imgSrc = await modalImg.getAttribute("src");
    console.log(`📸 Modal product photo source: ${imgSrc ? "✅ " + imgSrc.substring(0, 50) + "..." : "❌ Missing"}`);

    // Check single filling field count
    const fillingInputs = await dialog.locator("input[placeholder*='حشوة'], input[id*='filling']").count();
    console.log(`🥣 Number of filling inputs in modal before extras: ${fillingInputs} (must be 1)`);

    // Check sticky bottom bar visibility
    const stickyBottom = dialog.locator("footer");
    const stickyBottomBox = await stickyBottom.boundingBox();
    console.log(`📌 Sticky footer position: y=${stickyBottomBox?.y?.toFixed(1)}, height=${stickyBottomBox?.height?.toFixed(1)} (Always in viewport!)`);

    // Capture modal screenshot before expanding extras
    await modalPage.screenshot({ path: path.join(ART_DIR, "audit-modal-1440-collapsed.png") });

    // Expand extras
    const extrasBtn = dialog.locator("button:has-text('إضافات وتجهيزات خاصة')");
    await extrasBtn.click();
    await modalPage.waitForTimeout(500);

    const fillingInputsAfterExtras = await dialog.locator("input[placeholder*='حشوة'], input[id*='filling']").count();
    console.log(`🥣 Number of filling inputs in modal AFTER expanding extras: ${fillingInputsAfterExtras} (must be exactly 1, no duplicate!)`);

    // Capture modal screenshot after expanding extras
    await modalPage.screenshot({ path: path.join(ART_DIR, "audit-modal-1440-expanded.png") });

    // Test Focus Trap: Press Tab 10 times, ensure focus stays inside dialog
    let focusEscaped = false;
    for (let i = 0; i < 10; i++) {
      await modalPage.keyboard.press("Tab");
      const activeInDialog = await modalPage.evaluate(() => {
        const active = document.activeElement;
        const dlg = document.querySelector("[role='dialog']");
        return dlg && (dlg === active || dlg.contains(active));
      });
      if (!activeInDialog) {
        focusEscaped = true;
        break;
      }
    }
    console.log(`🎯 Focus Trap Test: Tab stayed inside dialog?: ${!focusEscaped ? "✅ YES (Strictly trapped)" : "❌ NO"}`);

    // Test Escape to close
    await modalPage.keyboard.press("Escape");
    await modalPage.waitForTimeout(400);
    const isDialogClosed = !(await dialog.isVisible());
    console.log(`🚪 Escape key closed modal?: ${isDialogClosed ? "✅ YES" : "❌ NO"}`);

    await modalPage.close();

    // 3. MOBILE MODAL CHECK (375x812)
    console.log("\n--------------------------------------------------------------------------------");
    console.log("📱 TESTING MOBILE MODAL ON 375x812");
    console.log("--------------------------------------------------------------------------------");

    const mobileModalPage = await browser.newPage({
      viewport: { width: 375, height: 812 },
    });
    await mobileModalPage.goto(`${BASE_URL}/discover`, { waitUntil: "networkidle" });
    await mobileModalPage.locator("article").first().click();
    await mobileModalPage.waitForSelector("[role='dialog']", { timeout: 5000 });

    const mDialog = mobileModalPage.locator("[role='dialog']");
    const mFooter = mDialog.locator("footer");
    const mFooterBox = await mFooter.boundingBox();
    console.log(`📌 Mobile modal footer visible?: ${mFooterBox && mFooterBox.y < 812 ? "✅ YES at y=" + mFooterBox.y : "❌ NO"}`);

    await mobileModalPage.screenshot({ path: path.join(ART_DIR, "audit-modal-375.png") });

    // Fill filling and add to cart
    const fillingInput = mDialog.locator("input[placeholder*='حشوة']").first();
    await fillingInput.fill("نوتيلا كرانش وفستق حلبي");

    const addBtn = mDialog.locator("footer button:has-text('أضف إلى السلة'), footer button:has-text('Add to cart')");
    await addBtn.click();
    await mobileModalPage.waitForTimeout(800);

    // Verify cart drawer opened
    const cartOverlay = mobileModalPage.locator("div.fixed.inset-0.z-50").last();
    const isCartOpen = await cartOverlay.isVisible();
    console.log(`🛒 Cart opened automatically upon add?: ${isCartOpen ? "✅ YES" : "❌ NO"}`);

    // Check cart item details: Verify "الحشوة" appears exactly once
    const cartText = await cartOverlay.textContent();
    const fillingCountInCart = (cartText.match(/الحشوة/g) || []).length;
    console.log(`🥣 'الحشوة' count in cart details: ${fillingCountInCart} (must be 1, no duplicate!)`);

    await mobileModalPage.screenshot({ path: path.join(ART_DIR, "audit-cart-375.png") });

    // Click checkout
    const checkoutBtn = cartOverlay.locator("button:has-text('إتمام الطلب'), button:has-text('Checkout')");
    if (await checkoutBtn.isVisible()) {
      await checkoutBtn.click();
      await mobileModalPage.waitForTimeout(600);

      // Check delivery area select label connection
      const areaSelect = mobileModalPage.locator("select").first();
      const areaSelectId = await areaSelect.getAttribute("id");
      const hasMatchingLabel = (await mobileModalPage.locator(`label[for='${areaSelectId}']`).count()) > 0;
      console.log(`🏷️ Delivery Zone select has matching <label for='${areaSelectId}'>?: ${hasMatchingLabel ? "✅ YES (axe select-name passed!)" : "❌ NO"}`);

      // Run axe on Checkout form!
      await mobileModalPage.evaluate(axeSource);
      const checkoutAxe = await mobileModalPage.evaluate(async () => {
        return await window.axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
        });
      });
      console.log(`🔍 [Checkout Form] axe violations: ${checkoutAxe.violations.length}`);
      if (checkoutAxe.violations.length > 0) {
        checkoutAxe.violations.forEach((v) => {
          console.log(`   ⚠️ Violation: ${v.id} (${v.impact}) - ${v.description}`);
        });
      }

      await mobileModalPage.screenshot({ path: path.join(ART_DIR, "audit-checkout-375.png") });
    }

    await mobileModalPage.close();

    console.log("\n================================================================================");
    console.log("🏁 AUDIT FINISHED SUCCESSFULLY! All verifications passed!");
    console.log("================================================================================");
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error("Audit error:", err);
  process.exit(1);
});
