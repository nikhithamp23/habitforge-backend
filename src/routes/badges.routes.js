import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { BADGES, badgeSummary } from "../utils/gamification.js";

export const badgesRouter = Router();
badgesRouter.use(requireAuth);

// Full catalog, each marked with whether (and when) this user earned it —
// enough for the client to render both locked and unlocked badge tiles.
badgesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const earned = new Map(req.user.badges.map((b) => [b.id, b.earnedAt]));
    const badges = BADGES.map((b) => ({ ...badgeSummary(b), earned: earned.has(b.id), earnedAt: earned.get(b.id) || null }));
    res.json({ badges });
  })
);
