// All camera/location/GPS-stamping logic lives here — screens only call
// these functions and render UI; they never touch expo-camera/expo-location/
// expo-media-library or file paths directly.
import * as Location from 'expo-location';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';

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
 * Returns the Gallery asset's path, suitable for both <Image> display and
 * fileExists() checks (on Android this is a real file:// path into the
 * device's MediaStore).
 */
export async function saveToDeviceGallery(localUri) {
  const asset = await MediaLibrary.createAssetAsync(localUri);
  await deleteFileIfExists(localUri);
  return asset.uri;
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
