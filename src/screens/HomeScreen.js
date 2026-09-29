import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, TextInput, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as diaryService from '../services/diaryService';
import ProgressBar from '../components/ProgressBar';
import EntryPhotoState from '../components/EntryPhotoState';
import { validateEntry } from '../utils/validation';
import { COLORS } from '../constants/colors';
import { SPACING, RADIUS, FONT_SIZE, TOUCH_TARGET_MIN } from '../constants/dimensions';
import { getMonthName, getCurrentMonthYear, formatDisplayDate } from '../utils/dateUtils';

export default function HomeScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [diary, setDiary] = useState(null);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [todayEntry, setTodayEntry] = useState(null);
  const [defaultFromLocation, setDefaultFromLocation] = useState(''); // read fresh from the profile every load — never stale
  const [editing, setEditing] = useState(false); // false = read-only "completed" view; true = the fill/edit form

  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  function resetFormFrom(entry, defaultFrom) {
    setFromLocation(diaryService.resolveFromLocation(entry, defaultFrom));
    setToLocation((entry && entry.to_location) || '');
    setRemarks((entry && entry.remarks) || '');
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { diary: d, entry, defaultFromLocation: currentDefault } = await diaryService.getTodayEntryContext();
      const p = await diaryService.getDiaryProgress(d.id);
      setDiary(d);
      setProgress(p);
      setTodayEntry(entry);
      setDefaultFromLocation(currentDefault);
      resetFormFrom(entry, currentDefault);
      // A freshly-empty day opens straight into the fill form (no extra tap
      // needed); an already-completed day opens as a read-only summary with
      // an Edit button, rather than showing raw inputs by default.
      setEditing(!entry || entry.status !== 'COMPLETED');
    } catch (e) {
      if (e.code === 'WRITE_LOCKED') {
        setError(e.message);
      } else {
        setError('Unable to load your current diary. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function handleStartEdit() {
    resetFormFrom(todayEntry, defaultFromLocation);
    setSaveError(null);
    setEditing(true);
  }

  function handleCancelEdit() {
    resetFormFrom(todayEntry, defaultFromLocation);
    setSaveError(null);
    setEditing(false);
  }

  async function handleSaveToday() {
    if (!todayEntry) return;
    const validation = validateEntry({ fromLocation, toLocation, remarks });
    if (!validation.valid) {
      setSaveError(validation.message);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await diaryService.saveEntry(todayEntry.id, { fromLocation, toLocation, remarks });
      setTodayEntry(updated);
      const p = await diaryService.getDiaryProgress(diary.id);
      setProgress(p);
      setEditing(false); // snap back to the completed summary view on success
    } catch (err) {
      setSaveError(err.message || 'Unable to save today\u2019s entry. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const { month, year } = getCurrentMonthYear();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primaryText} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.monthTitle}>
          {getMonthName(month)} {year}
        </Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : <ProgressBar completed={progress.completed} total={progress.total} />}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => diary && navigation.navigate('DiaryDetails', { diaryId: diary.id })}
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonText}>Continue Current Diary</Text>
        </TouchableOpacity>
      </View>

      {todayEntry && !editing && (
        <View style={[styles.card, styles.cardCompleted]}>
          <View style={styles.todayHeaderRow}>
            <Text style={styles.todayTitle}>Today {'\u2014'} {formatDisplayDate(todayEntry.date)}</Text>
            <View style={styles.badgeCompleted}>
              <Text style={styles.badgeCompletedText}>{'\u2713'} Completed</Text>
            </View>
          </View>

          <Text style={styles.fieldLabel}>From</Text>
          <Text style={styles.fieldValue}>{todayEntry.from_location}</Text>
          <Text style={styles.fieldLabel}>To</Text>
          <Text style={styles.fieldValue}>{todayEntry.to_location}</Text>
          <Text style={styles.fieldLabel}>Remarks</Text>
          <Text style={styles.fieldValue}>{todayEntry.remarks}</Text>
          <Text style={styles.fieldLabel}>Photo</Text>
          <EntryPhotoState photoPath={todayEntry.photo_path} />

          <TouchableOpacity style={styles.primaryButton} onPress={handleStartEdit} accessibilityRole="button">
            <Text style={styles.primaryButtonText}>Edit Entry</Text>
          </TouchableOpacity>
        </View>
      )}

      {todayEntry && editing && (
        <View style={styles.card}>
          <Text style={styles.todayTitle}>Today {'\u2014'} {formatDisplayDate(todayEntry.date)}</Text>

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

          <Text style={styles.fieldLabel}>Remarks</Text>
          <TextInput
            style={[styles.input, styles.remarksInput]}
            value={remarks}
            onChangeText={setRemarks}
            placeholder="Remarks"
            placeholderTextColor={COLORS.textMuted}
            multiline
          />

          <Text style={styles.fieldLabel}>Photo</Text>
          <EntryPhotoState photoPath={todayEntry.photo_path} />

          {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}

          <TouchableOpacity
            style={[styles.primaryButton, saving && styles.primaryButtonDisabled]}
            onPress={handleSaveToday}
            disabled={saving}
            accessibilityRole="button"
          >
            {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryButtonText}>{"Save Today's Entry"}</Text>}
          </TouchableOpacity>

          {todayEntry.status === 'COMPLETED' && (
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancelEdit} disabled={saving} accessibilityRole="button">
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <Text style={styles.credit}>Developed by Vikas Justa</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: SPACING.lg, backgroundColor: COLORS.background, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  monthTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.textPrimary },
  cardCompleted: { borderColor: COLORS.success, borderWidth: 1.5 },
  todayHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  badgeCompleted: { backgroundColor: COLORS.successBg, paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.sm },
  badgeCompletedText: { color: COLORS.success, fontWeight: '700', fontSize: FONT_SIZE.sm },
  todayTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  fieldValue: { fontSize: FONT_SIZE.base, color: COLORS.textPrimary, marginTop: 2 },
  errorText: { color: COLORS.dangerText, marginTop: SPACING.sm },
  fieldLabel: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: SPACING.md, fontWeight: '600' },
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
  remarksInput: { minHeight: 80, textAlignVertical: 'top' },
  primaryButton: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    minHeight: TOUCH_TARGET_MIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: COLORS.white, fontWeight: '700', fontSize: FONT_SIZE.md },
  cancelButton: {
    marginTop: SPACING.sm,
    minHeight: TOUCH_TARGET_MIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: FONT_SIZE.base },
  credit: {
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.sm,
    marginTop: SPACING.lg,
  },
});
