// ---------------------------------------------------------------------------
// Pure date helpers for Notes / reminders. No React, no native modules, so the
// logic can be unit-tested in plain Node. All maths is on the device's LOCAL
// calendar (a reminder "at 4:30 PM" stays at 4:30 PM).
// ---------------------------------------------------------------------------

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const pad2 = (n) => String(n).padStart(2, '0');

export function addDays(date, n) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + n);
  return d;
}

/** Adds whole months, clamping to the month's last day (31 Jan + 1 month = 28/29 Feb). */
export function addMonthsClamped(date, n, anchorDay) {
  const d = new Date(date.getTime());
  const day = anchorDay || date.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, dim));
  return d;
}

export function startOfDay(date) {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Whole-day number of a LOCAL calendar date (immune to DST length changes).
function dayNumber(d) {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY);
}

/** 'YYYY-MM-DD' from local date parts (same convention as utils/dateUtils). */
export function localDateKey(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** ISO weekday: Monday = 1 ... Sunday = 7. */
export function isoWeekday(d) {
  const w = d.getDay();
  return w === 0 ? 7 : w;
}

/** "HH:mm" -> { hour, minute } (falls back to 18:00 for bad input). */
export function parseHm(text) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(text || ''));
  if (!m) return { hour: 18, minute: 0 };
  const hour = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const minute = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return { hour, minute };
}
export const formatHm = (hour, minute) => `${pad2(hour)}:${pad2(minute)}`;

// ---- repeating series -----------------------------------------------------

/** The k-th occurrence (k = 0 is the base itself) of a repeating series. */
export function occurrenceAt(base, repeat, k) {
  if (!k || k <= 0) return new Date(base.getTime());
  if (repeat === 'DAILY') return addDays(base, k);
  if (repeat === 'WEEKLY') return addDays(base, 7 * k);
  if (repeat === 'MONTHLY') return addMonthsClamped(base, k, base.getDate());
  return new Date(base.getTime());
}

function firstIndexNear(base, repeat, ref) {
  if (repeat === 'MONTHLY') {
    return Math.max(0, (ref.getFullYear() - base.getFullYear()) * 12 + ref.getMonth() - base.getMonth() - 1);
  }
  const per = repeat === 'WEEKLY' ? 7 : 1;
  return Math.max(0, Math.floor((dayNumber(ref) - dayNumber(base)) / per) - 1);
}

/** First occurrence strictly after `after`, or null (a one-off already in the past). */
export function nextOccurrenceAfter(base, repeat, after) {
  if (!repeat || repeat === 'NONE') return base.getTime() > after.getTime() ? new Date(base.getTime()) : null;
  if (base.getTime() > after.getTime()) return new Date(base.getTime());
  const k0 = firstIndexNear(base, repeat, after);
  for (let k = k0; k < k0 + 400; k++) {
    const c = occurrenceAt(base, repeat, k);
    if (c.getTime() > after.getTime()) return c;
  }
  return null;
}

/** Occurrences in [from, to], ascending, at most `max` of them. */
export function seriesBetween(base, repeat, from, to, max = 60) {
  const out = [];
  if (!repeat || repeat === 'NONE') {
    if (base.getTime() >= from.getTime() && base.getTime() <= to.getTime()) out.push(new Date(base.getTime()));
    return out;
  }
  const k0 = firstIndexNear(base, repeat, from);
  for (let k = k0; k < k0 + 800 && out.length < max; k++) {
    const c = occurrenceAt(base, repeat, k);
    if (c.getTime() > to.getTime()) break;
    if (c.getTime() >= from.getTime()) out.push(c);
  }
  return out;
}

// ---- display ------------------------------------------------------------------

export function formatTime12(d) {
  let h = d.getHours();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${pad2(d.getMinutes())} ${ap}`;
}

/** "Fri, 2 Oct" (adds the year when it is not the current year). */
export function formatDateShort(d, now = new Date()) {
  const base = `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

export function formatDateLong(d) {
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "Today, 4:30 PM" / "Tomorrow, 9:00 AM" / "Yesterday, ..." / "Fri, 2 Oct, 4:30 PM". */
export function friendlyDateTime(d, now = new Date()) {
  const diff = dayNumber(d) - dayNumber(now);
  let dayText;
  if (diff === 0) dayText = 'Today';
  else if (diff === 1) dayText = 'Tomorrow';
  else if (diff === -1) dayText = 'Yesterday';
  else dayText = formatDateShort(d, now);
  return `${dayText}, ${formatTime12(d)}`;
}

/** "5 min", "1 hour", "3 hours", "1 day", "2 days" for an alert offset in minutes. */
export function offsetLabel(minutes) {
  if (minutes % 1440 === 0) {
    const n = minutes / 1440;
    return `${n} day${n === 1 ? '' : 's'}`;
  }
  if (minutes % 60 === 0) {
    const n = minutes / 60;
    return `${n} hour${n === 1 ? '' : 's'}`;
  }
  return `${minutes} min`;
}

/** "5 min overdue", "2 h 10 min overdue", "3 days overdue" — for something due in the past. */
export function overdueText(due, now = new Date()) {
  const ms = now.getTime() - due.getTime();
  if (ms < MINUTE) return 'Due now';
  const mins = Math.floor(ms / MINUTE);
  if (mins < 60) return `${mins} min overdue`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    const rest = mins % 60;
    return rest ? `${hours} h ${rest} min overdue` : `${hours} h overdue`;
  }
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} overdue`;
}
