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
  HeadingLevel,
} from 'docx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { formatDisplayDate, getMonthName } from '../utils/dateUtils';

const CELL_BORDER = {
  top: { style: BorderStyle.SINGLE, size: 2, color: '999999' },
  bottom: { style: BorderStyle.SINGLE, size: 2, color: '999999' },
  left: { style: BorderStyle.SINGLE, size: 2, color: '999999' },
  right: { style: BorderStyle.SINGLE, size: 2, color: '999999' },
};

function headerCell(text, widthPercent) {
  return new TableCell({
    borders: CELL_BORDER,
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    shading: { fill: 'E7EFE9' },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, bold: true, size: 22 })],
      }),
    ],
  });
}

function bodyCell(text, widthPercent) {
  return new TableCell({
    borders: CELL_BORDER,
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    children: [new Paragraph({ children: [new TextRun({ text: text || '', size: 20 })] })],
  });
}

// This function is the single place that defines the exported table's shape.
// Swapping in an official government format later means changing this
// function (and/or adding a new build*Document variant) without touching
// the screens that call exportDiaryToWord().
export function buildTourDiaryDocument({ month, year, entries, profile }) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      headerCell('S.No.', 8),
      headerCell('Date', 14),
      headerCell('From', 22),
      headerCell('To', 22),
      headerCell('Remarks', 34),
    ],
  });

  const dataRows = entries.map(
    (entry) =>
      new TableRow({
        children: [
          bodyCell(String(entry.serial_number), 8),
          bodyCell(formatDisplayDate(entry.date), 14),
          bodyCell(entry.from_location, 22),
          bodyCell(entry.to_location, 22),
          bodyCell(entry.remarks, 34),
        ],
      })
  );

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });

  const titleText = buildDocumentTitle(profile);
  const children = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: titleText, bold: true })],
    }),
  ];

  if (profile && profile.designation && profile.designation.trim()) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [new TextRun({ text: profile.designation.trim(), italics: true, size: 22 })],
      })
    );
  }

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: `${getMonthName(month)} ${year}`, size: 26 })],
    }),
    table,
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 300 },
      children: [new TextRun({ text: 'App developed by Vikas Justa', italics: true, size: 16, color: '8B958F' })],
    })
  );

  return new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });
}

// "Tour Diary of Mr. Ramesh Kumar" — falls back to a plain "Tour Diary"
// title if no profile/name is available (should not normally happen, since
// the app requires a profile before any diary can be created).
function buildDocumentTitle(profile) {
  const name = profile && profile.name && profile.name.trim();
  if (!name) return 'Tour Diary';
  const salutation = profile.salutation && profile.salutation.trim() ? profile.salutation.trim() : 'Mr.';
  return `Tour Diary of ${salutation} ${name}`;
}

/**
 * Builds the .docx, writes it to app storage, then opens the native
 * share/save sheet so the user can actually get the file off the device.
 * Returns the file URI. Throws with a `.code` on failure so screens can
 * show a plain-language message.
 */
export async function exportDiaryToWord({ month, year, entries, profile }) {
  let base64;
  try {
    const doc = buildTourDiaryDocument({ month, year, entries, profile });
    base64 = await Packer.toBase64String(doc);
  } catch (err) {
    const wrapped = new Error('Unable to generate the Word document.');
    wrapped.code = 'BUILD_FAILED';
    throw wrapped;
  }

  const fileName = `TourDiary_${getMonthName(month)}_${year}.docx`;
  const fileUri = `${FileSystem.documentDirectory}${fileName}`;

  try {
    await FileSystem.writeAsStringAsync(fileUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch (err) {
    const wrapped = new Error('Unable to save the Word document to this device.');
    wrapped.code = 'WRITE_FAILED';
    throw wrapped;
  }

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    const err = new Error('Sharing is not available on this device.');
    err.code = 'SHARING_UNAVAILABLE';
    err.fileUri = fileUri;
    throw err;
  }

  try {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      dialogTitle: 'Save / Share Tour Diary',
      UTI: 'org.openxmlformats.wordprocessingml.document',
    });
  } catch (err) {
    const wrapped = new Error('Unable to open the share dialog.');
    wrapped.code = 'SHARE_FAILED';
    wrapped.fileUri = fileUri;
    throw wrapped;
  }

  return fileUri;
}
