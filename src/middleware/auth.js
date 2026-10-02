import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { HttpError } from "../utils/httpError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const signToken = (userId) => jwt.sign({ sub: userId.toString() }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

// Verifies the bearer token and attaches the full user document to req.user.
// Loading the user (not just the id) lets every route read timezone/isPremium/xp
// without a second query.
export const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) throw new HttpError(401, "Missing or malformed Authorization header.", "UNAUTHENTICATED");

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw new HttpError(401, "Invalid or expired token.", "UNAUTHENTICATED");
  }

  const user = await User.findById(payload.sub);
  if (!user) throw new HttpError(401, "User no longer exists.", "UNAUTHENTICATED");
  req.user = user;
  next();
});

// Blocks a route for Free-plan accounts. Applied server-side so a modified
// or replayed client request can never reach a Pro-only feature for free.
export const requirePremium = (req, res, next) => {
  if (!req.user.isPremium) {
    throw new HttpError(402, "This feature needs HabitForge Pro.", "PREMIUM_REQUIRED");
  }
  next();
};
