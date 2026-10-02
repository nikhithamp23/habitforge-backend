import { Habit } from "../models/Habit.js";
import { CheckIn } from "../models/CheckIn.js";
import { analyzeHabit } from "../utils/gamification.js";

// Returns every non-archived habit for the user, each enriched with
// { done, streak, best } for the given "today" (already resolved to the
// user's timezone by the caller).
export async function getHabitsWithStreaks(userId, todayKey) {
  const habits = await Habit.find({ user: userId, archivedAt: null }).sort({ createdAt: 1 }).lean();
  if (habits.length === 0) return [];

  const checkIns = await CheckIn.find({ user: userId, habit: { $in: habits.map((h) => h._id) } })
    .select("habit date xp")
    .lean();

  const byHabit = new Map();
  for (const c of checkIns) {
    const key = c.habit.toString();
    if (!byHabit.has(key)) byHabit.set(key, []);
    byHabit.get(key).push(c.date);
  }

  return habits.map((h) => {
    const dates = byHabit.get(h._id.toString()) || [];
    const info = analyzeHabit(h.frequency, dates, todayKey);
    return { ...h, id: h._id.toString(), dates, ...info };
  });
}

export async function countActiveHabits(userId) {
  return Habit.countDocuments({ user: userId, archivedAt: null });
}
