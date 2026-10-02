import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../utils/httpError.js";
import { env } from "../config/env.js";

export const billingRouter = Router();
billingRouter.use(requireAuth);

/*
 * These two routes exist so the frontend's Pro toggle has something real to
 * call in development. They take no payment and are gated by
 * ALLOW_DEMO_BILLING so they can be switched off in any environment that
 * isn't a sandbox.
 *
 * For production: replace this file with Stripe Checkout (or another
 * provider). The browser never sets isPremium directly — Checkout redirects
 * back, and a webhook handler (verified with the provider's signing secret)
 * is the only thing allowed to flip isPremium on the User document. Every
 * Pro-gated route already reads req.user.isPremium via requirePremium, so no
 * other code needs to change.
 */
billingRouter.post(
  "/upgrade",
  asyncHandler(async (req, res) => {
    if (!env.allowDemoBilling) throw new HttpError(403, "Demo billing is disabled. Wire up a real payment provider.", "DEMO_DISABLED");
    req.user.isPremium = true;
    await req.user.save();
    res.json({ user: req.user.toPublicJSON() });
  })
);

billingRouter.post(
  "/downgrade",
  asyncHandler(async (req, res) => {
    if (!env.allowDemoBilling) throw new HttpError(403, "Demo billing is disabled.", "DEMO_DISABLED");
    req.user.isPremium = false;
    await req.user.save();
    res.json({ user: req.user.toPublicJSON() });
  })
);
