import { getDatabase } from '../database/database';

// fromLocation defaults to '' but is normally passed in from the user's
// profile (their "usual start" place) so each freshly-created entry already
// shows that as its From value — the user only has to change it on the
// days they actually started somewhere else.
export async function insertEmptyEntry(diaryId, serialNumber, date, timestamp, fromLocation = '') {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO diary_entries
      (diary_id, serial_number, date, from_location, to_location, remarks, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, '', '', 'EMPTY', ?, ?);`,
    [diaryId, serialNumber, date, fromLocation, timestamp, timestamp]
  );
  return result.lastInsertRowId;
}

export async function findEntriesByDiaryId(diaryId) {
  const db = await getDatabase();
  return db.getAllAsync(
    'SELECT * FROM diary_entries WHERE diary_id = ? ORDER BY serial_number ASC;',
    [diaryId]
  );
}

export async function findEntryById(entryId) {
  const db = await getDatabase();
  return db.getFirstAsync('SELECT * FROM diary_entries WHERE id = ?;', [entryId]);
}

// Used to find "today's" entry within a diary without loading the whole month.
export async function findEntryByDiaryIdAndDate(diaryId, date) {
  const db = await getDatabase();
  return db.getFirstAsync(
    'SELECT * FROM diary_entries WHERE diary_id = ? AND date = ?;',
    [diaryId, date]
  );
}

// Updates the existing row in place — this is the ONLY write path for entry
// content, used by both "fill" and "edit" flows, so a save can never create
// a duplicate row for the same date.
export async function updateEntryRow(entryId, { fromLocation, toLocation, remarks, status, timestamp }) {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE diary_entries
     SET from_location = ?, to_location = ?, remarks = ?, status = ?, updated_at = ?
     WHERE id = ?;`,
    [fromLocation, toLocation, remarks, status, timestamp, entryId]
  );
}

export async function countEntriesByStatus(diaryId, status) {
  const db = await getDatabase();
  const row = await db.getFirstAsync(
    'SELECT COUNT(*) as count FROM diary_entries WHERE diary_id = ? AND status = ?;',
    [diaryId, status]
  );
  return row ? row.count : 0;
}

// Sets (or clears, if photoPath is null) the entry's attached photo path
// without touching from_location/to_location/remarks/status. Used when a
// completed entry keeps its text but gets a new/updated photo.
export async function updateEntryPhotoPath(entryId, photoPath, timestamp) {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE diary_entries SET photo_path = ?, updated_at = ? WHERE id = ?;',
    [photoPath, timestamp, entryId]
  );
}

export async function countAllEntries(diaryId) {
  const db = await getDatabase();
  const row = await db.getFirstAsync(
    'SELECT COUNT(*) as count FROM diary_entries WHERE diary_id = ?;',
    [diaryId]
  );
  return row ? row.count : 0;
}

export async function deleteEntriesByDiaryId(diaryId) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM diary_entries WHERE diary_id = ?;', [diaryId]);
}
