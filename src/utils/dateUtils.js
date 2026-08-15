// ---------------------------------------------------------------------------
// Date utilities — LOCAL DATE ONLY.
//
// Rule (per spec §7): dates are compared/stored as 'YYYY-MM-DD' strings built
// manually from getFullYear()/getMonth()/getDate(). We NEVER use
// Date.toISOString() (or any UTC-based conversion) for date comparison or
// storage, because that can silently shift a date to the previous/next day
// near midnight in timezones ahead of UTC (e.g. IST).
//
// Note: created_at/updated_at audit timestamps elsewhere in the app *do* use
// ISO strings — that's fine, because those are just bookkeeping metadata,
// not the diary "date" field this rule governs.
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Build a 'YYYY-MM-DD' string from a local Date object (never UTC). */
export function toLocalDateString(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Today's date as 'YYYY-MM-DD', using the device's local calendar day. */
export function getTodayLocalDateString() {
  return toLocalDateString(new Date());
}

/** { month: 1-12, year } for the device's current local date. */
export function getCurrentMonthYear() {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

/** Number of days in a given month/year (month is 1-12). Handles leap years. */
export function getDaysInMonth(month, year) {
  // Day 0 of "next month" == last day of "this month".
  return new Date(year, month, 0).getDate();
}

/** Build 'YYYY-MM-DD' from explicit year/month(1-12)/day parts — no Date math. */
export function buildDateString(year, month, day) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/**
 * True if dateString ('YYYY-MM-DD') is strictly after today's local date.
 * Safe to compare lexicographically because the format is zero-padded.
 */
export function isFutureDate(dateString) {
  return dateString > getTodayLocalDateString();
}

/** True if the given month/year matches the device's current local month/year. */
export function isDateInCurrentMonth(month, year) {
  const { month: curMonth, year: curYear } = getCurrentMonthYear();
  return month === curMonth && year === curYear;
}

export function getMonthName(month) {
  return MONTH_NAMES[month - 1] || '';
}

/** Human-readable display like "12 Aug 2026" — parsed from the string, no Date/UTC involved. */
export function formatDisplayDate(dateString) {
  const [y, m, d] = dateString.split('-').map(Number);
  return `${d} ${MONTH_ABBR[m - 1]} ${y}`;
}
