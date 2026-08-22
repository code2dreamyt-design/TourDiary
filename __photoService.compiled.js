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
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = (minFloat - min) * 60;
  const dir = isLat ? decimal >= 0 ? 'N' : 'S' : decimal >= 0 ? 'E' : 'W';
  return `${deg}°${String(min).padStart(2, '0')}'${sec.toFixed(1)}"${dir}`;
}
export function formatLatDMS(latitude) {
  return toDMS(latitude, true);
}
export function formatLonDMS(longitude) {
  return toDMS(longitude, false);
}

/** HH:MM:SS, 24-hour, local device time. */
export function formatTime(date) {
  const d = date || new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * Builds the stamp lines shown live on the camera overlay AND burned onto
 * the photo — one source of truth so the two never drift apart.
 * Returns an array of { text, color? } lines. Elevation line is OMITTED
 * entirely (not shown as blank/zero) when altitude is null/undefined —
 * note 0 is a legitimate altitude (sea level) and must NOT be treated as
 * "missing".
 */
export function buildStampLines({
  latitude,
  longitude,
  altitude,
  accuracy,
  time
}) {
  const lines = [];
  if (latitude != null && longitude != null) {
    lines.push({
      text: `${formatLatDMS(latitude)}  ${formatLonDMS(longitude)}`
    });
  }
  if (altitude !== null && altitude !== undefined && !Number.isNaN(altitude)) {
    lines.push({
      text: `Elevation: ${Math.round(altitude)} m`
    });
  }
  if (accuracy !== null && accuracy !== undefined && !Number.isNaN(accuracy)) {
    lines.push({
      text: `Accuracy: ${Math.round(accuracy)} m`,
      color: getAccuracyColor(accuracy)
    });
  }
  lines.push({
    text: formatTime(time)
  });
  return lines;
}

// --- Permissions -----------------------------------------------------------
/**
 * Requests camera + foreground location + media-library permissions.
 * Returns { camera, location, mediaLibrary } booleans. Screens should check
 * these and show a plain message rather than proceeding if any are false —
 * this never throws.
 */
export async function requestAllPermissions({
  requestCameraPermission
}) {
  const cameraResult = await requestCameraPermission();
  const locationResult = await Location.requestForegroundPermissionsAsync();
  const mediaResult = await MediaLibrary.requestPermissionsAsync();
  return {
    camera: !!(cameraResult && cameraResult.granted),
    location: locationResult.status === 'granted',
    mediaLibrary: mediaResult.status === 'granted'
  };
}

// --- Live location watching -------------------------------------------------
/**
 * Starts watching device location at high accuracy for the live overlay.
 * callback receives { latitude, longitude, altitude, accuracy } — altitude
 * may be null if the device doesn't report it.
 * Returns the subscription; caller must call subscription.remove() on unmount.
 */
export async function watchLocation(callback) {
  return Location.watchPositionAsync({
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 1000,
    distanceInterval: 0
  }, loc => {
    callback({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      altitude: loc.coords.altitude,
      accuracy: loc.coords.accuracy
    });
  });
}

// --- File management ---------------------------------------------------------
const PHOTOS_DIR = `${FileSystem.documentDirectory}photos/`;
async function ensurePhotosDir() {
  const info = await FileSystem.getInfoAsync(PHOTOS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PHOTOS_DIR, {
      intermediates: true
    });
  }
}

/** Deletes a file at the given uri if it exists. Never throws. */
export async function deleteFileIfExists(uri) {
  if (!uri) return;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.deleteAsync(uri, {
        idempotent: true
      });
    }
  } catch (e) {
    // Best-effort cleanup — a failed delete of a temp file isn't worth
    // surfacing to the user.
  }
}

/** True if a file exists at the given path (used to detect a photo the user deleted outside the app). */
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
 * Moves a composited photo from cache into permanent app storage, named by
 * entry id so re-saves for the same entry are easy to reason about. If an
 * old photo already existed for this entry, deletes it first (replace).
 * Returns the final permanent path.
 */
export async function savePhotoPermanently(sourceUri, entryId, previousPhotoPath) {
  await ensurePhotosDir();
  if (previousPhotoPath) {
    await deleteFileIfExists(previousPhotoPath);
  }
  const destUri = `${PHOTOS_DIR}entry_${entryId}_${Date.now()}.jpg`;
  await FileSystem.copyAsync({
    from: sourceUri,
    to: destUri
  });
  await deleteFileIfExists(sourceUri);
  return destUri;
}

/** Saves a photo to the device's gallery/camera roll — used when the photo isn't attached to any entry. */
export async function saveToGallery(uri) {
  await MediaLibrary.saveToLibraryAsync(uri);
}

// --- Compositing orchestration ------------------------------------------
// These two functions are the actual "on capture, burn the stamp" (step 2)
// and "note gets burned in too" (step 3) passes from the spec. Both delegate
// the actual pixel work to a <PhotoCompositor> ref the calling screen holds
// (compositing needs a real mounted view to render into — see that file).

/**
 * Pass 1 — right after the shutter fires: burns the GPS/time stamp box
 * (bottom-left) onto the raw capture. Deletes the raw temp file afterward.
 * Returns the path of the new intermediate "stamped" file (still in cache).
 */
export async function compositeStamp(compositorRef, rawUri, stampLines) {
  const stampedUri = await compositorRef.current.capture(rawUri, {
    position: 'bottom-left',
    lines: stampLines
  });
  await deleteFileIfExists(rawUri);
  return stampedUri;
}

/**
 * Pass 2 — after the user confirms the From/To/Note form: burns the note
 * text (bottom-right) onto the already-stamped image. If note is empty,
 * skips this pass entirely (no need to re-render/re-encode the image) and
 * just returns the stamped file as-is. Deletes the intermediate stamped
 * cache file once the final composite is made.
 */
export async function compositeNote(compositorRef, stampedUri, note) {
  const trimmed = (note || '').trim();
  if (!trimmed) return stampedUri;
  const finalUri = await compositorRef.current.capture(stampedUri, {
    position: 'bottom-right',
    lines: [{
      text: trimmed
    }]
  });
  await deleteFileIfExists(stampedUri);
  return finalUri;
}