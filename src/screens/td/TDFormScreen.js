import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Switch, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';
import { SPACING, RADIUS, FONT_SIZE, TOUCH_TARGET_MIN, CAMERA_CLEARANCE } from '../../constants/dimensions';
import {
  CLASS_OPTIONS,
  KIND_SEIZED,
  MAX_COMPARTMENT_LENGTH,
  MAX_TREES,
  SPECIES_LIST,
  TREE_COLORS,
} from '../../constants/tdData';
import * as tdService from '../../services/tdService';
import { useTDDraft } from '../../context/TDDraftContext';
import { validateDetails } from '../../utils/tdValidation';
import { ChipSelect, Field, PrimaryButton, SectionLabel, tdShared } from '../../components/td/TDParts';

// Step 1 of 3: applicant + forest + tree details. Nothing is saved here —
// this only fills the in-memory draft; the actual (subscription-gated) write
// happens on the result screen via tdService.saveTd().
export default function TDFormScreen({ navigation }) {
  const { draft, setField, setTreeCount, setTree, syncSizes } = useTDDraft();
  const seized = draft.kind === KIND_SEIZED;
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const scrollRef = useRef(null);
  const [recent, setRecent] = useState([]);

  // Compartment names already used in saved records, as one-tap suggestions.
  useEffect(() => {
    let alive = true;
    tdService
      .listTds()
      .then((all) => {
        if (!alive) return;
        const seen = [];
        for (const r of all) {
          const c = (r.compartment || '').trim();
          if (c && !seen.includes(c)) seen.push(c);
          if (seen.length >= 6) break;
        }
        setRecent(seen);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  function onContinue() {
    setSubmitted(true);
    const result = validateDetails(draft);
    setErrors(result.errors);
    if (!result.valid) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    syncSizes();
    navigation.navigate('TDSizes');
  }

  // Once the user has tried to continue, clear a field's error as soon as it's fixed.
  const err = (name) => (submitted ? errors[name] : undefined);
  const set = (name) => (value) => {
    setField(name, value);
    if (submitted && errors[name]) setErrors((e) => ({ ...e, [name]: undefined }));
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={tdShared.screen}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <Text style={styles.stepText}>
        Step 1 of 3 · {draft.editingId ? 'Edit' : 'New'} {seized ? 'seized timber' : 'TD'}
      </Text>

      {submitted && Object.values(errors).some(Boolean) && (
        <View style={[tdShared.banner, tdShared.bannerError]}>
          <Text style={tdShared.bannerErrorText}>Please fix the highlighted fields.</Text>
        </View>
      )}

      <SectionLabel>{seized ? 'NAME & ADDRESS' : 'APPLICANT DETAILS'}</SectionLabel>
      <Field
        label={seized ? 'Name' : 'Applicant name'}
        value={draft.applicantName}
        onChangeText={set('applicantName')}
        error={err('applicantName')}
        placeholder="e.g. Ramesh Kumar"
        autoCapitalize="words"
      />
      <Field
        label="Father's name"
        value={draft.fathersName}
        onChangeText={set('fathersName')}
        error={err('fathersName')}
        placeholder="e.g. Suresh Kumar"
        autoCapitalize="words"
      />
      <Field
        label="Address"
        value={draft.address}
        onChangeText={set('address')}
        error={err('address')}
        placeholder="e.g. Khalawan"
        autoCapitalize="words"
      />
      {!seized && (
        <>
          <Field
            label="Marking number"
            value={draft.markingNo}
            onChangeText={set('markingNo')}
            error={err('markingNo')}
            placeholder="e.g. 12,13 / 2025"
            autoCapitalize="none"
          />

          <Text style={[styles.label, { marginTop: SPACING.lg }]}>Status</Text>
          <View style={styles.switchRow}>
            <Text style={styles.switchText}>Free grant</Text>
            <Switch
              value={draft.isFreeGrant}
              onValueChange={(v) => setField('isFreeGrant', v)}
              trackColor={{ false: COLORS.lockedFill, true: COLORS.primary }}
              thumbColor={COLORS.white}
            />
          </View>
          <Field
            label={draft.isFreeGrant ? 'Grant details (optional)' : 'Payment'}
            value={draft.isFreeGrant ? draft.freeGrantStatus : 'Paid'}
            onChangeText={(v) => setField('freeGrantStatus', v)}
            editable={draft.isFreeGrant}
            placeholder="e.g. Order No. 123"
            inputStyle={!draft.isFreeGrant && styles.inputDisabled}
          />
        </>
      )}

      <SectionLabel>FOREST DETAILS</SectionLabel>
      <Field
        label="Compartment"
        value={draft.compartment}
        onChangeText={set('compartment')}
        error={err('compartment')}
        placeholder="e.g. C.no. 3 Pharog"
        maxLength={MAX_COMPARTMENT_LENGTH}
        autoCapitalize="sentences"
      />
      {recent.length > 0 && (
        <View style={{ marginTop: SPACING.sm }}>
          <Text style={styles.recentLabel}>Used before — tap to fill</Text>
          <ChipSelect options={recent} value={draft.compartment.trim()} onChange={set('compartment')} />
        </View>
      )}

      <Text style={[styles.label, { marginTop: SPACING.md }]}>No. of trees</Text>
      <ChipSelect
        options={Array.from({ length: MAX_TREES }, (_, i) => ({ value: i + 1, label: String(i + 1) }))}
        value={draft.trees.length}
        onChange={setTreeCount}
      />

      <SectionLabel>TREE DETAILS</SectionLabel>
      {draft.trees.map((tree, i) => (
        <View key={i} style={tdShared.card}>
          <View style={[tdShared.row, { marginBottom: SPACING.sm }]}>
            <View style={[styles.dot, { backgroundColor: TREE_COLORS[i].dot }]} />
            <Text style={styles.treeTitle}>Tree {i + 1}</Text>
          </View>
          <Text style={styles.label}>Species</Text>
          <ChipSelect options={SPECIES_LIST} value={tree.species} onChange={(v) => setTree(i, { species: v })} />
          <Text style={[styles.label, { marginTop: SPACING.md }]}>Class</Text>
          <ChipSelect options={CLASS_OPTIONS} value={tree.class} onChange={(v) => setTree(i, { class: v })} />
        </View>
      ))}
      {err('trees') ? <Text style={styles.errorText}>{errors.trees}</Text> : null}

      <PrimaryButton title="Save & continue to sizes →" onPress={onContinue} style={{ marginTop: SPACING.lg }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: SPACING.lg, paddingBottom: CAMERA_CLEARANCE },
  stepText: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, fontWeight: '600' },
  label: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, fontWeight: '600', marginBottom: SPACING.xs },
  errorText: { color: COLORS.dangerText, fontSize: FONT_SIZE.sm, marginTop: SPACING.xs },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: TOUCH_TARGET_MIN,
  },
  switchText: { color: COLORS.textPrimary, fontSize: FONT_SIZE.base },
  inputDisabled: { color: COLORS.textMuted, backgroundColor: COLORS.surface },
  recentLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginBottom: SPACING.xs },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: SPACING.sm },
  treeTitle: { color: COLORS.textPrimary, fontWeight: '700', fontSize: FONT_SIZE.md },
});
