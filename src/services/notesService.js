import * as FileSystem from 'expo-file-system/legacy';
import * as repo from '../repositories/notesRepository';
import { assertWriteAllowed, checkWriteAccess } from './notesAccess';
import { diarySettingsToEntries, readDiarySettings, toNote } from './notesModel';
import * as scheduler from './reminderScheduler';
import { nextOccurrenceAfter, addDays } from '../utils/notesTime';
import {
  ALERT_OPTIONS,
  FOLLOW_OPTIONS,
  KIND_OBSERVATION,
  KIND_REMINDER,
  KIND_SIMPLE,
  MAX_OBS_PHOTOS,
  REPEAT_OPTIONS,
} from '../constants/notesData';

// ---------------------------------------------------------------------------
// Notes: simple notes, observations (with photos) and reminders.
//
// Every function that CHANGES anything starts with assertWriteAllowed() — the
// same signed, offline-verified subscription gate as the diary and the TD
// calculator — so the lock is enforced here and no screen can bypass it.
// Reading notes is never gated. Notification problems never fail a save: they
// come back as `notifyStatus` so the screen can tell the user.
// ---------------------------------------------------------------------------

export { checkWriteAccess };

const PRIVATE_PHOTO_MARK = '/notes_photos/';

function nowIso() {
  return new Date().toISOString();
}

function validationError(message) {
  const err = new Error(message);
  err.code = 'VALIDATION';
  return err;
}

const cleanText = (v) => String(v == null ? '' : v).trim();

// ---- reading ---------------------------------------------------------------------

async function withPhotos(rows) {
  const ids = rows.filter((r) => r.kind === KIND_OBSERVATION).map((r) => r.id);
  const photoRows = await repo.listPhotoRows(ids);
  const byNote = new Map();
  photoRows.forEach((p) => {
    if (!byNote.has(p.note_id)) byNote.set(p.note_id, []);
    byNote.get(p.note_id).push(p);
  });
  return rows.map((r) => toNote(r, byNote.get(r.id) || []));
}

/** Everything, split by kind: { simple, observations, reminders }. */
export async function listAll() {
  const notes = await withPhotos(await repo.listNoteRows());
  const out = { simple: [], observations: [], reminders: [] };
  notes.forEach((n) => {
    if (n.kind === KIND_SIMPLE) out.simple.push(n);
    else if (n.kind === KIND_OBSERVATION) out.observations.push(n);
    else if (n.kind === KIND_REMINDER) out.reminders.push(n);
  });
  // simple + observations: pinned first, then newest edit first. observations: by when they were seen.
  const byPinnedThenNew = (a, b) => Number(b.pinned) - Number(a.pinned) || String(b.updatedAt).localeCompare(String(a.updatedAt));
  out.simple.sort(byPinnedThenNew);
  out.observations.sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || String(b.observedAt || b.createdAt).localeCompare(String(a.observedAt || a.createdAt))
  );
  return out;
}

export async function getNote(id) {
  const row = await repo.getNoteRow(id);
  if (!row) return null;
  return (await withPhotos([row]))[0];
}

// ---- simple notes ------------------------------------------------------------------

export async function saveSimple({ id, title, body, color, pinned }) {
  await assertWriteAllowed();
  const t = cleanText(title);
  const b = String(body == null ? '' : body).replace(/\s+$/, '');
  if (!t && !cleanText(b)) throw validationError('Write something in the note before saving.');
  const fields = {
    kind: KIND_SIMPLE, title: t, body: b, color: color || '', pinned: !!pinned,
    category: '', observedAt: null, place: '', latitude: null, longitude: null, accuracy: null,
    remindAt: null, baseAt: null, repeat: 'NONE', alerts: [], followEvery: 0, snoozeUntil: null, doneAt: null,
  };
  const ts = nowIso();
  const noteId = id ? id : await repo.insertNote(fields, ts);
  if (id) await repo.updateNote(id, fields, ts);
  return { note: await getNote(noteId) };
}

// ---- observations ---------------------------------------------------------------------

function isPrivatePhoto(uri) {
  return typeof uri === 'string' && uri.includes(PRIVATE_PHOTO_MARK);
}

async function deletePrivateFiles(photos) {
  for (const p of photos) {
    if (!isPrivatePhoto(p.uri)) continue; // gallery photos belong to the user's gallery; never deleted from here
    try {
      await FileSystem.deleteAsync(p.uri, { idempotent: true });
    } catch (e) {
      // best-effort cleanup
    }
  }
}

export async function saveObservation({ id, title, body, category, observedAt, place, latitude, longitude, accuracy, pinned, photos }) {
  await assertWriteAllowed();
  const t = cleanText(title);
  if (!t) throw validationError('Give the observation a short title.');
  if (!category) throw validationError('Choose what kind of observation this is.');
  const seen = observedAt ? new Date(observedAt) : new Date();
  if (Number.isNaN(seen.getTime())) throw validationError('The date and time of the observation is not valid.');
  if (seen.getTime() > Date.now() + 60 * 1000) throw validationError('An observation cannot be in the future.');
  const list = Array.isArray(photos) ? photos : [];
  if (list.length > MAX_OBS_PHOTOS) throw validationError(`You can attach up to ${MAX_OBS_PHOTOS} photos.`);

  const fields = {
    kind: KIND_OBSERVATION, title: t, body: String(body == null ? '' : body).replace(/\s+$/, ''), color: '', pinned: !!pinned,
    category, observedAt: seen.toISOString(), place: cleanText(place),
    latitude: latitude == null ? null : Number(latitude), longitude: longitude == null ? null : Number(longitude),
    accuracy: accuracy == null ? null : Number(accuracy),
    remindAt: null, baseAt: null, repeat: 'NONE', alerts: [], followEvery: 0, snoozeUntil: null, doneAt: null,
  };
  const ts = nowIso();
  let previous = [];
  if (id) previous = (await getNote(id))?.photos || [];
  const noteId = id ? id : await repo.insertNote(fields, ts);
  if (id) await repo.updateNote(id, fields, ts);
  await repo.replacePhotos(noteId, list, ts);

  const keep = new Set(list.map((p) => p.uri));
  await deletePrivateFiles(previous.filter((p) => !keep.has(p.uri)));
  return { note: await getNote(noteId) };
}

// ---- reminders -----------------------------------------------------------------------------

async function afterReminderChange({ prompt }) {
  const allowed = await scheduler.ensurePermission(prompt);
  const res = await scheduler.syncAll();
  if (!allowed) return 'NO_PERMISSION';
  return res.status === 'OK' ? 'OK' : res.status;
}

export async function saveReminder({ id, title, body, remindAt, repeat, alerts, followEvery }) {
  await assertWriteAllowed();
  const t = cleanText(title);
  if (!t) throw validationError('Give the reminder a title.');
  const when = remindAt ? new Date(remindAt) : null;
  if (!when || Number.isNaN(when.getTime())) throw validationError('Pick a date and time for the reminder.');
  const rep = REPEAT_OPTIONS.some((o) => o.value === repeat) ? repeat : 'NONE';
  const offsets = Array.from(new Set((alerts || []).map(Number))).filter((m) => ALERT_OPTIONS.some((o) => o.value === m));
  const follow = FOLLOW_OPTIONS.some((o) => o.value === followEvery) ? followEvery : 0;

  const existing = id ? await getNote(id) : null;
  const sameTime = existing && existing.remindAt && new Date(existing.remindAt).getTime() === when.getTime();
  // a new time (or a new reminder) must be in the future; leaving an old time untouched is fine
  if (!sameTime && when.getTime() <= Date.now()) throw validationError('Pick a time in the future.');

  const timeChanged = !existing || !sameTime || existing.repeat !== rep;
  const fields = {
    kind: KIND_REMINDER, title: t, body: String(body == null ? '' : body).replace(/\s+$/, ''), color: '', pinned: false,
    category: '', observedAt: null, place: '', latitude: null, longitude: null, accuracy: null,
    remindAt: when.toISOString(),
    baseAt: timeChanged ? when.toISOString() : existing.baseAt || when.toISOString(),
    repeat: rep, alerts: offsets, followEvery: follow,
    snoozeUntil: timeChanged ? null : existing.snoozeUntil,
    doneAt: timeChanged ? null : existing.doneAt, // moving a finished reminder to a new time reopens it
  };
  const ts = nowIso();
  const noteId = id ? id : await repo.insertNote(fields, ts);
  if (id) await repo.updateNote(id, fields, ts);
  const notifyStatus = await afterReminderChange({ prompt: true });
  return { note: await getNote(noteId), notifyStatus };
}

/**
 * Marks a reminder done. A repeating reminder is not "finished": it moves on to
 * its next occurrence. Returns { note, next } where next is that Date (or null).
 */
export async function completeReminder(id) {
  await assertWriteAllowed();
  const note = await getNote(id);
  if (!note || note.kind !== KIND_REMINDER) throw validationError('This reminder no longer exists.');
  const ts = nowIso();
  let next = null;
  if (note.repeat !== 'NONE') {
    const after = new Date(Math.max(Date.now(), new Date(note.remindAt).getTime()));
    next = nextOccurrenceAfter(new Date(note.baseAt || note.remindAt), note.repeat, after);
  }
  if (next) {
    await repo.setReminderState(id, { doneAt: null, remindAt: next.toISOString(), snoozeUntil: null }, ts);
  } else {
    await repo.setReminderState(id, { doneAt: ts, remindAt: note.remindAt, snoozeUntil: null }, ts);
  }
  await scheduler.syncAll();
  return { note: await getNote(id), next };
}

export async function reopenReminder(id) {
  await assertWriteAllowed();
  const note = await getNote(id);
  if (!note || note.kind !== KIND_REMINDER) throw validationError('This reminder no longer exists.');
  await repo.setReminderState(id, { doneAt: null, remindAt: note.remindAt, snoozeUntil: null }, nowIso());
  const notifyStatus = await afterReminderChange({ prompt: true });
  return { note: await getNote(id), notifyStatus };
}

/** option: minutes from now (10, 60 ...) or 'TOMORROW' (9:00 AM tomorrow). */
export async function snoozeReminder(id, option) {
  await assertWriteAllowed();
  const note = await getNote(id);
  if (!note || note.kind !== KIND_REMINDER) throw validationError('This reminder no longer exists.');
  let until;
  if (option === 'TOMORROW') {
    until = addDays(new Date(), 1);
    until.setHours(9, 0, 0, 0);
  } else {
    until = new Date(Date.now() + Number(option) * 60 * 1000);
  }
  await repo.setReminderState(id, { doneAt: null, remindAt: note.remindAt, snoozeUntil: until.toISOString() }, nowIso());
  const notifyStatus = await afterReminderChange({ prompt: true });
  return { note: await getNote(id), until, notifyStatus };
}

// ---- shared ------------------------------------------------------------------------------------

export async function setPinned(id, pinned) {
  await assertWriteAllowed();
  await repo.setPinned(id, pinned, nowIso());
}

export async function deleteNote(id) {
  await assertWriteAllowed();
  const note = await getNote(id);
  if (!note) return;
  await repo.deleteNote(id);
  await deletePrivateFiles(note.photos);
  if (note.kind === KIND_REMINDER) await scheduler.syncAll();
}

// ---- diary reminder settings ---------------------------------------------------------------------

export async function getDiarySettings() {
  return readDiarySettings(await repo.getAllSettings());
}

export async function saveDiarySettings(settings) {
  await assertWriteAllowed();
  if (!settings.days || settings.days.length === 0) throw validationError('Choose at least one day for the diary reminder.');
  await repo.setSettings(diarySettingsToEntries(settings));
  const notifyStatus = settings.enabled ? await afterReminderChange({ prompt: true }) : (await scheduler.syncAll(), 'OK');
  return { settings: await getDiarySettings(), notifyStatus };
}
