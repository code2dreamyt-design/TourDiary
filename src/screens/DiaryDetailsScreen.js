import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as diaryService from '../services/diaryService';
import { exportDiaryToWord, buildDiaryProfile } from '../services/exportService';
import { presentExportError, presentExportResult } from '../utils/exportUi';
import { useAuth } from '../context/AuthContext';
import * as secureStorage from '../storage/secureStorage';
import DiaryEntryCard from '../components/DiaryEntryCard';
import NavigationControls from '../components/NavigationControls';
import ProgressBar from '../components/ProgressBar';
import { COLORS } from '../constants/colors';
import { SPACING, RADIUS, FONT_SIZE, TOUCH_TARGET_MIN } from '../constants/dimensions';
import { getMonthName } from '../utils/dateUtils';
import { validateEntry } from '../utils/validation';

const PAGE_SIZE = 3;
// Extra scroll room so the last content never sits under the floating camera button.
const CAMERA_CLEARANCE = 96;

export default function DiaryDetailsScreen({ route, navigation }) {
  const { diaryId } = route.params;
  const { user, subscriptionActive } = useAuth();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [diary, setDiary] = useState(null);
  const [entries, setEntries] = useState([]);
  const [salutation, setSalutation] = useState('Mr.');
  const [page, setPage] = useState(0);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [draft, setDraft] = useState({ fromLocation: '', toLocation: '', remarks: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [exporting, setExporting] = useState(false);
  const scrollRef = useRef(null);

  const defaultFromLocation = user?.usualTourStart || '';

  useEffect(() => {
    secureStorage.getSalutation().then((s) => s && setSalutation(s));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [d, e] = await Promise.all([diaryService.getDiaryById(diaryId), diaryService.getDiaryEntries(diaryId)]);
      setDiary(d);
      setEntries(e);
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

  function selectPage(p) {
    setPage(p);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }
  const pageEntries = entries.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const progress = useMemo(() => {
    const completed = entries.filter((e) => e.status === 'COMPLETED').length;
    return { completed, total: entries.length };
  }, [entries]);

  const isEntryEditable = useCallback(
    (entry) => subscriptionActive && (diary ? diaryService.isDateEditable(entry.date, diary.month, diary.year) : false),
    [diary, subscriptionActive]
  );

  function startEdit(entry) {
    if (!subscriptionActive) {
      Alert.alert('Subscription Required', 'An active subscription is required to create or edit diary entries.', [
        { text: 'Not Now', style: 'cancel' },
        { text: 'Subscribe', onPress: () => navigation.navigate('Subscription') },
      ]);
      return;
    }
    setEditingEntryId(entry.id);
    setSaveError(null);
    setDraft({
      fromLocation: diaryService.resolveFromLocation(entry, defaultFromLocation),
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
      } else if (err.code === 'WRITE_LOCKED') {
        setSaveError(err.message);
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
      const profile = buildDiaryProfile(user, salutation);
      const result = await exportDiaryToWord({ month: diary.month, year: diary.year, entries, profile });
      presentExportResult(result);
    } catch (err) {
      presentExportError(err, navigation);
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
              if (err.code === 'WRITE_LOCKED') {
                Alert.alert('Subscription Required', err.message);
              } else {
                Alert.alert('Delete Failed', 'Unable to delete this diary. Please try again.');
              }
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
        <ActivityIndicator size="large" color={COLORS.primaryText} />
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
    <View style={styles.screen}>
    <NavigationControls
      total={entries.length}
      pageSize={PAGE_SIZE}
      currentPage={safePage}
      onSelectPage={selectPage}
    />
    <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>
        {getMonthName(diary.month)} {diary.year}
      </Text>
      <ProgressBar completed={progress.completed} total={progress.total} />

      {savedFlash && (
        <View style={styles.flashBanner}>
          <Text style={styles.flashText}>Entry saved successfully</Text>
        </View>
      )}

      {!subscriptionActive && (
        <TouchableOpacity style={styles.lockedBanner} onPress={() => navigation.navigate('Subscription')} accessibilityRole="button">
          <Text style={styles.lockedBannerText}>Subscription inactive — entries are view-only. Tap to subscribe.</Text>
        </TouchableOpacity>
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
    </ScrollView>
    </View>
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
  screen: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  container: { padding: SPACING.lg, paddingBottom: CAMERA_CLEARANCE, backgroundColor: COLORS.background, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  title: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  errorText: { color: COLORS.dangerText, marginTop: SPACING.sm, fontSize: FONT_SIZE.base },
  flashBanner: { backgroundColor: COLORS.successBg, borderRadius: RADIUS.md, padding: SPACING.md, marginVertical: SPACING.sm },
  flashText: { color: COLORS.success, fontWeight: '700', textAlign: 'center' },
  lockedBanner: { backgroundColor: COLORS.lockedBg, borderRadius: RADIUS.md, padding: SPACING.md, marginVertical: SPACING.sm },
  lockedBannerText: { color: COLORS.locked, fontWeight: '700', textAlign: 'center' },
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
    borderColor: COLORS.primaryText,
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
