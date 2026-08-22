import { getDatabase } from '../database/database';
import * as diaryRepo from '../repositories/diaryRepository';
import * as entryRepo from '../repositories/diaryEntryRepository';
import * as profileRepo from '../repositories/profileRepository';
import {
  getDaysInMonth,
  buildDateString,
  isFutureDate,
  isDateInCurrentMonth,
  getCurrentMonthYear,
  getTodayLocalDateString,
} from '../utils/dateUtils';

// Audit-only timestamp (NOT used for any date-comparison logic — see dateUtils.js header).
function nowIso() {
  return new Date().toISOString();
}

/**
 * Creates a diary for the given month/year, generating one EMPTY entry per
 * calendar day (28-31, leap-year aware). Wrapped in a transaction so a
 * failure partway through never leaves a partially-created diary behind.
 * Throws { code: 'DIARY_EXISTS', diaryId } if one already exists (UNIQUE
 * constraint backs this up at the DB level too).
 */
export async function createDiary(month, year) {
  const existing = await diaryRepo.findDiaryByMonthYear(month, year);
  if (existing) {
    const err = new Error('A diary for this month already exists.');
    err.code = 'DIARY_EXISTS';
    err.diaryId = existing.id;
    throw err;
  }

  const db = await getDatabase();
  const timestamp = nowIso();
  const daysInMonth = getDaysInMonth(month, year);
  const profile = await profileRepo.getProfileRow();
  const defaultFromLocation = profile && profile.default_from_location ? profile.default_from_location : '';

  let diaryId;
  try {
    await db.withTransactionAsync(async () => {
      diaryId = await diaryRepo.insertDiary(month, year, timestamp);
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = buildDateString(year, month, day);
        await entryRepo.insertEmptyEntry(diaryId, day, dateStr, timestamp, defaultFromLocation);
      }
    });
  } catch (err) {
    if (err && /UNIQUE/i.test(String(err.message))) {
      const dup = await diaryRepo.findDiaryByMonthYear(month, year);
      const dupErr = new Error('A diary for this month already exists.');
      dupErr.code = 'DIARY_EXISTS';
      dupErr.diaryId = dup ? dup.id : null;
      throw dupErr;
    }
    const wrapped = new Error('Unable to create this diary. Please try again.');
    wrapped.code = 'CREATE_FAILED';
    throw wrapped;
  }

  return diaryRepo.findDiaryById(diaryId);
}

export async function getDiary(month, year) {
  return diaryRepo.findDiaryByMonthYear(month, year);
}

export async function getDiaryById(diaryId) {
  return diaryRepo.findDiaryById(diaryId);
}

/** Returns the current month's diary, auto-creating it if it doesn't exist yet. */
export async function getOrCreateCurrentMonthDiary() {
  const { month, year } = getCurrentMonthYear();
  const existing = await getDiary(month, year);
  if (existing) return existing;
  return createDiary(month, year);
}

/**
 * Resolves (auto-creating if needed) the current month's diary and returns
 * today's entry row within it, for the Home screen's inline "today" card
 * and the camera's "add to today's entry" flow.
 */
export async function getTodayEntryContext() {
  const diary = await getOrCreateCurrentMonthDiary();
  const today = getTodayLocalDateString();
  const entry = await entryRepo.findEntryByDiaryIdAndDate(diary.id, today);
  return { diary, entry };
}

/** All diaries, newest month first, each annotated with progress info. */
export async function getAllDiaries() {
  const diaries = await diaryRepo.findAllDiaries();
  const results = [];
  for (const diary of diaries) {
    const progress = await getDiaryProgress(diary.id);
    results.push({ ...diary, ...progress });
  }
  return results;
}

export async function getDiaryEntries(diaryId) {
  return entryRepo.findEntriesByDiaryId(diaryId);
}

export async function getEntry(entryId) {
  return entryRepo.findEntryById(entryId);
}

/**
 * True if a given entry's date may currently be edited.
 * - Historical (non-current) months: everything is editable.
 * - Current month: past & today editable, future dates locked.
 */
export function isDateEditable(dateString, diaryMonth, diaryYear) {
  if (!isDateInCurrentMonth(diaryMonth, diaryYear)) {
    return true;
  }
  return !isFutureDate(dateString);
}

async function assertEditable(entry) {
  const diary = await diaryRepo.findDiaryById(entry.diary_id);
  if (diary && !isDateEditable(entry.date, diary.month, diary.year)) {
    const err = new Error('This date is locked and cannot be edited yet.');
    err.code = 'DATE_LOCKED';
    throw err;
  }
  return diary;
}

/**
 * Saves (fills) an EMPTY entry, or updates an already-COMPLETED one.
 * Always UPDATEs the existing row by id — never inserts a new row — so
 * editing can never create a duplicate entry for the same date.
 */
export async function saveEntry(entryId, { fromLocation, toLocation, remarks }) {
  const entry = await entryRepo.findEntryById(entryId);
  if (!entry) {
    const err = new Error('This entry could not be found.');
    err.code = 'ENTRY_NOT_FOUND';
    throw err;
  }

  const diary = await assertEditable(entry);
  const timestamp = nowIso();

  try {
    await entryRepo.updateEntryRow(entryId, {
      fromLocation: (fromLocation || '').trim(),
      toLocation: (toLocation || '').trim(),
      remarks: (remarks || '').trim(),
      status: 'COMPLETED',
      timestamp,
    });
  } catch (err) {
    const wrapped = new Error('Unable to save this entry. Please try again.');
    wrapped.code = 'SAVE_FAILED';
    throw wrapped;
  }

  if (diary) {
    await diaryRepo.touchDiary(diary.id, timestamp);
  }

  return entryRepo.findEntryById(entryId);
}

// Editing a completed entry goes through the exact same update-in-place path.
export const updateEntry = saveEntry;

/**
 * Saves From/To/Remarks AND attaches a photo to the entry in one atomic
 * step — used by the camera flow's "add to today's entry" path (both the
 * EMPTY-entry direct-save case and the COMPLETED-entry "Replace" case).
 * Reuses saveEntry() itself rather than duplicating the update logic.
 */
export async function saveEntryWithPhoto(entryId, { fromLocation, toLocation, remarks, photoPath }) {
  const db = await getDatabase();
  let result;
  await db.withTransactionAsync(async () => {
    result = await saveEntry(entryId, { fromLocation, toLocation, remarks });
    const timestamp = nowIso();
    await entryRepo.updateEntryPhotoPath(entryId, photoPath, timestamp);
  });
  return entryRepo.findEntryById(entryId);
}

export async function getDiaryProgress(diaryId) {
  const total = await entryRepo.countAllEntries(diaryId);
  const completed = await entryRepo.countEntriesByStatus(diaryId, 'COMPLETED');
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return {
    total,
    completed,
    percent,
    isComplete: total > 0 && completed === total,
  };
}

export async function isDiaryComplete(diaryId) {
  const progress = await getDiaryProgress(diaryId);
  return progress.isComplete;
}

/**
 * Permanently deletes a diary and all of its entries. Wrapped in a
 * transaction so a failure partway through can't leave orphaned entries
 * (or a diary with no entries) behind.
 */
export async function deleteDiary(diaryId) {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await entryRepo.deleteEntriesByDiaryId(diaryId);
    await diaryRepo.deleteDiaryRow(diaryId);
  });
}

/** Deletes multiple diaries (and their entries) in a single transaction. */
export async function deleteDiaries(diaryIds) {
  if (!diaryIds || diaryIds.length === 0) return;
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const id of diaryIds) {
      await entryRepo.deleteEntriesByDiaryId(id);
      await diaryRepo.deleteDiaryRow(id);
    }
  });
}
