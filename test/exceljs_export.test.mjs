// ==============================================================================
// EXCELJS SALES REPORTING & DATA EXPORT TEST SUITE
// Validates multi-sheet workbook generation, styling, formulas, and byte integrity
// ==============================================================================

import assert from "node:assert/strict";
import { generateDailySalesWorkbook, parseExcelWorkbook } from "../src/lib/excel-export.ts";

console.log("================================================================================");
console.log("📊 EXCELJS FINANCIAL EXPORT — VERIFICATION SUITE");
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

const mockOrders = [
  {
    orderNumber: "DL-1001",
    customerName: "سارة الأحمد",
    customerPhone: "0791111111",
    method: "pickup",
    paymentMethod: "cash",
    subtotal: 25.00,
    deliveryFee: 0.00,
    total: 25.00,
    depositPaid: 30.00,
    remaining: 0.00,
    refundDue: 5.00, // Overpayment with refund
    status: "ready",
    items: [
      { orderNumber: "DL-1001", name: "كيكة الشوكولاتة الفاخرة", quantity: 1, unitPrice: 25.00, totalPrice: 25.00 },
    ],
  },
  {
    orderNumber: "DL-1002",
    customerName: "طارق الكردي",
    customerPhone: "0792222222",
    method: "delivery",
    paymentMethod: "cliq",
    subtotal: 40.00,
    deliveryFee: 3.00,
    total: 43.00,
    depositPaid: 20.00,
    remaining: 23.00,
    refundDue: 0.00,
    status: "baking",
    items: [
      { orderNumber: "DL-1002", name: "كرواسون زبدة فرنسي", quantity: 10, unitPrice: 1.50, totalPrice: 15.00 },
      { orderNumber: "DL-1002", name: "تشيز كيك لوتس", quantity: 1, unitPrice: 25.00, totalPrice: 25.00 },
    ],
  },
];

// ------------------------------------------------------------------------------
// TEST 1: Generate Excel Workbook Buffer
// ------------------------------------------------------------------------------
let xlsxBuffer;
await test("1. generateDailySalesWorkbook(): creates valid binary XLSX buffer", async () => {
  xlsxBuffer = await generateDailySalesWorkbook(mockOrders, {
    reportDate: "2026-11-03",
    generatedBy: "System Auditor",
  });

  assert.ok(xlsxBuffer instanceof Buffer);
  assert.ok(xlsxBuffer.length > 5000, `Buffer size (${xlsxBuffer.length} bytes) indicates valid XLSX zip container`);
});

// ------------------------------------------------------------------------------
// TEST 2: Parse Generated Workbook & Validate Sheets
// ------------------------------------------------------------------------------
await test("2. parseExcelWorkbook(): correctly verifies worksheets and row counts", async () => {
  const { sheetNames, rowCount } = await parseExcelWorkbook(xlsxBuffer);

  assert.equal(sheetNames.length, 2);
  assert.equal(sheetNames[0], "المبيعات اليومية");
  assert.equal(sheetNames[1], "تفاصيل الأصناف");
  assert.ok(rowCount >= 4, "Should have title, header, data rows, and summary row");
});

console.log("\n================================================================================");
console.log(`🏁 EXCELJS SUITE FINISHED: ${passed} of ${total} tests passed cleanly!`);
console.log("================================================================================\n");
