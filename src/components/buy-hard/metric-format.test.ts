import assert from "node:assert/strict";
import { test } from "node:test";

import { formatCompactMetric } from "./metric-format.ts";

test("keeps short values and abbreviates purchasing totals", () => {
  for (const [value, expected] of [
    [0, "0"],
    [12, "12"],
    [999, "999"],
    [1_000, "1k"],
    [1_234, "1.2k"],
    [17_430, "17k"],
    [284_320, "284k"],
    [1_234_567, "1.2m"],
    [2_340_000_000, "2.3b"],
    [12_000_000_000_000, "12t"],
  ] as const) {
    assert.equal(formatCompactMetric(value), expected);
  }
});

test("promotes units when rounding would add a fifth character", () => {
  for (const [value, expected] of [
    [999.5, "1k"],
    [9_999, "10k"],
    [99_999, "100k"],
    [999_499, "999k"],
    [999_500, "1m"],
    [999_500_000, "1b"],
    [999_500_000_000, "1t"],
    [-999, "-999"],
    [-999.5, "-1k"],
    [-12_345, "-12k"],
    [-100_000, "-.1m"],
  ] as const) {
    assert.equal(formatCompactMetric(value), expected);
  }
});

test("handles unavailable values and always respects the four-character budget", () => {
  for (const value of [undefined, null, NaN, Infinity, -Infinity]) {
    assert.equal(formatCompactMetric(value), "—");
  }

  for (let exponent = 0; exponent <= 308; exponent++) {
    for (const coefficient of [1, 1.234, 9.994, 9.995]) {
      for (const sign of [-1, 1]) {
        const value = coefficient * 10 ** exponent * sign;
        assert.ok(formatCompactMetric(value).length <= 4, `Value ${value} exceeds four characters`);
      }
    }
  }
  assert.equal(formatCompactMetric(Number.MAX_VALUE), "MAX");
  assert.equal(formatCompactMetric(-Number.MAX_VALUE), "-MAX");
});
