import assert from "node:assert/strict";
import { test } from "node:test";
import { arabicNum, t_ } from "../src/lib/i18n-dict.ts";

test("every dictionary entry defines non-empty Arabic and English strings", () => {
  const keys = Object.keys(t_);
  assert.ok(keys.length > 0, "Dictionary must not be empty");
  for (const key of keys) {
    const entry = t_[key];
    assert.ok(entry && entry.ar.trim().length > 0, `Missing Arabic translation for ${key}`);
    assert.ok(entry && entry.en.trim().length > 0, `Missing English translation for ${key}`);
  }
  assert.equal(t_.heroTitle.ar, "كل قطمة، لحظة فرح");
  assert.equal(t_.heroTitle.en, "Every bite, a little celebration");
});

test("arabicNum formats digits as Eastern Arabic numerals when lang is 'ar'", () => {
  assert.equal(arabicNum("2026-05", "ar"), "٢٠٢٦-٠٥");
  assert.equal(arabicNum(145, "ar"), "١٤٥");
  assert.equal(arabicNum(145, "en"), "145");
});
