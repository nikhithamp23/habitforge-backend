import { Router } from "express";
import { Habit } from "../models/Habit.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../utils/httpError.js";
import { parseHabitInput } from "../utils/validate.js";
import { getHabitsWithStreaks, countActiveHabits } from "../services/habitService.js";
import { todayInTz } from "../utils/dates.js";
import { env } from "../config/env.js";

export const habitsRouter = Router();
habitsRouter.use(requireAuth);

// GET /api/habits — every active habit plus its live streak, relative to the
// caller's own "today" (their timezone, not the server's).
habitsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const today = todayInTz(req.user.timezone);
    const habits = await getHabitsWithStreaks(req.user._id, today);
    res.json({ today, habits });
  })
);

habitsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = parseHabitInput(req.body, { partial: false });

    if (!req.user.isPremium) {
      const activeCount = await countActiveHabits(req.user._id);
      if (activeCount >= env.freeHabitLimit) {
        throw new HttpError(402, `The Free plan holds ${env.freeHabitLimit} habits. Upgrade to Pro to add more.`, "PREMIUM_REQUIRED");
      }
    }

    const today = todayInTz(req.user.timezone);
    const habit = await Habit.create({ user: req.user._id, createdAtKey: today, ...input });
    res.status(201).json({ habit: { ...habit.toObject(), id: habit._id.toString() } });
  })
);

habitsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = parseHabitInput(req.body, { partial: true }); // rejects attempts to change `frequency`
    const habit = await Habit.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id, archivedAt: null },
      { $set: input },
      { new: true, runValidators: true }
    );
    if (!habit) throw new HttpError(404, "Habit not found.", "NOT_FOUND");
    res.json({ habit: { ...habit.toObject(), id: habit._id.toString() } });
  })
);

// Soft delete: archives the habit but keeps its check-in history and the XP
// already earned from it, so past totals and badges never move backward.
habitsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const habit = await Habit.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id, archivedAt: null },
      { $set: { archivedAt: new Date() } },
      { new: true }
    );
    if (!habit) throw new HttpError(404, "Habit not found.", "NOT_FOUND");
    res.status(204).end();
  })
);
