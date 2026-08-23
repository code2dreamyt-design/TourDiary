import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as diaryService from '../services/diaryService';
import * as photoService from '../services/photoService';
import PhotoCompositor from '../components/PhotoCompositor';
import { COLORS } from '../constants/colors';
import { SPACING, RADIUS, FONT_SIZE, TOUCH_TARGET_MIN } from '../constants/dimensions';

// Shown right after a photo is captured. Burns the GPS/time stamp AND the
// note (if any) onto the raw photo together, in a single pass, once
// Confirm is pressed — then either attaches the photo+text to today's
// diary entry, or saves it to the gallery, per the checkbox and the
// Replace/gallery choice when today's entry is already filled in.
export default function PhotoDetailsFormScreen({ navigation, route }) {
  const { rawUri, location, capturedAtIso } = route.params;

  const [loadingContext, setLoadingContext] = useState(true);
  const [todayEntry, setTodayEntry] = useState(null);
  const [addToEntry, setAddToEntry] = useState(true);
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const compositorRef = useRef(null);
  const confirmedRef = useRef(false);
  const currentUriRef = useRef(rawUri); // tracks whatever the "live" cache file is right now, for cleanup

  const loadContext = useCallback(async () => {
    setLoadingContext(true);
    try {
      const { entry, defaultFromLocation } = await diaryService.getTodayEntryContext();
      setTodayEntry(entry);
      setFromLocation(diaryService.resolveFromLocation(entry, defaultFromLocation));
    } catch (e) {
      // Non-fatal — form still works, From just won't be prefilled.
    } finally {
      setLoadingContext(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadContext();
    }, [loadContext])
  );

  // Clean up the raw/intermediate cache file if the user backs out without confirming.
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      if (!confirmedRef.current) {
        photoService.deleteFileIfExists(currentUriRef.current);
      }
    });
    return unsubscribe;
  }, [navigation]);

  async function finalizeImage() {
    // Single pass: stamp box + note (if any) burned onto the raw capture together.
    const boxLines = photoService.buildStampBox({
      ...location,
      time: new Date(capturedAtIso),
      note,
    });
    const finalUri = await photoService.compositeFinal(compositorRef, currentUriRef.current, boxLines);
    currentUriRef.current = finalUri;
    return finalUri;
  }

  async function saveAsGalleryOnly() {
    const finalUri = await finalizeImage();
    await photoService.saveToDeviceGallery(finalUri);
    confirmedRef.current = true;
    Alert.alert('Saved', 'Photo saved to your gallery.');
    navigation.goBack();
  }

  async function saveAttachedToEntry() {
    const finalUri = await finalizeImage();
    // Always the same one Gallery copy — attaching just means the entry
    // remembers its path. No separate private app-storage copy, and we
    // never delete the old gallery photo on Replace: the user has full
    // control over their Gallery, the app only ever adds to it.
    const galleryPath = await photoService.saveToDeviceGallery(finalUri);
    await diaryService.saveEntryWithPhoto(todayEntry.id, {
      fromLocation,
      toLocation,
      remarks: note,
      photoPath: galleryPath,
    });
    confirmedRef.current = true;
    Alert.alert('Saved', "Photo attached to today's diary entry.");
    navigation.goBack();
  }

  function handleRetake() {
    if (saving) return;
    // The existing beforeRemove listener (registered above) cleans up
    // currentUriRef.current since confirmedRef.current is still false —
    // same safe, idempotent cleanup path as backing out with the hardware
    // back button, just via an explicit, discoverable button.
    navigation.goBack();
  }

  async function handleConfirm() {
    if (saving) return;
    setSaving(true);
    try {
      if (!addToEntry) {
        await saveAsGalleryOnly();
        return;
      }

      if (!todayEntry) {
        Alert.alert('Unable to Save', "Could not find today's diary entry. Saving to gallery instead.");
        await saveAsGalleryOnly();
        return;
      }

      if (todayEntry.status === 'EMPTY') {
        await saveAttachedToEntry();
        return;
      }

      // Entry already COMPLETED — ask Replace vs gallery-only.
      Alert.alert(
        "Today's Entry Already Filled",
        'Replace the entry\'s From/To/Remarks with these new values, or just save this photo to your gallery instead?',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setSaving(false) },
          {
            text: 'Save to Gallery',
            onPress: async () => {
              try {
                await saveAsGalleryOnly();
              } catch (e) {
                Alert.alert('Save Failed', 'Unable to save the photo. Please try again.');
              } finally {
                setSaving(false);
              }
            },
          },
          {
            text: 'Replace',
            style: 'destructive',
            onPress: async () => {
              try {
                await saveAttachedToEntry();
              } catch (e) {
                Alert.alert('Save Failed', 'Unable to save the photo. Please try again.');
              } finally {
                setSaving(false);
              }
            },
          },
        ]
      );
      return; // Alert branches handle setSaving(false) themselves.
    } catch (err) {
      Alert.alert('Save Failed', 'Unable to save the photo. Please try again.');
    }
    setSaving(false);
  }

  if (loadingContext) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Image source={{ uri: rawUri }} style={styles.preview} resizeMode="cover" />
      <Text style={styles.previewHint}>The GPS stamp {note.trim() ? 'and your note ' : ''}will be burned onto the photo when you confirm.</Text>

      <TouchableOpacity
        style={styles.checkboxRow}
        onPress={() => setAddToEntry((v) => !v)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: addToEntry }}
      >
        <View style={[styles.checkbox, addToEntry && styles.checkboxChecked]}>
          {addToEntry && <Text style={styles.checkboxMark}>✓</Text>}
        </View>
        <Text style={styles.checkboxLabel}>Add to today's entry</Text>
      </TouchableOpacity>

      {addToEntry && (
        <>
          <Text style={styles.fieldLabel}>From</Text>
          <TextInput
            style={styles.input}
            value={fromLocation}
            onChangeText={setFromLocation}
            placeholder="From"
            placeholderTextColor={COLORS.textMuted}
          />

          <Text style={styles.fieldLabel}>To</Text>
          <TextInput
            style={styles.input}
            value={toLocation}
            onChangeText={setToLocation}
            placeholder="To"
            placeholderTextColor={COLORS.textMuted}
          />
        </>
      )}

      <Text style={styles.fieldLabel}>Note</Text>
      <Text style={styles.fieldHint}>This text gets burned into the photo itself.</Text>
      <TextInput
        style={[styles.input, styles.noteInput]}
        value={note}
        onChangeText={setNote}
        placeholder="Optional note"
        placeholderTextColor={COLORS.textMuted}
        multiline
      />

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.retakeButton, saving && styles.retakeButtonDisabled]}
          onPress={handleRetake}
          disabled={saving}
          accessibilityRole="button"
        >
          <Text style={styles.retakeButtonText}>Retake</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.confirmButton, saving && styles.confirmButtonDisabled]}
          onPress={handleConfirm}
          disabled={saving}
          accessibilityRole="button"
        >
          {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.confirmButtonText}>Confirm</Text>}
        </TouchableOpacity>
      </View>

      <PhotoCompositor ref={compositorRef} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: SPACING.lg, backgroundColor: COLORS.background, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  preview: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.lockedBg,
    marginBottom: SPACING.sm,
  },
  previewHint: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginBottom: SPACING.lg, fontStyle: 'italic' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.lg },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.primary,
    marginRight: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  checkboxChecked: { backgroundColor: COLORS.primary },
  checkboxMark: { color: COLORS.white, fontWeight: '700' },
  checkboxLabel: { fontSize: FONT_SIZE.base, color: COLORS.textPrimary, fontWeight: '600' },
  fieldLabel: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: SPACING.md, fontWeight: '600' },
  fieldHint: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginTop: SPACING.xs },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    fontSize: FONT_SIZE.base,
    color: COLORS.textPrimary,
    marginTop: SPACING.xs,
    backgroundColor: COLORS.surface,
    minHeight: TOUCH_TARGET_MIN,
  },
  noteInput: { minHeight: 80, textAlignVertical: 'top' },
  actionRow: {
    flexDirection: 'row',
    marginTop: SPACING.xl,
    marginBottom: SPACING.xl,
    gap: SPACING.md,
  },
  retakeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    minHeight: TOUCH_TARGET_MIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retakeButtonDisabled: { opacity: 0.6 },
  retakeButtonText: { color: COLORS.textSecondary, fontWeight: '700', fontSize: FONT_SIZE.base },
  confirmButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    minHeight: TOUCH_TARGET_MIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonDisabled: { opacity: 0.6 },
  confirmButtonText: { color: COLORS.white, fontWeight: '700', fontSize: FONT_SIZE.base },
});
