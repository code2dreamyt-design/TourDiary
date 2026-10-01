import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Alert, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';
import { SPACING, RADIUS, FONT_SIZE, CAMERA_CLEARANCE } from '../../constants/dimensions';
import { KIND_SEIZED, LIMIT_PERCENT } from '../../constants/tdData';
import { useTDDraft } from '../../context/TDDraftContext';
import * as tdService from '../../services/tdService';
import { validateSizes } from '../../utils/tdValidation';
import { dimToText, formatHundredths, formatMilli, summarize } from '../../utils/tdCalc';
import { groupTreesBySpecies } from '../../utils/tdFormat';
import { showToast } from '../../components/Toast';
import { PrimaryButton, SecondaryButton, SectionLabel, TreePills, tdShared } from '../../components/td/TDParts';
import { showLockedAlert } from './tdGuard';

// Step 3 of 3: review + Save. Save goes through tdService.saveTd(), which
// enforces the subscription gate and re-validates everything before writing.
export default function TDResultScreen({ navigation }) {
  const { draft, clear } = useTDDraft();
  const [saving, setSaving] = useState(false);

  const check = useMemo(() => validateSizes(draft.sizes, draft.trees), [draft.sizes, draft.trees]);
  const totals = useMemo(() => summarize(draft.trees, check.complete), [draft.trees, check.complete]);
  const groups = useMemo(() => groupTreesBySpecies(draft.trees), [draft.trees]);
  const withoutSizes = groups.filter((g) => !check.complete.some((s) => s.species === g.species));
  const within = totals.withinLimit;

  async function onSave() {
    if (saving) return;
    setSaving(true);
    try {
      const { unchanged } = await tdService.saveTd(draft, draft.editingId);
      showToast(unchanged ? 'No changes to save.' : draft.editingId ? 'Record updated.' : 'Record saved.');
      clear();
      navigation.popToTop();
    } catch (e) {
      if (e.code === 'WRITE_LOCKED') showLockedAlert(navigation, e.reason, e.message);
      else if (e.code === 'VALIDATION') Alert.alert('Check your entries', e.message);
      else Alert.alert('Save Failed', e.message || 'Unable to save this TD. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (!check.valid) {
    return (
      <View style={tdShared.center}>
        <Text style={{ color: COLORS.textSecondary, textAlign: 'center', marginBottom: SPACING.lg }}>
          {check.message || 'There is nothing to show yet.'}
        </Text>
        <SecondaryButton title="Back to sizes" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  const pct = formatHundredths(totals.conversionHundredths);

  return (
    <ScrollView style={tdShared.screen} contentContainerStyle={styles.container}>
      <Text style={styles.stepText}>Step 3 of 3 · Review</Text>

      <View style={[tdShared.card, { marginTop: SPACING.sm }]}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{draft.applicantName}</Text>
          {draft.kind !== KIND_SEIZED && <Text style={styles.marking}>M.No. {draft.markingNo}</Text>}
        </View>
        <View style={{ marginTop: SPACING.sm }}>
          <TreePills trees={draft.trees} />
        </View>
      </View>

      <SectionLabel>SIZES</SectionLabel>
      <View style={styles.table}>
        <View style={[styles.tr, styles.thead]}>
          <Text style={[styles.th, { flex: 0.6, textAlign: 'left' }]}>#</Text>
          <Text style={[styles.th, { flex: 2.2 }]}>L×W×T (m)</Text>
          <Text style={[styles.th, { flex: 1.1 }]}>V/unit</Text>
          <Text style={[styles.th, { flex: 0.9 }]}>Qty</Text>
          <Text style={[styles.th, { flex: 1.2 }]}>Total m³</Text>
        </View>
        {groups.map(({ species, count }) => {
          const rows = check.complete.filter((s) => s.species === species);
          if (rows.length === 0) return null;
          return (
            <View key={species}>
              <View style={styles.speciesRow}>
                <Text style={styles.speciesText}>
                  {species.toUpperCase()} · {count} {count > 1 ? 'trees' : 'tree'}
                </Text>
              </View>
              {rows.map((s, i) => (
                <View key={i} style={styles.tr}>
                  <Text style={[styles.td, { flex: 0.6, textAlign: 'left', color: COLORS.textMuted }]}>S{i + 1}</Text>
                  <Text style={[styles.td, { flex: 2.2 }]}>
                    {dimToText(s.lengthMilli)}×{dimToText(s.widthMilli)}×{dimToText(s.thicknessMilli)}
                  </Text>
                  <Text style={[styles.td, { flex: 1.1 }]}>{formatMilli(s.unitMilli)}</Text>
                  <Text style={[styles.td, { flex: 0.9 }]}>{s.qty}</Text>
                  <Text style={[styles.td, { flex: 1.2, color: COLORS.primaryText, fontWeight: '700' }]}>
                    {formatMilli(s.totalMilli)}
                  </Text>
                </View>
              ))}
            </View>
          );
        })}
      </View>

      {withoutSizes.length > 0 && (
        <Text style={styles.warn}>
          No sizes entered for: {withoutSizes.map((g) => g.species).join(', ')}.
        </Text>
      )}

      <SectionLabel>SUMMARY</SectionLabel>
      <View style={tdShared.card}>
        <SummaryLine label="Total qty" value={`${totals.totalQty} pcs`} />
        <SummaryLine label="Total converted vol" value={`${formatMilli(totals.convertedMilli)} m³`} />
        <SummaryLine label="Total standing vol" value={`${formatMilli(totals.standingMilli)} m³`} last />
      </View>

      <SectionLabel>CONVERSION</SectionLabel>
      <View style={tdShared.card}>
        <View style={styles.convRow}>
          <Text style={styles.convLabel}>Conversion rate</Text>
          <Text style={[styles.convValue, !within && { color: COLORS.dangerText }]}>{pct} %</Text>
        </View>
        <Text style={styles.formula}>
          {formatMilli(totals.convertedMilli)} ÷ {formatMilli(totals.standingMilli)} × 100 = {pct}%
        </Text>
      </View>

      <View style={[styles.limit, within ? styles.limitOk : styles.limitOver]}>
        <Text style={[styles.limitText, { color: within ? COLORS.primaryText : COLORS.dangerText }]}>
          {within
            ? `✓ Within limit — ${pct}% of ${LIMIT_PERCENT}% max`
            : `! Limit exceeded — ${pct}% exceeds ${LIMIT_PERCENT}% max`}
        </Text>
      </View>

      <View style={styles.buttonRow}>
        <SecondaryButton title="Back" onPress={() => navigation.goBack()} disabled={saving} style={{ flex: 1 }} />
        <PrimaryButton
          title={saving ? 'Saving…' : draft.editingId ? 'Save changes' : draft.kind === KIND_SEIZED ? 'Save record' : 'Save TD'}
          onPress={onSave}
          disabled={saving}
          style={{ flex: 2 }}
        />
      </View>
    </ScrollView>
  );
}

function SummaryLine({ label, value, last }) {
  return (
    <View style={[styles.sumRow, !last && styles.sumRowBorder]}>
      <Text style={styles.sumLabel}>{label}</Text>
      <Text style={styles.sumValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: SPACING.lg, paddingBottom: CAMERA_CLEARANCE },
  stepText: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, fontWeight: '600' },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: COLORS.textPrimary, fontSize: FONT_SIZE.md, fontWeight: '700', flexShrink: 1 },
  marking: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginLeft: SPACING.sm },
  table: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: SPACING.sm },
  thead: { backgroundColor: COLORS.header },
  th: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm - 2, fontWeight: '700', textAlign: 'center' },
  td: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, textAlign: 'center' },
  speciesRow: { backgroundColor: COLORS.lockedBg, paddingVertical: 6, paddingHorizontal: SPACING.sm },
  speciesText: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm - 2, fontWeight: '700', letterSpacing: 0.5 },
  warn: { color: COLORS.accent, fontSize: FONT_SIZE.sm, marginTop: SPACING.sm },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.sm },
  sumRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  sumLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },
  sumValue: { color: COLORS.textPrimary, fontSize: FONT_SIZE.base, fontWeight: '700' },
  convRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  convLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },
  convValue: { color: COLORS.primaryText, fontSize: FONT_SIZE.xl, fontWeight: '700' },
  formula: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginTop: SPACING.sm },
  limit: { borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1 },
  limitOk: { backgroundColor: COLORS.successBg, borderColor: COLORS.success },
  limitOver: { backgroundColor: COLORS.dangerBg, borderColor: COLORS.dangerText },
  limitText: { fontWeight: '700', fontSize: FONT_SIZE.sm },
  buttonRow: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.xl },
});
