import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import * as photoService from '../services/photoService';
import PhotoZoomViewer from './PhotoZoomViewer';
import { COLORS } from '../constants/colors';
import { SPACING, RADIUS, FONT_SIZE, TOUCH_TARGET_MIN } from '../constants/dimensions';

// Shows one of exactly three states for an entry's attached photo:
//   1. No photo_path at all -> "Photo not attached"
//   2. photo_path set and the file exists -> a compact "See Photo" link that
//      expands into a SMALL preview box (collapsed by default so it doesn't
//      dominate the entry card). The preview uses resizeMode="contain" so
//      the ENTIRE photo is always visible, uncropped — the GPS/time stamp
//      burned into the bottom-left corner is never clipped off. Tapping the
//      preview opens a full-screen, pinch-to-zoom viewer.
//   3. photo_path set but the file is missing (user deleted it from their
//      Gallery) -> "Photo not available"
// No re-link, no gallery import, no upload — this is display-only.
export default function EntryPhotoState({ photoPath }) {
  const [checking, setChecking] = useState(!!photoPath);
  const [exists, setExists] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [zoomVisible, setZoomVisible] = useState(false);

  useEffect(() => {
    let active = true;
    setExpanded(false); // collapse again if the photo path itself changes (e.g. after Replace)
    setZoomVisible(false);
    if (!photoPath) {
      setChecking(false);
      setExists(false);
      return;
    }
    setChecking(true);
    photoService.fileExists(photoPath).then((result) => {
      if (active) {
        setExists(result);
        setChecking(false);
      }
    });
    return () => {
      active = false;
    };
  }, [photoPath]);

  if (!photoPath) {
    return (
      <View style={styles.row}>
        <Text style={styles.mutedText}>Photo not attached</Text>
      </View>
    );
  }

  if (checking) {
    return (
      <View style={styles.row}>
        <ActivityIndicator size="small" color={COLORS.textMuted} />
      </View>
    );
  }

  if (!exists) {
    return (
      <View style={styles.row}>
        <Text style={styles.missingText}>Photo not available</Text>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.toggleButton}
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
      >
        <Text style={styles.toggleText}>{expanded ? 'Hide Photo' : 'See Photo'}</Text>
      </TouchableOpacity>

      {expanded && (
        <TouchableOpacity
          style={styles.photoFrame}
          onPress={() => setZoomVisible(true)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="View full photo"
        >
          <Image source={{ uri: photoPath }} style={styles.photo} resizeMode="contain" />
          <View style={styles.zoomHintBadge}>
            <Text style={styles.zoomHintText}></Text>
          </View>
        </TouchableOpacity>
      )}

      <PhotoZoomViewer visible={zoomVisible} uri={photoPath} onClose={() => setZoomVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginTop: SPACING.sm },
  mutedText: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, fontStyle: 'italic' },
  missingText: { fontSize: FONT_SIZE.sm, color: COLORS.dangerText, fontStyle: 'italic' },
  toggleButton: {
    alignSelf: 'flex-start',
    minHeight: TOUCH_TARGET_MIN,
    justifyContent: 'center',
  },
  toggleText: { fontSize: FONT_SIZE.base, color: COLORS.primaryText, fontWeight: '700' },
  // Smaller than the old full-width box, and uses "contain" so the whole
  // photo (including the corner stamp) is always visible, letterboxed
  // rather than cropped.
  photoFrame: {
    width: '60%',
    aspectRatio: 1,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.lockedBg,
    marginTop: SPACING.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  zoomHintBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  zoomHintText: { color: COLORS.white, fontSize: 10, fontWeight: '600' },
});
