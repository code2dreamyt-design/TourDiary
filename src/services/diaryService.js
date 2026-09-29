import { getDatabase } from '../database/database';
import * as diaryRepo from '../repositories/diaryRepository';
import * as entryRepo from '../repositories/diaryEntryRepository';
import * as secureStorage from '../storage/secureStorage';
import { isWriteAllowed } from './entitlementService';
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

const WRITE_LOCK_MESSAGES = {
  CLOCK_ROLLBACK: 'Your device clock looks wrong. Please reconnect to the internet to continue editing.',
  NO_ENTITLEMENT: 'An active subscription is required to create or edit diary entries.',
  EXPIRED: 'Your subscription has expired. Renew to continue creating or editing diary entries.',
};

/**
 * Throws a WRITE_LOCKED error if the signed subscription entitlement
 * (verified fully offline — see entitlementService.js) doesn't currently
 * allow writes. Every diary-mutating function below calls this first, so
 * a lapsed subscription is enforced in exactly one place rather than
 * re-implemented per function. Reading diary data is never gated — only
 * create/edit/delete.
 */
async function assertWriteAllowed() {
  const { allowed, reason } = await isWriteAllowed();
  if (!allowed) {
    const err = new Error(WRITE_LOCK_MESSAGES[reason] || 'Writes are currently locked.');
    err.code = 'WRITE_LOCKED';
    err.reason = reason;
    throw err;
  }
}

/**
 * Creates a diary for the given month/year, generating one EMPTY entry per
 * calendar day (28-31, leap-year aware). Wrapped in a transaction so a
 * failure partway through never leaves a partially-created diary behind.
 * Throws { code: 'DIARY_EXISTS', diaryId } if one already exists (UNIQUE
 * constraint backs this up at the DB level too).
 */
export async function createDiary(month, year) {
  await assertWriteAllowed();

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

  let diaryId;
  try {
    await db.withTransactionAsync(async () => {
      diaryId = await diaryRepo.insertDiary(month, year, timestamp);
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = buildDateString(year, month, day);
        // from_location is left EMPTY here on purpose — it is NOT baked in
        // from the profile's current default at creation time. Baking it in
        // would freeze that value forever, even for entries the user never
        // touches, so a later change to the profile's default would never
        // be reflected. Instead, the UI (DiaryDetailsScreen, HomeScreen)
        // falls back to the CURRENT profile default whenever it opens an
        // entry with an empty from_location — always live, never stale.
        await entryRepo.insertEmptyEntry(diaryId, day, dateStr, timestamp);
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
 * today's entry row within it, plus the account's CURRENT usualTourStart
 * (synced from the backend on every login/getme — see AuthContext) — for
 * the Home screen's inline "today" card and the camera's "add to today's
 * entry" flow. Always read fresh from secure storage here (never cached
 * in a module variable), so a profile change is reflected immediately.
 */
export async function getTodayEntryContext() {
  const diary = await getOrCreateCurrentMonthDiary();
  const today = getTodayLocalDateString();
  const entry = await entryRepo.findEntryByDiaryIdAndDate(diary.id, today);
  const user = await secureStorage.getCachedUser();
  const defaultFromLocation = (user && user.usualTourStart) || '';
  return { diary, entry, defaultFromLocation };
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
  await assertWriteAllowed();

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
 * Resolves what an entry's From field should actually show. For an EMPTY
 * entry (never explicitly saved by the user), whatever's sitting in
 * from_location is only ever a convenience pre-fill, never real user
 * data — so the CURRENT profile default always wins here, even overriding
 * a stale value that got baked in by an older version of this app before
 * the profile's default was changed. For a COMPLETED entry, from_location
 * is real, user-confirmed data and is never overridden.
 */
export function resolveFromLocation(entry, defaultFromLocation) {
  if (!entry) return defaultFromLocation || '';
  if (entry.status === 'EMPTY') {
    return defaultFromLocation || entry.from_location || '';
  }
  return entry.from_location || '';
}

/**
 * Permanently deletes a diary and all of its entries. Wrapped in a
 * transaction so a failure partway through can't leave orphaned entries
 * (or a diary with no entries) behind.
 */
export async function deleteDiary(diaryId) {
  await assertWriteAllowed();
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await entryRepo.deleteEntriesByDiaryId(diaryId);
    await diaryRepo.deleteDiaryRow(diaryId);
  });
}

/** Deletes multiple diaries (and their entries) in a single transaction. */
export async function deleteDiaries(diaryIds) {
  if (!diaryIds || diaryIds.length === 0) return;
  await assertWriteAllowed();
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const id of diaryIds) {
      await entryRepo.deleteEntriesByDiaryId(id);
      await diaryRepo.deleteDiaryRow(id);
    }
  });
}
