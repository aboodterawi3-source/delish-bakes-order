// ==============================================================================
// DELISH CAKE & BAKE — ACCEPTANCE HARDENING & BUSINESS LOGIC TEST SUITE
// Automated verification calling actual project code units directly:
// - calculateFinancials & buildConfirmationMessage (src/lib/confirmation-message.ts)
// - assertRole (src/lib/role-guard.ts)
// - normalizeUsername & usernameToEmail (src/lib/username.ts)
// ==============================================================================

import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateFinancials, buildConfirmationMessage } from "../src/lib/confirmation-message.ts";
import { assertRole } from "../src/lib/role-guard.ts";
import { normalizeUsername, usernameToEmail, emailToUsername } from "../src/lib/username.ts";
import {
  buildCmsProductWritePayload,
  isValidStorageUrl,
  isValidUuid,
  listAllAuthUsers,
  serializeValidStorageUrls,
  timingSafeEqualString,
} from "../src/lib/server-shared.ts";
import {
  applyDiscountToCachedOrder,
  computeCartSubmissionFingerprint,
  computeUnackModKey,
  reconcileOrderDrawerFields,
} from "../src/lib/order-modifications.ts";
import {
  extractLineInscription,
  isOfficialCatalogPrice,
  mergeModalSpecExtras,
} from "../src/lib/order-pricing.ts";
import {
  aggregateAdminCustomerAndAgentStats,
  aggregateShiftReport,
  validateSocialOrderScheduleAndQuantity,
} from "../src/lib/validators.ts";
import { sanitizeStaffRpcError } from "../src/lib/server-log.ts";

// ------------------------------------------------------------------------------
// TEST 1: Financial Precision & Refund-Due Logic via calculateFinancials()
// ------------------------------------------------------------------------------
await test("1. calculateFinancials(): correctly computes refund due when paid exceeds total (25 JD on 20 JD)", () => {
  const fin = calculateFinancials(20.0, 25.0);

  assert.equal(fin.total, 20.0);
  assert.equal(fin.paid, 25.0);
  assert.equal(fin.remaining, 0, "Remaining balance must be 0 when overpaid");
  assert.equal(fin.refundDue, 5.0, "Refund due must be exactly 5.00 JD");
  assert.equal(fin.isOverpaid, true, "isOverpaid must be true");
  assert.equal(
    fin.isFullyPaid,
    false,
    "Overpaid order requires refund action before settling as standard fully paid",
  );
});

await test("2. calculateFinancials(): partial deposit (10 JD on 35 JD) leaves 25 JD remaining and 0 refund due", () => {
  const fin = calculateFinancials(35.0, 10.0);

  assert.equal(fin.remaining, 25.0, "Remaining balance must be 25.00 JD");
  assert.equal(fin.refundDue, 0, "Refund due must be 0");
  assert.equal(fin.isOverpaid, false, "isOverpaid must be false");
  assert.equal(fin.isFullyPaid, false, "Partially paid order is not fully paid");
});

await test("3. calculateFinancials(): exact payment (30 JD on 30 JD) settles fully with 0 balance and 0 refund due", () => {
  const fin = calculateFinancials(30.0, 30.0);

  assert.equal(fin.remaining, 0);
  assert.equal(fin.refundDue, 0);
  assert.equal(fin.isOverpaid, false);
  assert.equal(fin.isFullyPaid, true);
});

// ------------------------------------------------------------------------------
// TEST 2: Confirmation Message Generator via buildConfirmationMessage()
// ------------------------------------------------------------------------------
await test("4. buildConfirmationMessage(): includes prominent refund-due line when customer overpays", () => {
  const msg = buildConfirmationMessage({
    orderNumber: "DL-1040",
    customerName: "فرح حداد",
    when: "اليوم 05:00 م",
    fulfilment: "استلام من المحل",
    items: ["كيكة الشوكولاتة والكراميل الفاخرة"],
    cakeWriting: "Happy Birthday",
    cardWriting: "",
    notes: "",
    price: 20.0,
    deliveryFee: 0,
    total: 20.0,
    paid: 25.0,
    paymentMethod: "cliq",
  });

  assert.ok(
    msg.includes("🔄 مبلغ مستحق الإرجاع للزبون: 5.00 د.أ") || msg.includes("مستحق الإرجاع"),
    "WhatsApp message must explicitly declare the 5.00 JD refund due",
  );
  assert.ok(
    !msg.includes("المبلغ المتبقي: 0.00 د.أ (مسدد بالكامل ✅)"),
    "Must not mask an overpayment as regular full settlement without refund notice",
  );
});

// ------------------------------------------------------------------------------
// TEST 3: Role Guard Logic via assertRole()
// ------------------------------------------------------------------------------
await test("5. assertRole(): validates allowed roles and strictly rejects unauthorized access", async () => {
  const mockKitchenContext = {
    userId: "user-kitchen-uuid",
    supabase: {
      from: (table) => ({
        select: () => ({
          eq: () => Promise.resolve({ data: [{ role: "kitchen" }], error: null }),
        }),
      }),
    },
  };

  // Kitchen attempting sales role action
  await assert.rejects(
    () => assertRole(mockKitchenContext, ["sales", "admin"]),
    /غير مصرّح · Not authorised/,
    "Kitchen role must be rejected from sales actions",
  );

  // Kitchen attempting kitchen role action
  await assert.doesNotReject(
    () => assertRole(mockKitchenContext, ["kitchen", "admin"]),
    "Kitchen role must be accepted for kitchen actions",
  );
});

// ------------------------------------------------------------------------------
// TEST 4: Staff Username & Email Normalization via usernameToEmail()
// ------------------------------------------------------------------------------
await test("6. usernameToEmail(): normalizes staff name to internal delish.local domain for auth", () => {
  assert.equal(usernameToEmail("admin"), "admin@delish.local");
  assert.equal(usernameToEmail("Ahmad Chef"), "ahmad.chef@delish.local");
  assert.equal(emailToUsername("admin@delish.local"), "admin");
  assert.equal(emailToUsername("tariq.kds@delish.local"), "tariq.kds");
});

// ------------------------------------------------------------------------------
// TEST 5: Security Hardening Helpers (Constant-Time Compare, UUID, Storage Origin, Pagination)
// ------------------------------------------------------------------------------
await test("7. timingSafeEqualString() & isValidUuid() & serializeValidStorageUrls(): enforce strict security boundaries", async () => {
  assert.equal(timingSafeEqualString("secret-token-123", "secret-token-123"), true);
  assert.equal(timingSafeEqualString("secret-token-123", "secret-token-124"), false);
  assert.equal(timingSafeEqualString("short", "longer-secret"), false);
  assert.equal(timingSafeEqualString(null, "secret"), false);

  assert.equal(isValidUuid("00000000-4000-4000-8000-000000000001"), true);
  assert.equal(isValidUuid("00000000-4000-4000-8000-000000000001,staff_code.eq.1"), false);

  // Foreign storage host must be rejected when allowAnyStorageHost = false
  const foreignUrl =
    "https://evil-tracker.example.com/storage/v1/object/public/order-designs/x.webp";
  assert.equal(isValidStorageUrl(foreignUrl), false);
  assert.equal(serializeValidStorageUrls(foreignUrl, false, 10), null);

  // Paginated listAllAuthUsers fetches beyond page 1
  const mockSupabaseAdmin = {
    auth: {
      admin: {
        listUsers: async ({ page, perPage }) => {
          if (page === 1) {
            return {
              data: {
                users: Array.from({ length: perPage }, (_, i) => ({ id: `u-${i}` })),
              },
              error: null,
            };
          }
          return { data: { users: [{ id: "u-extra" }] }, error: null };
        },
      },
    },
  };
  const { users, error } = await listAllAuthUsers(mockSupabaseAdmin, 5, 200);
  assert.equal(error, null);
  assert.equal(users.length, 201);
});

// ------------------------------------------------------------------------------
// TEST 6: Storefront Spec Extras, Official Size Prices, and KDS Unack Key (Fixes 1, 2, 6)
// ------------------------------------------------------------------------------
await test("8. mergeModalSpecExtras(), extractLineInscription(), isOfficialCatalogPrice() & computeUnackModKey()", () => {
  const merged = mergeModalSpecExtras({
    flavor: "CHOCOLATE",
    filling: "وصفة الشيف الأصلية",
    customizationFilling: "نوتيلا بلجيكية",
    inscription: "كل عام وأنت بخير",
    extrasAr: ["الحشوة: نوتيلا بلجيكية", "شموع: 25"],
    extrasEn: ["Filling: نوتيلا بلجيكية", "Candles: 25"],
  });
  assert.deepEqual(merged.extrasAr, [
    "النكهة: CHOCOLATE",
    "الحشوة: نوتيلا بلجيكية",
    "الكتابة: كل عام وأنت بخير",
    "شموع: 25",
  ]);
  assert.equal(
    extractLineInscription({ ar: merged.extrasAr, en: merged.extrasEn }),
    "كل عام وأنت بخير",
  );

  const productWithSizes = {
    price: 18,
    sizes: [
      { label: "صغير", price: 18 },
      { label: "وسط", price: 25 },
      { label: "كبير", price: 35 },
    ],
  };
  assert.equal(isOfficialCatalogPrice(18, productWithSizes), true);
  assert.equal(isOfficialCatalogPrice(25, productWithSizes), true);
  assert.equal(isOfficialCatalogPrice(35, productWithSizes), true);
  assert.equal(isOfficialCatalogPrice(22, productWithSizes), false);

  const orderWithMod = {
    version: 3,
    modifications: [
      {
        id: "mod-1",
        field: "الحشوة",
        oldValue: "فانيلا",
        newValue: "فستق حلبي",
        updatedAt: "2026-11-15T15:00:00.000Z",
        acknowledgedAt: null,
      },
    ],
  };
  assert.equal(computeUnackModKey(orderWithMod), "3_mod-1_2026-11-15T15:00:00.000Z");
});

await test("9. Pure bug-fix helpers: OCC version update on discount, CMS slug preservation, cart fingerprint, admin >250 aggregation & social validation", () => {
  // 1) Discount cache update must advance version
  const patchedOrder = applyDiscountToCachedOrder(
    { id: "o-1", subtotal: 50, delivery_fee: 3, method: "delivery", version: 2 },
    { discount_amount: 5, discount_percent: 10, version: 3 },
  );
  assert.equal(patchedOrder.total, 48);
  assert.equal(patchedOrder.version, 3);

  const patchedOrderFallback = applyDiscountToCachedOrder(
    { id: "o-2", subtotal: 40, delivery_fee: 3, method: "pickup", version: 4 },
    { discount_amount: 4, discount_percent: 10, version: null },
  );
  assert.equal(patchedOrderFallback.total, 36);
  assert.equal(patchedOrderFallback.version, 5);

  // 2) CMS update omits slug while insert retains it
  const insertPayload = buildCmsProductWritePayload({
    id: null,
    slug: "chocolate-cake",
    row: { name_en: "Chocolate Cake", price: 20 },
  });
  assert.equal(insertPayload.slug, "chocolate-cake");
  const updatePayload = buildCmsProductWritePayload({
    id: "prod-1",
    slug: "chocolate-cake-renamed",
    row: { name_en: "Chocolate Cake Renamed", price: 22 },
  });
  assert.equal("slug" in updatePayload, false);

  // 3) Cart fingerprint changes on cart/delivery edit
  const fpA = computeCartSubmissionFingerprint({
    lines: [{ key: "cms:1", qty: 1 }],
    method: "delivery",
    area: "عبدون",
    date: "2026-11-20",
    time: "14:00",
    pay: "cash",
    name: "سارة",
    phone: "0791234567",
    address: "شارع 1",
    notes: "",
  });
  const fpB = computeCartSubmissionFingerprint({
    lines: [{ key: "cms:1", qty: 2 }],
    method: "delivery",
    area: "عبدون",
    date: "2026-11-20",
    time: "14:00",
    pay: "cash",
    name: "سارة",
    phone: "0791234567",
    address: "شارع 1",
    notes: "",
  });
  assert.notEqual(fpA, fpB);

  // 4) Admin stats aggregate across >250 completed rows without truncation
  const sampleRows = Array.from({ length: 300 }, (_, i) => ({
    customer_phone: i < 260 ? "0790000001" : "0790000002",
    customer_name: "Customer",
    total: 10,
    created_at: `2026-11-15T10:${String(i % 60).padStart(2, "0")}:00Z`,
    created_by: "agent-1",
    status: "completed",
  }));
  sampleRows.push({
    customer_phone: "0799999999",
    customer_name: "Cancelled",
    total: 100,
    created_at: "2026-11-15T12:00:00Z",
    created_by: "agent-1",
    status: "cancelled",
  });
  const stats = aggregateAdminCustomerAndAgentStats(sampleRows);
  assert.equal(stats.customerMap.get("0790000001")?.orders, 260);
  assert.equal(stats.customerMap.get("0790000002")?.orders, 40);
  assert.equal(stats.customerMap.has("0799999999"), false);
  assert.equal(stats.agentMap.get("agent-1")?.orders, 300);
  assert.equal(stats.agentMap.get("agent-1")?.volume, 3000);

  // 5) Social order quantity / date / time validation
  assert.doesNotThrow(() =>
    validateSocialOrderScheduleAndQuantity({
      requested_date: "2026-11-20",
      requested_time: "14:30",
      quantity: 2,
    }),
  );
  assert.throws(() =>
    validateSocialOrderScheduleAndQuantity({
      requested_date: "2026-11-20",
      requested_time: "14:30",
      quantity: 1.5,
    }),
  );
  assert.throws(() =>
    validateSocialOrderScheduleAndQuantity({
      requested_date: "2026-02-31",
      requested_time: "14:30",
      quantity: 1,
    }),
  );
  assert.throws(() =>
    validateSocialOrderScheduleAndQuantity({
      requested_date: "2026-11-20",
      requested_time: "25:99",
      quantity: 1,
    }),
  );
});

// ------------------------------------------------------------------------------
// TEST 10: Pure Runtime Fixes (Drawer Live Sync, Shift Report >1000, Safe RPC Errors)
// ------------------------------------------------------------------------------
await test("10. reconcileOrderDrawerFields(), aggregateShiftReport() >1000 rows & sanitizeStaffRpcError()", () => {
  // 1) Drawer sync updates untouched server-changed fields while keeping dirty local edits
  const prevServer = {
    id: "ord-1",
    deposit_paid: 10,
    driver_name: "أحمد",
    driver_phone: "0790000001",
    discount_percent: 0,
    address: "عبدون",
  };
  const nextServer = {
    id: "ord-1",
    deposit_paid: 25,
    driver_name: "أحمد",
    driver_phone: "0790000001",
    discount_percent: 10,
    address: "عبدون",
  };
  const localEditedDriver = {
    deposit: "10",
    driverName: "خالد (تعديل غير محفوظ)",
    driverPhone: "0790000001",
    discountPercent: "",
    discountReason: "خصم",
    address: "عبدون",
  };
  const synced = reconcileOrderDrawerFields(prevServer, nextServer, localEditedDriver);
  assert.equal(synced.deposit, "25", "Untouched deposit must sync when server updates");
  assert.equal(synced.discountPercent, "10", "Untouched discount must sync when server updates");
  assert.equal(
    synced.driverName,
    "خالد (تعديل غير محفوظ)",
    "Locally edited driverName must NOT be overwritten",
  );
  assert.equal(synced.discountReason, "خصم");

  // Switching order ID resets all drawer fields cleanly
  const switched = reconcileOrderDrawerFields(
    prevServer,
    {
      id: "ord-2",
      deposit_paid: 5,
      driver_name: null,
      driver_phone: null,
      discount_percent: 0,
      address: "الشميساني",
    },
    localEditedDriver,
  );
  assert.equal(switched.deposit, "5");
  assert.equal(switched.driverName, "");
  assert.equal(switched.discountPercent, "");
  assert.equal(switched.discountReason, "");
  assert.equal(switched.address, "الشميساني");

  // 2) Shift report aggregates >1000 rows cleanly with refunds & cancelled counts
  const paymentRows = [
    ...Array.from({ length: 1200 }, () => ({
      amount: 10,
      payment_method: "cash",
      payment_type: "deposit",
    })),
    { amount: 50, payment_method: "cliq", payment_type: "refund" },
  ];
  const orderRows = [
    ...Array.from({ length: 1050 }, () => ({
      status: "completed",
      total: 20,
      deposit_paid: 15,
    })),
    { status: "cancelled", total: 99, deposit_paid: 0 },
  ];
  const shift = aggregateShiftReport(paymentRows, orderRows, "2026-11-15");
  assert.equal(shift.date, "2026-11-15");
  assert.equal(shift.orders, 1050);
  assert.equal(shift.cancelled, 1);
  assert.equal(shift.collected, 11950);
  assert.equal(shift.outstanding, 5250);
  const cashBucket = shift.byMethod.find((m) => m.method === "cash");
  const cliqBucket = shift.byMethod.find((m) => m.method === "cliq");
  assert.equal(cashBucket?.orders, 1200);
  assert.equal(cashBucket?.collected, 12000);
  assert.equal(cliqBucket?.collected, -50);

  // 3) RPC error sanitizer preserves OCC/domain errors & hides raw SQL schema leaks
  const occErr = sanitizeStaffRpcError(
    new Error("OCC_VERSION_MISMATCH: Order version changed (expected 1, current 2)"),
    "تعذّر التحديث",
  );
  assert.ok(occErr.message.includes("OCC_VERSION_MISMATCH"));

  const arErr = sanitizeStaffRpcError(
    new Error("غير مصرّح: لا تملك صلاحية تعديل سعر هذا المنتج"),
    "تعذّر التحديث",
  );
  assert.ok(arErr.message.includes("غير مصرّح"));

  const rawPgErr = sanitizeStaffRpcError(
    {
      message: 'null value in column "subtotal" of relation "orders" violates not-null constraint',
    },
    "تعذّر تحديث الطلب · Could not update order",
  );
  assert.equal(rawPgErr.message, "تعذّر تحديث الطلب · Could not update order");
});
