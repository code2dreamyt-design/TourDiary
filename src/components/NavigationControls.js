import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { COLORS } from '../constants/colors';
import { SPACING, RADIUS, FONT_SIZE, TOUCH_TARGET_MIN } from '../constants/dimensions';

// Page jumper, pinned at the TOP of the diary screen (outside the vertical
// scroll area, so the floating camera button can never cover it).
// One chip per page, labelled with the serial number of the first entry on
// that page (1, 4, 7, 10 … for 3 entries per page). The row slides
// horizontally, and the selected chip is kept in view automatically.
// Paging state stays in DiaryDetailsScreen — this component only renders and
// reports taps.
export default function NavigationControls({ total, pageSize, currentPage, onSelectPage }) {
  const scrollRef = useRef(null);
  const viewportWidth = useRef(0);
  const chipLayouts = useRef({}); // page -> { x, width }

  function centerOn(page, animated) {
    const layout = chipLayouts.current[page];
    if (!layout || !scrollRef.current || !viewportWidth.current) return;
    const x = Math.max(0, layout.x - (viewportWidth.current - layout.width) / 2);
    scrollRef.current.scrollTo({ x, animated });
  }

  useEffect(() => {
    centerOn(currentPage, true);
  }, [currentPage]);

  if (total === 0) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pages = Array.from({ length: totalPages }, (_, i) => i);

  return (
    <View style={styles.bar}>
      <Text style={styles.label}>Entry</Text>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.scroller}
        contentContainerStyle={styles.chips}
        onLayout={(e) => {
          viewportWidth.current = e.nativeEvent.layout.width;
          centerOn(currentPage, false);
        }}
      >
        {pages.map((p) => {
          const active = p === currentPage;
          const firstEntry = p * pageSize + 1;
          return (
            <TouchableOpacity
              key={p}
              style={[styles.chip, active && styles.chipActive]}
              onLayout={(e) => {
                chipLayouts.current[p] = { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width };
                if (active) centerOn(p, false);
              }}
              onPress={() => onSelectPage(p)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Entries starting at ${firstEntry}`}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{firstEntry}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingLeft: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  label: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, fontWeight: '700', marginRight: SPACING.sm },
  scroller: { flex: 1, flexGrow: 1 },
  chips: { alignItems: 'center', paddingRight: SPACING.lg, gap: SPACING.sm },
  chip: {
    minWidth: TOUCH_TARGET_MIN,
    minHeight: 44,
    paddingHorizontal: SPACING.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
  },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { color: COLORS.primaryText, fontWeight: '700', fontSize: FONT_SIZE.base },
  chipTextActive: { color: COLORS.white },
});
