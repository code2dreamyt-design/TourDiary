import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

// Photos chosen from the Gallery for an observation are COPIED into the app's
// own storage (…/notes_photos/) so they survive the picker's temporary cache
// being cleared. notesService deletes these private copies when the photo or
// the observation is removed. Photos taken with the Notes camera are different:
// they live in the user's Gallery (like every other photo in the app) and are
// never deleted from here.

function folder() {
  return `${FileSystem.documentDirectory}notes_photos/`;
}

function extensionOf(uri) {
  const m = /\.([a-zA-Z0-9]{2,5})(?:\?|$)/.exec(uri || '');
  return m ? m[1].toLowerCase() : 'jpg';
}

/** Lets the user pick up to `limit` photos. Resolves to [{ uri, takenAt, latitude, longitude }] (empty if cancelled). */
export async function importFromGallery(limit) {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: limit > 1,
    selectionLimit: Math.max(1, limit),
    quality: 0.9,
  });
  if (res.canceled || !res.assets || res.assets.length === 0) return [];
  try {
    await FileSystem.makeDirectoryAsync(folder(), { intermediates: true });
  } catch (e) {
    // already exists
  }
  const out = [];
  for (let i = 0; i < res.assets.length; i++) {
    const asset = res.assets[i];
    const dest = `${folder()}obs_${Date.now()}_${i}.${extensionOf(asset.uri)}`;
    await FileSystem.copyAsync({ from: asset.uri, to: dest });
    out.push({ uri: dest, mediaId: null, takenAt: null, latitude: null, longitude: null });
  }
  return out;
}
