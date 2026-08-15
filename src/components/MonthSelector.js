import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { COLORS } from '../constants/colors';
import { SPACING, RADIUS, FONT_SIZE } from '../constants/dimensions';
import { getMonthName } from '../utils/dateUtils';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function MonthSelector({ month, year, onChangeMonth, onChangeYear, yearRange }) {
  const currentYear = new Date().getFullYear();
  // Default range: a handful of past years (for historical diaries) through a couple ahead.
  const years = yearRange || Array.from({ length: 12 }, (_, i) => currentYear - 9 + i);

  return (
    <View style={styles.row}>
      <View style={styles.pickerWrap}>
        <Text style={styles.label}>Month</Text>
        <View style={styles.pickerBorder}>
          <Picker selectedValue={month} onValueChange={onChangeMonth} style={styles.picker}>
            {MONTHS.map((m) => (
              <Picker.Item key={m} label={getMonthName(m)} value={m} />
            ))}
          </Picker>
        </View>
      </View>
      <View style={styles.pickerWrap}>
        <Text style={styles.label}>Year</Text>
        <View style={styles.pickerBorder}>
          <Picker selectedValue={year} onValueChange={onChangeYear} style={styles.picker}>
            {years.map((y) => (
              <Picker.Item key={y} label={String(y)} value={y} />
            ))}
          </Picker>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: SPACING.md },
  pickerWrap: { flex: 1 },
  label: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginBottom: SPACING.xs, fontWeight: '600' },
  pickerBorder: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
  },
  picker: {
    height: Platform.OS === 'ios' ? 150 : 50,
    width: '100%',
    color: COLORS.textPrimary,
  },
});
