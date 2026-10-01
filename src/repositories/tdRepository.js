import { getTdDb } from '../database/tdSchema';

// Local Repository (SQLite) for the TD Calculator. Every call goes through
// getTdDb(), which makes sure the TD tables exist first (see database/tdSchema.js).
// — same layering as
// diaryRepository / diaryEntryRepository: SQL lives here, business rules
// (subscription gate, validation, totals) live in tdService.js.

export async function insertRecord(f) {
  const db = await getTdDb();
  const result = await db.runAsync(
    `INSERT INTO td_records
      (kind, applicant_name, fathers_name, address, marking_no, range_name, beat, compartments,
       is_free_grant, free_grant_status, standing_milli, converted_milli, total_qty,
       conversion_hundredths, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      f.kind, f.applicantName, f.fathersName, f.address, f.markingNo, '', '',
      f.compartment, f.isFreeGrant ? 1 : 0, f.freeGrantStatus,
      f.standingMilli, f.convertedMilli, f.totalQty, f.conversionHundredths,
      f.timestamp, f.timestamp,
    ]
  );
  return result.lastInsertRowId;
}

// created_at is deliberately NOT updated here: editing a saved TD keeps its
// original date and its place in the list.
export async function updateRecordRow(id, f) {
  const db = await getTdDb();
  await db.runAsync(
    `UPDATE td_records SET
       kind = ?, applicant_name = ?, fathers_name = ?, address = ?, marking_no = ?,
       compartments = ?, is_free_grant = ?, free_grant_status = ?,
       standing_milli = ?, converted_milli = ?, total_qty = ?, conversion_hundredths = ?,
       updated_at = ?
     WHERE id = ?;`,
    [
      f.kind, f.applicantName, f.fathersName, f.address, f.markingNo,
      f.compartment, f.isFreeGrant ? 1 : 0, f.freeGrantStatus,
      f.standingMilli, f.convertedMilli, f.totalQty, f.conversionHundredths,
      f.timestamp, id,
    ]
  );
}

export async function insertTree(tdId, position, species, cls) {
  const db = await getTdDb();
  await db.runAsync(
    'INSERT INTO td_trees (td_id, position, species, class) VALUES (?, ?, ?, ?);',
    [tdId, position, species, cls]
  );
}

export async function insertSize(tdId, position, s) {
  const db = await getTdDb();
  await db.runAsync(
    `INSERT INTO td_sizes
      (td_id, position, species, length_mm, width_mm, thickness_mm, qty, unit_milli, total_milli)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [tdId, position, s.species, s.lengthMilli, s.widthMilli, s.thicknessMilli, s.qty, s.unitMilli, s.totalMilli]
  );
}

export async function deleteTreesByTdId(tdId) {
  const db = await getTdDb();
  await db.runAsync('DELETE FROM td_trees WHERE td_id = ?;', [tdId]);
}

export async function deleteSizesByTdId(tdId) {
  const db = await getTdDb();
  await db.runAsync('DELETE FROM td_sizes WHERE td_id = ?;', [tdId]);
}

export async function deleteRecordRow(tdId) {
  const db = await getTdDb();
  await db.runAsync('DELETE FROM td_records WHERE id = ?;', [tdId]);
}

// Newest first. id DESC breaks ties between records saved in the same instant.
export async function findAllRecords() {
  const db = await getTdDb();
  return db.getAllAsync('SELECT * FROM td_records ORDER BY created_at DESC, id DESC;');
}

export async function findRecordById(id) {
  const db = await getTdDb();
  return db.getFirstAsync('SELECT * FROM td_records WHERE id = ?;', [id]);
}

export async function findAllTrees() {
  const db = await getTdDb();
  return db.getAllAsync('SELECT * FROM td_trees ORDER BY td_id ASC, position ASC;');
}

export async function findAllSizes() {
  const db = await getTdDb();
  return db.getAllAsync('SELECT * FROM td_sizes ORDER BY td_id ASC, position ASC;');
}

export async function findTreesByTdId(tdId) {
  const db = await getTdDb();
  return db.getAllAsync('SELECT * FROM td_trees WHERE td_id = ? ORDER BY position ASC;', [tdId]);
}

export async function findSizesByTdId(tdId) {
  const db = await getTdDb();
  return db.getAllAsync('SELECT * FROM td_sizes WHERE td_id = ? ORDER BY position ASC;', [tdId]);
}
