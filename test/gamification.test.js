import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeHabit, levelFromXp, xpForLevel, completionXp } from "../src/utils/gamification.js";
import { addDays } from "../src/utils/dates.js";

test("daily streak counts back-to-back days and stops at a gap", () => {
  const today = "2026-09-26";
  const dates = [addDays(today, -2), addDays(today, -1), today]; // 3 in a row, including today
  const { done, streak, best } = analyzeHabit("daily", dates, today);
  assert.equal(done, true);
  assert.equal(streak, 3);
  assert.equal(best, 3);
});

test("streak stays alive if today isn't done yet, but resets after a real gap", () => {
  const today = "2026-09-26";
  const yesterday = addDays(today, -1);
  const dates = [addDays(today, -3), addDays(today, -2), yesterday]; // nothing logged today yet
  const r1 = analyzeHabit("daily", dates, today);
  assert.equal(r1.done, false);
  assert.equal(r1.streak, 3); // still alive, today hasn't ended

  const gappy = [addDays(today, -5), addDays(today, -3)]; // missing day -4
  const r2 = analyzeHabit("daily", gappy, today);
  assert.equal(r2.streak, 0); // gap right before today breaks it
  assert.equal(r2.best, 1);
});

test("weekly streak groups check-ins by Monday-based week", () => {
  const dates = ["2026-09-07", "2026-09-14", "2026-09-21"]; // three consecutive Mondays
  const r = analyzeHabit("weekly", dates, "2026-09-24");
  assert.equal(r.streak, 3);
});

test("completionXp applies the daily and weekly caps", () => {
  assert.equal(completionXp("daily", 1), 10);
  assert.equal(completionXp("daily", 15), 10 + 2 * 14);
  assert.equal(completionXp("daily", 30), 10 + 2 * 14); // capped, doesn't keep growing
  assert.equal(completionXp("weekly", 1), 25);
  assert.equal(completionXp("weekly", 9), 25 + 3 * 8);
});

test("levelFromXp and xpForLevel are inverses at level boundaries", () => {
  for (let level = 1; level <= 20; level++) {
    const xpAtBoundary = xpForLevel(level);
    assert.equal(levelFromXp(xpAtBoundary), level);
  }
});
