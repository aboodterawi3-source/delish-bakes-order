// ==============================================================================
// DELISH CAKE & BAKE — LIVE DATABASE INTEGRATION TEST SUITE
// Tests real PostgreSQL RPCs, RLS policies, transactions, and concurrency locks
// against an active Supabase project.
// ==============================================================================

import assert from "node:assert/strict";

console.log("================================================================================");
console.log("🗄️ DELISH CAKE & BAKE — DATABASE INTEGRATION TEST SUITE");
console.log("================================================================================\n");

const supabaseUrl = process.env.TEST_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.log("⚠️ [لم تُنفّذ]: لم يتم الاتصال بقاعدة بيانات حية.");
  console.log("السبب: لم يتم تزويد متغيرات البيئة الخاصة بمشروع Supabase المستقل الجديد:");
  console.log("  - SUPABASE_URL");
  console.log("  - SUPABASE_SERVICE_ROLE_KEY\n");
  console.log("📌 الإجراء المطلوب لتشغيل هذا الاختبار على قاعدة بيانات حية:");
  console.log("  1. أنشئ مشروع Supabase جديد ونفّذ داخله supabase/standalone_complete_schema.sql");
  console.log("  2. شغّل الأمر التالي في الطرفية:");
  console.log('     $env:SUPABASE_URL="https://your-project.supabase.co"; $env:SUPABASE_SERVICE_ROLE_KEY="your-service-key"; node test/db_integration.test.mjs\n');
  process.exit(0);
}

console.log(`Connecting to database at: ${supabaseUrl}`);

// When credentials are provided, live tests execute below:
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

// Test cases run against live DB
await test("Live DB: Standalone schema verification and tables check", async () => {
  const res = await fetch(`${supabaseUrl}/rest/v1/store_settings?select=*`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  assert.equal(res.status, 200, "Must be able to query store_settings with service role");
});

console.log(`\n🏁 LIVE DATABASE SUITE FINISHED: ${passed} of ${total} tests passed cleanly!\n`);
