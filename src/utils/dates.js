/*
 * Date helpers.
 *
 * A check-in is stored as a calendar date string "YYYY-MM-DD" in the USER'S timezone,
 * never as a UTC timestamp. All date math below runs on those strings using UTC
 * arithmetic, so daylight-saving changes can never shift a day.
 */
const pad = (n) => String(n).padStart(2, "0");

const toUTC = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const fromUTC = (dt) => `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;

export const addDays = (key, n) => {
  const dt = toUTC(key);
  dt.setUTCDate(dt.getUTCDate() + n);
  return fromUTC(dt);
};

// Weeks start on Monday.
export const startOfWeek = (key) => addDays(key, -((toUTC(key).getUTCDay() + 6) % 7));

// The "period" a check-in belongs to: the day itself (daily) or the Monday of its week (weekly).
export const periodKey = (frequency, dateKey) => (frequency === "weekly" ? startOfWeek(dateKey) : dateKey);
export const stepBack = (period, frequency) => addDays(period, frequency === "weekly" ? -7 : -1);

export function isValidTimezone(tz) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return typeof tz === "string" && tz.length > 0;
  } catch {
    return false;
  }
}

// "What calendar date is it right now for someone in this timezone?"
export function todayInTz(timeZone = "UTC", now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
