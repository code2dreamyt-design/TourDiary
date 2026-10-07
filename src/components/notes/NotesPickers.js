import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/colors';
import { SPACING, RADIUS, FONT_SIZE, TOUCH_TARGET_MIN } from '../../constants/dimensions';
import { pad2, startOfDay } from '../../utils/notesTime';

// ---------------------------------------------------------------------------
// Date and time pickers built from plain React Native (no extra native
// module): a bottom-sheet calendar and a scroll-wheel time picker.
// ---------------------------------------------------------------------------

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEK_HEAD = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function Sheet({ visible, title, onCancel, onConfirm, confirmLabel, children }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, SPACING.lg) }]}>
          <View style={styles.sheetHead}>
            <TouchableOpacity onPress={onCancel} style={styles.sheetBtn} accessibilityRole="button">
              <Text style={styles.sheetBtnText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.sheetTitle}>{title}</Text>
            {onConfirm ? (
              <TouchableOpacity onPress={onConfirm} style={styles.sheetBtn} accessibilityRole="button">
                <Text style={[styles.sheetBtnText, styles.sheetBtnPrimary]}>{confirmLabel || 'Done'}</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.sheetBtn} />
            )}
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

// ---- date -------------------------------------------------------------------------

/**
 * Calendar sheet. Tapping a day confirms it. `value` is a Date (its time of day
 * is kept); minDate / maxDate (Dates) grey out days outside the range.
 */
export function DatePickerSheet({ visible, value, minDate, maxDate, title = 'Pick a date', onConfirm, onCancel }) {
  const [view, setView] = useState({ y: 0, m: 0 });
  useEffect(() => {
    if (visible) {
      const base = value || new Date();
      setView({ y: base.getFullYear(), m: base.getMonth() });
    }
  }, [visible, value]);

  const today = startOfDay(new Date());
  const min = minDate ? startOfDay(minDate) : null;
  const max = maxDate ? startOfDay(maxDate) : null;
  const sel = value ? startOfDay(value) : null;

  const cells = useMemo(() => {
    const first = new Date(view.y, view.m, 1).getDay();
    const dim = new Date(view.y, view.m + 1, 0).getDate();
    const out = [];
    for (let i = 0; i < first; i++) out.push(null);
    for (let d = 1; d <= dim; d++) out.push(new Date(view.y, view.m, d));
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [view]);

  const canPrev = !min || new Date(view.y, view.m, 1) > min;
  const canNext = !max || new Date(view.y, view.m + 1, 1) <= max;
  const step = (delta) => setView((v) => {
    const d = new Date(v.y, v.m + delta, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  function pick(day) {
    const base = value || new Date();
    const out = new Date(day.getTime());
    out.setHours(base.getHours(), base.getMinutes(), 0, 0);
    onConfirm(out);
  }

  return (
    <Sheet visible={visible} title={title} onCancel={onCancel}>
      <View style={styles.monthRow}>
        <TouchableOpacity onPress={() => step(-1)} disabled={!canPrev} style={[styles.monthBtn, !canPrev && { opacity: 0.3 }]} accessibilityLabel="Previous month">
          <Ionicons name="chevron-back" size={22} color={COLORS.primaryText} />
        </TouchableOpacity>
        <Text style={styles.monthText}>
          {MONTH_NAMES[view.m]} {view.y}
        </Text>
        <TouchableOpacity onPress={() => step(1)} disabled={!canNext} style={[styles.monthBtn, !canNext && { opacity: 0.3 }]} accessibilityLabel="Next month">
          <Ionicons name="chevron-forward" size={22} color={COLORS.primaryText} />
        </TouchableOpacity>
      </View>
      <View style={styles.weekRow}>
        {WEEK_HEAD.map((w, i) => (
          <Text key={i} style={styles.weekHead}>{w}</Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((day, i) => {
          if (!day) return <View key={i} style={styles.cell} />;
          const disabled = (min && day < min) || (max && day > max);
          const isSel = sel && day.getTime() === sel.getTime();
          const isToday = day.getTime() === today.getTime();
          return (
            <TouchableOpacity
              key={i}
              style={styles.cell}
              disabled={disabled}
              onPress={() => pick(day)}
              accessibilityRole="button"
              accessibilityLabel={`${day.getDate()} ${MONTH_NAMES[view.m]}`}
              accessibilityState={{ selected: !!isSel, disabled: !!disabled }}
            >
              <View style={[styles.dayBubble, isSel && styles.dayBubbleSel, !isSel && isToday && styles.dayBubbleToday]}>
                <Text style={[styles.dayText, disabled && styles.dayTextOff, isSel && styles.dayTextSel]}>{day.getDate()}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </Sheet>
  );
}

// ---- time ---------------------------------------------------------------------------

const ITEM_H = 44;
const ROWS = 5;

function WheelColumn({ items, index, onIndex, width, label }) {
  const ref = useRef(null);
  const yRef = useRef(0);
  const momentum = useRef(false);

  // follow external changes (initial value, quick presets) without fighting the user's own scrolling
  useEffect(() => {
    const target = index * ITEM_H;
    if (Math.abs(yRef.current - target) > 1) {
      const id = setTimeout(() => {
        if (ref.current) ref.current.scrollTo({ y: target, animated: false });
        yRef.current = target;
      }, 0);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [index]);

  function settle(y) {
    yRef.current = y;
    const i = Math.max(0, Math.min(items.length - 1, Math.round(y / ITEM_H)));
    if (i !== index) onIndex(i);
  }

  return (
    <View style={{ width, height: ITEM_H * ROWS }} accessibilityLabel={label}>
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        nestedScrollEnabled
        contentContainerStyle={{ paddingVertical: ITEM_H * Math.floor(ROWS / 2) }}
        onScrollBeginDrag={() => { momentum.current = false; }}
        onMomentumScrollBegin={() => { momentum.current = true; }}
        onMomentumScrollEnd={(e) => settle(e.nativeEvent.contentOffset.y)}
        onScrollEndDrag={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          setTimeout(() => { if (!momentum.current) settle(y); }, 80);
        }}
      >
        {items.map((it, i) => (
          <TouchableOpacity
            key={i}
            activeOpacity={0.7}
            style={styles.wheelItem}
            onPress={() => {
              if (ref.current) ref.current.scrollTo({ y: i * ITEM_H, animated: true });
              yRef.current = i * ITEM_H;
              onIndex(i);
            }}
          >
            <Text style={[styles.wheelText, i === index && styles.wheelTextOn]}>{it}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 60 }, (_, i) => pad2(i));
const AMPM = ['AM', 'PM'];

/** Scroll-wheel time picker sheet. onConfirm gets the same Date with the new time. */
export function TimePickerSheet({ visible, value, title = 'Pick a time', onConfirm, onCancel }) {
  const [h, setH] = useState(0); // index into HOURS ("1".."12")
  const [m, setM] = useState(0);
  const [pm, setPm] = useState(0);

  useEffect(() => {
    if (visible) {
      const d = value || new Date();
      const h24 = d.getHours();
      const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
      setH(h12 - 1);
      setM(d.getMinutes());
      setPm(h24 >= 12 ? 1 : 0);
    }
  }, [visible, value]);

  function confirm() {
    const hour12 = h + 1; // 1..12
    const hour24 = (hour12 % 12) + (pm ? 12 : 0);
    const out = new Date((value || new Date()).getTime());
    out.setHours(hour24, m, 0, 0);
    onConfirm(out);
  }

  return (
    <Sheet visible={visible} title={title} onCancel={onCancel} onConfirm={confirm}>
      <View style={styles.wheels}>
        <WheelColumn items={HOURS} index={h} onIndex={setH} width={88} label="Hour" />
        <Text style={styles.colon}>:</Text>
        <WheelColumn items={MINUTES} index={m} onIndex={setM} width={88} label="Minute" />
        <WheelColumn items={AMPM} index={pm} onIndex={setPm} width={88} label="AM or PM" />
        <View pointerEvents="none" style={styles.wheelBand} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  sheetTitle: { color: COLORS.textPrimary, fontWeight: '700', fontSize: FONT_SIZE.md },
  sheetBtn: { minWidth: 72, minHeight: TOUCH_TARGET_MIN, justifyContent: 'center' },
  sheetBtnText: { color: COLORS.textSecondary, fontWeight: '700', fontSize: FONT_SIZE.base },
  sheetBtnPrimary: { color: COLORS.primaryText, textAlign: 'right' },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  monthBtn: { width: TOUCH_TARGET_MIN, height: TOUCH_TARGET_MIN, alignItems: 'center', justifyContent: 'center' },
  monthText: { color: COLORS.textPrimary, fontWeight: '700', fontSize: FONT_SIZE.md },
  weekRow: { flexDirection: 'row' },
  weekHead: { flex: 1, textAlign: 'center', color: COLORS.textMuted, fontWeight: '700', fontSize: FONT_SIZE.sm, paddingVertical: SPACING.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, height: 46, alignItems: 'center', justifyContent: 'center' },
  dayBubble: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  dayBubbleSel: { backgroundColor: COLORS.primary },
  dayBubbleToday: { borderWidth: 1.5, borderColor: COLORS.primaryText },
  dayText: { color: COLORS.textPrimary, fontSize: FONT_SIZE.base, fontWeight: '600' },
  dayTextOff: { color: COLORS.lockedFill },
  dayTextSel: { color: COLORS.white, fontWeight: '700' },
  wheels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: ITEM_H * ROWS, marginBottom: SPACING.sm },
  colon: { color: COLORS.textMuted, fontSize: FONT_SIZE.xl, fontWeight: '700', marginHorizontal: -SPACING.sm },
  wheelItem: { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  wheelText: { color: COLORS.textMuted, fontSize: FONT_SIZE.lg, fontWeight: '600' },
  wheelTextOn: { color: COLORS.textPrimary, fontSize: FONT_SIZE.xl, fontWeight: '700' },
  wheelBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: ITEM_H * Math.floor(ROWS / 2),
    height: ITEM_H,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.primaryText,
    borderRadius: RADIUS.sm,
    opacity: 0.6,
  },
});
