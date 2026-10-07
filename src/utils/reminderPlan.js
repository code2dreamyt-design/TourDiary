// ---------------------------------------------------------------------------
// Pure planning of WHICH notifications should exist for the reminders and the
// daily diary reminder. The scheduler (services/reminderScheduler.js) only
// does the native scheduling; every decision about times lives here so it can
// be tested without a phone.
// ---------------------------------------------------------------------------
import {
  MINUTE,
  addDays,
  formatDateShort,
  formatTime12,
  isoWeekday,
  localDateKey,
  offsetLabel,
  parseHm,
  seriesBetween,
  startOfDay,
} from './notesTime';
import { DIARY_WINDOW_DAYS, FOLLOW_TIMES, ID_PREFIX_DIARY, ID_PREFIX_NOTE } from '../constants/notesData';

// How far ahead repeating reminders are laid out (re-laid on every app open).
const REPEAT_LOOKAHEAD_DAYS = { DAILY: 30, WEEKLY: 84, MONTHLY: 190 };
const REPEAT_MAX_OCCURRENCES = { DAILY: 30, WEEKLY: 12, MONTHLY: 6 };
const SOON_MS = 2000; // anything closer than this to "now" is not worth scheduling

/** The time a pending reminder is currently waiting for (snooze wins while it applies). */
export function effectiveDue(note, now = new Date()) {
  if (!note || !note.remindAt) return null;
  const remind = new Date(note.remindAt);
  if (note.snoozeUntil) {
    const snooze = new Date(note.snoozeUntil);
    if (snooze.getTime() > now.getTime() || snooze.getTime() > remind.getTime()) return snooze;
  }
  return remind;
}

function itemId(noteId, at) {
  return `${ID_PREFIX_NOTE}${noteId}-${Math.round(at.getTime() / MINUTE)}`;
}

/**
 * All notifications a pending reminder wants, future ones only:
 *   - "before" alerts (each chosen offset), the alert AT the due time,
 *   - optional follow-ups after the due time, and
 *   - for repeating reminders, the same for each coming occurrence.
 * Returns [{ id, at, type: 'before'|'due'|'follow', minutes, followN, due, noteId }].
 */
export function planReminder(note, now = new Date()) {
  if (!note || note.doneAt || !note.remindAt) return [];
  const nowMs = now.getTime();
  const remind = new Date(note.remindAt);
  const snooze = note.snoozeUntil ? new Date(note.snoozeUntil) : null;
  const repeat = note.repeat || 'NONE';
  const alerts = Array.from(new Set((note.alerts || []).filter((m) => m > 0))).sort((a, b) => b - a);
  const followEvery = note.followEvery > 0 ? note.followEvery : 0;

  // Each "due" is a moment the reminder is about; withBefore = also send the advance alerts for it.
  const dues = [];
  if (repeat === 'NONE') {
    if (snooze) dues.push({ date: snooze, withBefore: false });
    else dues.push({ date: remind, withBefore: true });
  } else {
    const base = new Date(note.baseAt || note.remindAt);
    const horizon = new Date(nowMs + (REPEAT_LOOKAHEAD_DAYS[repeat] || 30) * 86400000);
    seriesBetween(base, repeat, remind, horizon, REPEAT_MAX_OCCURRENCES[repeat] || 30).forEach((d) =>
      dues.push({ date: d, withBefore: true })
    );
    if (snooze) dues.push({ date: snooze, withBefore: false });
  }

  const out = new Map();
  const add = (at, type, minutes, followN, due) => {
    if (at.getTime() <= nowMs + SOON_MS) return;
    const id = itemId(note.id, at);
    if (!out.has(id)) out.set(id, { id, at, type, minutes, followN, due, noteId: note.id });
  };
  dues.forEach(({ date, withBefore }) => {
    if (withBefore) alerts.forEach((m) => add(new Date(date.getTime() - m * MINUTE), 'before', m, 0, date));
    add(new Date(date.getTime()), 'due', 0, 0, date);
    if (followEvery) {
      for (let n = 1; n <= FOLLOW_TIMES; n++) {
        add(new Date(date.getTime() + n * followEvery * MINUTE), 'follow', followEvery, n, date);
      }
    }
  });
  return Array.from(out.values()).sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Daily diary reminders for the next few weeks, honouring chosen weekdays and "skip if done". */
export function planDiary(settings, now = new Date(), doneToday = false) {
  if (!settings || !settings.enabled) return [];
  const { hour, minute } = parseHm(settings.time);
  const days = settings.days && settings.days.length ? settings.days : [1, 2, 3, 4, 5, 6, 7];
  const today = startOfDay(now);
  const out = [];
  for (let d = 0; d < DIARY_WINDOW_DAYS; d++) {
    const day = addDays(today, d);
    if (!days.includes(isoWeekday(day))) continue;
    const at = new Date(day.getTime());
    at.setHours(hour, minute, 0, 0);
    if (at.getTime() <= now.getTime() + SOON_MS) continue;
    if (d === 0 && settings.skipIfDone && doneToday) continue;
    out.push({ id: `${ID_PREFIX_DIARY}${localDateKey(day)}`, at, type: 'diary', day });
  }
  return out;
}

export function snippet(text, max = 110) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** Title/body shown in the notification for one planned item. */
export function buildContent(item, note) {
  if (item.type === 'diary') {
    return {
      title: 'Tour Diary',
      body: `Time to fill in today's entry (${formatDateShort(item.at)}).`,
    };
  }
  const title = note.title || 'Reminder';
  const extra = snippet(note.body, 90);
  const dueAt = formatTime12(item.due);
  if (item.type === 'before') {
    return {
      title: `In ${offsetLabel(item.minutes)}: ${title}`,
      body: extra ? `${dueAt} · ${extra}` : `Due at ${dueAt}.`,
    };
  }
  if (item.type === 'follow') {
    return {
      title: `Still pending: ${title}`,
      body: `Was due at ${dueAt}. Open the app and tap Done to stop these reminders.`,
    };
  }
  return { title, body: extra || 'Your reminder is due now.' };
}
