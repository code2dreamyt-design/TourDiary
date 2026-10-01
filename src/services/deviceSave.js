import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as SecureStore from 'expo-secure-store';

// ---------------------------------------------------------------------------
// Saves an exported Word file ONTO THE PHONE (not just a share sheet).
//
// Android: the first export asks the user to pick a folder once (Android's
//   own folder picker, no storage permission needed); the file is then
//   written straight into it. The folder is remembered, so every later
//   export saves with no extra steps. If the remembered folder stops working
//   (deleted, permission revoked) the picker is shown again automatically.
// iOS: there is no folder access, so the system share sheet is used
//   ("Save to Files").
//
// Used by BOTH the diary export and the TD export so they behave the same.
// Errors carry a `.code`: SAVE_CANCELLED, WRITE_FAILED, SHARING_UNAVAILABLE,
// SHARE_FAILED.
// ---------------------------------------------------------------------------

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const DOCX_UTI = 'org.openxmlformats.wordprocessingml.document';
const FOLDER_KEY = 'export.folderUri';

async function getSavedFolder() {
  try {
    return await SecureStore.getItemAsync(FOLDER_KEY);
  } catch (e) {
    return null;
  }
}

async function setSavedFolder(uri) {
  try {
    if (uri) await SecureStore.setItemAsync(FOLDER_KEY, uri);
    else await SecureStore.deleteItemAsync(FOLDER_KEY);
  } catch (e) {
    // Not being able to remember the folder only means we ask again next time.
  }
}

/** Makes the next Android export ask for a save folder again. */
export async function resetExportFolder() {
  await setSavedFolder(null);
}

async function pickFolder() {
  const SAF = FileSystem.StorageAccessFramework;
  let initial = null;
  try {
    initial = SAF.getUriForDirectoryInRoot('Documents');
  } catch (e) {
    initial = null;
  }
  let result;
  try {
    result = await SAF.requestDirectoryPermissionsAsync(initial);
  } catch (e) {
    throw coded('Unable to open the folder picker.', 'WRITE_FAILED');
  }
  if (!result.granted) return null;
  await setSavedFolder(result.directoryUri);
  return result.directoryUri;
}

async function writeIntoFolder(folderUri, fileName, base64) {
  const SAF = FileSystem.StorageAccessFramework;
  // Android adds the .docx extension from the MIME type, so pass the bare name.
  const baseName = fileName.replace(/\.docx$/i, '');
  const fileUri = await SAF.createFileAsync(folderUri, baseName, DOCX_MIME);
  await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
  return fileUri;
}

function coded(message, code) {
  const err = new Error(message);
  err.code = code;
  return err;
}

/** Writes a temporary copy that the share sheet can read. */
async function writeShareCopy(fileName, base64) {
  const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  const uri = `${dir}${fileName}`;
  try {
    await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  } catch (e) {
    throw coded('Unable to save the Word document to this device.', 'WRITE_FAILED');
  }
  return uri;
}

/** Opens the system share sheet for an already-exported file (the "Share" button). */
export async function shareDocxFile(fileName, base64) {
  const uri = await writeShareCopy(fileName, base64);
  if (!(await Sharing.isAvailableAsync())) {
    throw coded('Sharing is not available on this device.', 'SHARING_UNAVAILABLE');
  }
  try {
    await Sharing.shareAsync(uri, { mimeType: DOCX_MIME, dialogTitle: 'Share Word file', UTI: DOCX_UTI });
  } catch (e) {
    throw coded('Unable to open the share dialog.', 'SHARE_FAILED');
  }
}

/**
 * Saves the .docx (base64) to the phone.
 * Returns { kind: 'saved', fileName, base64 } when it was written to a folder
 * (Android), or { kind: 'shared', fileName } after the iOS share sheet.
 */
export async function saveDocxToPhone({ fileName, base64 }) {
  if (Platform.OS !== 'android') {
    await shareDocxFile(fileName, base64);
    return { kind: 'shared', fileName };
  }

  let folder = await getSavedFolder();
  let triedRepick = false;

  // At most: saved folder -> (if it fails) ask again once.
  for (;;) {
    if (!folder) {
      folder = await pickFolder();
      if (!folder) throw coded('No folder was chosen, so the file was not saved.', 'SAVE_CANCELLED');
      triedRepick = true;
    }
    try {
      await writeIntoFolder(folder, fileName, base64);
      return { kind: 'saved', fileName, base64 };
    } catch (e) {
      await setSavedFolder(null);
      if (triedRepick) throw coded('Unable to save the Word document to the chosen folder.', 'WRITE_FAILED');
      folder = null; // remembered folder no longer works -> ask once more
    }
  }
}
