import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useTDDraft } from '../../context/TDDraftContext';
import * as tdService from '../../services/tdService';
import { COLORS } from '../../constants/colors';
import { SPACING, RADIUS, FONT_SIZE, TOUCH_TARGET_MIN, CAMERA_CLEARANCE } from '../../constants/dimensions';
import { KIND_OPTIONS, KIND_SEIZED, KIND_TD, LIMIT_PERCENT } from '../../constants/tdData';
import { dimToText, formatHundredths, formatMilli, isWithinLimit } from '../../utils/tdCalc';
import {
  formatIsoDateTime,
  groupTreesBySpecies,
  recordMatchesSearch,
  statusText,
} from '../../utils/tdFormat';
import { ChipSelect, PrimaryButton, SecondaryButton, TreePills, tdShared } from '../../components/td/TDParts';
import { requireWriteAccess, showLockedAlert } from './tdGuard';

// TD home: saved records (always viewable, like diaries) + New / Export.
// Creating, editing, deleting and exporting all need an active subscription.
export default function TDHomeScreen({ navigation }) {
  const { subscriptionActive } = useAuth();
  const { startNew, startEdit } = useTDDraft();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [kind, setKind] = useState(KIND_TD);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRecords(await tdService.listTds());
    } catch (e) {
      setError('Unable to load your TD records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // The main toggle: TD records and seized-timber records are kept apart everywhere.
  const ofKind = useMemo(() => records.filter((r) => r.kind === kind), [records, kind]);
  const filtered = useMemo(() => ofKind.filter((r) => recordMatchesSearch(r, search)), [ofKind, search]);
  const seized = kind === KIND_SEIZED;

  async function onNew() {
    if (!(await requireWriteAccess(navigation))) return;
    startNew(kind);
    navigation.navigate('TDForm');
  }

  async function onEdit(record) {
    if (!(await requireWriteAccess(navigation))) return;
    startEdit(record);
    navigation.navigate('TDForm');
  }

  async function onExport() {
    if (!(await requireWriteAccess(navigation))) return;
    navigation.navigate('TDExport', { kind });
  }

  async function onDelete(record) {
    if (!(await requireWriteAccess(navigation))) return;
    Alert.alert(
      'Delete record?',
      `This will permanently delete the record for ${record.applicantName}${record.kind === KIND_TD ? ` (M.No. ${record.markingNo})` : ''}. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await tdService.deleteTd(record.id);
              if (expandedId === record.id) setExpandedId(null);
              await load();
            } catch (e) {
              if (e.code === 'WRITE_LOCKED') showLockedAlert(navigation, e.reason, e.message);
              else Alert.alert('Delete Failed', 'Unable to delete this TD. Please try again.');
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={tdShared.center}>
        <ActivityIndicator size="large" color={COLORS.primaryText} />
      </View>
    );
  }

  const header = (
    <View>
      {!subscriptionActive && (
        <View style={[tdShared.banner, tdShared.bannerLocked]}>
          <Text style={tdShared.bannerLockedText}>Subscription inactive — view only. Renew to create, edit or export records.</Text>
        </View>
      )}
      <ChipSelect options={KIND_OPTIONS} value={kind} onChange={(k) => { setKind(k); setSearch(''); setExpandedId(null); }} />
      <View style={[styles.actionRow, { marginTop: SPACING.md }]}>
        <PrimaryButton title={seized ? '+ New seized' : '+ New TD'} onPress={onNew} style={{ flex: 1 }} />
        <SecondaryButton title="Export" onPress={onExport} style={{ flex: 1 }} />
      </View>
      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder={seized ? 'Search name, address or compartment' : 'Search name, address, compartment or M.No.'}
        placeholderTextColor={COLORS.textMuted}
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
      <Text style={styles.count}>
        {filtered.length}
        {search.trim() ? ` of ${ofKind.length}` : ''} {seized ? 'SEIZED' : 'TD'} RECORD{filtered.length === 1 ? '' : 'S'}
      </Text>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );

  return (
    <FlatList
      style={tdShared.screen}
      contentContainerStyle={styles.list}
      data={filtered}
      keyExtractor={(r) => String(r.id)}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={header}
      ListEmptyComponent={
        <Text style={styles.empty}>
          {ofKind.length === 0 ? (seized ? 'No seized timber records yet. Tap “+ New seized” to add one.' : 'No TD records yet. Tap “+ New TD” to add one.') : 'No records match your search.'}
        </Text>
      }
      renderItem={({ item }) => (
        <RecordCard
          record={item}
          expanded={expandedId === item.id}
          onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
          onEdit={() => onEdit(item)}
          onDelete={() => onDelete(item)}
        />
      )}
    />
  );
}

function RecordCard({ record, expanded, onToggle, onEdit, onDelete }) {
  const within = isWithinLimit(record.convertedMilli, record.standingMilli);
  const groups = groupTreesBySpecies(record.trees);
  return (
    <View style={tdShared.card}>
      <View style={styles.cardTop}>
        <Text style={styles.name} numberOfLines={2}>
          {record.applicantName}
        </Text>
        <View style={[styles.badge, !within && styles.badgeOver]}>
          <Text style={[styles.badgeText, !within && { color: COLORS.dangerText }]}>
            {formatHundredths(record.conversionHundredths)} %
          </Text>
        </View>
      </View>
      <Text style={styles.sub}>
        S/O {record.fathersName} · {record.address}
      </Text>
      <View style={{ marginTop: SPACING.sm }}>
        <TreePills trees={record.trees} />
      </View>

      <View style={styles.stats}>
        <Stat label="STANDING" value={`${formatMilli(record.standingMilli)} m³`} />
        <Stat label="CONVERTED" value={`${formatMilli(record.convertedMilli)} m³`} accent />
        {record.kind === KIND_TD && <Stat label="M.No." value={record.markingNo} />}
      </View>

      <Text style={styles.meta}>{record.compartment}</Text>
      <Text style={styles.meta}>
        {record.kind === KIND_TD ? `${statusText(record)} · ` : ''}
        {formatIsoDateTime(record.createdAt)}
      </Text>

      {expanded && (
        <View style={styles.sizesBox}>
          {groups.map(({ species }) => {
            const rows = record.sizes.filter((s) => s.species === species);
            return (
              <View key={species}>
                <Text style={styles.sizesSpecies}>{species.toUpperCase()}</Text>
                {rows.length === 0 && <Text style={styles.sizeLine}>No sizes</Text>}
                {rows.map((s, i) => (
                  <Text key={i} style={styles.sizeLine}>
                    S{i + 1}  {dimToText(s.lengthMilli)}×{dimToText(s.widthMilli)}×{dimToText(s.thicknessMilli)} m  ·  {s.qty} pcs  ·  {formatMilli(s.totalMilli)} m³
                  </Text>
                ))}
              </View>
            );
          })}
          <Text style={styles.limitNote}>Limit {LIMIT_PERCENT}% · {within ? 'within' : 'exceeded'}</Text>
        </View>
      )}

      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.smallBtn} onPress={onToggle} accessibilityRole="button">
          <Text style={styles.smallBtnText}>{expanded ? 'Close' : 'View'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.smallBtn} onPress={onEdit} accessibilityRole="button">
          <Text style={styles.smallBtnText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.smallBtn, styles.deleteBtn]} onPress={onDelete} accessibilityRole="button">
          <Text style={[styles.smallBtnText, { color: COLORS.dangerText }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Stat({ label, value, accent }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, accent && { color: COLORS.primaryText }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: SPACING.lg, paddingBottom: CAMERA_CLEARANCE, flexGrow: 1 },
  actionRow: { flexDirection: 'row', gap: SPACING.md },
  search: {
    marginTop: SPACING.md,
    minHeight: TOUCH_TARGET_MIN,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    color: COLORS.textPrimary,
    paddingHorizontal: SPACING.md,
    fontSize: FONT_SIZE.base,
  },
  count: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, fontWeight: '700', marginVertical: SPACING.md },
  errorText: { color: COLORS.dangerText, marginBottom: SPACING.sm },
  empty: { color: COLORS.textSecondary, textAlign: 'center', marginTop: SPACING.xl },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  name: { color: COLORS.textPrimary, fontSize: FONT_SIZE.md, fontWeight: '700', flex: 1, marginRight: SPACING.sm },
  badge: { backgroundColor: COLORS.successBg, borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm, paddingVertical: 4 },
  badgeOver: { backgroundColor: COLORS.dangerBg },
  badgeText: { color: COLORS.primaryText, fontWeight: '700', fontSize: FONT_SIZE.sm },
  sub: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginTop: 2 },
  stats: { flexDirection: 'row', marginTop: SPACING.md, borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.border },
  stat: { flex: 1, paddingVertical: SPACING.sm, paddingHorizontal: 4 },
  statLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm - 3, fontWeight: '700' },
  statValue: { color: COLORS.textPrimary, fontSize: FONT_SIZE.sm, fontWeight: '700', marginTop: 2 },
  meta: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginTop: SPACING.sm },
  sizesBox: { marginTop: SPACING.md, backgroundColor: COLORS.background, borderRadius: RADIUS.md, padding: SPACING.md },
  sizesSpecies: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm - 2, fontWeight: '700', marginTop: 4, letterSpacing: 0.5 },
  sizeLine: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, marginTop: 4 },
  limitNote: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm - 1, marginTop: SPACING.sm },
  cardActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  smallBtn: {
    flex: 1,
    minHeight: TOUCH_TARGET_MIN,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: { backgroundColor: COLORS.dangerBg },
  smallBtnText: { color: COLORS.primaryText, fontWeight: '700' },
});
