/**
 * Excel Reporting & Data Export Module for Delish Cake & Bake
 * Powered by ExcelJS (https://github.com/exceljs/exceljs)
 * Generates formatted, styled, formula-driven financial workbooks for bakery staff & management.
 */

import ExcelJS from "exceljs";

export interface ExportOrderItem {
  orderNumber: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ExportOrder {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  method: "pickup" | "delivery";
  paymentMethod: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  depositPaid: number;
  remaining: number;
  refundDue: number;
  status: string;
  items: ExportOrderItem[];
}

export interface ReportMetadata {
  reportDate: string;
  generatedBy: string;
}

/**
 * Generates a professionally formatted multi-sheet Excel workbook.
 */
export async function generateDailySalesWorkbook(
  orders: ExportOrder[],
  meta: ReportMetadata
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Delish Cake & Bake Accounting";
  workbook.lastModifiedBy = meta.generatedBy;
  workbook.created = new Date();

  // ----------------------------------------------------------------------------
  // SHEET 1: Daily Sales & Financial Reconciliation
  // ----------------------------------------------------------------------------
  const sheet1 = workbook.addWorksheet("المبيعات اليومية", {
    views: [{ rightToLeft: true }], // RTL for Arabic
  });

  // Title Banner
  sheet1.mergeCells("A1:L1");
  const titleCell = sheet1.getCell("A1");
  titleCell.value = `تقرير مبيعات ديليش آند بيك — تاريخ: ${meta.reportDate}`;
  titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2E7D32" }, // Forest Green
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet1.getRow(1).height = 32;

  // Table Headers
  const headers = [
    "رقم الطلب",
    "اسم العميل",
    "الهاتف",
    "الاستلام",
    "طريقة الدفع",
    "المجموع الفرعي",
    "التوصيل",
    "الإجمالي",
    "المدفوع",
    "المتبقي للدفع",
    "مسترجع للعميل",
    "حالة الطلب",
  ];

  const headerRow = sheet1.addRow(headers);
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF374151" }, // Slate Gray
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  // Populate Order Rows
  const startRow = 3;
  orders.forEach((o) => {
    const row = sheet1.addRow([
      o.orderNumber,
      o.customerName,
      o.customerPhone,
      o.method === "delivery" ? "توصيل" : "استلام",
      o.paymentMethod,
      o.subtotal,
      o.deliveryFee,
      o.total,
      o.depositPaid,
      o.remaining,
      o.refundDue,
      o.status,
    ]);

    // Format financial currency columns (Cols F to K)
    [6, 7, 8, 9, 10, 11].forEach((colIdx) => {
      const cell = row.getCell(colIdx);
      cell.numFmt = '#,##0.00 "د.أ"';
    });

    // Highlight overpayment/refund in soft red
    if (o.refundDue > 0) {
      const refundCell = row.getCell(11);
      refundCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFEBEE" }, // Soft Red
      };
      refundCell.font = { bold: true, color: { argb: "FFC62828" } };
    }
  });

  const endRow = startRow + orders.length - 1;

  // Add Summary Totals Row with Formulas
  if (orders.length > 0) {
    const totalRow = sheet1.addRow([
      "المجموع الكلي",
      "",
      "",
      "",
      "",
      { formula: `SUM(F${startRow}:F${endRow})` },
      { formula: `SUM(G${startRow}:G${endRow})` },
      { formula: `SUM(H${startRow}:H${endRow})` },
      { formula: `SUM(I${startRow}:I${endRow})` },
      { formula: `SUM(J${startRow}:J${endRow})` },
      { formula: `SUM(K${startRow}:K${endRow})` },
      "",
    ]);

    totalRow.height = 24;
    totalRow.eachCell((cell, colIdx) => {
      cell.font = { name: "Arial", size: 10, bold: true };
      if (colIdx >= 6 && colIdx <= 11) {
        cell.numFmt = '#,##0.00 "د.أ"';
      }
    });
  }

  // Auto-fit column widths
  sheet1.columns.forEach((column) => {
    column.width = 16;
  });

  // ----------------------------------------------------------------------------
  // SHEET 2: Order Items Breakdown
  // ----------------------------------------------------------------------------
  const sheet2 = workbook.addWorksheet("تفاصيل الأصناف", {
    views: [{ rightToLeft: true }],
  });

  const itemHeaders = ["رقم الطلب", "الصنف / الكيكة", "الكمية", "سعر الوحدة", "الإجمالي"];
  const itemHeaderRow = sheet2.addRow(itemHeaders);
  itemHeaderRow.height = 22;
  itemHeaderRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4B5563" } };
    cell.alignment = { horizontal: "center" };
  });

  orders.forEach((o) => {
    o.items.forEach((it) => {
      const row = sheet2.addRow([
        o.orderNumber,
        it.name,
        it.quantity,
        it.unitPrice,
        it.totalPrice,
      ]);
      row.getCell(4).numFmt = '#,##0.00 "د.أ"';
      row.getCell(5).numFmt = '#,##0.00 "د.أ"';
    });
  });

  sheet2.columns.forEach((column) => {
    column.width = 20;
  });

  const rawBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(rawBuffer);
}

/**
 * Reads and parses an uploaded Excel sales workbook.
 */
export async function parseExcelWorkbook(buffer: Buffer): Promise<{ sheetNames: string[]; rowCount: number }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const sheetNames = workbook.worksheets.map((ws) => ws.name);
  const rowCount = workbook.worksheets[0]?.rowCount || 0;
  return { sheetNames, rowCount };
}
