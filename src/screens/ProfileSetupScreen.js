import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect } from '@react-navigation/native';
import * as profileService from '../services/profileService';
import { COLORS } from '../constants/colors';
import { SPACING, RADIUS, FONT_SIZE, TOUCH_TARGET_MIN } from '../constants/dimensions';
import { getMonthName, buildDateString, formatDisplayDate } from '../utils/dateUtils';

const SALUTATIONS = ['Mr.', 'Ms.', 'Mrs.', 'Other'];
const CURRENT_YEAR = new Date().getFullYear();
const DOB_YEARS = Array.from({ length: 70 }, (_, i) => CURRENT_YEAR - 15 - i); // ~15 to ~85 years old
const DOB_MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

function daysInMonth(month, year) {
  return new Date(year, month, 0).getDate();
}

// mode: 'setup' (first run, no way back, forces completion — always shows
// the editable form) or 'edit' (reached from the Profile tab — opens as a
// clean read-only summary, with an Edit button that reveals the same form).
export default function ProfileSetupScreen({ navigation, route }) {
  const mode = route.params?.mode === 'edit' ? 'edit' : 'setup';

  const [loading, setLoading] = useState(true);
  const [hasSavedProfile, setHasSavedProfile] = useState(false);
  // In 'setup' mode we're always in the form; in 'edit' mode we start on
  // the read-only summary and only enter the form via the Edit button.
  const [isEditing, setIsEditing] = useState(mode === 'setup');

  const [salutation, setSalutation] = useState('Mr.');
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('');
  const [dobDay, setDobDay] = useState(1);
  const [dobMonth, setDobMonth] = useState(1);
  const [dobYear, setDobYear] = useState(DOB_YEARS[10]);
  const [dobSet, setDobSet] = useState(false);
  const [defaultFromLocation, setDefaultFromLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    navigation.setOptions({
      title: mode === 'edit' ? 'My Profile' : 'Set Up Your Profile',
      headerLeft: mode === 'setup' ? () => null : undefined,
      gestureEnabled: mode !== 'setup',
    });
  }, [navigation, mode]);

  function applyProfileToForm(profile) {
    if (!profile) return;
    setSalutation(profile.salutation || 'Mr.');
    setName(profile.name || '');
    setDesignation(profile.designation || '');
    setDefaultFromLocation(profile.default_from_location || '');
    if (profile.dob) {
      const [y, m, d] = profile.dob.split('-').map(Number);
      if (y && m && d) {
        setDobYear(y);
        setDobMonth(m);
        setDobDay(d);
        setDobSet(true);
      }
    } else {
      setDobSet(false);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const profile = await profileService.getProfile();
      const complete = !!(profile && profile.name && profile.name.trim());
      setHasSavedProfile(complete);
      applyProfileToForm(profile);
      // Every fresh visit to the Profile tab should start on the summary
      // view, never mid-edit from a previous visit.
      if (mode === 'edit') {
        setIsEditing(false);
      }
      setError(null);
    } catch (e) {
      // Non-fatal: form just opens blank/defaulted.
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const maxDay = daysInMonth(dobMonth, dobYear);
  const days = Array.from({ length: maxDay }, (_, i) => i + 1);

  function handleStartEdit() {
    setError(null);
    setIsEditing(true);
  }

  async function handleCancelEdit() {
    setError(null);
    try {
      const profile = await profileService.getProfile();
      applyProfileToForm(profile);
    } catch (e) {
      // Non-fatal — worst case the form keeps whatever was last typed.
    }
    setIsEditing(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const dob = dobSet ? buildDateString(dobYear, dobMonth, Math.min(dobDay, maxDay)) : null;
      const saved = await profileService.saveProfile({
        salutation,
        name,
        designation,
        dob,
        defaultFromLocation,
      });
      applyProfileToForm(saved);
      setHasSavedProfile(true);
      if (mode === 'setup') {
        navigation.replace('MainTabs');
      } else {
        // Drop back to the clean summary view on success.
        setIsEditing(false);
        Alert.alert('Saved', 'Your profile has been updated.');
      }
    } catch (err) {
      setError(err.message || 'Unable to save your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (mode === 'edit' && !isEditing) {
    return (
      <ProfileSummary
        hasSavedProfile={hasSavedProfile}
        salutation={salutation}
        name={name}
        designation={designation}
        dobSet={dobSet}
        dobDay={dobDay}
        dobMonth={dobMonth}
        dobYear={dobYear}
        defaultFromLocation={defaultFromLocation}
        onEdit={handleStartEdit}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {mode === 'setup' && (
        <Text style={styles.intro}>
          Tell us a bit about yourself. This is used on your Word exports and to pre-fill your diary entries.
        </Text>
      )}

      <Text style={styles.sectionLabel}>Your Details</Text>

      <Text style={styles.fieldLabel}>Title</Text>
      <View style={styles.pickerBorder}>
        <Picker selectedValue={salutation} onValueChange={setSalutation} style={styles.picker}>
          {SALUTATIONS.map((s) => (
            <Picker.Item key={s} label={s} value={s} />
          ))}
        </Picker>
      </View>

      <Text style={styles.fieldLabel}>Name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Ramesh Kumar"
        placeholderTextColor={COLORS.textMuted}
      />

      <Text style={styles.fieldLabel}>Designation</Text>
      <TextInput
        style={styles.input}
        value={designation}
        onChangeText={setDesignation}
        placeholder="e.g. Van Mitra, Forest Guard, Range Officer"
        placeholderTextColor={COLORS.textMuted}
      />

      <Text style={styles.fieldLabel}>Date of Birth {dobSet ? '' : '(optional)'}</Text>
      <View style={styles.dobRow}>
        <View style={styles.dobCol}>
          <View style={styles.pickerBorder}>
            <Picker
              selectedValue={dobDay}
              onValueChange={(v) => {
                setDobDay(v);
                setDobSet(true);
              }}
              style={styles.picker}
            >
              {days.map((d) => (
                <Picker.Item key={d} label={String(d)} value={d} />
              ))}
            </Picker>
          </View>
        </View>
        <View style={styles.dobColWide}>
          <View style={styles.pickerBorder}>
            <Picker
              selectedValue={dobMonth}
              onValueChange={(v) => {
                setDobMonth(v);
                setDobSet(true);
              }}
              style={styles.picker}
            >
              {DOB_MONTHS.map((m) => (
                <Picker.Item key={m} label={getMonthName(m)} value={m} />
              ))}
            </Picker>
          </View>
        </View>
        <View style={styles.dobCol}>
          <View style={styles.pickerBorder}>
            <Picker
              selectedValue={dobYear}
              onValueChange={(v) => {
                setDobYear(v);
                setDobSet(true);
              }}
              style={styles.picker}
            >
              {DOB_YEARS.map((y) => (
                <Picker.Item key={y} label={String(y)} value={y} />
              ))}
            </Picker>
          </View>
        </View>
      </View>

      <Text style={styles.sectionLabel}>Usual Tour Start</Text>
      <Text style={styles.fieldHint}>
        The place you usually start your tour from. This will be used as the default "From" for each new
        diary entry — you'll only need to change it on days you start somewhere else.
      </Text>
      <TextInput
        style={styles.input}
        value={defaultFromLocation}
        onChangeText={setDefaultFromLocation}
        placeholder="e.g. Range Office, Compartment 12"
        placeholderTextColor={COLORS.textMuted}
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving} accessibilityRole="button">
        {saving ? (
          <ActivityIndicator color={COLORS.white} />
        ) : (
          <Text style={styles.saveButtonText}>{mode === 'setup' ? 'Get Started' : 'Save Changes'}</Text>
        )}
      </TouchableOpacity>

      {mode === 'edit' && (
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancelEdit} disabled={saving} accessibilityRole="button">
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

// Clean, read-only presentation of the saved profile, shown by default on
// the Profile tab. Never renders raw inputs — just labelled values — with
// a single Edit button that hands off to the form above.
function ProfileSummary({
  hasSavedProfile,
  salutation,
  name,
  designation,
  dobSet,
  dobDay,
  dobMonth,
  dobYear,
  defaultFromLocation,
  onEdit,
}) {
  const dobDisplay = dobSet ? formatDisplayDate(buildDateString(dobYear, dobMonth, dobDay)) : null;

  return (
    <ScrollView contentContainerStyle={styles.summaryContainer}>
      {!hasSavedProfile && (
        <Text style={styles.summaryEmptyHint}>Your profile hasn't been filled in yet.</Text>
      )}

      <View style={styles.summaryCard}>
        <View style={styles.summaryHeaderRow}>
          <Text style={styles.summaryName}>
            {name ? `${salutation ? `${salutation} ` : ''}${name}` : 'Name not set'}
          </Text>
        </View>
        {!!designation && <Text style={styles.summaryDesignation}>{designation}</Text>}

        <View style={styles.summaryDivider} />

        <SummaryRow label="Date of Birth" value={dobDisplay || 'Not set'} />
        <SummaryRow label="Usual Tour Start" value={defaultFromLocation || 'Not set'} last />
      </View>

      <TouchableOpacity style={styles.editButton} onPress={onEdit} accessibilityRole="button">
        <Text style={styles.editButtonText}>Edit Profile</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function SummaryRow({ label, value, last }) {
  return (
    <View style={[styles.summaryRow, last && styles.summaryRowLast]}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: SPACING.lg, backgroundColor: COLORS.background, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  intro: { fontSize: FONT_SIZE.base, color: COLORS.textSecondary, marginBottom: SPACING.lg, lineHeight: 21 },
  sectionLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
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
  picker: {
    height: Platform.OS === 'ios' ? 150 : 50,
    width: '100%',
    color: COLORS.textPrimary,
  },
  dobRow: { flexDirection: 'row', gap: SPACING.sm },
  dobCol: { flex: 1 },
  dobColWide: { flex: 1.4 },
  errorText: { color: COLORS.danger, marginTop: SPACING.md, fontSize: FONT_SIZE.base },
  saveButton: {
    marginTop: SPACING.xl,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    minHeight: TOUCH_TARGET_MIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: { color: COLORS.white, fontWeight: '700', fontSize: FONT_SIZE.base },
  cancelButton: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.xl,
    minHeight: TOUCH_TARGET_MIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: FONT_SIZE.base },

  // --- Read-only summary ---------------------------------------------------
  summaryContainer: { padding: SPACING.lg, backgroundColor: COLORS.background, flexGrow: 1 },
  summaryEmptyHint: {
    fontSize: FONT_SIZE.base,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.xl,
  },
  summaryHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  summaryName: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.textPrimary },
  summaryDesignation: { fontSize: FONT_SIZE.base, color: COLORS.primary, fontWeight: '600', marginTop: 2 },
  summaryDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.lg },
  summaryRow: {
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  summaryRowLast: { borderBottomWidth: 0 },
  summaryLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  summaryValue: { fontSize: FONT_SIZE.md, color: COLORS.textPrimary, marginTop: 4 },
  editButton: {
    marginTop: SPACING.xl,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    minHeight: TOUCH_TARGET_MIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: { color: COLORS.white, fontWeight: '700', fontSize: FONT_SIZE.base },
});
