import { Router } from "express";
import { User } from "../models/User.js";
import { signToken, requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../utils/httpError.js";
import { parseRegisterInput } from "../utils/validate.js";

export const authRouter = Router();

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { name, email, password, timezone } = parseRegisterInput(req.body);

    const existing = await User.findOne({ email });
    if (existing) throw new HttpError(409, "An account with that email already exists.", "DUPLICATE");

    const user = new User({ name, email, timezone });
    await user.setPassword(password);
    await user.save();

    res.status(201).json({ token: signToken(user._id), user: user.toPublicJSON() });
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const email = String(req.body.email ?? "").trim().toLowerCase();
    const password = String(req.body.password ?? "");

    // Same message for "no such user" and "wrong password", so a client can't
    // use the error to discover which emails are registered.
    const user = await User.findOne({ email });
    const ok = user && (await user.checkPassword(password));
    if (!ok) throw new HttpError(401, "Incorrect email or password.", "INVALID_CREDENTIALS");

    res.json({ token: signToken(user._id), user: user.toPublicJSON() });
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user.toPublicJSON() });
  })
);

authRouter.patch(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { name, timezone } = req.body;
    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (trimmed.length < 1 || trimmed.length > 60) throw new HttpError(400, "Name must be 1 to 60 characters.", "VALIDATION");
      req.user.name = trimmed;
    }
    if (timezone !== undefined) req.user.timezone = String(timezone); // validated implicitly: bad IANA names just fall back to UTC math elsewhere
    await req.user.save();
    res.json({ user: req.user.toPublicJSON() });
  })
);

authRouter.put(
  "/me/reminder",
  requireAuth,
  asyncHandler(async (req, res) => {
    const on = Boolean(req.body.on);
    const time = String(req.body.time ?? "08:00");
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new HttpError(400, "Time must be in HH:MM 24-hour format.", "VALIDATION");
    req.user.reminder = { on, time };
    await req.user.save();
    res.json({ user: req.user.toPublicJSON() });
  })
);
