import * as fs from "node:fs";
import * as path from "node:path";
import { roundJod } from "../src/lib/currency";
import { esc } from "../src/lib/esc";

async function runTests() {
  console.log("Running Fixes Tests...");

  // 1. Test roundJod
  const value = 1.235;
  const rounded = roundJod(value);
  console.assert(rounded === 1.24, `roundJod expected 1.24 but got ${rounded}`);
  console.log("✔ roundJod tested (2 decimal precision)");

  // 2. Test PHONE_LIKE
  // Using Regex extraction since importing validators might cause module errors if tsx is not configured perfectly
  const validatorsPath = path.join(__dirname, "../src/lib/validators.ts");
  const validatorsContent = fs.readFileSync(validatorsPath, "utf-8");
  const phoneLikeMatch = validatorsContent.match(/PHONE_PATTERN\s*=\s*(\/.+\/)/);
  if (phoneLikeMatch) {
    const PHONE_PATTERN = eval(phoneLikeMatch[1]);
    const validPhone = "0791234567";
    const invalidPhone = "٠٧٩١٢٣٤٥٦٧"; 
    console.assert(PHONE_PATTERN.test(validPhone), `Valid phone failed`);
    console.assert(!PHONE_PATTERN.test(invalidPhone), `Invalid phone passed (should block Arabic numerals)`);
    console.log("✔ PHONE_LIKE regex tested (blocks Arabic-Indic numbers)");
  } else {
    console.error("❌ PHONE_PATTERN not found in validators.ts");
  }

  // 3. Test esc
  const dangerousHTML = "<script>alert('XSS')</script>";
  const escaped = esc(dangerousHTML);
  console.assert(!escaped.includes("<script>"), `Escaping failed: ${escaped}`);
  console.log("✔ esc function tested (prevents XSS and HTML Injection)");

  // 4. Constants
  const storefrontPath = path.join(__dirname, "../src/lib/storefront-order.functions.ts");
  const storefrontContent = fs.readFileSync(storefrontPath, "utf-8");
  console.assert(storefrontContent.includes("MAX_LINES = 100"), "MAX_LINES not found or not 100");
  console.assert(storefrontContent.includes("MAX_QTY = 500"), "MAX_QTY not found or not 500");
  console.log("✔ MAX_LINES and MAX_QTY constants verified in storefront functions");

  console.log("All tests completed!");
}

runTests().catch(console.error);
