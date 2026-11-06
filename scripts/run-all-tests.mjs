import { spawnSync } from "node:child_process";

const suites = [
  {
    name: "Unit & Acceptance Hardening",
    args: ["test/acceptance_hardening.test.mjs"],
  },
  {
    name: "React-i18next Localization Verification",
    args: ["test/i18n.test.mjs"],
  },
  {
    name: "Scheduled Delivery & Pickup Slots Engine (TDD)",
    args: ["test/delivery_slots.test.mjs"],
  },
  {
    name: "Touch Item Editor Lifecycle (J2, J3, J5)",
    args: ["test/item_editor_lifecycle.test.mjs"],
  },
  {
    name: "Multi-Session E2E Order Lifecycle (Storefront, KDS, J2, OCC, Ledger)",
    args: ["test/multisession_lifecycle_e2e.test.mjs"],
  },
  {
    name: "PGlite In-Memory Engine Audit",
    args: ["scripts/verify-all-fixes-pglite.mjs"],
  },
];

let failed = false;

// Enable strip-types on Node 22+ to allow direct execution of TypeScript units
const nodeMajor = parseInt(process.versions.node.split(".")[0] || "22", 10);
const stripTypesFlag = nodeMajor >= 22 ? ["--experimental-strip-types"] : [];

for (const suite of suites) {
  console.log(`\n▶ Running Suite: ${suite.name}...`);
  const res = spawnSync(process.execPath, [...stripTypesFlag, ...suite.args], {
    stdio: "inherit",
    env: process.env,
  });
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
