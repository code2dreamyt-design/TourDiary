import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';
import { SPACING, RADIUS, FONT_SIZE, TOUCH_TARGET_MIN } from '../../constants/dimensions';
import { TREE_COLORS } from '../../constants/tdData';

// Small building blocks shared by the TD screens, styled with the app's
// existing "Forest Night" tokens so TD looks like the rest of the app.

export function SectionLabel({ children }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export function Field({ label, error, style, inputStyle, ...inputProps }) {
  return (
    <View style={[styles.fieldWrap, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, error && styles.inputError, inputStyle]}
        placeholderTextColor={COLORS.textMuted}
        {...inputProps}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

/** Single-choice chips (used for Range, Beat, No. of trees, Species and Class). */
export function ChipSelect({ options, value, onChange, disabled }) {
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => {
        const o = typeof opt === 'object' ? opt : { value: opt, label: String(opt) };
        const active = o.value === value;
        return (
          <TouchableOpacity
            key={String(o.value)}
            style={[styles.chip, active && styles.chipActive, disabled && styles.chipDisabled]}
            onPress={() => onChange && onChange(o.value)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** One tree pill: "IA · Deodar" with its slot colour. */
export function TreePill({ tree, index }) {
  const c = TREE_COLORS[index % TREE_COLORS.length];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg, borderColor: c.border }]}>
      <View style={[styles.pillDot, { backgroundColor: c.dot }]} />
      <Text style={[styles.pillText, { color: c.text }]}>
        {tree.class} · {tree.species}
      </Text>
    </View>
  );
}

export function TreePills({ trees }) {
  return (
    <View style={styles.pillRow}>
      {trees.map((t, i) => (
        <TreePill key={`${t.species}-${t.class}-${i}`} tree={t} index={i} />
      ))}
    </View>
  );
}

export function Checkbox({ checked }) {
  return (
    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
      {checked && <Text style={styles.checkboxMark}>✓</Text>}
    </View>
  );
}

export function PrimaryButton({ title, onPress, disabled, style }) {
  return (
    <TouchableOpacity
      style={[styles.primaryButton, disabled && styles.primaryButtonDisabled, style]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
    >
      <Text style={styles.primaryButtonText}>{title}</Text>
    </TouchableOpacity>
  );
}

export function SecondaryButton({ title, onPress, disabled, style }) {
  return (
    <TouchableOpacity
      style={[styles.secondaryButton, disabled && styles.secondaryButtonDisabled, style]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
    >
      <Text style={styles.secondaryButtonText}>{title}</Text>
    </TouchableOpacity>
  );
}

export const tdShared = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background, padding: SPACING.lg },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  banner: { borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md },
  bannerLocked: { backgroundColor: COLORS.lockedBg },
  bannerLockedText: { color: COLORS.locked, fontWeight: '700', textAlign: 'center' },
  bannerError: { backgroundColor: COLORS.dangerBg },
  bannerErrorText: { color: COLORS.dangerText, fontWeight: '700', textAlign: 'center' },
  mutedText: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },
});

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.6,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  fieldWrap: { marginTop: SPACING.sm },
  fieldLabel: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, fontWeight: '600', marginBottom: SPACING.xs },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.base,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.background,
    minHeight: TOUCH_TARGET_MIN,
  },
  inputError: { borderColor: COLORS.dangerText },
  errorText: { color: COLORS.dangerText, fontSize: FONT_SIZE.sm, marginTop: SPACING.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipDisabled: { opacity: 0.5 },
  chipText: { color: COLORS.textSecondary, fontWeight: '700', fontSize: FONT_SIZE.base },
  chipTextActive: { color: COLORS.white },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
  },
  pillDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  pillText: { fontSize: FONT_SIZE.sm, fontWeight: '700' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: COLORS.primaryText,
    marginRight: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  checkboxChecked: { backgroundColor: COLORS.primary },
  checkboxMark: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    minHeight: TOUCH_TARGET_MIN,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  primaryButtonDisabled: { backgroundColor: COLORS.lockedFill },
  primaryButtonText: { color: COLORS.white, fontWeight: '700', fontSize: FONT_SIZE.base },
  secondaryButton: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
    minHeight: TOUCH_TARGET_MIN,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  secondaryButtonDisabled: { opacity: 0.5 },
  secondaryButtonText: { color: COLORS.primaryText, fontWeight: '700', fontSize: FONT_SIZE.base },
});
