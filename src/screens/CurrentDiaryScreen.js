import React, { useCallback, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as diaryService from '../services/diaryService';
import DiaryDetailsScreen from './DiaryDetailsScreen';
import { COLORS } from '../constants/colors';
import { SPACING, FONT_SIZE } from '../constants/dimensions';

// Thin wrapper: resolves (or auto-creates) the current month's diary, then
// renders the same detail/edit/pagination/export UI used for any diary —
// so current-month behavior and historical-month behavior never drift apart.
export default function CurrentDiaryScreen({ navigation }) {
  const [diaryId, setDiaryId] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        setError(null);
        try {
          const diary = await diaryService.getOrCreateCurrentMonthDiary();
          if (active) setDiaryId(diary.id);
        } catch (e) {
          if (active) setError('Unable to open your current diary. Please try again.');
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  if (loading || (!diaryId && !error)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primaryText} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return <DiaryDetailsScreen navigation={navigation} route={{ params: { diaryId } }} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background, padding: SPACING.lg },
  errorText: { color: COLORS.dangerText, fontSize: FONT_SIZE.base, textAlign: 'center' },
});
