import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Image, Linking, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as photoService from '../../services/photoService';
import { setPendingPhoto } from '../../services/notesPhotoBridge';
import PhotoCompositor from '../../components/PhotoCompositor';
import { COLORS } from '../../constants/colors';
import { SPACING, RADIUS, FONT_SIZE } from '../../constants/dimensions';

// GPS-stamped camera for observation photos. Same stamp, same Gallery saving
// and same permissions as the main Camera tab (it reuses photoService and
// PhotoCompositor untouched) — but it returns the finished photo to the
// observation being written instead of asking for diary From/To details.
// Flow: preview -> shutter -> review (+ optional note stamped on the photo)
// -> "Use photo" burns the stamp in, saves to the Gallery and goes back.
export default function NotesCameraScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [, requestCameraPermission] = useCameraPermissions();
  const [checked, setChecked] = useState(false);
  const [granted, setGranted] = useState(false);
  const [mediaOk, setMediaOk] = useState(true);
  const [facing, setFacing] = useState('back');
  const [flashOn, setFlashOn] = useState(false);
  const [location, setLocation] = useState(null);
  const [now, setNow] = useState(new Date());
  const [capturing, setCapturing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pictureSize, setPictureSize] = useState(null);
  const [previewRatio, setPreviewRatio] = useState(9 / 16);
  const [shot, setShot] = useState(null); // { rawUri, location, capturedAtIso }
  const [note, setNote] = useState('');

  const cameraRef = useRef(null);
  const locationSubRef = useRef(null);
  const sizePickedRef = useRef(false);
  const compositorRef = useRef(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const res = await photoService.requestAllPermissions({ requestCameraPermission });
        if (!alive) return;
        const ok = res.camera && res.location;
        setGranted(ok);
        setMediaOk(res.mediaLibrary);
        setChecked(true);
        if (ok) {
          try {
            const sub = await photoService.watchLocation(setLocation);
            if (alive) locationSubRef.current = sub;
            else sub.remove();
          } catch (e) {
            setGranted(false);
          }
        }
      })();
      const clock = setInterval(() => setNow(new Date()), 1000);
      return () => {
        alive = false;
        clearInterval(clock);
        if (locationSubRef.current) {
          locationSubRef.current.remove();
          locationSubRef.current = null;
        }
      };
    }, [requestCameraPermission])
  );

  // Same sizing rule as the main camera: the supported size closest to 16:9, and a preview of exactly that shape.
  async function handleCameraReady() {
    if (sizePickedRef.current || !cameraRef.current) return;
    sizePickedRef.current = true;
    try {
      const sizes = await cameraRef.current.getAvailablePictureSizesAsync();
      if (!sizes || sizes.length === 0) return;
      const target = 16 / 9;
      const list = [];
      sizes.forEach((s) => {
        const [w, h] = s.split('x').map((v) => parseInt(v, 10));
        if (!w || !h) return;
        list.push({ size: s, w, h, ratio: Math.max(w, h) / Math.min(w, h), area: w * h });
      });
      if (list.length === 0) return;
      list.sort((a, b) => {
        const da = Math.abs(a.ratio - target);
        const db = Math.abs(b.ratio - target);
        if (Math.abs(da - db) > 0.01) return da - db;
        return b.area - a.area;
      });
      setPictureSize(list[0].size);
      setPreviewRatio(Math.min(list[0].w, list[0].h) / Math.max(list[0].w, list[0].h));
    } catch (e) {
      // keep the default ratio
    }
  }

  async function handleCapture() {
    if (!cameraRef.current || !location || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      // freeze the GPS reading and time at the moment of the shot
      setShot({ rawUri: photo.uri, location, capturedAtIso: new Date().toISOString() });
      setNote('');
    } catch (e) {
      Alert.alert('Capture Failed', 'Unable to take the photo. Please try again.');
    } finally {
      setCapturing(false);
    }
  }

  async function handleUse() {
    if (!shot || saving) return;
    if (!mediaOk) {
      Alert.alert('Photos permission needed', 'Allow Forest App to save photos to your Gallery so the photo can be kept with your observation.', [
        { text: 'Not Now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    setSaving(true);
    try {
      const lines = photoService.buildStampBox({ ...shot.location, time: new Date(shot.capturedAtIso), note });
      const finalUri = await photoService.compositeFinal(compositorRef, shot.rawUri, lines);
      const saved = await photoService.saveToDeviceGallery(finalUri);
      setPendingPhoto({
        uri: saved.uri,
        mediaId: saved.id,
        takenAt: shot.capturedAtIso,
        latitude: shot.location.latitude,
        longitude: shot.location.longitude,
        accuracy: shot.location.accuracy,
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Could Not Save Photo', 'Something went wrong while saving the photo. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleRetake() {
    if (saving) return;
    photoService.deleteFileIfExists(shot && shot.rawUri);
    setShot(null);
    setNote('');
  }

  function handleClose() {
    if (shot) photoService.deleteFileIfExists(shot.rawUri);
    navigation.goBack();
  }

  const top = Math.max(insets.top, SPACING.lg) + SPACING.sm;

  if (!checked) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primaryText} />
      </View>
    );
  }

  if (!granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>Camera and location permission are needed to take GPS-stamped photos.</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => Linking.openSettings()} accessibilityRole="button">
          <Text style={styles.primaryBtnText}>Open Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.goBack()} accessibilityRole="button">
          <Text style={styles.linkBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ---- review step -----------------------------------------------------------
  if (shot) {
    const lines = photoService.buildStampBox({ ...shot.location, time: new Date(shot.capturedAtIso), note });
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Image source={{ uri: shot.rawUri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
        <View style={[styles.overlayBox, { bottom: 170 }]} pointerEvents="none">
          {lines.map((l, i) => (
            <Text key={i} style={[styles.overlayText, l.color ? { color: l.color } : null]}>{l.text}</Text>
          ))}
        </View>
        <TouchableOpacity style={[styles.closeButton, { top }]} onPress={handleClose} accessibilityRole="button" accessibilityLabel="Cancel">
          <Ionicons name="close" size={26} color={COLORS.white} />
        </TouchableOpacity>
        <View style={[styles.reviewBar, { paddingBottom: Math.max(insets.bottom, SPACING.lg) }]}>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="Add a note to stamp on the photo (optional)"
            placeholderTextColor={COLORS.textMuted}
            maxLength={120}
            editable={!saving}
          />
          <View style={styles.reviewRow}>
            <TouchableOpacity style={[styles.secondaryBtn, { flex: 1 }]} onPress={handleRetake} disabled={saving} accessibilityRole="button">
              <Text style={styles.secondaryBtnText}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.primaryBtn, { flex: 1.4 }, saving && { opacity: 0.7 }]} onPress={handleUse} disabled={saving} accessibilityRole="button">
              {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryBtnText}>Use photo</Text>}
            </TouchableOpacity>
          </View>
        </View>
        <PhotoCompositor ref={compositorRef} />
      </KeyboardAvoidingView>
    );
  }

  // ---- live camera -----------------------------------------------------------------
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

      <TouchableOpacity style={[styles.closeButton, { top }]} onPress={handleClose} accessibilityRole="button" accessibilityLabel="Close camera">
        <Ionicons name="close" size={26} color={COLORS.white} />
      </TouchableOpacity>

      <View style={[styles.topControls, { top }]}>
        <TouchableOpacity style={styles.controlButton} onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))} accessibilityRole="button" accessibilityLabel="Flip camera">
          <Ionicons name="camera-reverse-outline" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton} onPress={() => setFlashOn((v) => !v)} accessibilityRole="button" accessibilityLabel={flashOn ? 'Turn flash off' : 'Turn flash on'}>
          <Ionicons name={flashOn ? 'flash' : 'flash-off'} size={24} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <View style={[styles.overlayBox, { bottom: SPACING.xxl + 90 }]} pointerEvents="none">
        {stampLines ? (
          stampLines.map((l, i) => (
            <Text key={i} style={[styles.overlayText, l.color ? { color: l.color } : null]}>{l.text}</Text>
          ))
        ) : (
          <Text style={styles.overlayText}>Waiting for GPS…</Text>
        )}
      </View>

      <View style={[styles.shutterRow, { bottom: Math.max(insets.bottom, SPACING.lg) + SPACING.lg }]}>
        <TouchableOpacity
          style={[styles.shutterButton, (!location || capturing) && { opacity: 0.4 }]}
          onPress={handleCapture}
          disabled={!location || capturing}
          accessibilityRole="button"
          accessibilityLabel="Take photo"
        >
          {capturing ? <ActivityIndicator color={COLORS.white} /> : <View style={styles.shutterInner} />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  previewWrapper: { width: '100%', maxWidth: '100%', maxHeight: '100%', alignSelf: 'center', backgroundColor: '#000', overflow: 'hidden' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background, padding: SPACING.xl },
  permissionText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.base, textAlign: 'center', marginBottom: SPACING.lg },
  primaryBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, minHeight: 52, paddingHorizontal: SPACING.xl, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONT_SIZE.base },
  secondaryBtn: { backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: RADIUS.md, minHeight: 52, paddingHorizontal: SPACING.lg, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONT_SIZE.base },
  linkBtn: { marginTop: SPACING.md, minHeight: 44, justifyContent: 'center' },
  linkBtnText: { color: COLORS.primaryText, fontWeight: '700' },
  closeButton: { position: 'absolute', left: SPACING.lg, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: RADIUS.md, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topControls: { position: 'absolute', right: SPACING.lg, gap: SPACING.sm },
  controlButton: { backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: RADIUS.md, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  overlayBox: { position: 'absolute', left: SPACING.lg, backgroundColor: 'rgba(255,255,255,0.55)', paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, maxWidth: '75%' },
  overlayText: { color: '#000000', fontSize: FONT_SIZE.sm, fontWeight: '700' },
  shutterRow: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  shutterButton: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.white },
  reviewBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.78)', padding: SPACING.lg, gap: SPACING.md },
  noteInput: { backgroundColor: 'rgba(255,255,255,0.12)', color: COLORS.white, borderRadius: RADIUS.md, minHeight: 48, paddingHorizontal: SPACING.md, fontSize: FONT_SIZE.base },
  reviewRow: { flexDirection: 'row', gap: SPACING.md },
});
