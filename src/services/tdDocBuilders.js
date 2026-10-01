// Word (.docx) document builders for the TD Calculator. PURE — no device,
// storage or subscription code here (that lives in tdExportService.js), so
// the exact layout can be built and rendered anywhere for testing.
//
// PAGINATION: nothing is ever cut off. Every size / record is a real table
// row, and Word flows rows onto as many pages as needed. The header row is
// marked to REPEAT at the top of each new page, and rows are marked
// "can't split" so a row never breaks across a page boundary. Widths are
// explicit DXA (twips) with columnWidths, which also renders correctly in
// Google Docs and LibreOffice.
import {
  Document,
  Footer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  PageNumber,
  WidthType,
  AlignmentType,
  BorderStyle,
  ShadingType,
  HeadingLevel,
  PageOrientation,
  VerticalAlign,
} from 'docx';
import { formatMilli, formatHundredths, dimToText } from '../utils/tdCalc';
import { KIND_SEIZED, KIND_TITLES, LIMIT_PERCENT } from '../constants/tdData';
import { formatIsoDate, speciesSummary, statusText, groupTreesBySpecies } from '../utils/tdFormat';
import { formatDisplayDate, getTodayLocalDateString } from '../utils/dateUtils';

const GREEN = '2C5F2E';
const A4_W = 11906;
const A4_H = 16838;
const MARGIN = 1134; // 2 cm
const PORTRAIT_CONTENT_W = A4_W - 2 * MARGIN; // 9638
const LANDSCAPE_CONTENT_W = A4_H - 2 * MARGIN; // 14570

const BORDER = { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB' };
const CELL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
const HEADER_FILL = { type: ShadingType.CLEAR, fill: GREEN, color: 'auto' };
const ALT_FILL = { type: ShadingType.CLEAR, fill: 'F2F7F2', color: 'auto' };
const TOTAL_FILL = { type: ShadingType.CLEAR, fill: 'DCEBDD', color: 'auto' };
const GROUP_FILL = { type: ShadingType.CLEAR, fill: 'E9EFE9', color: 'auto' };

function cell(text, width, opts = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: opts.shading,
    columnSpan: opts.columnSpan,
    verticalAlign: VerticalAlign.CENTER,
    borders: CELL_BORDERS,
    margins: { top: 50, bottom: 50, left: 80, right: 80 },
    children: [
      new Paragraph({
        alignment: opts.align ?? AlignmentType.CENTER,
        children: [
          new TextRun({
            text: String(text ?? ''),
            bold: opts.bold ?? false,
            size: opts.size ?? 18,
            color: opts.color ?? '000000',
            font: 'Arial',
          }),
        ],
      }),
    ],
  });
}

const headerCell = (text, width, size = 18) =>
  cell(text, width, { bold: true, color: 'FFFFFF', shading: HEADER_FILL, size });

function makeTable(columnWidths, rows) {
  return new Table({
    width: { size: columnWidths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths,
    rows,
  });
}

const spacer = () => new Paragraph({ children: [new TextRun({ text: '' })] });

function title(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text, bold: true, size: 32, color: GREEN, font: 'Arial' })],
  });
}

function centred(text, size = 20, color = '666666') {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text, size, color, font: 'Arial' })],
  });
}

function pageFooter() {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: `Generated on: ${formatDisplayDate(getTodayLocalDateString())}   |   Page `,
            size: 16,
            color: '888888',
            font: 'Arial',
          }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '888888', font: 'Arial' }),
          new TextRun({ text: ' of ', size: 16, color: '888888', font: 'Arial' }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: '888888', font: 'Arial' }),
        ],
      }),
    ],
  });
}

// ---------------------------------------------------------------------------
// Batch document — one row per record, landscape A4.
// `kind` decides the title and columns: TD and seized timber are NEVER mixed in
// one document. `profile` = { beatName, forestRange, forestBlock } supplies the
// beat (range and block are not stored on each record).
// `startDate` / `endDate` are 'YYYY-MM-DD' and are the range the user chose.
// ---------------------------------------------------------------------------
export function buildTdBatchDocument({ records, startDate, endDate, kind, profile }) {
  const seized = kind === KIND_SEIZED;
  const beat = (profile && profile.beatName) || '';
  const alt = (i) => (i % 2 === 1 ? ALT_FILL : undefined);

  // Column widths (twips) always add up to the landscape content width, 14570.
  const W = seized ? [700, 4200, 1300, 2800, 2700, 1400, 1470] : [700, 3600, 1100, 2300, 2200, 1300, 1500, 1870];
  const heads = seized
    ? ['S.No.', 'Name (F/o, R/o)', 'Beat', 'Forest (Compartment)', 'Species (Class)', 'Standing Vol (m³)', 'Converted Vol (m³)']
    : ['S.No.', 'Applicant (Name, F/o, R/o)', 'Beat', 'Forest (Compartment)', 'Species (Class)', 'Standing Vol (m³)', 'M.No.', 'Status'];

  const headerRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: heads.map((h, i) => headerCell(h, W[i])),
  });

  const dataRows = records.map((r, i) => {
    const who = `${r.applicantName}, F/o ${r.fathersName}, R/o ${r.address}`;
    const sh = { shading: alt(i) };
    const cells = [
      cell(i + 1, W[0], sh),
      cell(who, W[1], { align: AlignmentType.LEFT, ...sh }),
      cell(beat, W[2], sh),
      cell(r.compartment, W[3], sh),
      cell(speciesSummary(r.trees), W[4], sh),
      cell(formatMilli(r.standingMilli), W[5], sh),
    ];
    if (seized) cells.push(cell(formatMilli(r.convertedMilli), W[6], sh));
    else cells.push(cell(r.markingNo, W[6], sh), cell(statusText(r), W[7], sh));
    return new TableRow({ cantSplit: true, children: cells });
  });

  return new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: A4_W, height: A4_H, orientation: PageOrientation.LANDSCAPE },
            margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
          },
        },
        footers: { default: pageFooter() },
        children: [
          title(KIND_TITLES[seized ? KIND_SEIZED : 'TD']),
          centred(`Period: ${formatDisplayDate(startDate)} – ${formatDisplayDate(endDate)}`),
          centred(`Total Records: ${records.length}`),
          spacer(),
          makeTable(W, [headerRow, ...dataRows]),
        ],
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Single document — one TD with its full size table (portrait A4).
// ---------------------------------------------------------------------------
export function buildTdSingleDocument(record, profile) {
  const seized = record.kind === KIND_SEIZED;
  const beat = (profile && profile.beatName) || '';
  const range = (profile && profile.forestRange) || '';
  const W = [700, 1500, 2700, 1400, 1000, 2338]; // = 9638
  const alt = (i) => (i % 2 === 1 ? ALT_FILL : undefined);

  // Sizes grouped by species (in tree order) so a multi-species TD reads clearly.
  const bySpecies = groupTreesBySpecies(record.trees);
  const ordered = [];
  for (const { species } of bySpecies) {
    for (const s of record.sizes) if (s.species === species) ordered.push(s);
  }
  for (const s of record.sizes) if (!ordered.includes(s)) ordered.push(s); // never lose a row

  const headerRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: [
      headerCell('S.No.', W[0]),
      headerCell('Species', W[1]),
      headerCell('L × W × T (m)', W[2]),
      headerCell('Vol/Unit (m³)', W[3]),
      headerCell('Qty', W[4]),
      headerCell('Total Vol (m³)', W[5]),
    ],
  });

  const sizeRows = ordered.map(
    (s, i) =>
      new TableRow({
        cantSplit: true,
        children: [
          cell(i + 1, W[0], { shading: alt(i) }),
          cell(s.species, W[1], { shading: alt(i) }),
          cell(`${dimToText(s.lengthMilli)} × ${dimToText(s.widthMilli)} × ${dimToText(s.thicknessMilli)}`, W[2], {
            shading: alt(i),
          }),
          cell(formatMilli(s.unitMilli), W[3], { shading: alt(i) }),
          cell(s.qty, W[4], { shading: alt(i) }),
          cell(formatMilli(s.totalMilli), W[5], { shading: alt(i) }),
        ],
      })
  );

  const totalQty = ordered.reduce((a, s) => a + s.qty, 0);
  const grandMilli = ordered.reduce((a, s) => a + s.totalMilli, 0);
  const totalRow = new TableRow({
    cantSplit: true,
    children: [
      cell('', W[0], { shading: TOTAL_FILL }),
      cell('TOTAL', W[1] + W[2] + W[3], { bold: true, shading: TOTAL_FILL, columnSpan: 3 }),
      cell(totalQty, W[4], { bold: true, shading: TOTAL_FILL }),
      cell(formatMilli(grandMilli), W[5], { bold: true, shading: TOTAL_FILL }),
    ],
  });

  const line = (label, value) =>
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({ text: `${label}: `, bold: true, size: 20, font: 'Arial' }),
        new TextRun({ text: String(value ?? ''), size: 20, font: 'Arial' }),
      ],
    });

  const within = record.convertedMilli * 100 <= LIMIT_PERCENT * record.standingMilli;

  return new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: A4_W, height: A4_H },
            margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
          },
        },
        footers: { default: pageFooter() },
        children: [
          title(KIND_TITLES[seized ? KIND_SEIZED : 'TD']),
          centred(formatIsoDate(record.createdAt)),
          spacer(),
          new Paragraph({
            children: [
              new TextRun({
                text: `${record.applicantName}, F/o ${record.fathersName}, R/o ${record.address}${beat ? `, Beat: ${beat}` : ''}`,
                size: 20,
                font: 'Arial',
              }),
            ],
          }),
          spacer(),
          ...(range ? [line('Range', range)] : []),
          line('Compartment', record.compartment),
          line('Species', record.trees.map((t) => `${t.class} · ${t.species}`).join(', ')),
          // Seized timber has no marking number and no payment / free-grant status.
          ...(seized ? [] : [line('Marking No.', record.markingNo), line('Status', statusText(record))]),
          line('Standing Vol', `${formatMilli(record.standingMilli)} m³`),
          line('Converted Vol', `${formatMilli(record.convertedMilli)} m³`),
          line(
            'Conversion',
            `${formatHundredths(record.conversionHundredths)}% (${within ? 'within' : 'exceeds'} the ${LIMIT_PERCENT}% limit)`
          ),
          spacer(),
          new Paragraph({
            children: [new TextRun({ text: 'Size Details', bold: true, size: 24, font: 'Arial', color: GREEN })],
          }),
          spacer(),
          makeTable(W, [headerRow, ...sizeRows, totalRow]),
        ],
      },
    ],
  });
}
