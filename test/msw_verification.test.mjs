import assert from "node:assert/strict";

// Dynamic import or direct execution of handlers
import { handleMockSupabaseRequest, mockOrdersDatabase } from "./mocks/handlers.ts";

console.log("================================================================================");
console.log("🥪 DELISH CAKE & BAKE — MSW (MOCK SERVICE WORKER) SIMULATION SUITE");
console.log("================================================================================");

// 1. Verify Auth Interception
const authSuccess = handleMockSupabaseRequest(
  "https://dmvwdkxcltnomigoqtue.supabase.co/auth/v1/token?grant_type=password",
  "POST",
  {
    email: "admin@delish.local",
    password: "Admin@Delish2026",
  },
);
assert.equal(authSuccess.status, 200, "Auth should return 200 OK");
assert.equal(authSuccess.data.user.email, "admin@delish.local", "User email should match");
console.log(
  "  ✅ PASS: 1. MSW Auth Handler correctly intercepts and authenticates admin credentials",
);

// 2. Verify Auth Rejection
const authFail = handleMockSupabaseRequest(
  "https://dmvwdkxcltnomigoqtue.supabase.co/auth/v1/token?grant_type=password",
  "POST",
  {
    email: "intruder@bad.com",
    password: "WrongPassword",
  },
);
assert.equal(authFail.status, 400, "Auth rejection should return 400");
console.log("  ✅ PASS: 2. MSW Auth Handler strictly rejects invalid credentials");

// 3. Verify Orders Listing
const ordersList = handleMockSupabaseRequest(
  "https://dmvwdkxcltnomigoqtue.supabase.co/rest/v1/orders",
  "GET",
);
assert.equal(ordersList.status, 200, "Orders GET should return 200");
assert.equal(ordersList.data.length >= 2, true, "Should return mock orders");
console.log(
  `  ✅ PASS: 3. MSW Orders Handler intercepts GET and returns ${ordersList.data.length} mock orders`,
);

// 4. Verify Order Creation
const newOrderRes = handleMockSupabaseRequest(
  "https://dmvwdkxcltnomigoqtue.supabase.co/rest/v1/orders",
  "POST",
  {
    customer_name: "Lina Bakery Fan",
    total_amount: 32.5,
    status: "pending_deposit",
  },
);
assert.equal(newOrderRes.status, 201, "Order creation should return 201 Created");
assert.equal(newOrderRes.data.customer_name, "Lina Bakery Fan");
assert.equal(newOrderRes.data.version, 1, "New order initial OCC version must be 1");
console.log(
  "  ✅ PASS: 4. MSW Orders Handler intercepts POST and creates mock order with OCC version 1",
);

console.log("================================================================================");
console.log("🏁 MSW VERIFICATION FINISHED: All mock handlers passed cleanly!");
console.log("================================================================================");
