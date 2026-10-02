# HabitForge API

A REST backend for HabitForge (Node.js, Express, MongoDB/Mongoose). Pairs with
the `habitforge-boho.jsx` frontend artifact, though it doesn't require it.

## Setup

```bash
npm install
cp .env.example .env        # then fill in MONGODB_URI and JWT_SECRET
npm run seed                # creates the Demo User with ~3.5 months of history
npm run dev                 # http://localhost:5000
npm test                    # unit tests for streaks, XP and levels
```

Demo login after seeding: `demo@habitforge.app` / `ForgeDemo123`.

## Project layout

```
src/
  config/     env loading, MongoDB connection
  models/     User, Habit, CheckIn (Mongoose schemas)
  middleware/ JWT auth, Pro-plan gate, error handler
  routes/     one file per resource (auth, habits, checkins, stats, badges, billing, friends)
  services/   habitService (streaks per user), gamificationService (badge awarding)
  utils/      dates.js, gamification.js — pure functions, no Express/Mongo imports
  seed/       seed.js — Demo User generator
test/         node:test unit tests for the pure logic
```

## Streaks, timezones and missed days

A check-in is stored as a **calendar date string** (`"YYYY-MM-DD"`) in the
user's own timezone — never a UTC timestamp. Every user has an IANA
`timezone` field (e.g. `Asia/Kolkata`); `todayInTz()` in `utils/dates.js` is
the only place "what day is it" gets computed, so a user in Kochi and a user
in New York get different "today"s from the same server clock, and a check-in
made at 11:58 pm always lands on the correct day.

**Streak algorithm** (`analyzeHabit` in `utils/gamification.js`):
1. Collapse check-ins into periods — one day for daily habits, one
   Monday-to-Sunday week for weekly habits.
2. Start at the current period. If it isn't done yet, start one period back,
   so the streak stays alive until the period actually ends.
3. Walk backward while each period has a check-in. The first gap stops the
   count.

Miss a full period and the streak resets to 0; the next check-in starts a new
streak at 1. `best` is tracked separately and never decreases. Weekly habits
are limited to one check-in per week (enforced in `checkins.routes.js`), so a
habit can't be checked in twice in the same week from two different dates.

## XP and levels

- Daily check-in: `10 + 2 × min(streak - 1, 14)` XP.
- Weekly check-in: `25 + 3 × min(streak - 1, 8)` XP.
- `level = floor(sqrt(xp / 40)) + 1`.

Undoing a check-in (`DELETE /checkins/today`) refunds exactly the XP that
check-in earned, so toggling back and forth can't be used to farm XP.

## Badges

Nine badges live in `utils/gamification.js` as small predicate functions over
`{ total, best, habits, level, perfect }`. `gamificationService.refreshBadges`
recomputes this context from the database after every check-in, undo, or new
habit and saves any newly-qualified badges — badges can never fall out of
sync with the real history, and nothing is ever revoked once earned.

## Free vs Pro

| | Free | Pro |
|---|---|---|
| Habits | up to 3 | unlimited |
| Streaks, XP, levels, badges | ✓ | ✓ |
| 30-day chart | ✓ | ✓ |
| Year heatmap | ✗ (`402 PREMIUM_REQUIRED`) | ✓ |
| CSV export | ✗ (`402 PREMIUM_REQUIRED`) | ✓ |

Gating happens **server-side**: `requirePremium` middleware checks
`req.user.isPremium` on the actual route (`GET /stats/heatmap`, `GET
/stats/export.csv`, and the habit-limit check in `POST /habits`), so a
modified frontend request can't bypass it.

`POST /api/billing/upgrade` and `/downgrade` are demo-only stand-ins for a
real payment flow, gated behind `ALLOW_DEMO_BILLING=true` in `.env`. To go to
production, replace `billing.routes.js` with Stripe Checkout: the browser
never sets `isPremium` directly, a webhook (verified with Stripe's signing
secret) is the only thing allowed to flip it on the `User` document, and every
other route is unchanged because they already just read `req.user.isPremium`.

## API reference

All routes except `/api/health`, `/api/auth/register` and `/api/auth/login`
require `Authorization: Bearer <token>`.

### Auth
| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/register` | `{ name, email, password, timezone }` → `{ token, user }` |
| POST | `/api/auth/login` | `{ email, password }` → `{ token, user }` |
| GET | `/api/auth/me` | current user |
| PATCH | `/api/auth/me` | update `name` / `timezone` |
| PUT | `/api/auth/me/reminder` | `{ on, time: "HH:MM" }` |

### Habits
| Method | Path | Notes |
|---|---|---|
| GET | `/api/habits` | active habits + live streak/done, in the user's timezone |
| POST | `/api/habits` | `{ name, frequency, icon?, color?, minutes? }`; `402` past the Free limit |
| PATCH | `/api/habits/:id` | edit everything except `frequency` |
| DELETE | `/api/habits/:id` | soft delete (archives; history and past XP are kept) |

### Check-ins
| Method | Path | Notes |
|---|---|---|
| GET | `/api/habits/:habitId/checkins` | full history for one habit |
| POST | `/api/habits/:habitId/checkins` | check in for today's period; `409` if already done |
| DELETE | `/api/habits/:habitId/checkins/today` | undo + refund XP; `404` if nothing to undo |

### Stats (Pro routes marked)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/stats/summary` | total check-ins, live streak, best streak |
| GET | `/api/stats/daily-rate?days=30` | daily completion % series |
| GET | `/api/stats/heatmap` | 🔒 Pro — counts per day, last 371 days |
| GET | `/api/stats/export.csv` | 🔒 Pro — CSV download |

### Other
| Method | Path | Notes |
|---|---|---|
| GET | `/api/badges` | full catalog + which this user earned |
| GET | `/api/friends/leaderboard` | sample friends + the caller's real weekly XP |
| POST | `/api/billing/upgrade` / `/downgrade` | demo-only, see above |

## Security notes

- Passwords hashed with bcrypt (cost 12); auth uses signed JWTs.
- `helmet`, CORS restricted to `CLIENT_ORIGIN`, and rate limiting (tighter on
  `/auth/login` and `/auth/register`).
- All input is validated in `utils/validate.js` before touching the database.
- Every habit/check-in query is scoped to `req.user._id`, so one account can
  never read or modify another's data.

## What's not included

- Real payment integration (Stripe) — see the Free vs Pro section.
- Push notifications for the reminder (the frontend's reminder is in-app
  only); a production version would need a scheduler (e.g. node-cron or a
  queue) plus a push/email provider.
- A real social graph for friends (follow requests, invites).
