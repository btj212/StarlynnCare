/**
 * Tests: seededShuffle from src/lib/data/stateHub.ts
 *
 * seededShuffle drives the hourly facility rotation on hub pages.
 * The guarantee: same seed → same order (deterministic), different seeds → different
 * orders (non-trivial shuffle). This affects which facilities family members see
 * first on landing pages — important for YMYL fairness.
 */

import { describe, it, expect } from "vitest";
import { seededShuffle } from "@/lib/data/stateHub";

describe("seededShuffle", () => {
  const items = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];

  it("returns the same items (no additions or deletions)", () => {
    const result = seededShuffle(items, 42);
    expect(result).toHaveLength(items.length);
    expect(new Set(result)).toEqual(new Set(items));
  });

  it("is deterministic — same seed produces identical order on repeated calls", () => {
    const r1 = seededShuffle(items, 12345);
    const r2 = seededShuffle(items, 12345);
    expect(r1).toEqual(r2);
  });

  it("different seeds produce different orders (with high probability for 10-item array)", () => {
    const r1 = seededShuffle(items, 1);
    const r2 = seededShuffle(items, 999999);
    // It's extremely unlikely that two different seeds produce identical orderings
    expect(r1).not.toEqual(r2);
  });

  it("does not mutate the original array", () => {
    const original = [...items];
    seededShuffle(items, 42);
    expect(items).toEqual(original);
  });

  it("handles seed=0 without hanging (special case in LCG)", () => {
    const result = seededShuffle(items, 0);
    expect(result).toHaveLength(items.length);
  });

  it("handles single-element array", () => {
    expect(seededShuffle(["only"], 42)).toEqual(["only"]);
  });

  it("handles empty array", () => {
    expect(seededShuffle([], 42)).toEqual([]);
  });

  it("produces a different order from the original for a sufficient item count", () => {
    // With 10 items, the probability of the shuffle matching original is 1/10! ≈ 0
    const result = seededShuffle(items, 42);
    // At least some elements should have moved
    const moved = items.filter((item, i) => result[i] !== item).length;
    expect(moved).toBeGreaterThan(0);
  });

  it("hourly seed produces different result from the previous hour", () => {
    const hour1 = Math.floor(Date.now() / 3600000);
    const hour2 = hour1 - 1;
    const r1 = seededShuffle(items, hour1);
    const r2 = seededShuffle(items, hour2);
    // Different seeds = different order (with extremely high probability)
    expect(r1).not.toEqual(r2);
  });

  it("works correctly with numeric item arrays", () => {
    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = seededShuffle(numbers, 777);
    expect(new Set(result)).toEqual(new Set(numbers));
    expect(result).toHaveLength(numbers.length);
  });

  it("works correctly with UUID-like strings (facility IDs)", () => {
    const uuids = Array.from({ length: 20 }, (_, i) =>
      `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`
    );
    const result = seededShuffle(uuids, 99999);
    expect(new Set(result)).toEqual(new Set(uuids));
    expect(result).toHaveLength(uuids.length);
  });
});
