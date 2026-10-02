import { Router } from "express";
import { Habit } from "../models/Habit.js";
import { CheckIn } from "../models/CheckIn.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../utils/httpError.js";
import { todayInTz, periodKey } from "../utils/dates.js";
import { analyzeHabit, completionXp, levelFromXp } from "../utils/gamification.js";
import { refreshBadges } from "../services/gamificationService.js";

// mergeParams so this router can read :habitId from the parent mount in server.js
export const checkinsRouter = Router({ mergeParams: true });
checkinsRouter.use(requireAuth);

async function loadOwnedHabit(req) {
  const habit = await Habit.findOne({ _id: req.params.habitId, user: req.user._id, archivedAt: null });
  if (!habit) throw new HttpError(404, "Habit not found.", "NOT_FOUND");
  return habit;
}

checkinsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    await loadOwnedHabit(req);
    const checkIns = await CheckIn.find({ habit: req.params.habitId }).sort({ date: 1 }).select("date xp -_id").lean();
    res.json({ checkIns });
  })
);

// POST /api/habits/:habitId/checkins — check in for "today" in the user's timezone.
// One check-in per PERIOD (a day for daily habits, a Monday-based week for
// weekly habits), enforced here so a weekly habit can't be checked in twice
// in the same week even on different dates.
checkinsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const habit = await loadOwnedHabit(req);
    const today = todayInTz(req.user.timezone);

    const existing = await CheckIn.find({ habit: habit._id }).select("date").lean();
    const dates = existing.map((c) => c.date);
    const currentPeriod = periodKey(habit.frequency, today);
    const alreadyDone = dates.some((d) => periodKey(habit.frequency, d) === currentPeriod);
    if (alreadyDone) throw new HttpError(409, "Already checked in for this period.", "ALREADY_DONE");

    const before = analyzeHabit(habit.frequency, dates, today);
    const xp = completionXp(habit.frequency, before.streak + 1);

    const checkIn = await CheckIn.create({ user: req.user._id, habit: habit._id, date: today, xp });

    const beforeLevel = levelFromXp(req.user.xp);
    req.user.xp += xp;
    await req.user.save();
    const afterLevel = levelFromXp(req.user.xp);

    const newBadges = await refreshBadges(req.user, today);
    const after = analyzeHabit(habit.frequency, [...dates, today], today);

    res.status(201).json({
      checkIn: { date: checkIn.date, xp: checkIn.xp },
      streak: after.streak,
      best: after.best,
      xpAwarded: xp,
      userXp: req.user.xp,
      levelUp: afterLevel > beforeLevel ? { from: beforeLevel, to: afterLevel } : null,
      newBadges: newBadges.map((b) => ({ id: b.id, name: b.name })),
    });
  })
);

// DELETE /api/habits/:habitId/checkins/today — undo today's (or this week's)
// check-in and refund exactly the XP it earned, so undo can never be used to
// farm XP by toggling back and forth.
checkinsRouter.delete(
  "/today",
  asyncHandler(async (req, res) => {
    const habit = await loadOwnedHabit(req);
    const today = todayInTz(req.user.timezone);
    const currentPeriod = periodKey(habit.frequency, today);

    const all = await CheckIn.find({ habit: habit._id }).lean();
    const toRemove = all.filter((c) => periodKey(habit.frequency, c.date) === currentPeriod);
    if (toRemove.length === 0) throw new HttpError(404, "No check-in for the current period.", "NOT_FOUND");

    const refund = toRemove.reduce((sum, c) => sum + c.xp, 0);
    await CheckIn.deleteMany({ _id: { $in: toRemove.map((c) => c._id) } });

    req.user.xp = Math.max(0, req.user.xp - refund);
    await req.user.save();

    const remaining = all.filter((c) => periodKey(habit.frequency, c.date) !== currentPeriod).map((c) => c.date);
    const after = analyzeHabit(habit.frequency, remaining, today);

    res.json({ refunded: refund, userXp: req.user.xp, streak: after.streak, best: after.best });
  })
);
