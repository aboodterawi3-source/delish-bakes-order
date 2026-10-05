import { createClient } from "@supabase/supabase-js";
import { resolve } from "path";

// 1. Load environment variables securely using native Node.js functionality (Node >= 20.6.0)
try {
  process.loadEnvFile(resolve(process.cwd(), ".env"));
} catch (e) {
  console.log("No .env file found or failed to load, falling back to process.env");
}

const URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const log = {
  info: (msg: string) => console.log(`\x1b[34m[INFO]\x1b[0m ${msg}`),
  success: (msg: string) => console.log(`\x1b[32m[OK]\x1b[0m ${msg}`),
  warn: (msg: string) => console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`),
  error: (msg: string) => console.log(`\x1b[31m[ERROR]\x1b[0m ${msg}`),
  fatal: (msg: string) => {
    console.error(`\x1b[41m\x1b[37m[FATAL]\x1b[0m ${msg}`);
    process.exit(1);
  },
};

async function verifyRuntime() {
  console.log("\n==============================================");
  console.log("🚀 Pre-flight Runtime Verification Protocol");
  console.log("==============================================\n");

  // Step 1: Environment Variables Check
  log.info("Checking environment variables...");
  if (!URL) log.fatal("Missing SUPABASE_URL in .env");
  if (!ANON_KEY) log.fatal("Missing SUPABASE_PUBLISHABLE_KEY in .env");
  if (!SERVICE_KEY) log.fatal("Missing SUPABASE_SERVICE_ROLE_KEY in .env");
  
  log.success("All critical environment variables are present.");
  log.info(`Supabase URL configured as: ${new URL(URL).origin}`);

  // Step 2: Supabase Clients Initialization
  const anonClient = createClient(URL, ANON_KEY, {
    auth: { persistSession: false },
  });
  const adminClient = createClient(URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // Step 3: RLS Boundary Check (BOLA Verification)
  log.info("Verifying RLS Policies and Boundary Defenses...");
  try {
    // Attempt malicious anonymous insert (Should be blocked by our RLS fix)
    const { error: anonInsertError } = await anonClient
      .from("orders")
      .insert({
        customer_name: "Attacker",
        customer_phone: "00000",
        total: 0,
        status: "new"
      });

    if (!anonInsertError) {
      log.fatal("SECURITY BREACH: Anonymous user successfully inserted an order! RLS is failing.");
    } else if (anonInsertError.code === '42501' || anonInsertError.message.includes('row-level security')) {
      log.success(`RLS Boundary Intact: Anonymous insert correctly blocked. (Error: ${anonInsertError.code})`);
    } else {
      log.warn(`Anonymous insert failed, but not strictly due to RLS. Error: ${anonInsertError.message}`);
    }

    // Verify Admin Client has full access
    const { error: adminReadError, count } = await adminClient
      .from("orders")
      .select("*", { count: "exact", head: true });
    
    if (adminReadError) {
      log.fatal(`Admin access failed: ${adminReadError.message}. Check your SUPABASE_SERVICE_ROLE_KEY.`);
    }
    log.success(`Admin Authorization Intact: Can read orders table (Total Rows: ${count}).`);
    
  } catch (err) {
    log.fatal(`Unexpected error during RLS verification: ${err}`);
  }

  // Step 4: Storage Bucket Integrity Check
  log.info("Verifying Storage Bucket (site-media) Integrity...");
  const testFileName = `diagnostic_test_${Date.now()}.txt`;
  const testContent = "Diagnostic File - Should be automatically deleted.";

  try {
    // 4.a Upload File
    const { error: uploadError } = await adminClient.storage
      .from("site-media")
      .upload(testFileName, testContent, {
        contentType: "text/plain",
        upsert: false
      });

    if (uploadError) log.fatal(`Storage Upload Failed: ${uploadError.message}`);
    log.success(`Successfully uploaded diagnostic file: ${testFileName}`);

    // 4.b Verify Signed URL Generation (Read access check)
    const { data: signed, error: signError } = await adminClient.storage
      .from("site-media")
      .createSignedUrl(testFileName, 60);

    if (signError || !signed?.signedUrl) {
      log.fatal(`Failed to generate signed URL: ${signError?.message}`);
    }
    log.success("Storage Read Access Intact (Signed URL generated successfully).");

    // 4.c Cleanup / Delete File
    const { error: deleteError } = await adminClient.storage
      .from("site-media")
      .remove([testFileName]);
      
    if (deleteError) log.fatal(`Storage Cleanup Failed: ${deleteError.message}`);
    log.success("Storage Cleanup Intact: Diagnostic file completely removed.");

  } catch (err) {
    log.fatal(`Unexpected error during storage verification: ${err}`);
  }

  console.log("\n==============================================");
  console.log("✅ ALL SYSTEMS GO - Runtime Verification Passed!");
  console.log("==============================================\n");
}

verifyRuntime().catch(err => log.fatal(err.message));
