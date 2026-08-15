import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS } from '../constants/colors';
import { SPACING, RADIUS, FONT_SIZE, TOUCH_TARGET_MIN } from '../constants/dimensions';
import { formatDisplayDate } from '../utils/dateUtils';

// Status is never conveyed by color alone — each state also has an icon + label.
export default function DiaryEntryCard({ entry, editable, onPressEdit, onPressFill }) {
  const isCompleted = entry.status === 'COMPLETED';
  const isLocked = !editable;

  return (
    <View style={[styles.card, isCompleted && styles.cardCompleted, isLocked && styles.cardLocked]}>
      <View style={styles.headerRow}>
        <Text style={styles.serial}>#{entry.serial_number}</Text>
        <Text style={styles.date}>{formatDisplayDate(entry.date)}</Text>
        {isLocked ? (
          <View style={styles.badgeLocked}>
            <Text style={styles.badgeLockedText}>🔒 Locked</Text>
          </View>
        ) : isCompleted ? (
          <View style={styles.badgeCompleted}>
            <Text style={styles.badgeCompletedText}>✓ Completed</Text>
          </View>
        ) : (
          <View style={styles.badgeEmpty}>
            <Text style={styles.badgeEmptyText}>Empty</Text>
          </View>
        )}
      </View>

      {isCompleted ? (
        <View style={styles.body}>
          <Text style={styles.fieldLabel}>From</Text>
          <Text style={styles.fieldValue}>{entry.from_location}</Text>
          <Text style={styles.fieldLabel}>To</Text>
          <Text style={styles.fieldValue}>{entry.to_location}</Text>
          <Text style={styles.fieldLabel}>Remarks</Text>
          <Text style={styles.fieldValue}>{entry.remarks}</Text>
        </View>
      ) : (
        <Text style={styles.placeholderText}>
          {isLocked ? 'This date is in the future and cannot be filled in yet.' : 'No entry yet for this date.'}
        </Text>
      )}

      {!isLocked && (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={isCompleted ? onPressEdit : onPressFill}
          accessibilityRole="button"
          accessibilityLabel={isCompleted ? 'Edit entry' : 'Fill entry'}
        >
          <Text style={styles.actionButtonText}>{isCompleted ? 'Edit Entry' : 'Fill Entry'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  cardCompleted: { borderColor: COLORS.success, borderWidth: 1.5 },
  cardLocked: { backgroundColor: COLORS.lockedBg },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  serial: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, fontWeight: '600', marginRight: SPACING.sm },
  date: { fontSize: FONT_SIZE.md, color: COLORS.textPrimary, fontWeight: '700', flex: 1 },
  badgeCompleted: { backgroundColor: COLORS.successBg, paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.sm },
  badgeCompletedText: { color: COLORS.success, fontWeight: '700', fontSize: FONT_SIZE.sm },
  badgeEmpty: {
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  badgeEmptyText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: FONT_SIZE.sm },
  badgeLocked: { backgroundColor: COLORS.lockedBg, paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.sm },
  badgeLockedText: { color: COLORS.locked, fontWeight: '600', fontSize: FONT_SIZE.sm },
  body: { marginTop: SPACING.xs },
  fieldLabel: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginTop: SPACING.xs },
  fieldValue: { fontSize: FONT_SIZE.base, color: COLORS.textPrimary, marginTop: 2 },
  placeholderText: { fontSize: FONT_SIZE.base, color: COLORS.textMuted, fontStyle: 'italic', marginVertical: SPACING.sm },
  actionButton: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    minHeight: TOUCH_TARGET_MIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: { color: COLORS.white, fontWeight: '700', fontSize: FONT_SIZE.base },
});
