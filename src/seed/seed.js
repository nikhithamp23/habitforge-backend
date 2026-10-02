/*
 * Seeds a Demo User with about 3.5 months of history, mirroring the frontend's
 * built-in demo data so the API and the UI agree when wired together.
 *
 * Usage: npm run seed
 */
import { connectDB } from "../config/db.js";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { Habit } from "../models/Habit.js";
import { CheckIn } from "../models/CheckIn.js";
import { addDays, todayInTz, periodKey, stepBack } from "../utils/dates.js";
import { completionXp, evaluateBadges, levelFromXp } from "../utils/gamification.js";
import mongoose from "mongoose";

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEMO_EMAIL = "demo@habitforge.app";
const DEMO_PASSWORD = "ForgeDemo123";

async function seed() {
  await connectDB();

  await User.deleteOne({ email: DEMO_EMAIL });
  const user = new User({ name: "Demo User", email: DEMO_EMAIL, timezone: env.seedTimezone || "UTC" });
  await user.setPassword(DEMO_PASSWORD);
  await user.save();
  await Habit.deleteMany({ user: user._id });
  await CheckIn.deleteMany({ user: user._id });

  const today = todayInTz(user.timezone);
  const DAYS = 105;
  const startKey = addDays(today, -DAYS);

  const habitDefs = [
    { name: "Drink a glass of water", icon: "droplet", color: "#6E9C94", minutes: 5, frequency: "daily", p: 0.86 },
    { name: "Read for 30 minutes", icon: "book", color: "#D9A441", minutes: 30, frequency: "daily", p: 0.66 },
    { name: "Go for a short walk", icon: "run", color: "#C4623A", minutes: 20, frequency: "daily", p: 0.5 },
    { name: "Stretch for 10 minutes", icon: "flower", color: "#D98E8E", minutes: 10, frequency: "daily", p: 0.6 },
    { name: "Weekly review", icon: "pen", color: "#8FA383", minutes: 15, frequency: "weekly", p: 0.85 },
  ];

  const habits = await Habit.insertMany(
    habitDefs.map((h) => ({
      user: user._id, name: h.name, icon: h.icon, color: h.color, minutes: h.minutes, frequency: h.frequency, createdAtKey: startKey,
    }))
  );

  const rand = mulberry32(20260919);
  const docs = [];
  const track = new Map(); // habitId -> { last period, run length }

  for (let i = -DAYS; i < 0; i++) {
    const dateKey = addDays(today, i);
    const t = (i + DAYS) / DAYS; // habits get steadier over time

    habits.forEach((habit, idx) => {
      const def = habitDefs[idx];
      let did;
      if (def.frequency === "daily") {
        did = rand() < Math.min(0.97, def.p + 0.14 * t);
        if (i === -1) did = def.name !== "Go for a short walk"; // yesterday: everything except the walk
        if (i >= -9 && def.name === "Drink a glass of water") did = true; // a visible recent streak
      } else {
        // ISO weekday: Sunday's local weekday number, close enough for demo purposes.
        const dow = new Date(dateKey + "T00:00:00Z").getUTCDay();
        did = dow === 0 && rand() < 0.85;
      }
      if (!did) return;

      const period = periodKey(def.frequency, dateKey);
      const tr = track.get(habit._id.toString()) || { last: null, run: 0 };
      tr.run = tr.last && stepBack(period, def.frequency) === tr.last ? tr.run + 1 : 1;
      tr.last = period;
      track.set(habit._id.toString(), tr);

      docs.push({ user: user._id, habit: habit._id, date: dateKey, xp: completionXp(def.frequency, tr.run) });
    });
  }

  await CheckIn.insertMany(docs);
  user.xp = docs.reduce((sum, d) => sum + d.xp, 0);
  user.isPremium = true;

  // Award every badge the seeded history already qualifies for, same rule the API uses live.
  const dailyDates = new Map();
  habits.forEach((h, idx) => {
    if (habitDefs[idx].frequency !== "daily") return;
    dailyDates.set(h._id.toString(), docs.filter((d) => d.habit.equals(h._id)).map((d) => d.date));
  });
  const dailyDone = [...dailyDates.values()].filter((dates) => dates.includes(today));
  const ctx = {
    total: docs.length,
    best: 0,
    habits: habits.length,
    level: levelFromXp(user.xp),
    perfect: dailyDates.size >= 3 && dailyDone.length === dailyDates.size,
  };
  // Recompute `best` properly by reusing the same streak function used at query time.
  const { analyzeHabit } = await import("../utils/gamification.js");
  ctx.best = Math.max(
    0,
    ...habits.map((h, idx) => {
      const dates = docs.filter((d) => d.habit.equals(h._id)).map((d) => d.date);
      return analyzeHabit(habitDefs[idx].frequency, dates, today).best;
    })
  );
  const earned = evaluateBadges(ctx);
  user.badges = earned.map((b) => ({ id: b.id, earnedAt: today }));
  await user.save();

  console.log("Seed complete.");
  console.log(`  Login:    ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`  Habits:   ${habits.length}`);
  console.log(`  Check-ins:${docs.length}`);
  console.log(`  XP:       ${user.xp} (level ${levelFromXp(user.xp)})`);
  console.log(`  Badges:   ${user.badges.map((b) => b.id).join(", ") || "none"}`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
