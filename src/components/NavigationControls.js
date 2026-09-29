import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../constants/colors';
import { SPACING, RADIUS, FONT_SIZE, TOUCH_TARGET_MIN } from '../constants/dimensions';

export default function NavigationControls({
  startIndex,
  endIndex,
  total,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
}) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, !hasPrevious && styles.buttonDisabled]}
        onPress={onPrevious}
        disabled={!hasPrevious}
        accessibilityRole="button"
        accessibilityLabel="Previous entries"
      >
        <Text style={[styles.buttonText, !hasPrevious && styles.buttonTextDisabled]}>‹ Previous</Text>
      </TouchableOpacity>

      <Text style={styles.rangeText}>
        {total === 0 ? 'No entries' : `Entries ${startIndex}–${endIndex} of ${total}`}
      </Text>

      <TouchableOpacity
        style={[styles.button, !hasNext && styles.buttonDisabled]}
        onPress={onNext}
        disabled={!hasNext}
        accessibilityRole="button"
        accessibilityLabel="Next entries"
      >
        <Text style={[styles.buttonText, !hasNext && styles.buttonTextDisabled]}>Next ›</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: SPACING.md },
  button: {
    minHeight: TOUCH_TARGET_MIN,
    paddingHorizontal: SPACING.lg,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
  },
  buttonDisabled: { backgroundColor: COLORS.background },
  buttonText: { color: COLORS.primaryText, fontWeight: '700', fontSize: FONT_SIZE.base },
  buttonTextDisabled: { color: COLORS.textMuted },
  rangeText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, fontWeight: '600' },
});
