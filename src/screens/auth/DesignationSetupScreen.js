import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../api/client';
import { showErrorToast } from '../../components/Toast';
import { COLORS } from '../../constants/colors';
import { SPACING, RADIUS, FONT_SIZE, TOUCH_TARGET_MIN } from '../../constants/dimensions';

// Must match the backend's completeDesignationSchema enum exactly
// (src/validations/auth.validation.js) — sending anything else 400s.
const DESIGNATIONS = ['Van Mitra', 'Forest Guard', 'Forest Worker', 'Others'];

// Shown once, right after signup, and cannot be skipped — profileCompleted
// only becomes true once this succeeds (see user.controller.js's
// completeOrUpdateDesignation), and AppNavigator routes here for as long
// as it's false. Editing these fields again later happens from the
// Profile tab (ProfileScreen), which reuses updateDesignation the same way.
export default function DesignationSetupScreen() {
  const { updateDesignation } = useAuth();

  const [designation, setDesignation] = useState(DESIGNATIONS[0]);
  const [usualTourStart, setUsualTourStart] = useState('');
  const [beatName, setBeatName] = useState('');
  const [forestBlock, setForestBlock] = useState('');
  const [forestRange, setForestRange] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit() {
    setError(null);
    if (!usualTourStart.trim() || !beatName.trim() || !forestBlock.trim() || !forestRange.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    setSubmitting(true);
    try {
      await updateDesignation({
        designation,
        usualTourStart: usualTourStart.trim(),
        beatName: beatName.trim(),
        forestBlock: forestBlock.trim(),
        forestRange: forestRange.trim(),
      });
      // AppNavigator switches to MainTabs automatically once
      // needsDesignationSetup flips false.
    } catch (err) {
      showErrorToast(err instanceof ApiError ? err.message : 'Unable to save. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.intro}>
        Tell us about your role and posting. This is required before you can start your tour diary.
      </Text>

      <Text style={styles.fieldLabel}>Designation</Text>
      <View style={styles.pickerBorder}>
        <Picker selectedValue={designation} onValueChange={setDesignation} style={styles.picker}>
          {DESIGNATIONS.map((d) => (
            <Picker.Item key={d} label={d} value={d} />
          ))}
        </Picker>
      </View>

      <Text style={styles.fieldLabel}>Usual Tour Start</Text>
      <Text style={styles.fieldHint}>The place you usually start your tour from — this pre-fills each new diary entry's "From" field.</Text>
      <TextInput
        style={styles.input}
        value={usualTourStart}
        onChangeText={setUsualTourStart}
        maxLength={50}
        placeholder="e.g. Range Office, Compartment 12"
        placeholderTextColor={COLORS.textMuted}
      />

      <Text style={styles.fieldLabel}>Beat Name</Text>
      <TextInput
        style={styles.input}
        value={beatName}
        onChangeText={setBeatName}
        maxLength={50}
        placeholder="e.g. Beat 4"
        placeholderTextColor={COLORS.textMuted}
      />

      <Text style={styles.fieldLabel}>Forest Block</Text>
      <TextInput
        style={styles.input}
        value={forestBlock}
        onChangeText={setForestBlock}
        maxLength={50}
        placeholder="e.g. Block B"
        placeholderTextColor={COLORS.textMuted}
      />

      <Text style={styles.fieldLabel}>Forest Range</Text>
      <TextInput
        style={styles.input}
        value={forestRange}
        onChangeText={setForestRange}
        maxLength={50}
        placeholder="e.g. North Range"
        placeholderTextColor={COLORS.textMuted}
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TouchableOpacity style={styles.saveButton} onPress={handleSubmit} disabled={submitting} accessibilityRole="button">
        {submitting ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.saveButtonText}>Continue</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: SPACING.lg, backgroundColor: COLORS.background, flexGrow: 1 },
  intro: { fontSize: FONT_SIZE.base, color: COLORS.textSecondary, marginBottom: SPACING.lg, lineHeight: 21 },
  fieldLabel: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: SPACING.md, fontWeight: '600' },
  fieldHint: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginTop: SPACING.xs, lineHeight: 18 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    fontSize: FONT_SIZE.base,
    color: COLORS.textPrimary,
    marginTop: SPACING.xs,
    backgroundColor: COLORS.surface,
    minHeight: TOUCH_TARGET_MIN,
  },
  pickerBorder: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
    marginTop: SPACING.xs,
  },
  picker: { height: Platform.OS === 'ios' ? 150 : 50, width: '100%', color: COLORS.textPrimary },
  errorText: { color: COLORS.dangerText, marginTop: SPACING.md, fontSize: FONT_SIZE.base },
  saveButton: {
    marginTop: SPACING.xl,
    marginBottom: SPACING.xl,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    minHeight: TOUCH_TARGET_MIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: { color: COLORS.white, fontWeight: '700', fontSize: FONT_SIZE.base },
});
