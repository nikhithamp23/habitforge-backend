/*
 * Gamification logic: streaks, XP, levels, badges.
 * Pure functions with no Express or Mongo imports, so they are easy to unit
 * test and stay isolated from the API routes.
 */
import { periodKey, stepBack } from "./dates.js";

/* ---------- XP and levels ---------- */
export const XP_UNIT = 40;

// Level = floor(sqrt(XP / 40)) + 1
export const levelFromXp = (xp) => Math.floor(Math.sqrt(Math.max(0, xp) / XP_UNIT)) + 1;
export const xpForLevel = (level) => XP_UNIT * (level - 1) * (level - 1);
export const rankTitle = (level) =>
  level < 5 ? "Apprentice" : level < 10 ? "Journeyman" : level < 15 ? "Smith" : level < 20 ? "Master smith" : "Forgemaster";

// Daily: 10 XP + 2 per streak day (bonus capped at 14 days).
// Weekly: 25 XP + 3 per streak week (bonus capped at 8 weeks).
export const completionXp = (frequency, streakAfter) =>
  frequency === "weekly" ? 25 + 3 * Math.min(streakAfter - 1, 8) : 10 + 2 * Math.min(streakAfter - 1, 14);

/*
 * Streak algorithm
 *  1. Collapse check-in dates into periods (a day, or a Monday-based week).
 *  2. Start at the current period. If it is not done yet, start one period back:
 *     the streak stays alive until the current period ends.
 *  3. Walk backward while each period exists. The first gap ends the streak.
 * A missed period therefore resets the streak to 0; the next check-in makes it 1.
 * `best` is the longest run of consecutive periods in the whole history.
 */
export function analyzeHabit(frequency, dates, today) {
  const periods = new Set(dates.map((d) => periodKey(frequency, d)));
  const current = periodKey(frequency, today);
  const done = periods.has(current);

  let cursor = done ? current : stepBack(current, frequency);
  let streak = 0;
  while (periods.has(cursor)) {
    streak += 1;
    cursor = stepBack(cursor, frequency);
  }

  let best = 0;
  let run = 0;
  let prev = null;
  for (const p of [...periods].sort()) {
    run = prev !== null && stepBack(p, frequency) === prev ? run + 1 : 1;
    best = Math.max(best, run);
    prev = p;
  }
  return { done, streak, best };
}

/* ---------- Badges ---------- */
export const BADGES = [
  { id: "first-spark", name: "First spark", description: "Complete your first check-in.", test: (c) => c.total >= 1 },
  { id: "consistency-king", name: "Consistency king", description: "Reach a 7-day streak.", test: (c) => c.best >= 7 },
  { id: "fortnight", name: "Fortnight forger", description: "Reach a 14-day streak.", test: (c) => c.best >= 14 },
  { id: "iron-will", name: "Iron will", description: "Reach a 30-day streak.", test: (c) => c.best >= 30 },
  { id: "centurion", name: "Centurion", description: "Log 100 check-ins in total.", test: (c) => c.total >= 100 },
  { id: "five-alloys", name: "Five alloys", description: "Track 5 habits at once.", test: (c) => c.habits >= 5 },
  { id: "perfect-day", name: "Perfect day", description: "Finish every daily habit (3 or more) in one day.", test: (c) => c.perfect },
  { id: "rising-smith", name: "Rising smith", description: "Reach level 5.", test: (c) => c.level >= 5 },
  { id: "master", name: "Master of the forge", description: "Reach level 15.", test: (c) => c.level >= 15 },
];

// ctx = { total, best, habits, level, perfect }
export const evaluateBadges = (ctx) => BADGES.filter((b) => b.test(ctx));
export const badgeSummary = ({ id, name, description }) => ({ id, name, description });
