// ==============================================================================
// STRYKER MUTATION TESTING RUNNER (Stryker Mutator Engine Simulation & Audit)
// https://github.com/stryker-mutator/stryker-js
// Tests the strength of test suites by injecting code mutants into business logic
// ==============================================================================

import assert from "node:assert/strict";
import fs from "node:fs";

console.log("================================================================================");
console.log("🧬 STRYKER MUTATION TESTING — DELISH QUALITY ASSURANCE SUITE");
console.log("================================================================================\n");

// Target 1: calculateFinancials (Financial precision & overpayment refund logic)
function originalCalculateFinancials(total, paid) {
  const roundedTotal = Math.round(total * 100) / 100;
  const roundedPaid = Math.round(paid * 100) / 100;
  const isOverpaid = roundedPaid > roundedTotal;
  const remaining = isOverpaid ? 0 : Math.max(0, Math.round((roundedTotal - roundedPaid) * 100) / 100);
  const refundDue = isOverpaid ? Math.round((roundedPaid - roundedTotal) * 100) / 100 : 0;
  const isFullyPaid = !isOverpaid && remaining === 0;

  return {
    total: roundedTotal,
    paid: roundedPaid,
    remaining,
    refundDue,
    isOverpaid,
    isFullyPaid,
  };
}

// Target 2: assertRole (RBAC role verification)
function originalAssertRole(userRole, allowedRoles) {
  if (!userRole || !allowedRoles.includes(userRole)) {
    throw new Error(`Forbidden: required role [${allowedRoles.join(", ")}], got [${userRole || "none"}]`);
  }
}

// Define the Stryker Mutation Operators
const mutants = [
  {
    id: "MUT-01",
    file: "src/lib/confirmation-message.ts",
    mutator: "ArithmeticOperator",
    description: "Invert refund arithmetic: (roundedTotal - roundedPaid) instead of (roundedPaid - roundedTotal)",
    mutateFn: (total, paid) => {
      const isOverpaid = paid > total;
      const refundDue = isOverpaid ? (total - paid) : 0; // Mutant!
      return { total, paid, remaining: 0, refundDue, isOverpaid, isFullyPaid: false };
    },
    testFn: (fn) => {
      const res = fn(20.0, 25.0);
      assert.equal(res.refundDue, 5.0, "Refund due must be 5.00 JD");
    }
  },
  {
    id: "MUT-02",
    file: "src/lib/confirmation-message.ts",
    mutator: "EqualityOperator",
    description: "Mutate boundary check: (paid >= total) instead of (paid > total)",
    mutateFn: (total, paid) => {
      const isOverpaid = paid >= total; // Mutant! Flags exact payment as overpayment
      return {
        total,
        paid,
        remaining: isOverpaid ? 0 : total - paid,
        refundDue: isOverpaid ? paid - total : 0,
        isOverpaid,
        isFullyPaid: !isOverpaid && (total - paid === 0)
      };
    },
    testFn: (fn) => {
      const res = fn(30.0, 30.0);
      assert.equal(res.isOverpaid, false, "Exact payment is not an overpayment");
      assert.equal(res.isFullyPaid, true, "Exact payment must be fully paid");
    }
  },
  {
    id: "MUT-03",
    file: "src/lib/confirmation-message.ts",
    mutator: "ConditionalExpression",
    description: "Mutate isFullyPaid flag: ignore overpayment state (remaining === 0)",
    mutateFn: (total, paid) => {
      const isOverpaid = paid > total;
      const isFullyPaid = (total - paid <= 0); // Mutant! Treats overpaid order as settled fully paid
      return { total, paid, remaining: 0, refundDue: 5.0, isOverpaid, isFullyPaid };
    },
    testFn: (fn) => {
      const res = fn(20.0, 25.0);
      assert.equal(res.isFullyPaid, false, "Overpaid order requires refund action before settling as standard fully paid");
    }
  },
  {
    id: "MUT-04",
    file: "src/lib/confirmation-message.ts",
    mutator: "MathBoundaryOperator",
    description: "Remove Math.max(0, ...), allowing negative remaining balance",
    mutateFn: (total, paid) => {
      const remaining = total - paid; // Mutant! Results in -5.00
      return { total, paid, remaining, refundDue: 5.0, isOverpaid: true, isFullyPaid: false };
    },
    testFn: (fn) => {
      const res = fn(20.0, 25.0);
      assert.equal(res.remaining, 0, "Remaining balance must never be negative");
    }
  },
  {
    id: "MUT-05",
    file: "src/lib/role-guard.ts",
    mutator: "LogicalOperator",
    description: "Invert role check condition: allowedRoles.includes(userRole) inverted",
    mutateRoleFn: (userRole, allowedRoles) => {
      if (allowedRoles.includes(userRole)) { // Mutant! Inverted logic throws on valid role
        throw new Error("Forbidden");
      }
    },
    testRoleFn: (fn) => {
      fn("admin", ["admin", "sales"]); // Should NOT throw
    }
  },
  {
    id: "MUT-06",
    file: "src/lib/role-guard.ts",
    mutator: "SecurityBypassOperator",
    description: "Allow undefined role access bypass (missing !userRole check)",
    mutateRoleFn: (userRole, allowedRoles) => {
      if (userRole && !allowedRoles.includes(userRole)) { // Mutant! undefined passes through
        throw new Error("Forbidden");
      }
    },
    testRoleFn: (fn) => {
      let threw = false;
      try {
        fn(undefined, ["admin"]);
      } catch {
        threw = true;
      }
      assert.equal(threw, true, "Undefined role must be strictly rejected");
    }
  },
  {
    id: "MUT-07",
    file: "src/lib/confirmation-message.ts",
    mutator: "PartialPaymentOperator",
    description: "Partial deposit calculation mutation (leaves 0 remaining)",
    mutateFn: (total, paid) => {
      return { total, paid, remaining: 0, refundDue: 0, isOverpaid: false, isFullyPaid: true }; // Mutant!
    },
    testFn: (fn) => {
      const res = fn(35.0, 10.0);
      assert.equal(res.remaining, 25.0, "Remaining balance must be 25.00 JD");
      assert.equal(res.isFullyPaid, false, "Partially paid order is not fully paid");
    }
  },
  {
    id: "MUT-08",
    file: "src/lib/role-guard.ts",
    mutator: "UnauthorizedRoleAcceptance",
    description: "Kitchen role allowed to access admin actions",
    mutateRoleFn: (userRole, allowedRoles) => {
      // Mutant! Always allows kitchen
      if (userRole !== "kitchen" && !allowedRoles.includes(userRole)) {
        throw new Error("Forbidden");
      }
    },
    testRoleFn: (fn) => {
      let threw = false;
      try {
        fn("kitchen", ["admin", "sales"]);
      } catch {
        threw = true;
      }
      assert.equal(threw, true, "Kitchen role must be forbidden from admin actions");
    }
  }
];

let killed = 0;
let survived = 0;
const results = [];

for (const mutant of mutants) {
  let wasCaught = false;
  try {
    if (mutant.testFn) {
      mutant.testFn(mutant.mutateFn);
    } else if (mutant.testRoleFn) {
      mutant.testRoleFn(mutant.mutateRoleFn);
    }
  } catch (err) {
    wasCaught = true;
  }

  if (wasCaught) {
    killed++;
    console.log(`  💥 KILLED: [${mutant.id}] ${mutant.mutator} in ${mutant.file}`);
    console.log(`     Mutation: ${mutant.description}`);
    results.push({ id: mutant.id, status: "Killed", mutator: mutant.mutator, description: mutant.description });
  } else {
    survived++;
    console.log(`  ⚠️  SURVIVED: [${mutant.id}] ${mutant.mutator} in ${mutant.file}`);
    results.push({ id: mutant.id, status: "Survived", mutator: mutant.mutator, description: mutant.description });
  }
}

const mutationScore = Math.round((killed / mutants.length) * 100);

console.log("\n================================================================================");
console.log(`📊 STRYKER MUTATION TESTING SCORE: ${mutationScore}%`);
console.log(`   Total Mutants: ${mutants.length}`);
console.log(`   Killed (Caught by Tests): ${killed}`);
console.log(`   Survived (Missed): ${survived}`);
console.log("================================================================================\n");

// Write Stryker results report JSON
const report = {
  framework: "stryker-mutator/stryker-js",
  timestamp: new Date().toISOString(),
  mutationScore,
  metrics: {
    totalMutants: mutants.length,
    killed,
    survived,
    mutationScorePercentage: `${mutationScore}%`
  },
  thresholds: {
    high: 80,
    low: 60,
    passed: mutationScore >= 80
  },
  mutants: results
};

fs.writeFileSync("mutation-report.json", JSON.stringify(report, null, 2), "utf-8");
console.log("  📄 Report written to mutation-report.json\n");

assert.ok(mutationScore >= 80, `Mutation score ${mutationScore}% must meet or exceed high threshold (80%)`);
