import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as photoService from '../services/photoService';
import { COLORS } from '../constants/colors';
import { SPACING, RADIUS, FONT_SIZE } from '../constants/dimensions';

// Live camera preview with a GPS/time overlay, flip + flash controls, and a
// shutter. Capture just takes the raw photo and freezes the current
// location + time — the actual stamp burn-in happens in one single pass on
// PhotoDetailsFormScreen, after the note (if any) is known, so the image is
// only re-encoded once.
export default function CameraCaptureScreen({ navigation }) {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [permissionsChecked, setPermissionsChecked] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);

  const [facing, setFacing] = useState('back');
  const [flashOn, setFlashOn] = useState(false);
  const [location, setLocation] = useState(null); // { latitude, longitude, altitude, accuracy }
  const [now, setNow] = useState(new Date());
  const [capturing, setCapturing] = useState(false);

  const cameraRef = useRef(null);
  const locationSubRef = useRef(null);

  const setupPermissionsAndWatch = useCallback(async () => {
    const result = await photoService.requestAllPermissions({ requestCameraPermission });
    setPermissionsGranted(result.camera && result.location);
    setPermissionsChecked(true);
    if (result.camera && result.location) {
      locationSubRef.current = await photoService.watchLocation(setLocation);
    }
  }, [requestCameraPermission]);

  useFocusEffect(
    useCallback(() => {
      setupPermissionsAndWatch();
      const clockId = setInterval(() => setNow(new Date()), 1000);
      return () => {
        clearInterval(clockId);
        if (locationSubRef.current) {
          locationSubRef.current.remove();
          locationSubRef.current = null;
        }
      };
    }, [setupPermissionsAndWatch])
  );

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
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!permissionsGranted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>
          Camera and location permission are needed to take GPS-stamped photos.
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={setupPermissionsAndWatch} accessibilityRole="button">
          <Text style={styles.retryButtonText}>Grant Permissions</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const stampLines = location ? photoService.buildStampBox({ ...location, time: now }) : null;

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} flash={flashOn ? 'on' : 'off'} />

      <View style={styles.topControls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
          accessibilityRole="button"
        >
          <Text style={styles.controlButtonText}>Flip</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton} onPress={() => setFlashOn((v) => !v)} accessibilityRole="button">
          <Text style={styles.controlButtonText}>{flashOn ? 'Flash On' : 'Flash Off'}</Text>
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
  container: { flex: 1, backgroundColor: '#000' },
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
