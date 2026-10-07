// Presentation helpers for the Notes screens (grouping, search, summaries).
import { effectiveDue } from './reminderPlan';
import { friendlyDateTime, isSameDay, offsetLabel } from './notesTime';
import { ALERT_OPTIONS, FOLLOW_OPTIONS, REPEAT_OPTIONS } from '../constants/notesData';

/**
 * Splits reminders into the sections the list shows:
 *   overdue (pending, due time passed), today, upcoming, done.
 * Pending sections are oldest-first; done is newest-first.
 */
export function groupReminders(reminders, now = new Date()) {
  const overdue = [];
  const today = [];
  const upcoming = [];
  const done = [];
  reminders.forEach((r) => {
    if (r.doneAt) {
      done.push(r);
      return;
    }
    const due = effectiveDue(r, now);
    if (!due) return;
    if (due.getTime() <= now.getTime()) overdue.push(r);
    else if (isSameDay(due, now)) today.push(r);
    else upcoming.push(r);
  });
  const byDue = (a, b) => effectiveDue(a, now).getTime() - effectiveDue(b, now).getTime();
  overdue.sort(byDue);
  today.sort(byDue);
  upcoming.sort(byDue);
  done.sort((a, b) => String(b.doneAt).localeCompare(String(a.doneAt)));
  return { overdue, today, upcoming, done };
}

export function repeatLabel(value) {
  const o = REPEAT_OPTIONS.find((x) => x.value === value);
  return o ? o.label : 'Once';
}

/** One-line description of when alerts go out, e.g. "1 day & 1 hour before · at time". */
export function alertsSummary(note) {
  const parts = [];
  const offsets = (note.alerts || []).filter((m) => m > 0).sort((a, b) => b - a);
  if (offsets.length) parts.push(`${offsets.map(offsetLabel).join(' & ')} before`);
  parts.push('at the time');
  if (note.followEvery > 0) {
    const f = FOLLOW_OPTIONS.find((x) => x.value === note.followEvery);
    parts.push(f ? `then ${f.label.toLowerCase()} until done` : 'then follow-ups');
  }
  return parts.join(' · ');
}

export function alertOptionLabel(value) {
  const o = ALERT_OPTIONS.find((x) => x.value === value);
  return o ? o.label : offsetLabel(value);
}

/** Text shown under a reminder's title in the list. */
export function reminderWhenText(note, now = new Date()) {
  const due = effectiveDue(note, now);
  if (!due) return '';
  const snoozed = note.snoozeUntil && due.getTime() === new Date(note.snoozeUntil).getTime();
  return `${snoozed ? 'Snoozed to ' : ''}${friendlyDateTime(due, now)}`;
}

export function noteMatchesSearch(note, text) {
  const q = String(text || '').trim().toLowerCase();
  if (!q) return true;
  return [note.title, note.body, note.place].some((f) => String(f || '').toLowerCase().includes(q));
}
