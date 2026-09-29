import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as photoService from '../services/photoService';
import { COLORS } from '../constants/colors';
import { SPACING, RADIUS, FONT_SIZE } from '../constants/dimensions';

// Live camera preview with a GPS/time overlay, flip + flash controls, and a
// shutter. Capture just takes the raw photo and freezes the current
// location + time — the actual stamp burn-in happens in one single pass on
// PhotoDetailsFormScreen, after the note (if any) is known, so the image is
// only re-encoded once.
export default function CameraCaptureScreen({ navigation, route }) {
  // If we're arriving here with a justSavedPhoto hand-off, this is a fresh
  // mount straight after a successful capture on this very screen a moment
  // ago — camera + location permission are a logical certainty (capture
  // itself requires both). Seeding these as already-true from the start
  // skips the blocking full-screen spinner below entirely for that case;
  // the real check still runs via setupPermissionsAndWatch below, just
  // without gating the UI on it first. A true first-ever visit (no
  // justSavedPhoto) still starts unchecked and shows the spinner as before.
  const cameFromSave = !!route.params?.justSavedPhoto;

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [permissionsChecked, setPermissionsChecked] = useState(cameFromSave);
  const [permissionsGranted, setPermissionsGranted] = useState(cameFromSave);

  const [facing, setFacing] = useState('back');
  const [flashOn, setFlashOn] = useState(false);
  const [location, setLocation] = useState(null); // { latitude, longitude, altitude, accuracy }
  const [now, setNow] = useState(new Date());
  const [capturing, setCapturing] = useState(false);
  const [pictureSize, setPictureSize] = useState(null); // "1920x1080" — chosen once, from the device's own supported sizes
  const [previewRatio, setPreviewRatio] = useState(9 / 16); // matches pictureSize once known, so preview framing == actual capture
  const [lastPhotoUri, setLastPhotoUri] = useState(null); // most recent Gallery photo, shown as a thumbnail like a stock camera app
  const [lastPhotoId, setLastPhotoId] = useState(null); // MediaStore id for that same photo — required to open it in the real Gallery viewer

  const cameraRef = useRef(null);
  const locationSubRef = useRef(null);
  const sizePickedRef = useRef(false);
  const consumedJustSavedUriRef = useRef(null); // tracks which justSavedPhoto hand-off we've already applied, to avoid reapplying/re-querying on unrelated focuses
  const permissionsGrantedRef = useRef(cameFromSave); // mirrors permissionsGranted without being a useCallback dependency, so re-requesting can be skipped below without changing setupPermissionsAndWatch's identity

  const setupPermissionsAndWatch = useCallback(async (overridePhoto) => {
    let granted = permissionsGrantedRef.current;
    if (!granted) {
      // Only hit this on the first run, or after a previous attempt
      // failed (e.g. the user just tapped "Grant Permissions"). Once
      // granted, routine refocuses skip straight past this block —
      // re-requesting already-granted camera/location/media permissions
      // on every single focus was an extra native round-trip + setState
      // firing right in the middle of the tab-switch transition, which is
      // what turned the white-container flash (see AppNavigator /
      // MainTabNavigator) into 2–3 rapid blinks instead of one clean one.
      const result = await photoService.requestAllPermissions({ requestCameraPermission });
      granted = result.camera && result.location;
      permissionsGrantedRef.current = granted;
      setPermissionsGranted(granted);
      setPermissionsChecked(true);
      if (!granted) {
        setLastPhotoUri(null);
        setLastPhotoId(null);
        return;
      }
    }

    // These two run on every focus regardless — neither re-requests a
    // permission (so neither contributes to the blink), and both are
    // what keep the live overlay and "last photo" thumbnail correct:
    // the location subscription was torn down on the previous blur, and
    // the gallery may have changed since we were last here.
    try {
      locationSubRef.current = await photoService.watchLocation(setLocation);
    } catch (e) {
      // Permission may have been revoked from OS settings since we last
      // checked here — fall back to a full re-request next time instead
      // of silently leaving the overlay stuck with no location.
      permissionsGrantedRef.current = false;
      setPermissionsGranted(false);
      return;
    }

    if (overridePhoto) {
      // We just came back from saving a photo and already know exactly
      // which asset that is — trust it over the gallery requery below.
      // (See the useFocusEffect comment for why the requery alone isn't
      // reliable enough to be the only source for this.)
      setLastPhotoUri(overridePhoto.uri);
      setLastPhotoId(overridePhoto.id);
    } else {
      // getMostRecentGalleryPhoto() never throws — it resolves to null on
      // its own if media-library permission isn't granted, so there's no
      // need to gate this call on that permission separately.
      const photo = await photoService.getMostRecentGalleryPhoto();
      setLastPhotoUri(photo ? photo.uri : null);
      setLastPhotoId(photo ? photo.id : null);
    }
  }, [requestCameraPermission]);

  // Picks the device's supported photo size closest to 16:9 (a "full
  // screen" wide ratio, not the boxed-in 4:3 a plain "largest available"
  // pick often lands on), and makes the on-screen preview match that exact
  // ratio — so what's framed on screen is exactly what ends up in the saved
  // photo. Falls back to the largest available size if nothing close to
  // 16:9 exists, rather than breaking on devices with limited options.
  async function handleCameraReady() {
    if (sizePickedRef.current || !cameraRef.current) return;
    sizePickedRef.current = true;
    try {
      const sizes = await cameraRef.current.getAvailablePictureSizesAsync();
      if (!sizes || sizes.length === 0) return; // fall back to default behavior

      const TARGET_RATIO = 16 / 9;
      const candidates = [];
      for (const s of sizes) {
        const [wStr, hStr] = s.split('x');
        const w = parseInt(wStr, 10);
        const h = parseInt(hStr, 10);
        if (!w || !h) continue;
        const long = Math.max(w, h);
        const short = Math.min(w, h);
        candidates.push({ size: s, w, h, ratio: long / short, area: w * h });
      }
      if (candidates.length === 0) return;

      // Closest to 16:9 wins; ties (same ratio family) broken by largest resolution.
      candidates.sort((a, b) => {
        const diffA = Math.abs(a.ratio - TARGET_RATIO);
        const diffB = Math.abs(b.ratio - TARGET_RATIO);
        if (Math.abs(diffA - diffB) > 0.01) return diffA - diffB;
        return b.area - a.area;
      });
      const best = candidates[0];

      setPictureSize(best.size);
      // Sizes are reported in the sensor's natural (landscape) orientation —
      // display the preview in portrait proportions (matching how the phone
      // is actually held), i.e. the smaller dimension over the larger one.
      setPreviewRatio(Math.min(best.w, best.h) / Math.max(best.w, best.h));
    } catch (e) {
      // Some devices/emulators don't support this — preview just keeps the
      // default 9:16 ratio rather than breaking.
    }
  }

  useFocusEffect(
    useCallback(() => {
      // If PhotoDetailsFormScreen just handed us back the photo it saved,
      // that's the guaranteed-correct "last photo" — use it directly
      // instead of leaning solely on getMostRecentGalleryPhoto(), whose
      // ordering can lag behind an asset that was created moments ago
      // (this was the actual cause of the thumbnail getting stuck on an
      // old photo, including across app restarts, since every future
      // requery kept landing on the same stale result).
      //
      // Dedupe via a ref rather than navigation.setParams(): clearing the
      // param would change route.params?.justSavedPhoto, which — since
      // it's a useCallback dependency below — produces a new callback
      // identity. useFocusEffect re-invokes a changed callback immediately
      // while still focused, so that second run would see justSaved as
      // undefined and re-fire the unreliable gallery query right after,
      // clobbering the thumbnail we'd just correctly set. The ref sidesteps
      // that entirely: no params mutation, no extra re-run.
      const justSaved = route.params?.justSavedPhoto;
      const isNewJustSaved = !!justSaved && justSaved.uri !== consumedJustSavedUriRef.current;
      if (isNewJustSaved) {
        consumedJustSavedUriRef.current = justSaved.uri;
      }
      setupPermissionsAndWatch(isNewJustSaved ? justSaved : null);
      const clockId = setInterval(() => setNow(new Date()), 1000);
      return () => {
        clearInterval(clockId);
        if (locationSubRef.current) {
          locationSubRef.current.remove();
          locationSubRef.current = null;
        }
      };
    }, [setupPermissionsAndWatch, route.params?.justSavedPhoto])
  );

  async function handleViewLastPhoto() {
    if (!lastPhotoUri) return;
    await photoService.openInViewer(lastPhotoUri, lastPhotoId);
  }

  async function handleCapture() {
    if (!cameraRef.current || !location || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      // Freeze location + time exactly as they were at the moment of capture —
      // the form screen must not use a "live" reading that drifts while the
      // user is typing.
      navigation.navigate('PhotoDetailsForm', {
        rawUri: photo.uri,
        location,
        capturedAtIso: new Date().toISOString(),
      });
    } catch (err) {
      Alert.alert('Capture Failed', 'Unable to take the photo. Please try again.');
    } finally {
      setCapturing(false);
    }
  }

  if (!permissionsChecked) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primaryText} />
      </View>
    );
  }

  if (!permissionsGranted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>
          Camera and location permission are needed to take GPS-stamped photos.
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => setupPermissionsAndWatch()} accessibilityRole="button">
          <Text style={styles.retryButtonText}>Grant Permissions</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const stampLines = location ? photoService.buildStampBox({ ...location, time: now }) : null;

  return (
    <View style={styles.container}>
      <View style={[styles.previewWrapper, { aspectRatio: previewRatio }]}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          flash={flashOn ? 'on' : 'off'}
          pictureSize={pictureSize || undefined}
          onCameraReady={handleCameraReady}
        />
      </View>

      <TouchableOpacity
        style={styles.closeButton}
        onPress={() => navigation.navigate('Home')}
        accessibilityRole="button"
        accessibilityLabel="Close camera"
      >
        <Ionicons name="close" size={26} color={COLORS.white} />
      </TouchableOpacity>

      <View style={styles.topControls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
          accessibilityRole="button"
          accessibilityLabel="Flip camera"
        >
          <Ionicons name="camera-reverse-outline" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => setFlashOn((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={flashOn ? 'Turn flash off' : 'Turn flash on'}
        >
          <Ionicons name={flashOn ? 'flash' : 'flash-off'} size={24} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.overlayBox}>
        {stampLines ? (
          stampLines.map((line, i) => (
            <Text key={i} style={[styles.overlayText, line.color ? { color: line.color } : null]}>
              {line.text}
            </Text>
          ))
        ) : (
          <Text style={styles.overlayText}>Waiting for GPS…</Text>
        )}
      </View>

      {lastPhotoUri && (
        <TouchableOpacity
          style={styles.thumbnailButton}
          onPress={handleViewLastPhoto}
          accessibilityRole="button"
          accessibilityLabel="View last photo"
        >
          <Image source={{ uri: lastPhotoUri }} style={styles.thumbnailImage} resizeMode="cover" />
        </TouchableOpacity>
      )}

      <View style={styles.shutterRow}>
        <TouchableOpacity
          style={[styles.shutterButton, (!location || capturing) && styles.shutterButtonDisabled]}
          onPress={handleCapture}
          disabled={!location || capturing}
          accessibilityRole="button"
        >
          {capturing ? <ActivityIndicator color={COLORS.white} /> : <View style={styles.shutterInner} />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  previewWrapper: {
    width: '100%',
    maxWidth: '100%',
    maxHeight: '100%',
    alignSelf: 'center',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.xl,
  },
  permissionText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.base, textAlign: 'center', marginBottom: SPACING.lg },
  retryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
  },
  retryButtonText: { color: COLORS.white, fontWeight: '700' },
  topControls: {
    position: 'absolute',
    top: SPACING.xl,
    right: SPACING.lg,
    gap: SPACING.sm,
  },
  closeButton: {
    position: 'absolute',
    top: SPACING.xl,
    left: SPACING.lg,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: RADIUS.md,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButton: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  controlButtonText: { color: COLORS.white, fontWeight: '600', fontSize: FONT_SIZE.sm },
  overlayBox: {
    position: 'absolute',
    left: SPACING.lg,
    bottom: SPACING.xxl + 70,
    backgroundColor: 'rgba(255,255,255,0.55)',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    maxWidth: '75%',
  },
  overlayText: { color: '#000000', fontSize: FONT_SIZE.sm, fontWeight: '700' },
  shutterRow: {
    position: 'absolute',
    bottom: SPACING.xxl,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  thumbnailButton: {
    position: 'absolute',
    bottom: SPACING.xxl + 6,
    left: SPACING.lg,
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.white,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  shutterButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterButtonDisabled: { opacity: 0.4 },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.white,
  },
});
