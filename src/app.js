const cors = require('cors');
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { authRouter } from "./routes/auth.routes.js";
import { habitsRouter } from "./routes/habits.routes.js";
import { checkinsRouter } from "./routes/checkins.routes.js";
import { statsRouter } from "./routes/stats.routes.js";
import { badgesRouter } from "./routes/badges.routes.js";
import { billingRouter } from "./routes/billing.routes.js";
import { friendsRouter } from "./routes/friends.routes.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

export function createApp() {
  app.use(cors({
  origin: true,
  credentials: true
}));
 
  app.set("trust proxy", 1);
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cors());

  // Generous global limit plus a tight one on auth, since login/register are
  // the routes most worth slowing down for a brute-force attempt.
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));
  app.use("/api/auth/login", rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false }));
  app.use("/api/auth/register", rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false }));

  app.get("/api/health", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

  app.use("/api/auth", authRouter);
  app.use("/api/habits", habitsRouter);
  app.use("/api/habits/:habitId/checkins", checkinsRouter);
  app.use("/api/stats", statsRouter);
  app.use("/api/badges", badgesRouter);
  app.use("/api/billing", billingRouter);
  app.use("/api/friends", friendsRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
