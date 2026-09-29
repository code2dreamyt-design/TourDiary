import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import MonthSelector from '../components/MonthSelector';
import * as diaryService from '../services/diaryService';
import { COLORS } from '../constants/colors';
import { SPACING, RADIUS, FONT_SIZE, TOUCH_TARGET_MIN } from '../constants/dimensions';
import { getCurrentMonthYear } from '../utils/dateUtils';

export default function CreateDiaryScreen({ navigation }) {
  const { month: curMonth, year: curYear } = getCurrentMonthYear();
  const [month, setMonth] = useState(curMonth);
  const [year, setYear] = useState(curYear);
  const [creating, setCreating] = useState(false);
  const [conflict, setConflict] = useState(null);
  const [error, setError] = useState(null);

  function resetFeedback() {
    setConflict(null);
    setError(null);
  }

  async function handleCreate() {
    setCreating(true);
    resetFeedback();
    try {
      const diary = await diaryService.createDiary(month, year);
      navigation.replace('DiaryDetails', { diaryId: diary.id });
    } catch (err) {
      if (err.code === 'DIARY_EXISTS') {
        setConflict({ diaryId: err.diaryId });
      } else if (err.code === 'WRITE_LOCKED') {
        Alert.alert('Subscription Required', err.message, [
          { text: 'Not Now', style: 'cancel' },
          { text: 'Subscribe', onPress: () => navigation.navigate('Subscription') },
        ]);
      } else {
        setError('Unable to create this diary. Please try again.');
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Select the month and year for this diary</Text>
      <MonthSelector
        month={month}
        year={year}
        onChangeMonth={(m) => {
          setMonth(m);
          resetFeedback();
        }}
        onChangeYear={(y) => {
          setYear(y);
          resetFeedback();
        }}
      />

      {conflict && (
        <View style={styles.conflictBox}>
          <Text style={styles.conflictText}>Diary already exists for this month.</Text>
          <TouchableOpacity
            style={styles.openButton}
            onPress={() => navigation.replace('DiaryDetails', { diaryId: conflict.diaryId })}
            accessibilityRole="button"
          >
            <Text style={styles.openButtonText}>Open Diary</Text>
          </TouchableOpacity>
        </View>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TouchableOpacity style={styles.createButton} onPress={handleCreate} disabled={creating} accessibilityRole="button">
        <Text style={styles.createButtonText}>{creating ? 'Creating…' : 'Create'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: SPACING.lg, backgroundColor: COLORS.background },
  heading: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.textPrimary, marginBottom: SPACING.lg },
  createButton: {
    marginTop: SPACING.xl,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    minHeight: TOUCH_TARGET_MIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonText: { color: COLORS.white, fontWeight: '700', fontSize: FONT_SIZE.base },
  conflictBox: { marginTop: SPACING.lg, backgroundColor: COLORS.lockedBg, borderRadius: RADIUS.md, padding: SPACING.md },
  conflictText: { color: COLORS.textPrimary, fontWeight: '600', marginBottom: SPACING.sm },
  openButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    minHeight: TOUCH_TARGET_MIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openButtonText: { color: COLORS.white, fontWeight: '700' },
  errorText: { color: COLORS.danger, marginTop: SPACING.md },
});
