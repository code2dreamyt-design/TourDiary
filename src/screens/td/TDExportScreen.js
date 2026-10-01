import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as tdService from '../../services/tdService';
import * as tdExport from '../../services/tdExportService';
import { useAuth } from '../../context/AuthContext';
import { presentExportError, presentExportResult } from '../../utils/exportUi';
import { COLORS } from '../../constants/colors';
import { SPACING, RADIUS, FONT_SIZE, TOUCH_TARGET_MIN, CAMERA_CLEARANCE } from '../../constants/dimensions';
import { KIND_OPTIONS, KIND_SEIZED, KIND_TD } from '../../constants/tdData';
import { formatMilli } from '../../utils/tdCalc';
import { getTodayLocalDateString, toLocalDateString } from '../../utils/dateUtils';
import {
  formatIsoDate,
  isoToLocalDateString,
  parseUserDate,
  recordMatchesSearch,
  speciesSummary,
  toUserDate,
} from '../../utils/tdFormat';
import { Checkbox, ChipSelect, PrimaryButton, SectionLabel, tdShared } from '../../components/td/TDParts';

const PRESETS = [
  { value: 'month', label: 'This month' },
  { value: 'last', label: 'Last month' },
  { value: 'three', label: 'Last 3 months' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
];

function presetRange(preset, records) {
  const now = new Date();
  const today = getTodayLocalDateString();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (preset === 'month') return { start: toLocalDateString(new Date(y, m, 1)), end: today };
  if (preset === 'last') return { start: toLocalDateString(new Date(y, m - 1, 1)), end: toLocalDateString(new Date(y, m, 0)) };
  if (preset === 'three') return { start: toLocalDateString(new Date(y, m - 2, 1)), end: today };
  if (preset === 'year') return { start: toLocalDateString(new Date(y, 0, 1)), end: today };
  const days = records.map((r) => isoToLocalDateString(r.createdAt)).filter(Boolean).sort();
  return { start: days.length ? days[0] : today, end: today };
}

// Export needs an active subscription (same rule as the diary export):
// tdExportService re-checks it, so this screen can't be used to bypass it.
export default function TDExportScreen({ navigation, route }) {
  const { user } = useAuth();
  const profile = tdExport.buildTdProfile(user);
  const [kind, setKind] = useState(route && route.params && route.params.kind === KIND_SEIZED ? KIND_SEIZED : KIND_TD);
  const seized = kind === KIND_SEIZED;
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [mode, setMode] = useState('batch');
  const [preset, setPreset] = useState('month');
  const [startText, setStartText] = useState(() => toUserDate(presetRange('month', []).start));
  const [endText, setEndText] = useState(() => toUserDate(presetRange('month', []).end));
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [singleId, setSingleId] = useState(null);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      tdService
        .listTds()
        .then((r) => alive && setRecords(r))
        .catch(() => alive && setRecords([]))
        .finally(() => alive && setLoading(false));
      return () => {
        alive = false;
      };
    }, [])
  );

  function applyPreset(value) {
    setPreset(value);
    const r = presetRange(value, ofKind);
    setStartText(toUserDate(r.start));
    setEndText(toUserDate(r.end));
  }

  const start = parseUserDate(startText);
  const end = parseUserDate(endText);
  const rangeError = !start || !end ? 'Enter dates as DD/MM/YYYY.' : start > end ? 'Start date is after the end date.' : null;

  // Batch list: inside the chosen date range AND matching the search.
  // TD and seized timber are always exported separately: only the chosen kind is listed.
  const ofKind = useMemo(() => records.filter((r) => r.kind === kind), [records, kind]);

  const batchList = useMemo(() => {
    if (rangeError) return [];
    return ofKind.filter((r) => {
      const day = isoToLocalDateString(r.createdAt);
      return day >= start && day <= end && recordMatchesSearch(r, search);
    });
  }, [ofKind, start, end, rangeError, search]);

  const singleList = useMemo(() => ofKind.filter((r) => recordMatchesSearch(r, search)), [ofKind, search]);

  const visibleSelected = batchList.filter((r) => selectedIds.includes(r.id));
  // Nothing ticked => export everything that matches the range + search
  // (never the whole database, ignoring the filters).
  const batchToExport = visibleSelected.length > 0 ? visibleSelected : batchList;
  const allTicked = batchList.length > 0 && batchList.every((r) => selectedIds.includes(r.id));

  function toggleAll() {
    const ids = batchList.map((r) => r.id);
    setSelectedIds((prev) => (allTicked ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])]));
  }
  const toggleOne = (id) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  async function run(fn) {
    if (busy) return;
    setBusy(true);
    try {
      presentExportResult(await fn());
    } catch (e) {
      presentExportError(e, navigation);
    } finally {
      setBusy(false);
    }
  }

  function changeKind(k) {
    setKind(k);
    setSelectedIds([]);
    setSingleId(null);
    setSearch('');
  }

  function onExport() {
    if (mode === 'single') {
      const rec = ofKind.find((r) => r.id === singleId);
      if (!rec) return Alert.alert('Select a record', 'Please select a record first.');
      return run(() => tdExport.exportTdSingleToWord(rec, profile));
    }
    if (rangeError) return Alert.alert('Check the dates', rangeError);
    if (batchToExport.length === 0) return Alert.alert('Nothing to export', 'No records match this date range and search.');
    return run(() => tdExport.exportTdBatchToWord({ records: batchToExport, startDate: start, endDate: end, kind, profile }));
  }

  if (loading) {
    return (
      <View style={tdShared.center}>
        <ActivityIndicator size="large" color={COLORS.primaryText} />
      </View>
    );
  }

  const exportLabel =
    mode === 'single'
      ? 'Export as Word'
      : `Export ${batchToExport.length} record${batchToExport.length === 1 ? '' : 's'} as Word`;

  return (
    <ScrollView style={tdShared.screen} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <ChipSelect options={KIND_OPTIONS} value={kind} onChange={changeKind} />
      <View style={{ height: SPACING.sm }} />
      <ChipSelect
        options={[
          { value: 'single', label: 'Single record' },
          { value: 'batch', label: 'Batch export' },
        ]}
        value={mode}
        onChange={setMode}
      />

      {mode === 'batch' && (
        <>
          <SectionLabel>DATE RANGE</SectionLabel>
          <ChipSelect options={PRESETS} value={preset} onChange={applyPreset} />
          <View style={styles.dateRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>From</Text>
              <TextInput
                style={[styles.input, !start && styles.inputError]}
                value={startText}
                onChangeText={(v) => {
                  setStartText(v);
                  setPreset(null);
                }}
                placeholder="DD/MM/YYYY"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>To</Text>
              <TextInput
                style={[styles.input, !end && styles.inputError]}
                value={endText}
                onChangeText={(v) => {
                  setEndText(v);
                  setPreset(null);
                }}
                placeholder="DD/MM/YYYY"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>
          {rangeError ? <Text style={styles.errorText}>{rangeError}</Text> : null}
        </>
      )}

      <SectionLabel>SEARCH</SectionLabel>
      <TextInput
        style={styles.input}
        value={search}
        onChangeText={setSearch}
        placeholder="Name, address or compartment"
        placeholderTextColor={COLORS.textMuted}
        autoCorrect={false}
      />

      {mode === 'batch' ? (
        <>
          <View style={styles.foundBox}>
            <Text style={styles.foundLabel}>Records found</Text>
            <Text style={styles.foundValue}>
              {batchList.length}
              {visibleSelected.length > 0 ? `  ·  ${visibleSelected.length} selected` : ''}
            </Text>
          </View>
          {batchList.length > 0 && (
            <>
              <TouchableOpacity style={styles.selectAll} onPress={toggleAll} accessibilityRole="checkbox" accessibilityState={{ checked: allTicked }}>
                <Checkbox checked={allTicked} />
                <Text style={styles.selectAllText}>Select all</Text>
              </TouchableOpacity>
              {visibleSelected.length === 0 && (
                <Text style={styles.hint}>Nothing ticked — all {batchList.length} matching records will be exported.</Text>
              )}
            </>
          )}
          {batchList.length === 0 && !rangeError && <Text style={styles.empty}>No records found in this date range.</Text>}
          {batchList.map((r, i) => (
            <TouchableOpacity
              key={r.id}
              style={[styles.row, selectedIds.includes(r.id) && styles.rowSelected]}
              onPress={() => toggleOne(r.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selectedIds.includes(r.id) }}
            >
              <Checkbox checked={selectedIds.includes(r.id)} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {i + 1}. {r.applicantName}
                </Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {speciesSummary(r.trees)} · {formatMilli(r.standingMilli)} m³{seized ? '' : ` · M.No. ${r.markingNo}`}
                </Text>
                <Text style={styles.rowSub}>{formatIsoDate(r.createdAt)}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </>
      ) : (
        <>
          <SectionLabel>SELECT RECORD</SectionLabel>
          {singleList.length === 0 && <Text style={styles.empty}>{ofKind.length === 0 ? (seized ? 'No seized timber records available.' : 'No TD records available.') : 'No matching records.'}</Text>}
          {singleList.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={[styles.row, singleId === r.id && styles.rowSelected]}
              onPress={() => setSingleId(r.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: singleId === r.id }}
            >
              <Checkbox checked={singleId === r.id} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {r.applicantName}
                </Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  S/o {r.fathersName} · R/o {r.address}
                </Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {speciesSummary(r.trees)}{seized ? '' : ` · M.No. ${r.markingNo}`} · {formatIsoDate(r.createdAt)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </>
      )}

      <PrimaryButton title={busy ? 'Preparing…' : exportLabel} onPress={onExport} disabled={busy} style={{ marginTop: SPACING.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: SPACING.lg, paddingBottom: CAMERA_CLEARANCE },
  label: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, fontWeight: '600', marginBottom: SPACING.xs },
  dateRow: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.md },
  input: {
    minHeight: TOUCH_TARGET_MIN,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    color: COLORS.textPrimary,
    paddingHorizontal: SPACING.md,
    fontSize: FONT_SIZE.base,
  },
  inputError: { borderColor: COLORS.dangerText },
  errorText: { color: COLORS.dangerText, fontSize: FONT_SIZE.sm, marginTop: SPACING.xs },
  foundBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginTop: SPACING.lg,
  },
  foundLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },
  foundValue: { color: COLORS.textPrimary, fontWeight: '700' },
  selectAll: { flexDirection: 'row', alignItems: 'center', minHeight: TOUCH_TARGET_MIN, marginTop: SPACING.sm },
  selectAllText: { color: COLORS.textSecondary, fontWeight: '600' },
  hint: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginBottom: SPACING.sm },
  empty: { color: COLORS.textSecondary, textAlign: 'center', marginTop: SPACING.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  rowSelected: { borderColor: COLORS.primaryText, backgroundColor: COLORS.primaryLight },
  rowName: { color: COLORS.textPrimary, fontWeight: '700', fontSize: FONT_SIZE.base },
  rowSub: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginTop: 2 },
});
