import { Router } from "express";
import { CheckIn } from "../models/CheckIn.js";
import { Habit } from "../models/Habit.js";
import { requireAuth, requirePremium } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { todayInTz, addDays } from "../utils/dates.js";
import { getHabitsWithStreaks } from "../services/habitService.js";
import { clampInt } from "../utils/validate.js";

export const statsRouter = Router();
statsRouter.use(requireAuth);

statsRouter.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const today = todayInTz(req.user.timezone);
    const [habits, totalCheckIns] = await Promise.all([
      getHabitsWithStreaks(req.user._id, today),
      CheckIn.countDocuments({ user: req.user._id }),
    ]);
    res.json({
      totalCheckIns,
      liveStreak: Math.max(0, ...habits.map((h) => h.streak), 0),
      bestStreak: Math.max(0, ...habits.map((h) => h.best), 0),
      habitCount: habits.length,
    });
  })
);

// Daily completion rate for the last N days (default 30), for a line/area chart.
statsRouter.get(
  "/daily-rate",
  asyncHandler(async (req, res) => {
    const days = clampInt(req.query.days, 7, 90, 30);
    const today = todayInTz(req.user.timezone);
    const since = addDays(today, -(days - 1));

    const [habits, checkIns] = await Promise.all([
      Habit.find({ user: req.user._id, archivedAt: null, frequency: "daily" }).select("createdAtKey").lean(),
      CheckIn.find({ user: req.user._id, date: { $gte: since } }).select("date habit").lean(),
    ]);

    const byDate = new Map();
    for (const c of checkIns) byDate.set(c.date, (byDate.get(c.date) || 0) + 1);

    const series = [];
    for (let i = 0; i < days; i++) {
      const key = addDays(since, i);
      const activeHabits = habits.filter((h) => h.createdAtKey <= key).length;
      const done = byDate.get(key) || 0;
      series.push({ date: key, rate: activeHabits ? Math.round((Math.min(done, activeHabits) / activeHabits) * 100) : 0 });
    }
    res.json({ series });
  })
);

// Pro only: one entry per active day for the last 371 days, for a GitHub-style heatmap.
statsRouter.get(
  "/heatmap",
  requirePremium,
  asyncHandler(async (req, res) => {
    const today = todayInTz(req.user.timezone);
    const since = addDays(today, -370);
    const checkIns = await CheckIn.find({ user: req.user._id, date: { $gte: since } }).select("date -_id").lean();
    const counts = {};
    for (const c of checkIns) counts[c.date] = (counts[c.date] || 0) + 1;
    res.json({ since, today, counts });
  })
);

// Pro only: every check-in as CSV text (date, habit name, frequency, xp).
statsRouter.get(
  "/export.csv",
  requirePremium,
  asyncHandler(async (req, res) => {
    const habits = await Habit.find({ user: req.user._id }).select("name frequency").lean();
    const nameById = Object.fromEntries(habits.map((h) => [h._id.toString(), h]));
    const checkIns = await CheckIn.find({ user: req.user._id }).sort({ date: 1 }).select("habit date xp -_id").lean();

    const rows = checkIns.map((c) => {
      const h = nameById[c.habit.toString()];
      const name = (h ? h.name : "Deleted habit").replace(/"/g, '""');
      return `${c.date},"${name}",${h ? h.frequency : ""},${c.xp}`;
    });
    const csv = ["date,habit,frequency,xp", ...rows].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="habitforge-history.csv"');
    res.send(csv);
  })
);
