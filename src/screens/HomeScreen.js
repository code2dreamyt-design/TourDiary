import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as diaryService from '../services/diaryService';
import ProgressBar from '../components/ProgressBar';
import { COLORS } from '../constants/colors';
import { SPACING, RADIUS, FONT_SIZE, TOUCH_TARGET_MIN } from '../constants/dimensions';
import { getMonthName, getCurrentMonthYear } from '../utils/dateUtils';

export default function HomeScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const diary = await diaryService.getOrCreateCurrentMonthDiary();
      const p = await diaryService.getDiaryProgress(diary.id);
      setProgress(p);
    } catch (e) {
      setError('Unable to load your current diary. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const { month, year } = getCurrentMonthYear();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
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
          onPress={() => navigation.navigate('CurrentDiary')}
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonText}>Continue Current Diary</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('CreateDiary')} accessibilityRole="button">
        <Text style={styles.secondaryButtonText}>Create Full Diary</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('MyDiaries')} accessibilityRole="button">
        <Text style={styles.secondaryButtonText}>My Diaries</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => navigation.navigate('ProfileSetup', { mode: 'edit' })}
        accessibilityRole="button"
      >
        <Text style={styles.secondaryButtonText}>My Profile</Text>
      </TouchableOpacity>

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
  errorText: { color: COLORS.danger, marginTop: SPACING.sm },
  primaryButton: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    minHeight: TOUCH_TARGET_MIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: COLORS.white, fontWeight: '700', fontSize: FONT_SIZE.md },
  secondaryButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.md,
    minHeight: TOUCH_TARGET_MIN,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  secondaryButtonText: { color: COLORS.primary, fontWeight: '700', fontSize: FONT_SIZE.base },
  credit: {
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.sm,
    marginTop: SPACING.lg,
  },
});
