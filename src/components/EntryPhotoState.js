import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator } from 'react-native';
import * as photoService from '../services/photoService';
import { COLORS } from '../constants/colors';
import { SPACING, RADIUS, FONT_SIZE } from '../constants/dimensions';

// Shows one of exactly three states for an entry's attached photo:
//   1. No photo_path at all -> "Photo not attached"
//   2. photo_path set and the file exists -> the photo
//   3. photo_path set but the file is missing (user deleted it outside the
//      app) -> "Photo not available"
// No re-link, no gallery import, no upload — this is display-only.
export default function EntryPhotoState({ photoPath }) {
  const [checking, setChecking] = useState(!!photoPath);
  const [exists, setExists] = useState(false);

  useEffect(() => {
    let active = true;
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
      <Image source={{ uri: photoPath }} style={styles.photo} resizeMode="cover" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginTop: SPACING.sm },
  mutedText: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, fontStyle: 'italic' },
  missingText: { fontSize: FONT_SIZE.sm, color: COLORS.danger, fontStyle: 'italic' },
  photo: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.lockedBg,
  },
});
