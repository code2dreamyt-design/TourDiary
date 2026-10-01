import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { SPACING, RADIUS, FONT_SIZE, TOUCH_TARGET_MIN, CAMERA_CLEARANCE } from '../../constants/dimensions';
import { LIMIT_PERCENT, TREE_COLORS } from '../../constants/tdData';
import { useTDDraft } from '../../context/TDDraftContext';
import { validateSizes } from '../../utils/tdValidation';
import { formatHundredths, formatMilli, summarize } from '../../utils/tdCalc';
import { groupTreesBySpecies } from '../../utils/tdFormat';
import { PrimaryButton, SecondaryButton, TreePills, tdShared } from '../../components/td/TDParts';

// Step 2 of 3: L x W x T x Qty rows per species with live volumes.
// The live totals bar is pinned at the TOP (never under the camera button);
// the Back / View result buttons sit at the end of the scroll content, which
// has camera-button clearance below it.
export default function TDSizesScreen({ navigation }) {
  const { draft, setSizeField, addSize, removeSize } = useTDDraft();
  const [showErrors, setShowErrors] = useState(false);

  const check = useMemo(() => validateSizes(draft.sizes, draft.trees), [draft.sizes, draft.trees]);
  const totals = useMemo(() => summarize(draft.trees, check.complete), [draft.trees, check.complete]);
  const groups = useMemo(() => groupTreesBySpecies(draft.trees), [draft.trees]);
  const calcByKey = useMemo(() => {
    const m = {};
    for (const r of check.rows) m[r.key] = r.calc;
    return m;
  }, [check.rows]);

  const speciesColor = (species) => {
    const idx = draft.trees.findIndex((t) => t.species === species);
    return TREE_COLORS[(idx < 0 ? 0 : idx) % TREE_COLORS.length];
  };

  function onViewResult() {
    setShowErrors(true);
    if (!check.valid) return;
    navigation.navigate('TDResult');
  }

  // "Required" is only nagged about after the user has tried to continue;
  // a genuinely wrong value (e.g. 4 decimals) is flagged straight away.
  const fieldError = (calc, field) => {
    const e = calc && calc.errors && calc.errors[field];
    if (!e) return null;
    if (e === 'Required' && !showErrors) return null;
    return e;
  };

  const within = totals.withinLimit;

  return (
    <View style={tdShared.screen}>
      <View style={styles.topBar}>
        <View style={styles.topRow}>
          <Text style={styles.topName} numberOfLines={1}>
            {draft.applicantName || 'N/A'}
          </Text>
          {draft.markingNo ? <Text style={styles.topMarking}>M.No. {draft.markingNo}</Text> : null}
        </View>
        <TreePills trees={draft.trees} />
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Converted</Text>
            <Text style={styles.statValue}>{formatMilli(totals.convertedMilli)} m³</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Standing</Text>
            <Text style={styles.statValue}>{formatMilli(totals.standingMilli)} m³</Text>
          </View>
          <View style={[styles.statBox, !within && styles.statBoxOver]}>
            <Text style={styles.statLabel}>Conversion</Text>
            <Text style={[styles.statValue, !within && styles.statValueOver]}>
              {formatHundredths(totals.conversionHundredths)}%
            </Text>
          </View>
        </View>
        {!within && (
          <Text style={styles.overText}>Above the {LIMIT_PERCENT}% conversion limit</Text>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Text style={styles.stepText}>Step 2 of 3 · Sizes (metres)</Text>

        {showErrors && !check.valid && check.message ? (
          <View style={[tdShared.banner, tdShared.bannerError, { marginTop: SPACING.sm }]}>
            <Text style={tdShared.bannerErrorText}>{check.message}</Text>
          </View>
        ) : null}

        {groups.map(({ species, count }) => {
          const color = speciesColor(species);
          const rows = draft.sizes.filter((s) => s.species === species);
          return (
            <View key={species} style={styles.speciesBlock}>
              <View style={tdShared.row}>
                <View style={[styles.dot, { backgroundColor: color.dot }]} />
                <Text style={styles.speciesName}>{species}</Text>
                <Text style={styles.speciesCount}>
                  {count} {count > 1 ? 'trees' : 'tree'}
                </Text>
              </View>

              {rows.map((row, idx) => {
                const calc = calcByKey[row.key];
                const errs = ['length', 'width', 'thickness', 'qty', 'total']
                  .map((f) => fieldError(calc, f))
                  .filter(Boolean);
                return (
                  <View key={row.key} style={styles.sizeCard}>
                    <View style={styles.sizeHeader}>
                      <Text style={styles.sizeTitle}>Size {idx + 1}</Text>
                      <TouchableOpacity
                        onPress={() => removeSize(row.key)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove size ${idx + 1}`}
                      >
                        <Ionicons name="close-circle-outline" size={26} color={COLORS.textMuted} />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.inputsRow}>
                      {[
                        ['length', 'L (m)', 'decimal-pad'],
                        ['width', 'W (m)', 'decimal-pad'],
                        ['thickness', 'T (m)', 'decimal-pad'],
                        ['qty', 'Qty', 'number-pad'],
                      ].map(([field, label, kb]) => (
                        <View key={field} style={styles.inputCol}>
                          <Text style={styles.inputLabel}>{label}</Text>
                          <TextInput
                            style={[styles.sizeInput, fieldError(calc, field) && styles.sizeInputError]}
                            value={row[field]}
                            onChangeText={(v) => setSizeField(row.key, field, v)}
                            keyboardType={kb}
                            placeholder="0"
                            placeholderTextColor={COLORS.textMuted}
                            selectTextOnFocus
                            maxLength={8}
                          />
                        </View>
                      ))}
                    </View>

                    <View style={styles.volRow}>
                      <View style={styles.volBox}>
                        <Text style={styles.volLabel}>Vol/unit</Text>
                        <Text style={styles.volValue}>{calc && calc.complete ? formatMilli(calc.unitMilli) : '—'} m³</Text>
                      </View>
                      <View style={styles.volBox}>
                        <Text style={styles.volLabel}>Total vol</Text>
                        <Text style={styles.volValue}>{calc && calc.complete ? formatMilli(calc.totalMilli) : '—'} m³</Text>
                      </View>
                    </View>

                    {errs.length > 0 && <Text style={styles.rowError}>{errs.join(' · ')}</Text>}
                  </View>
                );
              })}

              <TouchableOpacity
                style={styles.addButton}
                onPress={() => addSize(species)}
                accessibilityRole="button"
                accessibilityLabel={`Add a ${species} size`}
              >
                <Text style={styles.addButtonText}>+ Add size</Text>
              </TouchableOpacity>
            </View>
          );
        })}

        <View style={styles.buttonRow}>
          <SecondaryButton title="Back" onPress={() => navigation.goBack()} style={{ flex: 1 }} />
          <PrimaryButton title="View result" onPress={onViewResult} style={{ flex: 2 }} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topName: { color: COLORS.textPrimary, fontSize: FONT_SIZE.md, fontWeight: '700', flexShrink: 1 },
  topMarking: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginLeft: SPACING.sm },
  statsRow: { flexDirection: 'row', gap: SPACING.sm },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  statBoxOver: { backgroundColor: COLORS.dangerBg },
  statLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm - 2 },
  statValue: { color: COLORS.primaryText, fontSize: FONT_SIZE.base, fontWeight: '700', marginTop: 2 },
  statValueOver: { color: COLORS.dangerText },
  overText: { color: COLORS.dangerText, fontSize: FONT_SIZE.sm, fontWeight: '600' },
  container: { padding: SPACING.lg, paddingBottom: CAMERA_CLEARANCE },
  stepText: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, fontWeight: '600' },
  speciesBlock: { marginTop: SPACING.lg },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: SPACING.sm },
  speciesName: { color: COLORS.textPrimary, fontSize: FONT_SIZE.md, fontWeight: '700' },
  speciesCount: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginLeft: SPACING.sm },
  sizeCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  sizeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sizeTitle: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, fontWeight: '600' },
  inputsRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  inputCol: { flex: 1 },
  inputLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm - 1, textAlign: 'center', marginBottom: 4 },
  sizeInput: {
    minHeight: TOUCH_TARGET_MIN,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.background,
    color: COLORS.textPrimary,
    textAlign: 'center',
    fontSize: FONT_SIZE.base,
    paddingHorizontal: 4,
  },
  sizeInputError: { borderColor: COLORS.dangerText },
  volRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  volBox: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    minHeight: 40,
  },
  volLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm - 1 },
  volValue: { color: COLORS.primaryText, fontSize: FONT_SIZE.sm, fontWeight: '700' },
  rowError: { color: COLORS.dangerText, fontSize: FONT_SIZE.sm, marginTop: SPACING.sm },
  addButton: {
    marginTop: SPACING.md,
    minHeight: TOUCH_TARGET_MIN,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: COLORS.primaryText, fontWeight: '700' },
  buttonRow: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.xl },
});
