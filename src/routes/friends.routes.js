import { Router } from "express";
import { CheckIn } from "../models/CheckIn.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { todayInTz, startOfWeek } from "../utils/dates.js";

export const friendsRouter = Router();
friendsRouter.use(requireAuth);

// Sample data: a real "friends" feature needs a social graph (follow/accept
// requests) which is out of scope here. This route still computes the
// caller's OWN weekly XP for real, from their check-ins, so the board isn't
// entirely fake.
const SAMPLE_FRIENDS = [
  { name: "Mira K.", xp: 342 },
  { name: "Jonas", xp: 258 },
  { name: "Ada", xp: 176 },
  { name: "Theo", xp: 84 },
];

friendsRouter.get(
  "/leaderboard",
  asyncHandler(async (req, res) => {
    const today = todayInTz(req.user.timezone);
    const weekStart = startOfWeek(today);
    const myCheckIns = await CheckIn.find({ user: req.user._id, date: { $gte: weekStart } }).select("xp -_id").lean();
    const myWeeklyXp = myCheckIns.reduce((sum, c) => sum + c.xp, 0);

    const board = [...SAMPLE_FRIENDS.map((f) => ({ ...f, me: false })), { name: req.user.name, xp: myWeeklyXp, me: true }].sort(
      (a, b) => b.xp - a.xp
    );
    res.json({ weekStart, board });
  })
);
