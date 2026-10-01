import {
  Document,
  Packer,
  Table,
  TableRow,
  TableCell,
  Paragraph,
  TextRun,
  WidthType,
  BorderStyle,
  AlignmentType,
  VerticalAlign,
} from 'docx';
import { getMonthName } from '../utils/dateUtils';
import { isWriteAllowed } from './entitlementService';
import { saveDocxToPhone } from './deviceSave';

// ---------------------------------------------------------------------------
// Tour Diary Word document — layout matches the department's sample:
//   A4, 1" margins, Times New Roman, all text bold 11pt
//   Title  : "Tour Diary of Mr. <name> <designation> <beat> Beat during the month of <Month> <Year>"
//   Sub    : "(w.e.f. 01-MM-YYYY to <last day>-MM-YYYY)"
//   Table  : Date | From | To | Particular/Details of Work   (header repeats on every page)
//   Signatures (below the table):
//     - the person who wrote the diary, right-aligned (name + "<designation> <beat> beat")
//     - Van Mitra / Forest Worker / Others :  Forest Guard I/C <beat> Beat | Forest Block Officer | Forest Range Officer
//     - Forest Guard (the guard IS the I/C) :  Forest Block Officer | Forest Range Officer
//   Footer credit line.
// ---------------------------------------------------------------------------

const PAGE_CONTENT_WIDTH = 9026; // A4 (11906) minus 1" margins (2 x 1440)
const COLS = [1354, 1805, 1805, 4062]; // 15% / 20% / 20% / 45%  (sums to 9026)

const LINE = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const CELL_BORDERS = { top: LINE, bottom: LINE, left: LINE, right: LINE };
const NO_LINE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const NO_BORDERS = { top: NO_LINE, bottom: NO_LINE, left: NO_LINE, right: NO_LINE };

const run = (text, extra = {}) => new TextRun({ text: text || '', bold: true, size: 22, ...extra });

function tableCell(text, width, { center = false } = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: CELL_BORDERS,
    verticalAlign: VerticalAlign.TOP,
    margins: { top: 0, bottom: 0, left: 10, right: 10 },
    children: [
      new Paragraph({
        alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [run(text)],
      }),
    ],
  });
}

function signatureCell(lines, width) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: NO_BORDERS,
    children: lines.map(
      (t) => new Paragraph({ alignment: AlignmentType.CENTER, children: [run(t)] })
    ),
  });
}

/** 'YYYY-MM-DD' -> 'DD-MM-YYYY' */
function dmy(dateString) {
  const [y, m, d] = String(dateString || '').split('-');
  return y && m && d ? `${d}-${m}-${y}` : String(dateString || '');
}

function two(n) {
  return String(n).padStart(2, '0');
}

const clean = (v) => (v && String(v).trim()) || '';

function isForestGuard(designation) {
  return clean(designation).toLowerCase() === 'forest guard';
}

// "Van Mitra Pharog" — designation is left out for the generic "Others".
function designationLabel(designation) {
  const d = clean(designation);
  return d && d.toLowerCase() !== 'others' ? d : '';
}

function joinWords(...parts) {
  return parts.map(clean).filter(Boolean).join(' ');
}

function buildTitle(profile, month, year) {
  const who = joinWords(profile.salutation || 'Mr.', profile.name, designationLabel(profile.designation));
  const beat = clean(profile.beatName) ? `${clean(profile.beatName)} Beat ` : '';
  return `Tour Diary of ${who} ${beat}during the month of ${getMonthName(month)} ${year}`.replace(/\s+/g, ' ');
}

function buildSignatureBlock(profile) {
  const beat = clean(profile.beatName);
  const block = clean(profile.forestBlock);
  const range = clean(profile.forestRange);
  const guard = isForestGuard(profile.designation);

  // The writer's own signature, right-aligned: name, then "<designation> <beat> beat".
  const nameLine = joinWords(profile.salutation || 'Mr.', profile.name);
  const roleLine = joinWords(designationLabel(profile.designation), beat, beat ? 'beat' : '');

  // Forest Guard writes his own diary, so there is no separate "Forest Guard I/C" column.
  const columns = [];
  if (!guard) columns.push(['Forest Guard', joinWords('I/C', beat, beat ? 'Beat' : '')]);
  columns.push(['Forest Block Officer', joinWords('Forest Block', block)]);
  columns.push(['Forest Range Officer', joinWords('Forest Range', range)]);

  const base = Math.floor(PAGE_CONTENT_WIDTH / columns.length);
  const widths = columns.map((_, i) => (i === columns.length - 1 ? PAGE_CONTENT_WIDTH - base * (columns.length - 1) : base));

  const sigTable = new Table({
    width: { size: PAGE_CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    borders: {
      top: NO_LINE, bottom: NO_LINE, left: NO_LINE, right: NO_LINE,
      insideHorizontal: NO_LINE, insideVertical: NO_LINE,
    },
    rows: [
      new TableRow({
        cantSplit: true,
        children: columns.map((lines, i) => signatureCell(lines, widths[i])),
      }),
    ],
  });

  return [
    new Paragraph({ spacing: { before: 300 }, children: [] }),
    new Paragraph({ spacing: { before: 300 }, children: [] }),
    new Paragraph({ keepNext: true, keepLines: true, alignment: AlignmentType.RIGHT, children: [run(nameLine)] }),
    new Paragraph({
      keepNext: true,
      keepLines: true,
      alignment: AlignmentType.RIGHT,
      spacing: { after: 200 },
      children: [run(roleLine)],
    }),
    new Paragraph({ keepNext: true, keepLines: true, alignment: AlignmentType.RIGHT, spacing: { after: 200 }, children: [] }),
    new Paragraph({ keepNext: true, keepLines: true, alignment: AlignmentType.RIGHT, spacing: { after: 200 }, children: [] }),
    sigTable,
  ];
}

// This function is the single place that defines the exported diary's shape.
// `profile` = { name, salutation, designation, beatName, forestBlock, forestRange }.
export function buildTourDiaryDocument({ month, year, entries, profile }) {
  const p = profile || {};
  const mm = two(month);
  const lastDay = new Date(year, month, 0).getDate();

  const header = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: ['Date', 'From', 'To', 'Particular/Details of Work'].map((t, i) =>
      tableCell(t, COLS[i], { center: true })
    ),
  });

  const rows = entries.map(
    (e) =>
      new TableRow({
        children: [
          tableCell(dmy(e.date), COLS[0], { center: true }),
          tableCell(e.from_location, COLS[1]),
          tableCell(e.to_location, COLS[2]),
          tableCell(e.remarks, COLS[3]),
        ],
      })
  );

  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [run(buildTitle(p, month, year), { size: 32 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [run(`(w.e.f. 01-${mm}-${year} to ${two(lastDay)}-${mm}-${year})`, { size: 28 })],
    }),
    new Table({
      width: { size: PAGE_CONTENT_WIDTH, type: WidthType.DXA },
      columnWidths: COLS,
      rows: [header, ...rows],
    }),
    ...buildSignatureBlock(p),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 300 },
      children: [new TextRun({ text: 'App developed by Vikas Justa', italics: true, size: 16, color: '8B958F' })],
    }),
  ];

  return new Document({
    styles: { default: { document: { run: { font: 'Times New Roman' } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children,
      },
    ],
  });
}

/** Profile fields the diary document needs, from the signed-in user + saved salutation. */
export function buildDiaryProfile(user, salutation) {
  return {
    name: user && user.name,
    salutation: salutation || 'Mr.',
    designation: user && user.designation,
    beatName: user && user.beatName,
    forestBlock: user && user.forestBlock,
    forestRange: user && user.forestRange,
  };
}

/**
 * Builds the .docx and saves it onto the phone (see deviceSave.js).
 * Resolves with { kind, fileName, ... }; throws with a `.code` on failure so
 * screens can show a plain-language message (see utils/exportUi.js).
 */
export async function exportDiaryToWord({ month, year, entries, profile }) {
  // Exporting takes data OUT of the app's private storage — treated as a
  // privileged action gated the same way writes are, not as plain reading.
  // See diaryService.js's assertWriteAllowed for the same check.
  const { allowed, reason } = await isWriteAllowed();
  if (!allowed) {
    const err = new Error(
      reason === 'EXPIRED' || reason === 'NO_ENTITLEMENT'
        ? 'An active subscription is required to export your diary.'
        : 'Your device clock looks wrong. Please reconnect to the internet to continue.'
    );
    err.code = 'WRITE_LOCKED';
    err.reason = reason;
    throw err;
  }

  let base64;
  try {
    base64 = await Packer.toBase64String(buildTourDiaryDocument({ month, year, entries, profile }));
  } catch (err) {
    const wrapped = new Error('Unable to generate the Word document.');
    wrapped.code = 'BUILD_FAILED';
    throw wrapped;
  }

  return saveDocxToPhone({ fileName: `TourDiary_${getMonthName(month)}_${year}.docx`, base64 });
}
