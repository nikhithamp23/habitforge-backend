import { HttpError } from "./httpError.js";
import { isValidTimezone } from "./dates.js";
function isValidTz(tz) {
  if (typeof tz !== "string" || !tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const bad = (message) => new HttpError(400, message, "VALIDATION");
const COLOR = /^#[0-9a-fA-F]{6}$/;
const ICON = /^[a-z0-9-]{1,20}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseHabitInput(body = {}, { partial = false } = {}) {
  const out = {};

  if (!partial || body.name !== undefined) {
    const name = String(body.name ?? "").trim();
    if (name.length < 1 || name.length > 40) throw bad("Name must be 1 to 40 characters.");
    out.name = name;
  }
  if (partial) {
    if (body.frequency !== undefined) throw bad("Repeat schedule can't change after creation.");
  } else {
    const frequency = body.frequency ?? "daily";
    if (!["daily", "weekly"].includes(frequency)) throw bad("Frequency must be daily or weekly.");
    out.frequency = frequency;
  }
  if (body.icon !== undefined) {
    if (!ICON.test(String(body.icon))) throw bad("Icon must be a short lowercase key such as droplet.");
    out.icon = String(body.icon);
  }
  if (body.color !== undefined) {
    if (!COLOR.test(String(body.color))) throw bad("Color must be a hex value such as #C4623A.");
    out.color = String(body.color);
  }
  if (body.minutes !== undefined) {
    const minutes = Number(body.minutes);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 240) throw bad("Minutes must be a whole number from 1 to 240.");
    out.minutes = minutes;
  }
  return out;
}

export function parseRegisterInput(body = {}) {
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const tz = body.timezone === "Asia/Calcutta" ? "Asia/Kolkata" : body.timezone;

  if (name.length < 1 || name.length > 60) throw bad("Name must be 1 to 60 characters.");
  if (!EMAIL.test(email) || email.length > 254) throw bad("Enter a valid email address.");
  if (password.length < 8 || password.length > 72) throw bad("Password must be 8 to 72 characters.");
  if (!isValidTz(tz)) throw bad("Tz must be a valid IANA name such as Asia/Kolkata.");
  return { name, email, password, tz };
}

export function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
