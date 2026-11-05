import { spawnSync } from "node:child_process";

const suites = [
  {
    name: "Unit & Acceptance Hardening",
    cmd: "node",
    args: ["test/acceptance_hardening.test.mjs"],
  },
  {
    name: "React-i18next Localization Verification",
    cmd: "node",
    args: ["test/i18n.test.mjs"],
  },
  {
    name: "Scheduled Delivery & Pickup Slots Engine (TDD)",
    cmd: "node",
    args: ["test/delivery_slots.test.mjs"],
  },
  {
    name: "Touch Item Editor Lifecycle (J2, J3, J5)",
    cmd: "node",
    args: ["test/item_editor_lifecycle.test.mjs"],
  },
  {
    name: "Multi-Session E2E Order Lifecycle (Storefront, KDS, J2, OCC, Ledger)",
    cmd: "node",
    args: ["test/multisession_lifecycle_e2e.test.mjs"],
  },
  {
    name: "PGlite In-Memory Engine Audit (V6)",
    cmd: "node",
    args: ["scripts/independent-review-v6.mjs"],
  },
];

let failed = false;

for (const suite of suites) {
  console.log(`\n▶ Running Suite: ${suite.name}...`);
  const res = spawnSync(suite.cmd, suite.args, { stdio: "inherit" });
  if (res.status !== 0) {
    console.error(`❌ Suite ${suite.name} failed with exit code ${res.status}`);
    failed = true;
    break;
  }
}

if (failed) {
  process.exit(1);
} else {
  console.log("\n✨ ALL QUALITY GATE TEST SUITES PASSED SUCCESSFULLY (Exit Code 0)!");
  process.exit(0);
}
