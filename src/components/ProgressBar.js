import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/colors';
import { SPACING, RADIUS, FONT_SIZE } from '../constants/dimensions';

export default function ProgressBar({ completed, total }) {
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const isComplete = total > 0 && completed === total;

  return (
    <View style={styles.container}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percent}%` }, isComplete && styles.fillComplete]} />
      </View>
      <Text style={styles.label}>
        {total === 0
          ? 'No entries yet'
          : isComplete
          ? `${completed}/${total} — Diary Complete ✓`
          : `${completed}/${total} — ${total - completed} entries remaining`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: SPACING.sm },
  track: { height: 10, borderRadius: RADIUS.sm, backgroundColor: COLORS.border, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: RADIUS.sm },
  fillComplete: { backgroundColor: COLORS.success },
  label: { marginTop: SPACING.xs, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, fontWeight: '600' },
});
