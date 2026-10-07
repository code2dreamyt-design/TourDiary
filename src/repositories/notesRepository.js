import { getNotesDb } from '../database/notesSchema';

// Raw SQL for the Notes feature. No business rules here (those live in
// services/notesService.js) — this file only reads and writes rows.

const FIELD_COLS = `kind, title, body, color, pinned, category, observed_at, place, latitude, longitude, accuracy,
  remind_at, base_at, repeat, alerts, follow_every, snooze_until, done_at`;

function fieldValues(f) {
  return [
    f.kind,
    f.title,
    f.body,
    f.color,
    f.pinned ? 1 : 0,
    f.category,
    f.observedAt,
    f.place,
    f.latitude,
    f.longitude,
    f.accuracy,
    f.remindAt,
    f.baseAt,
    f.repeat,
    JSON.stringify(f.alerts || []),
    f.followEvery || 0,
    f.snoozeUntil,
    f.doneAt,
  ];
}

export async function insertNote(f, ts) {
  const db = await getNotesDb();
  const res = await db.runAsync(
    `INSERT INTO notes (${FIELD_COLS}, created_at, updated_at) VALUES (${new Array(18).fill('?').join(',')}, ?, ?);`,
    [...fieldValues(f), ts, ts]
  );
  return res.lastInsertRowId;
}

export async function updateNote(id, f, ts) {
  const db = await getNotesDb();
  await db.runAsync(
    `UPDATE notes SET kind = ?, title = ?, body = ?, color = ?, pinned = ?, category = ?, observed_at = ?, place = ?,
       latitude = ?, longitude = ?, accuracy = ?, remind_at = ?, base_at = ?, repeat = ?, alerts = ?, follow_every = ?,
       snooze_until = ?, done_at = ?, updated_at = ? WHERE id = ?;`,
    [...fieldValues(f), ts, id]
  );
}

export async function deleteNote(id) {
  const db = await getNotesDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM note_photos WHERE note_id = ?;', [id]);
    await db.runAsync('DELETE FROM notes WHERE id = ?;', [id]);
  });
}

export async function getNoteRow(id) {
  const db = await getNotesDb();
  return db.getFirstAsync('SELECT * FROM notes WHERE id = ?;', [id]);
}

export async function listNoteRows(kind) {
  const db = await getNotesDb();
  if (kind) {
    return db.getAllAsync('SELECT * FROM notes WHERE kind = ? ORDER BY pinned DESC, updated_at DESC, id DESC;', [kind]);
  }
  return db.getAllAsync('SELECT * FROM notes ORDER BY id ASC;');
}

export async function listPendingReminderRows() {
  const db = await getNotesDb();
  return db.getAllAsync(
    "SELECT * FROM notes WHERE kind = 'REMINDER' AND done_at IS NULL AND remind_at IS NOT NULL ORDER BY remind_at ASC;"
  );
}

export async function setPinned(id, pinned, ts) {
  const db = await getNotesDb();
  await db.runAsync('UPDATE notes SET pinned = ?, updated_at = ? WHERE id = ?;', [pinned ? 1 : 0, ts, id]);
}

/** Reminder progress: done / reopened / advanced to the next occurrence / snoozed. */
export async function setReminderState(id, { doneAt, remindAt, snoozeUntil }, ts) {
  const db = await getNotesDb();
  await db.runAsync(
    'UPDATE notes SET done_at = ?, remind_at = ?, snooze_until = ?, updated_at = ? WHERE id = ?;',
    [doneAt, remindAt, snoozeUntil, ts, id]
  );
}

// ---- photos -------------------------------------------------------------------

export async function listPhotoRows(noteIds) {
  const db = await getNotesDb();
  if (!noteIds || noteIds.length === 0) return [];
  const marks = noteIds.map(() => '?').join(',');
  return db.getAllAsync(`SELECT * FROM note_photos WHERE note_id IN (${marks}) ORDER BY note_id ASC, position ASC;`, noteIds);
}

export async function replacePhotos(noteId, photos, ts) {
  const db = await getNotesDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM note_photos WHERE note_id = ?;', [noteId]);
    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      await db.runAsync(
        `INSERT INTO note_photos (note_id, position, uri, media_id, taken_at, latitude, longitude, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        [noteId, i, p.uri, p.mediaId == null ? null : String(p.mediaId), p.takenAt || null, p.latitude ?? null, p.longitude ?? null, ts]
      );
    }
  });
}

// ---- settings (diary reminder) ------------------------------------------------

export async function getAllSettings() {
  const db = await getNotesDb();
  const rows = await db.getAllAsync('SELECT key, value FROM notes_settings;');
  const out = {};
  rows.forEach((r) => {
    out[r.key] = r.value;
  });
  return out;
}

export async function setSettings(entries) {
  const db = await getNotesDb();
  await db.withTransactionAsync(async () => {
    for (const [key, value] of Object.entries(entries)) {
      await db.runAsync('INSERT OR REPLACE INTO notes_settings (key, value) VALUES (?, ?);', [key, String(value)]);
    }
  });
}

// ---- read-only peek at the diary (never written from here) -----------------------

/** True if the diary entry for this local date ('YYYY-MM-DD') is already completed. */
export async function isDiaryEntryDone(dateKey) {
  const db = await getNotesDb();
  const row = await db.getFirstAsync("SELECT 1 AS done FROM diary_entries WHERE date = ? AND status = 'COMPLETED' LIMIT 1;", [dateKey]);
  return !!row;
}
