import { CheckIn } from "../models/CheckIn.js";
import { evaluateBadges, levelFromXp } from "../utils/gamification.js";
import { getHabitsWithStreaks } from "./habitService.js";

// Re-derives streak/XP-dependent badge eligibility from scratch and saves any
// newly earned ones onto the user document. Called after every check-in,
// undo, or new habit, so badges never fall out of sync with real history.
export async function refreshBadges(user, todayKey) {
  const [habits, total] = await Promise.all([
    getHabitsWithStreaks(user._id, todayKey),
    CheckIn.countDocuments({ user: user._id }),
  ]);

  const daily = habits.filter((h) => h.frequency === "daily");
  const ctx = {
    total,
    best: Math.max(0, ...habits.map((h) => h.best)),
    habits: habits.length,
    level: levelFromXp(user.xp),
    perfect: daily.length >= 3 && daily.every((h) => h.done),
  };

  const earnedIds = new Set(user.badges.map((b) => b.id));
  const fresh = evaluateBadges(ctx).filter((b) => !earnedIds.has(b.id));
  if (fresh.length > 0) {
    user.badges.push(...fresh.map((b) => ({ id: b.id, earnedAt: todayKey })));
    await user.save();
  }
  return fresh;
}
