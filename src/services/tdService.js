import { getTdDb } from '../database/tdSchema';
import * as tdRepo from '../repositories/tdRepository';
import { isWriteAllowed } from './entitlementService';
import { summarize } from '../utils/tdCalc';
import { validateDetails, validateSizes } from '../utils/tdValidation';
import { KIND_SEIZED, KIND_TD } from '../constants/tdData';

// Audit-only timestamp (same convention as diaryService).
function nowIso() {
  return new Date().toISOString();
}

const WRITE_LOCK_MESSAGES = {
  CLOCK_ROLLBACK: 'Your device clock looks wrong. Please reconnect to the internet to continue.',
  NO_ENTITLEMENT: 'An active subscription is required to create, edit, delete or export TDs.',
  EXPIRED: 'Your subscription has expired. Renew to continue creating, editing, deleting or exporting TDs.',
};

/**
 * Non-throwing version of the gate, for screens that want to check BEFORE
 * letting the user start filling something in (so they don't type a whole
 * form and only then learn it can't be saved).
 * Returns { allowed, reason, message }.
 */
export async function checkWriteAccess() {
  const { allowed, reason } = await isWriteAllowed();
  if (allowed) return { allowed: true, reason: null, message: null };
  return { allowed: false, reason, message: WRITE_LOCK_MESSAGES[reason] || 'This action is currently locked.' };
}

/**
 * Throws WRITE_LOCKED unless the signed subscription entitlement (verified
 * fully offline — see entitlementService.js) allows writes right now.
 * Every TD-mutating function below calls this FIRST, exactly like
 * diaryService's assertWriteAllowed, so the lock is enforced in the service
 * layer and cannot be bypassed by any screen. Reading TDs is never gated.
 */
export async function assertWriteAllowed() {
  const access = await checkWriteAccess();
  if (!access.allowed) {
    const err = new Error(access.message);
    err.code = 'WRITE_LOCKED';
    err.reason = access.reason;
    throw err;
  }
}

function validationError(message) {
  const err = new Error(message);
  err.code = 'VALIDATION';
  return err;
}

// ---- mapping DB rows <-> record objects --------------------------------------

// Records from the first TD build stored the compartments as a JSON list;
// they are shown as a plain comma-separated string.
function parseCompartment(text) {
  const t = String(text || '').trim();
  if (t.startsWith('[')) {
    try {
      const v = JSON.parse(t);
      if (Array.isArray(v)) return v.map(String).join(', ');
    } catch (e) {
      // not JSON after all — fall through and show it as typed
    }
  }
  return t;
}

function mapRecord(row, treeRows, sizeRows) {
  return {
    id: row.id,
    kind: row.kind === KIND_SEIZED ? KIND_SEIZED : KIND_TD,
    applicantName: row.applicant_name,
    fathersName: row.fathers_name,
    address: row.address,
    markingNo: row.marking_no,
    compartment: parseCompartment(row.compartments),
    isFreeGrant: !!row.is_free_grant,
    freeGrantStatus: row.free_grant_status,
    standingMilli: row.standing_milli,
    convertedMilli: row.converted_milli,
    totalQty: row.total_qty,
    conversionHundredths: row.conversion_hundredths,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    trees: treeRows.map((t) => ({ species: t.species, class: t.class })),
    sizes: sizeRows.map((s) => ({
      species: s.species,
      lengthMilli: s.length_mm,
      widthMilli: s.width_mm,
      thicknessMilli: s.thickness_mm,
      qty: s.qty,
      unitMilli: s.unit_milli,
      totalMilli: s.total_milli,
    })),
  };
}

function groupBy(rows, key) {
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r[key])) map.set(r[key], []);
    map.get(r[key]).push(r);
  }
  return map;
}

// ---- reads (never gated) -------------------------------------------------------

/** All saved TDs, newest first, each with its trees and sizes. */
export async function listTds() {
  const [records, trees, sizes] = await Promise.all([
    tdRepo.findAllRecords(),
    tdRepo.findAllTrees(),
    tdRepo.findAllSizes(),
  ]);
  const treesBy = groupBy(trees, 'td_id');
  const sizesBy = groupBy(sizes, 'td_id');
  return records.map((r) => mapRecord(r, treesBy.get(r.id) || [], sizesBy.get(r.id) || []));
}

export async function getTd(id) {
  const row = await tdRepo.findRecordById(id);
  if (!row) return null;
  const [trees, sizes] = await Promise.all([tdRepo.findTreesByTdId(id), tdRepo.findSizesByTdId(id)]);
  return mapRecord(row, trees, sizes);
}

// ---- building a record from form input -----------------------------------------

/**
 * Validates everything and computes every derived number in ONE place.
 * `input` = the draft shape: { applicantName, fathersName, address, markingNo,
 * compartment, isFreeGrant, freeGrantStatus, kind: 'TD' | 'SEIZED',
 * trees:[{species,class}], sizes:[{species,length,width,thickness,qty}] }.
 */
export function buildRecord(input) {
  const details = validateDetails(input);
  if (!details.valid) throw validationError(details.message);

  const trees = input.trees.map((t) => ({ species: t.species, class: t.class }));
  const sizeCheck = validateSizes(input.sizes, trees);
  if (!sizeCheck.valid) throw validationError(sizeCheck.message);

  const totals = summarize(trees, sizeCheck.complete);
  const isTd = input.kind === KIND_TD;
  return {
    kind: input.kind,
    applicantName: input.applicantName.trim(),
    fathersName: input.fathersName.trim(),
    address: input.address.trim(),
    // Seized timber has no marking number and no payment / free-grant status.
    markingNo: isTd ? input.markingNo.trim() : '',
    compartment: input.compartment.trim(),
    isFreeGrant: isTd ? !!input.isFreeGrant : false,
    freeGrantStatus: isTd ? (input.isFreeGrant ? (input.freeGrantStatus || '').trim() || 'Free Grant' : 'Paid') : '',
    trees,
    sizes: sizeCheck.complete.map((s) => ({
      species: s.species,
      lengthMilli: s.lengthMilli,
      widthMilli: s.widthMilli,
      thicknessMilli: s.thicknessMilli,
      qty: s.qty,
      unitMilli: s.unitMilli,
      totalMilli: s.totalMilli,
    })),
    standingMilli: totals.standingMilli,
    convertedMilli: totals.convertedMilli,
    totalQty: totals.totalQty,
    conversionHundredths: totals.conversionHundredths,
  };
}

// What counts as "the same TD" when deciding whether an edit changed anything.
function canonical(r) {
  return JSON.stringify([
    r.kind, r.applicantName, r.fathersName, r.address, r.markingNo, r.compartment,
    r.isFreeGrant, r.freeGrantStatus,
    r.trees.map((t) => [t.species, t.class]),
    r.sizes.map((s) => [s.species, s.lengthMilli, s.widthMilli, s.thicknessMilli, s.qty, s.unitMilli, s.totalMilli]),
    r.standingMilli, r.convertedMilli, r.totalQty, r.conversionHundredths,
  ]);
}

// ---- writes (ALL gated) ------------------------------------------------------------

/**
 * Creates a TD (editingId = null) or updates one in place (editingId = its
 * id — never inserts a second row, so editing can't create a duplicate).
 * The whole write is one transaction: trees/sizes are replaced together with
 * the record, so a failure never leaves a half-saved TD behind.
 * Returns { record, unchanged } — unchanged is true when an edit changed
 * nothing (nothing is written and updated_at is left alone).
 */
export async function saveTd(input, editingId = null) {
  await assertWriteAllowed();
  const built = buildRecord(input);

  if (editingId != null) {
    const existing = await getTd(editingId);
    if (!existing) {
      const err = new Error('This TD could not be found. It may have been deleted.');
      err.code = 'NOT_FOUND';
      throw err;
    }
    if (canonical(existing) === canonical(built)) {
      return { record: existing, unchanged: true };
    }
  }

  const db = await getTdDb();
  const timestamp = nowIso();
  let id = editingId;

  try {
    await db.withTransactionAsync(async () => {
      const fields = { ...built, timestamp };
      if (editingId != null) {
        await tdRepo.updateRecordRow(editingId, fields);
        await tdRepo.deleteTreesByTdId(editingId);
        await tdRepo.deleteSizesByTdId(editingId);
      } else {
        id = await tdRepo.insertRecord(fields);
      }
      for (let i = 0; i < built.trees.length; i++) {
        await tdRepo.insertTree(id, i, built.trees[i].species, built.trees[i].class);
      }
      for (let i = 0; i < built.sizes.length; i++) {
        await tdRepo.insertSize(id, i, built.sizes[i]);
      }
    });
  } catch (e) {
    // Keep the real reason: it is logged, and a short form is added to the
    // message so a failure can be diagnosed from a screenshot.
    console.warn('[TD] save failed:', e);
    const detail = e && e.message ? String(e.message).slice(0, 120) : '';
    const err = new Error(`Unable to save this record. Please try again.${detail ? ` (${detail})` : ''}`);
    err.code = 'SAVE_FAILED';
    err.cause = e;
    throw err;
  }

  return { record: await getTd(id), unchanged: false };
}

/** Permanently deletes a TD with its trees and sizes, atomically. */
export async function deleteTd(id) {
  await assertWriteAllowed();
  const db = await getTdDb();
  try {
    await db.withTransactionAsync(async () => {
      await tdRepo.deleteSizesByTdId(id);
      await tdRepo.deleteTreesByTdId(id);
      await tdRepo.deleteRecordRow(id);
    });
  } catch (e) {
    console.warn('[TD] delete failed:', e);
    const err = new Error('Unable to delete this record. Please try again.');
    err.code = 'DELETE_FAILED';
    throw err;
  }
}
