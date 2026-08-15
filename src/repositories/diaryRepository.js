import { getDatabase } from '../database/database';

// Local Repository (SQLite). In a future version this file's exports would
// be mirrored by an ApiRepository that talks to Node/Express/MongoDB instead
// — diaryService.js should never need to change for that swap.

export async function insertDiary(month, year, timestamp) {
  const db = await getDatabase();
  const result = await db.runAsync(
    'INSERT INTO diaries (month, year, created_at, updated_at) VALUES (?, ?, ?, ?);',
    [month, year, timestamp, timestamp]
  );
  return result.lastInsertRowId;
}

export async function findDiaryByMonthYear(month, year) {
  const db = await getDatabase();
  return db.getFirstAsync(
    'SELECT * FROM diaries WHERE month = ? AND year = ?;',
    [month, year]
  );
}

export async function findDiaryById(diaryId) {
  const db = await getDatabase();
  return db.getFirstAsync('SELECT * FROM diaries WHERE id = ?;', [diaryId]);
}

export async function findAllDiaries() {
  const db = await getDatabase();
  return db.getAllAsync('SELECT * FROM diaries ORDER BY year DESC, month DESC;');
}

export async function touchDiary(diaryId, timestamp) {
  const db = await getDatabase();
  await db.runAsync('UPDATE diaries SET updated_at = ? WHERE id = ?;', [timestamp, diaryId]);
}

export async function deleteDiaryRow(diaryId) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM diaries WHERE id = ?;', [diaryId]);
}
