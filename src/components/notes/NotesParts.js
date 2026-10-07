import React from 'react';
import { View, Text, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/colors';
import { SPACING, RADIUS, FONT_SIZE, TOUCH_TARGET_MIN } from '../../constants/dimensions';

// Small building blocks for the Notes screens. The text fields, chips and
// buttons come from the TD calculator's shared parts so Notes looks like the
// rest of the app; only what Notes needs on top lives here.

/**
 * Three-way switcher at the top of the Notebook screen. Each tab stacks its
 * icon (with the count badge beside it) above its label, so nothing is squeezed
 * into one row and nothing touches the border on narrow phones.
 */
export function SegmentTabs({ tabs, value, onChange, counts }) {
  return (
    <View style={styles.segment}>
      {tabs.map((t) => {
        const active = t.value === value;
        const count = counts ? counts[t.value] : 0;
        return (
          <TouchableOpacity
            key={t.value}
            style={[styles.segBtn, active && styles.segBtnActive]}
            onPress={() => onChange(t.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <View style={styles.segTop}>
              <Ionicons name={t.icon} size={22} color={active ? COLORS.white : COLORS.textSecondary} />
              {count > 0 && (
                <View style={[styles.badge, active && styles.badgeActive]}>
                  <Text style={[styles.badgeText, active && styles.badgeTextActive]}>{count > 99 ? '99+' : count}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.segText, active && styles.segTextActive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
              {t.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/**
 * Bottom action bar for the Notes forms (Save / Delete). The app's bottom tab
 * bar is hidden on these screens, so the bar keeps clear of the phone's
 * gesture / navigation bar itself.
 */
export function NotesFooter({ children }) {
  const insets = useSafeAreaInsets();
  return <View style={[notesStyles.footer, { paddingBottom: Math.max(insets.bottom, SPACING.lg) }]}>{children}</View>;
}

/** A pressable that looks like an input (date / time / location buttons). */
export function FieldButton({ label, value, placeholder, icon, onPress, disabled, error, style }) {
  return (
    <View style={[{ marginTop: SPACING.sm }, style]}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TouchableOpacity
        style={[styles.fieldBtn, error && { borderColor: COLORS.dangerText }, disabled && { opacity: 0.6 }]}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
      >
        {icon ? <Ionicons name={icon} size={20} color={COLORS.primaryText} style={{ marginRight: SPACING.sm }} /> : null}
        <Text style={[styles.fieldBtnText, !value && { color: COLORS.textMuted }]} numberOfLines={1}>
          {value || placeholder}
        </Text>
      </TouchableOpacity>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

/** Multi-select chips. disabledValues are shown greyed and cannot be toggled on. */
export function MultiChips({ options, values, onToggle, disabledValues = [], disabled }) {
  return (
    <View style={styles.chipRow}>
      {options.map((o) => {
        const active = values.includes(o.value);
        const off = disabled || (!active && disabledValues.includes(o.value));
        return (
          <TouchableOpacity
            key={String(o.value)}
            style={[styles.chip, active && styles.chipActive, off && styles.chipOff]}
            onPress={() => onToggle(o.value)}
            disabled={off}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled: off }}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function SwitchRow({ label, hint, value, onValueChange, disabled }) {
  return (
    <View style={styles.switchRow}>
      <View style={{ flex: 1, paddingRight: SPACING.md }}>
        <Text style={styles.switchLabel}>{label}</Text>
        {hint ? <Text style={styles.switchHint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: COLORS.lockedFill, true: COLORS.primary }}
        thumbColor={COLORS.white}
      />
    </View>
  );
}

export function EmptyState({ icon, title, text }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={30} color={COLORS.primaryText} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

/** "View only" strip + Subscribe button, shown on Notes screens when the subscription is not active. */
export function LockedBanner({ message, onSubscribe }) {
  return (
    <View style={styles.locked}>
      <Ionicons name="lock-closed" size={18} color={COLORS.locked} />
      <Text style={styles.lockedText}>{message || 'Subscription inactive — view only.'}</Text>
      {onSubscribe ? (
        <TouchableOpacity onPress={onSubscribe} style={styles.lockedBtn} accessibilityRole="button">
          <Text style={styles.lockedBtnText}>Subscribe</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** Soft notice card (e.g. "Notifications are off"). tone: 'warn' | 'info' */
export function NoticeCard({ tone = 'info', icon, title, text, actionLabel, onAction }) {
  const warn = tone === 'warn';
  return (
    <View style={[styles.notice, warn && styles.noticeWarn]}>
      <Ionicons name={icon || (warn ? 'alert-circle' : 'information-circle-outline')} size={22} color={warn ? COLORS.accent : COLORS.primaryText} />
      <View style={{ flex: 1, marginLeft: SPACING.md }}>
        {title ? <Text style={styles.noticeTitle}>{title}</Text> : null}
        <Text style={styles.noticeText}>{text}</Text>
        {actionLabel ? (
          <TouchableOpacity onPress={onAction} style={styles.noticeBtn} accessibilityRole="button">
            <Text style={styles.noticeBtnText}>{actionLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

export const notesStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background, padding: SPACING.lg },
  form: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  footer: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  titleInput: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    paddingVertical: SPACING.md,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  bodyInput: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.md,
    lineHeight: 24,
    minHeight: 180,
    textAlignVertical: 'top',
    paddingVertical: SPACING.md,
    paddingHorizontal: 0,
  },
  dangerButton: {
    minHeight: TOUCH_TARGET_MIN,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  dangerButtonText: { color: COLORS.dangerText, fontWeight: '700', fontSize: FONT_SIZE.base },
  hint: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginTop: SPACING.sm, lineHeight: 18 },
});

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', gap: SPACING.sm, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  segBtn: { flex: 1, minHeight: 64, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.sm },
  segBtnActive: { backgroundColor: COLORS.primary },
  segTop: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 24 },
  segText: { color: COLORS.textSecondary, fontWeight: '700', fontSize: FONT_SIZE.sm, textAlign: 'center' },
  segTextActive: { color: COLORS.white },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  badgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  badgeText: { color: COLORS.primaryText, fontWeight: '700', fontSize: 12 },
  badgeTextActive: { color: COLORS.white },
  fieldLabel: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, fontWeight: '600', marginBottom: SPACING.xs },
  fieldBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOUCH_TARGET_MIN,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.md,
  },
  fieldBtnText: { flex: 1, color: COLORS.textPrimary, fontSize: FONT_SIZE.base },
  errorText: { color: COLORS.dangerText, fontSize: FONT_SIZE.sm, marginTop: SPACING.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: {
    minHeight: 44,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipOff: { opacity: 0.35 },
  chipText: { color: COLORS.textSecondary, fontWeight: '700', fontSize: FONT_SIZE.sm + 1 },
  chipTextActive: { color: COLORS.white },
  switchRow: { flexDirection: 'row', alignItems: 'center', minHeight: TOUCH_TARGET_MIN, paddingVertical: SPACING.sm },
  switchLabel: { color: COLORS.textPrimary, fontSize: FONT_SIZE.base, fontWeight: '600' },
  switchHint: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginTop: 2, lineHeight: 18 },
  empty: { alignItems: 'center', paddingVertical: SPACING.xxl, paddingHorizontal: SPACING.lg },
  emptyIcon: { width: 68, height: 68, borderRadius: 34, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md },
  emptyTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.md, fontWeight: '700', textAlign: 'center' },
  emptyText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.base, textAlign: 'center', marginTop: SPACING.xs, lineHeight: 21 },
  locked: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.lockedBg, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md },
  lockedText: { flex: 1, color: COLORS.locked, fontWeight: '700', fontSize: FONT_SIZE.sm },
  lockedBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.md, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  lockedBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONT_SIZE.sm },
  notice: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, marginTop: SPACING.md },
  noticeWarn: { borderColor: COLORS.accent, backgroundColor: '#2B2616' },
  noticeTitle: { color: COLORS.textPrimary, fontWeight: '700', fontSize: FONT_SIZE.base, marginBottom: 2 },
  noticeText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm + 1, lineHeight: 19 },
  noticeBtn: { alignSelf: 'flex-start', marginTop: SPACING.sm, backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.md, minHeight: 40, justifyContent: 'center' },
  noticeBtnText: { color: COLORS.primaryText, fontWeight: '700' },
});
