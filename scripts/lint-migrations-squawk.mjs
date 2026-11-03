// ==============================================================================
// SQUAWK POSTGRESQL MIGRATION LINTER RUNNER
// https://github.com/sbdchd/squawk
// Detects locking issues, blocking index creations, and table rewrite hazards
// ==============================================================================

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

console.log("================================================================================");
console.log("🦅 SQUAWK — POSTGRESQL MIGRATION LINTER & SCHEMA SAFETY AUDITOR");
console.log("================================================================================\n");

const migrationsDir = path.resolve("supabase/migrations");
const files = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

console.log(`  📂 Found ${files.length} PostgreSQL migration files in supabase/migrations/`);

// Select critical recent production migrations to audit
const targetFiles = [
  "20261029143000_production_hardening_and_ledger.sql",
  "20261005160000_orders_idempotency_and_indexes.sql",
  "20261005163000_atomic_operations.sql",
];

let totalIssues = 0;
const report = [];

for (const file of targetFiles) {
  const filePath = path.join(migrationsDir, file);
  console.log(`\n  🔎 Linting: ${file}`);

  try {
    const cmd = `npx.cmd squawk "${filePath}" --config .squawk.toml --reporter json`;
    const output = execSync(cmd, { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
    console.log(`     ✅ Zero issues found.`);
    report.push({ file, status: "Clean", issuesCount: 0 });
  } catch (err) {
    const output = err.stdout ? err.stdout.toString() : err.message;
    let issues = [];
    try {
      issues = JSON.parse(output);
    } catch {
      // If output is plain text
    }

    const issueCount = Array.isArray(issues)
      ? issues.length
      : (output.match(/warning\[/g) || []).length;
    totalIssues += issueCount;
    console.log(`     ⚠️  Found ${issueCount} rule warnings/recommendations.`);

    if (Array.isArray(issues) && issues.length > 0) {
      for (const iss of issues.slice(0, 3)) {
        console.log(`        - [${iss.rule}] ${iss.message} (Line ${iss.line || "?"})`);
      }
    }
    report.push({ file, status: "Warnings", issuesCount: issueCount, raw: output });
  }
}

console.log("\n================================================================================");
console.log(`📊 SQUAWK AUDIT SUMMARY:`);
console.log(`   Migrations Audited: ${targetFiles.length}`);
console.log(`   Total Linter Observations: ${totalIssues}`);
console.log("================================================================================\n");

fs.writeFileSync(
  "squawk-report.json",
  JSON.stringify({ timestamp: new Date().toISOString(), report }, null, 2),
);
console.log("  📄 Report written to squawk-report.json\n");
