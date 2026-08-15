import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as diaryService from '../services/diaryService';
import * as profileService from '../services/profileService';
import { exportDiaryToWord } from '../services/exportService';
import DiaryEntryCard from '../components/DiaryEntryCard';
import NavigationControls from '../components/NavigationControls';
import ProgressBar from '../components/ProgressBar';
import { COLORS } from '../constants/colors';
import { SPACING, RADIUS, FONT_SIZE, TOUCH_TARGET_MIN } from '../constants/dimensions';
import { getMonthName } from '../utils/dateUtils';
import { validateEntry } from '../utils/validation';

const PAGE_SIZE = 3;

export default function DiaryDetailsScreen({ route, navigation }) {
  const { diaryId } = route.params;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [diary, setDiary] = useState(null);
  const [entries, setEntries] = useState([]);
  const [defaultFromLocation, setDefaultFromLocation] = useState('');
  const [page, setPage] = useState(0);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [draft, setDraft] = useState({ fromLocation: '', toLocation: '', remarks: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [d, e, profile] = await Promise.all([
        diaryService.getDiaryById(diaryId),
        diaryService.getDiaryEntries(diaryId),
        profileService.getProfile(),
      ]);
      setDiary(d);
      setEntries(e);
      setDefaultFromLocation((profile && profile.default_from_location) || '');
    } catch (err) {
      setLoadError('Unable to load this diary. Please go back and try again.');
    } finally {
      setLoading(false);
    }
  }, [diaryId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageEntries = entries.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const startIndex = entries.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const endIndex = Math.min(safePage * PAGE_SIZE + PAGE_SIZE, entries.length);

  const progress = useMemo(() => {
    const completed = entries.filter((e) => e.status === 'COMPLETED').length;
    return { completed, total: entries.length };
  }, [entries]);

  const isEntryEditable = useCallback(
    (entry) => (diary ? diaryService.isDateEditable(entry.date, diary.month, diary.year) : false),
    [diary]
  );

  function startEdit(entry) {
    setEditingEntryId(entry.id);
    setSaveError(null);
    setDraft({
      fromLocation: entry.from_location || defaultFromLocation || '',
      toLocation: entry.to_location || '',
      remarks: entry.remarks || '',
    });
  }

  function cancelEdit() {
    setEditingEntryId(null);
    setSaveError(null);
  }

  async function handleSave(entry) {
    const validation = validateEntry(draft);
    if (!validation.valid) {
      setSaveError(validation.message);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await diaryService.saveEntry(entry.id, draft);
      setEditingEntryId(null);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2200);
      await load();
    } catch (err) {
      if (err.code === 'DATE_LOCKED') {
        setSaveError('This date is locked and cannot be edited.');
      } else {
        setSaveError('Unable to save this entry. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDownload() {
    if (!diary) return;
    setExporting(true);
    try {
      const profile = await profileService.getProfile();
      await exportDiaryToWord({ month: diary.month, year: diary.year, entries, profile });
    } catch (err) {
      if (err.code === 'SHARING_UNAVAILABLE') {
        Alert.alert('File Saved', 'Sharing is not available on this device, but the Word file was saved to app storage.');
      } else {
        Alert.alert('Export Failed', err.message || 'Unable to generate the Word document. Please try again.');
      }
    } finally {
      setExporting(false);
    }
  }

  function confirmDeleteDiary() {
    if (!diary) return;
    Alert.alert(
      'Delete Diary?',
      `This will permanently delete the ${getMonthName(diary.month)} ${diary.year} diary and all ${entries.length} entries in it. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await diaryService.deleteDiary(diary.id);
              navigation.goBack();
            } catch (err) {
              Alert.alert('Delete Failed', 'Unable to delete this diary. Please try again.');
            }
          },
        },
      ]
    );
  }

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={confirmDeleteDiary} accessibilityRole="button" style={styles.headerDeleteButton}>
          <Text style={styles.headerDeleteText}>Delete</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, diary, entries]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (loadError || !diary) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{loadError || 'Diary not found.'}</Text>
      </View>
    );
  }

  const isComplete = progress.total > 0 && progress.completed === progress.total;
  const remaining = progress.total - progress.completed;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>
        {getMonthName(diary.month)} {diary.year}
      </Text>
      <ProgressBar completed={progress.completed} total={progress.total} />

      {savedFlash && (
        <View style={styles.flashBanner}>
          <Text style={styles.flashText}>Entry saved successfully</Text>
        </View>
      )}

      <View style={styles.exportBox}>
        {isComplete ? (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleDownload}
            disabled={exporting}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>{exporting ? 'Preparing…' : 'Download Word'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.incompleteBox}>
            <Text style={styles.incompleteText}>
              Diary incomplete — {remaining} {remaining === 1 ? 'entry is' : 'entries are'} still empty
            </Text>
          </View>
        )}
      </View>

      {pageEntries.map((entry) => {
        const editable = isEntryEditable(entry);
        const isEditingThis = editingEntryId === entry.id;

        if (isEditingThis) {
          return (
            <EditEntryForm
              key={entry.id}
              entry={entry}
              draft={draft}
              setDraft={setDraft}
              onSave={() => handleSave(entry)}
              onCancel={cancelEdit}
              saving={saving}
              error={saveError}
            />
          );
        }

        return (
          <DiaryEntryCard
            key={entry.id}
            entry={entry}
            editable={editable}
            onPressEdit={() => startEdit(entry)}
            onPressFill={() => startEdit(entry)}
          />
        );
      })}

      <NavigationControls
        startIndex={startIndex}
        endIndex={endIndex}
        total={entries.length}
        hasPrevious={safePage > 0}
        hasNext={safePage < totalPages - 1}
        onPrevious={() => setPage(safePage - 1)}
        onNext={() => setPage(safePage + 1)}
      />
    </ScrollView>
  );
}

function EditEntryForm({ entry, draft, setDraft, onSave, onCancel, saving, error }) {
  return (
    <View style={styles.editCard}>
      <Text style={styles.editTitle}>Entry #{entry.serial_number}</Text>

      <Text style={styles.fieldLabel}>From</Text>
      <TextInput
        style={styles.input}
        value={draft.fromLocation}
        onChangeText={(t) => setDraft((d) => ({ ...d, fromLocation: t }))}
        placeholder="Enter compartment / sub-compartment"
        placeholderTextColor={COLORS.textMuted}
      />

      <Text style={styles.fieldLabel}>To</Text>
      <TextInput
        style={styles.input}
        value={draft.toLocation}
        onChangeText={(t) => setDraft((d) => ({ ...d, toLocation: t }))}
        placeholder="Enter compartment / sub-compartment"
        placeholderTextColor={COLORS.textMuted}
      />

      <Text style={styles.fieldLabel}>Remarks</Text>
      <TextInput
        style={[styles.input, styles.inputMultiline]}
        value={draft.remarks}
        onChangeText={(t) => setDraft((d) => ({ ...d, remarks: t }))}
        placeholder="Purpose of visit, work performed, observations"
        placeholderTextColor={COLORS.textMuted}
        multiline
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.editButtonRow}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel} disabled={saving} accessibilityRole="button">
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.doneButton} onPress={onSave} disabled={saving} accessibilityRole="button">
          <Text style={styles.doneButtonText}>{saving ? 'Saving…' : 'Done'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: SPACING.lg, backgroundColor: COLORS.background, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  title: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  errorText: { color: COLORS.danger, marginTop: SPACING.sm, fontSize: FONT_SIZE.base },
  flashBanner: { backgroundColor: COLORS.successBg, borderRadius: RADIUS.md, padding: SPACING.md, marginVertical: SPACING.sm },
  flashText: { color: COLORS.success, fontWeight: '700', textAlign: 'center' },
  exportBox: { marginVertical: SPACING.md },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    minHeight: TOUCH_TARGET_MIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: COLORS.white, fontWeight: '700', fontSize: FONT_SIZE.base },
  incompleteBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  incompleteText: { color: COLORS.textSecondary, fontWeight: '600', textAlign: 'center' },
  editCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  editTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  fieldLabel: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: SPACING.sm, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    fontSize: FONT_SIZE.base,
    color: COLORS.textPrimary,
    marginTop: SPACING.xs,
    backgroundColor: COLORS.background,
    minHeight: TOUCH_TARGET_MIN,
  },
  inputMultiline: { minHeight: 90, textAlignVertical: 'top' },
  editButtonRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: SPACING.lg, gap: SPACING.md },
  cancelButton: {
    minHeight: TOUCH_TARGET_MIN,
    paddingHorizontal: SPACING.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelButtonText: { color: COLORS.textSecondary, fontWeight: '700' },
  doneButton: {
    minHeight: TOUCH_TARGET_MIN,
    paddingHorizontal: SPACING.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  doneButtonText: { color: COLORS.white, fontWeight: '700' },
  headerDeleteButton: { paddingHorizontal: SPACING.md, minHeight: TOUCH_TARGET_MIN, justifyContent: 'center' },
  headerDeleteText: { color: COLORS.white, fontWeight: '700', fontSize: FONT_SIZE.base },
});
