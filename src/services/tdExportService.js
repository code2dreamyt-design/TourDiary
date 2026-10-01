import { Packer } from 'docx';
import { isWriteAllowed } from './entitlementService';
import { buildTdBatchDocument, buildTdSingleDocument } from './tdDocBuilders';
import { saveDocxToPhone } from './deviceSave';
import { safeFileName } from '../utils/tdFormat';
import { KIND_SEIZED, KIND_TD } from '../constants/tdData';

/** Beat / range / block for the document, taken from the signed-in user's profile. */
export function buildTdProfile(user) {
  return {
    beatName: (user && user.beatName) || '',
    forestRange: (user && user.forestRange) || '',
    forestBlock: (user && user.forestBlock) || '',
  };
}

function coded(message, code) {
  const err = new Error(message);
  err.code = code;
  return err;
}

/**
 * Exporting takes data OUT of the app's private storage — so it is gated
 * exactly like the diary export (exportService.exportDiaryToWord): it needs
 * the same locally-verified active subscription that writes need.
 */
async function assertExportAllowed() {
  const { allowed, reason } = await isWriteAllowed();
  if (!allowed) {
    const err = coded(
      reason === 'EXPIRED' || reason === 'NO_ENTITLEMENT'
        ? 'An active subscription is required to export records.'
        : 'Your device clock looks wrong. Please reconnect to the internet to continue.',
      'WRITE_LOCKED'
    );
    err.reason = reason;
    throw err;
  }
}

async function buildAndSave(buildDoc, fileName) {
  let base64;
  try {
    base64 = await Packer.toBase64String(buildDoc());
  } catch (e) {
    throw coded('Unable to generate the Word document.', 'BUILD_FAILED');
  }
  // Same delivery as the diary: saved onto the phone (see deviceSave.js).
  return saveDocxToPhone({ fileName, base64 });
}

const prefixFor = (kind) => (kind === KIND_SEIZED ? 'Seized' : 'TD');

/**
 * Batch export of ONE kind. Seized timber and TDs are never mixed: any record
 * of the other kind passed in is ignored. `startDate`/`endDate` ('YYYY-MM-DD')
 * are printed as the Period.
 */
export async function exportTdBatchToWord({ records, startDate, endDate, kind = KIND_TD, profile }) {
  await assertExportAllowed();
  const ofKind = (records || []).filter((r) => r.kind === kind);
  if (ofKind.length === 0) throw coded('There are no records to export.', 'NOTHING_TO_EXPORT');
  // Oldest first, so S.No. 1 is the earliest record in the period.
  const ordered = [...ofKind].sort((a, b) =>
    a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id - b.id
  );
  const fileName = `${prefixFor(kind)}_Batch_${startDate}_to_${endDate}.docx`;
  return buildAndSave(() => buildTdBatchDocument({ records: ordered, startDate, endDate, kind, profile }), fileName);
}

/** Single-record export (titled by the record's own kind). */
export async function exportTdSingleToWord(record, profile) {
  await assertExportAllowed();
  if (!record) throw coded('Please select a record first.', 'NOTHING_TO_EXPORT');
  const tail = record.kind === KIND_SEIZED ? safeFileName(record.compartment, record.id) : safeFileName(record.markingNo, record.id);
  const fileName = `${prefixFor(record.kind)}_${safeFileName(record.applicantName)}_${tail}.docx`;
  return buildAndSave(() => buildTdSingleDocument(record, profile), fileName);
}
