import { describe, expect, test } from "bun:test";
import { calculateStreaks, intensityFor, intensityThresholds } from "./index";

describe("calculateStreaks", () => {
  test("deduplicates dates and calculates current and longest runs", () => {
    const days = [
      { localDate: "2026-01-01", totalTokens: 10 },
      { localDate: "2026-01-02", totalTokens: 20 },
      { localDate: "2026-01-04", totalTokens: 30 },
      { localDate: "2026-01-05", totalTokens: 40 },
      { localDate: "2026-01-06", totalTokens: 50 }
    ];
    expect(calculateStreaks(days, "2026-01-06")).toEqual({ current: 3, longest: 3 });
  });

  test("allows a streak to continue from yesterday", () => {
    expect(calculateStreaks(
      [{ localDate: "2026-01-05", totalTokens: 1 }],
      "2026-01-06"
    ).current).toBe(1);
  });
});

test("personal intensity distribution stays bounded", () => {
  const thresholds = intensityThresholds([0, 10, 20, 30, 100]);
  expect(intensityFor(0, thresholds)).toBe(0);
  expect(intensityFor(1000, thresholds)).toBe(4);
});
