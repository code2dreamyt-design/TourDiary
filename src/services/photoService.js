// All camera/location/GPS-stamping logic lives here — screens only call
// these functions and render UI; they never touch expo-camera/expo-location/
// expo-media-library or file paths directly.
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';

// --- Accuracy color thresholds (per spec) ---------------------------------
// < 11m = green, 11-69m = yellow, >= 70m = red.
export function getAccuracyColor(accuracyMeters) {
  if (accuracyMeters == null || Number.isNaN(accuracyMeters)) return '#8B958F'; // muted grey fallback
  if (accuracyMeters < 11) return '#2E7D4F'; // green
  if (accuracyMeters < 70) return '#C9A227'; // yellow
  return '#B3261E'; // red
}

// --- DMS (degrees/minutes/seconds) formatting -----------------------------
function toDMS(decimal, isLat) {
  const abs = Math.abs(decimal);
  let deg = Math.floor(abs);
  let minFloat = (abs - deg) * 60;
  let min = Math.floor(minFloat);
  let sec = (minFloat - min) * 60;

  // Round to 2 decimal places *before* checking for carry — floating-point
  // arithmetic above can produce e.g. sec=59.9999994, which rounds to
  // "60.00" and must roll over into the next minute (and minute into the
  // next degree), rather than being displayed as an invalid "60.00" seconds.
  sec = Math.round(sec * 100) / 100;
  if (sec >= 60) {
    sec -= 60;
    min += 1;
  }
  if (min >= 60) {
    min -= 60;
    deg += 1;
  }

  const dir = isLat ? (decimal >= 0 ? 'N' : 'S') : decimal >= 0 ? 'E' : 'W';
  return `${deg}°${String(min).padStart(2, '0')}'${sec.toFixed(2)}"${dir}`;
}

export function formatLatDMS(latitude) {
  return toDMS(latitude, true);
}

export function formatLonDMS(longitude) {
  return toDMS(longitude, false);
}

/** "2026-08-20 14:17" — date + 24-hour HH:mm, local device time, no seconds. */
export function formatDateTime(date) {
  const d = date || new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "2,722.29" — thousands-separated, 2 decimal places. */
function formatDecimal(n, decimals) {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/**
 * Builds the stamp box lines — used for BOTH the live camera overlay AND
 * the single burn-in pass on confirm, so the two never drift apart.
 * Returns an array of { text, color? } lines, top to bottom:
 *   Latitude: ...
 *   Longitude: ...
 *   Elevation: ... m ± ...   (omitted entirely if altitude is null/undefined —
 *                             0 is a legitimate altitude/sea level and is shown)
 *   Accuracy: ...             (color-coded by threshold)
 *   Time: YYYY-MM-DD HH:mm
 *   Note: ...                 (only included if a non-empty note is passed)
 */
export function buildStampBox({ latitude, longitude, altitude, altitudeAccuracy, accuracy, time, note }) {
  const lines = [];
  if (latitude != null && !Number.isNaN(latitude)) {
    lines.push({ text: `Latitude: ${formatLatDMS(latitude)}` });
  }
  if (longitude != null && !Number.isNaN(longitude)) {
    lines.push({ text: `Longitude: ${formatLonDMS(longitude)}` });
  }
  if (altitude !== null && altitude !== undefined && !Number.isNaN(altitude)) {
    const hasAccuracy = altitudeAccuracy !== null && altitudeAccuracy !== undefined && !Number.isNaN(altitudeAccuracy);
    const suffix = hasAccuracy ? ` \u00B1 ${formatDecimal(altitudeAccuracy, 2)}` : '';
    lines.push({ text: `Elevation: ${formatDecimal(altitude, 2)} m${suffix}` });
  }
  if (accuracy !== null && accuracy !== undefined && !Number.isNaN(accuracy)) {
    lines.push({ text: `Accuracy: ${formatDecimal(accuracy, 2)}`, color: getAccuracyColor(accuracy) });
  }
  lines.push({ text: `Time: ${formatDateTime(time)}` });
  const trimmedNote = (note || '').trim();
  if (trimmedNote) {
    lines.push({ text: `Note: ${trimmedNote}` });
  }
  return lines;
}

// --- Permissions -----------------------------------------------------------
/**
 * Requests camera + foreground location + media-library permissions.
 * Returns { camera, location, mediaLibrary } booleans. Screens should check
 * these and show a plain message rather than proceeding if any are false —
 * this never throws.
 */
export async function requestAllPermissions({ requestCameraPermission }) {
  const cameraResult = await requestCameraPermission();
  const locationResult = await Location.requestForegroundPermissionsAsync();
  const mediaResult = await MediaLibrary.requestPermissionsAsync();
  return {
    camera: !!(cameraResult && cameraResult.granted),
    location: locationResult.status === 'granted',
    mediaLibrary: mediaResult.status === 'granted',
  };
}

// --- Live location watching -------------------------------------------------
/**
 * Starts watching device location at high accuracy for the live overlay.
 * callback receives { latitude, longitude, altitude, altitudeAccuracy, accuracy }
 * — altitude/altitudeAccuracy may be null if the device doesn't report them.
 * Returns the subscription; caller must call subscription.remove() on unmount.
 */
export async function watchLocation(callback) {
  return Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 1000,
      distanceInterval: 0,
    },
    (loc) => {
      callback({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        altitude: loc.coords.altitude,
        altitudeAccuracy: loc.coords.altitudeAccuracy,
        accuracy: loc.coords.accuracy,
      });
    }
  );
}

// --- File management ---------------------------------------------------------

/** Deletes a file at the given uri if it exists. Never throws. */
export async function deleteFileIfExists(uri) {
  if (!uri) return;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch (e) {
    // Best-effort cleanup — a failed delete of a temp file isn't worth
    // surfacing to the user.
  }
}

/**
 * True if a photo is still there. Used to detect a photo the user deleted
 * outside the app (from their Gallery) — since photos live in the device's
 * public gallery now (not a private app-only copy), this is a real,
 * meaningful check: the user has full control, and deleting it from their
 * Gallery app is reflected here.
 */
export async function fileExists(uri) {
  if (!uri) return false;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return !!info.exists;
  } catch (e) {
    return false;
  }
}

/**
 * Saves a finished (already-stamped) photo to the device's public Gallery —
 * this is the ONE and ONLY place a photo ends up. There is no separate
 * private app-storage copy: whether a photo is attached to a diary entry or
 * not, it lives in the Gallery, and the app just remembers the path when
 * it's attached to an entry. Deletes the disposable cache copy afterward.
 * Returns { uri, id } for the new Gallery asset — uri is suitable for both
 * <Image> display and fileExists() checks (on Android this is a real
 * file:// path into the device's MediaStore); id is the MediaStore numeric
 * id, needed by openInViewer to open the photo in the real Gallery app
 * (see openInViewer's comment for why).
 */
export async function saveToDeviceGallery(localUri) {
  const asset = await MediaLibrary.createAssetAsync(localUri);
  await deleteFileIfExists(localUri);
  return { uri: asset.uri, id: asset.id };
}

/**
 * Returns the uri of the most recently added photo in the device's public
 * Gallery, or null if there isn't one / the media-library permission isn't
 * granted / the lookup fails for any reason. Powers the camera screen's
 * "last photo" thumbnail — mirrors what a stock camera app shows (the most
 * recent photo in the gallery generally, not only ones taken via this app).
 * Never throws.
 *
 * ROOT CAUSE of the thumbnail getting "stuck" on an old (non-TourDiary)
 * photo, including after a fresh app restart: this used to sort by
 * `SortBy.creationTime`, which on Android maps directly to the MediaStore
 * `DATE_TAKEN` column (confirmed by reading expo-media-library's own
 * Android source — see SortBy.CREATION_TIME in MediaLibraryEnums.kt) and
 * on iOS to `PHAsset.creationDate`. That column is populated from the
 * image file's own EXIF "date taken" metadata. Our own photos are final
 * composites produced by react-native-view-shot (a fresh render/snapshot,
 * not a straight sensor capture), so they carry no reliable EXIF
 * DateTimeOriginal — the OS is then free to leave DATE_TAKEN stale/blank,
 * which can sort a just-captured TourDiary photo *behind* a genuinely
 * older photo that has proper camera EXIF data (e.g. one from the phone's
 * default Camera app). The in-session `justSavedPhoto` hand-off (see
 * CameraCaptureScreen) papers over this right after a capture, but any
 * fresh query — including the very first load after an app restart —
 * still hit this and landed on the wrong photo.
 *
 * The fix: sort by `SortBy.default` instead, which maps to the MediaStore
 * row `_ID` (Android) / the platform's natural fetch order (iOS) — true
 * insertion order, independent of any EXIF metadata the file may or may
 * not carry, so it reliably reflects whatever was added most recently.
 */
export async function getMostRecentGalleryPhoto() {
  try {
    const result = await MediaLibrary.getAssetsAsync({
      mediaType: MediaLibrary.MediaType.photo,
      sortBy: [[MediaLibrary.SortBy.default, false]],
      first: 1,
    });
    if (!result || !result.assets || result.assets.length === 0) return null;
    const asset = result.assets[0];
    // Return both the uri (for <Image> display/fileExists checks) and the
    // MediaStore numeric id (needed by openInViewer to build a real
    // content:// URI — see that function for why the uri alone isn't enough).
    return { uri: asset.uri, id: asset.id };
  } catch (e) {
    return null;
  }
}

/**
 * Opens a photo in the device's own Gallery/Photos viewer — the same
 * behavior other camera apps use for their "last photo" thumbnail. This is
 * a real "view" hand-off, not a share: no "send to..." chooser, no picking
 * an app to send the file to.
 *
 * `mediaId` is the MediaLibrary asset's numeric id (from
 * getMostRecentGalleryPhoto's returned { uri, id }) and is the key to this
 * actually working — see below.
 *
 * ROOT CAUSE this works around: on Android, expo-media-library returns
 * asset.uri as a raw `file://` path straight into the device's *public*
 * gallery storage (built from MediaStore.Images.Media.DATA — confirmed by
 * reading expo-media-library's own Android source). expo-file-system's
 * FileProvider (used by getContentUriAsync) only ever exposes the app's
 * OWN private storage — its file_paths.xml declares just
 * <files-path>/<cache-path>, nothing public (confirmed via `expo prebuild`
 * and inspecting the generated native config). So getContentUriAsync()
 * always threw for a real gallery photo, silently falling into the catch
 * block below and landing on the share sheet — which is the bug being
 * fixed here.
 *
 * The fix: skip the FileProvider path entirely and build a MediaStore
 * content:// URI directly from the asset's own id
 * (content://media/external/images/media/<id>), which is a real, always-
 * valid handle to a public gallery image regardless of where its
 * underlying file lives.
 *
 * On Android, this fires a genuine ACTION_VIEW intent (via
 * expo-intent-launcher) at that content:// URI, which opens directly in
 * whatever the user's default photo viewer is (Gallery, Google Photos,
 * etc.) — mirroring what a stock camera app does. If mediaId isn't
 * available for some reason, or the intent still fails (older device
 * quirks, no viewer registered, etc.), it falls back to the share sheet so
 * the user still has *some* way to see the photo.
 *
 * On iOS there's no public API for a third-party app to open the Photos
 * app to a specific image, so this uses the share sheet, which on iOS
 * shows a full preview of the photo itself before any app/action is
 * chosen.
 *
 * Never throws; screens don't need a try/catch around this.
 */
export async function openInViewer(uri, mediaId) {
  if (!uri) return;
  try {
    if (Platform.OS === 'android') {
      const contentUri = mediaId
        ? `content://media/external/images/media/${mediaId}`
        : await FileSystem.getContentUriAsync(uri); // last-resort path if no id was passed
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        type: 'image/*',
      });
      return;
    }
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) return;
    await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: 'View Photo' });
  } catch (e) {
    // Fall back to the share sheet if the native viewer intent couldn't be
    // launched — still better than leaving the user stuck with nothing.
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: 'View Photo' });
      }
    } catch (e2) {
      // Truly nothing left to recover from.
    }
  }
}

// --- Compositing orchestration ------------------------------------------
// A single burn-in pass, done once the From/To/Note form is confirmed —
// the GPS/time stamp box and the note (if any) are composited onto the raw
// capture together in one shot, avoiding a double JPEG re-encode and an
// intermediate cache file. Delegates the actual pixel work to a
// <PhotoCompositor> ref the calling screen holds (compositing needs a real
// mounted view to render into — see that file).
export async function compositeFinal(compositorRef, rawUri, boxLines) {
  const finalUri = await compositorRef.current.capture(rawUri, {
    position: 'bottom-left',
    lines: boxLines,
  });
  await deleteFileIfExists(rawUri);
  return finalUri;
}
