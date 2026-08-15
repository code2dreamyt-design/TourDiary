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
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect } from '@react-navigation/native';
import * as profileService from '../services/profileService';
import { COLORS } from '../constants/colors';
import { SPACING, RADIUS, FONT_SIZE, TOUCH_TARGET_MIN } from '../constants/dimensions';
import { getMonthName, buildDateString } from '../utils/dateUtils';

const SALUTATIONS = ['Mr.', 'Ms.', 'Mrs.', 'Other'];
const CURRENT_YEAR = new Date().getFullYear();
const DOB_YEARS = Array.from({ length: 70 }, (_, i) => CURRENT_YEAR - 15 - i); // ~15 to ~85 years old
const DOB_MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

function daysInMonth(month, year) {
  return new Date(year, month, 0).getDate();
}

// mode: 'setup' (first run, no way back, forces completion) or 'edit'
// (reached from Home, pre-filled, normal back navigation).
export default function ProfileSetupScreen({ navigation, route }) {
  const mode = route.params?.mode === 'edit' ? 'edit' : 'setup';

  const [loading, setLoading] = useState(true);
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const profile = await profileService.getProfile();
      if (profile) {
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
        }
      }
    } catch (e) {
      // Non-fatal: form just opens blank/defaulted.
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const maxDay = daysInMonth(dobMonth, dobYear);
  const days = Array.from({ length: maxDay }, (_, i) => i + 1);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const dob = dobSet ? buildDateString(dobYear, dobMonth, Math.min(dobDay, maxDay)) : null;
      await profileService.saveProfile({
        salutation,
        name,
        designation,
        dob,
        defaultFromLocation,
      });
      if (mode === 'setup') {
        navigation.replace('Home');
      } else {
        navigation.goBack();
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
        <Text style={styles.saveButtonText}>{saving ? 'Saving…' : mode === 'setup' ? 'Get Started' : 'Save Changes'}</Text>
      </TouchableOpacity>
    </ScrollView>
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
    marginBottom: SPACING.xl,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    minHeight: TOUCH_TARGET_MIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: { color: COLORS.white, fontWeight: '700', fontSize: FONT_SIZE.base },
});
