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
  Image,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import * as authApi from '../api/authApi';
import * as secureStorage from '../storage/secureStorage';
import { ApiError } from '../api/client';
import { showErrorToast } from '../components/Toast';
import { COLORS } from '../constants/colors';
import { SPACING, RADIUS, FONT_SIZE, TOUCH_TARGET_MIN } from '../constants/dimensions';
import { getMonthName, buildDateString, formatDisplayDate } from '../utils/dateUtils';

const SALUTATIONS = ['Mr.', 'Ms.', 'Mrs.', 'Other'];
const DESIGNATIONS = ['Van Mitra', 'Forest Guard', 'Forest Worker', 'Others'];
const CURRENT_YEAR = new Date().getFullYear();
// Backend (dobUpdateSchema) rejects anyone under 18, so don't offer those years.
const DOB_YEARS = Array.from({ length: 70 }, (_, i) => CURRENT_YEAR - 18 - i);
const DOB_MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

function daysInMonth(month, year) {
  return new Date(year, month, 0).getDate();
}

export default function ProfileScreen({ navigation }) {
  const { user, subscriptionActive, logout, refreshProfile, updateName, updateDesignation, updateDob, uploadProfilePic, removeProfilePic } =
    useAuth();

  const [salutation, setSalutationState] = useState('Mr.');
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);

  const [editingDesignation, setEditingDesignation] = useState(false);
  const [designation, setDesignation] = useState(DESIGNATIONS[0]);
  const [usualTourStart, setUsualTourStart] = useState('');
  const [beatName, setBeatName] = useState('');
  const [forestBlock, setForestBlock] = useState('');
  const [forestRange, setForestRange] = useState('');
  const [savingDesignation, setSavingDesignation] = useState(false);

  const [settingDob, setSettingDob] = useState(false);
  const [dobDay, setDobDay] = useState(1);
  const [dobMonth, setDobMonth] = useState(1);
  const [dobYear, setDobYear] = useState(DOB_YEARS[10]);
  const [savingDob, setSavingDob] = useState(false);

  const [uploadingPic, setUploadingPic] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState(null);

  useFocusEffect(
    useCallback(() => {
      secureStorage.getSalutation().then((s) => s && setSalutationState(s));
      refreshProfile().catch(() => {});
    }, [refreshProfile])
  );

  useEffect(() => {
    if (user) {
      setDesignation(user.designation || DESIGNATIONS[0]);
      setUsualTourStart(user.usualTourStart || '');
      setBeatName(user.beatName || '');
      setForestBlock(user.forestBlock || '');
      setForestRange(user.forestRange || '');
    }
  }, [user]);

  async function handleSalutationChange(value) {
    setSalutationState(value);
    await secureStorage.setSalutation(value);
  }

  function startEditName() {
    setNameDraft(user?.name || '');
    setEditingName(true);
    setError(null);
  }

  async function saveName() {
    if (!nameDraft.trim()) {
      setError('Name cannot be empty.');
      return;
    }
    setSavingName(true);
    setError(null);
    try {
      await updateName(nameDraft.trim());
      setEditingName(false);
    } catch (err) {
      // updateName is rate-limited server-side (2 changes / 20 days) — see
      // user.routes.js's changeNameLimiter — surface that message as-is.
      showErrorToast(err instanceof ApiError ? err.message : 'Unable to update your name.');
    } finally {
      setSavingName(false);
    }
  }

  function startEditDesignation() {
    setEditingDesignation(true);
    setError(null);
  }

  async function saveDesignation() {
    if (!usualTourStart.trim() || !beatName.trim() || !forestBlock.trim() || !forestRange.trim()) {
      setError('Please fill in all posting details.');
      return;
    }
    setSavingDesignation(true);
    setError(null);
    try {
      await updateDesignation({
        designation,
        usualTourStart: usualTourStart.trim(),
        beatName: beatName.trim(),
        forestBlock: forestBlock.trim(),
        forestRange: forestRange.trim(),
      });
      setEditingDesignation(false);
    } catch (err) {
      // Also rate-limited server-side (3 changes / 20 days).
      showErrorToast(err instanceof ApiError ? err.message : 'Unable to update your posting details.');
    } finally {
      setSavingDesignation(false);
    }
  }

  async function saveDob() {
    setSavingDob(true);
    setError(null);
    try {
      const maxDay = daysInMonth(dobMonth, dobYear);
      const dob = buildDateString(dobYear, dobMonth, Math.min(dobDay, maxDay));
      await updateDob(dob);
      setSettingDob(false);
    } catch (err) {
      // Backend rejects a second DOB write outright — see
      // user.controller.js: "if (user.dob) throw 400".
      showErrorToast(err instanceof ApiError ? err.message : 'Unable to save your date of birth.');
    } finally {
      setSavingDob(false);
    }
  }

  async function handlePickProfilePic() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Photo library access is needed to update your profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setUploadingPic(true);
    setError(null);
    try {
      await uploadProfilePic(result.assets[0].uri, 'image/jpeg');
    } catch (err) {
      showErrorToast(err instanceof ApiError ? err.message : 'Unable to upload your photo.');
    } finally {
      setUploadingPic(false);
    }
  }

  function handleRemoveProfilePic() {
    Alert.alert('Remove Photo', 'Remove your profile picture?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setUploadingPic(true);
          try {
            await removeProfilePic();
          } catch (err) {
            showErrorToast(err instanceof ApiError ? err.message : 'Unable to remove your photo.');
          } finally {
            setUploadingPic(false);
          }
        },
      },
    ]);
  }

  async function handleResendVerification() {
    setResending(true);
    setError(null);
    try {
      await authApi.resendVerificationEmail();
      Alert.alert('Sent', 'A verification email has been sent to your inbox.');
    } catch (err) {
      showErrorToast(err instanceof ApiError ? err.message : 'Unable to resend the verification email.');
    } finally {
      setResending(false);
    }
  }

  function handleLogout() {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => logout() },
    ]);
  }

  if (!user) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primaryText} />
      </View>
    );
  }

  const maxDay = daysInMonth(dobMonth, dobYear);
  const days = Array.from({ length: maxDay }, (_, i) => i + 1);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      {/* --- Header banner: avatar + name + designation --- */}
      <View style={styles.hero}>
        <TouchableOpacity onPress={handlePickProfilePic} disabled={uploadingPic} accessibilityRole="button">
          {user.profilepic?.url ? (
            <Image source={{ uri: user.profilepic.url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={40} color="#FFFFFF" />
            </View>
          )}
          <View style={styles.avatarEditBadge}>
            <Ionicons name="camera" size={14} color={COLORS.primary} />
          </View>
          {uploadingPic && (
            <View style={styles.avatarOverlay}>
              <ActivityIndicator color={COLORS.white} />
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.heroName}>{user.name}</Text>
        {!!user.designation && <Text style={styles.heroSubtitle}>{user.designation}</Text>}

        <View style={styles.avatarActionsRow}>
          <TouchableOpacity onPress={handlePickProfilePic} disabled={uploadingPic} accessibilityRole="button">
            <Text style={styles.avatarActionText}>Change Photo</Text>
          </TouchableOpacity>
          {user.profilepic?.url && (
            <TouchableOpacity onPress={handleRemoveProfilePic} disabled={uploadingPic} accessibilityRole="button">
              <Text style={[styles.avatarActionText, styles.avatarActionDanger]}>Remove</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* --- Name --- */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLabel}>
            <Ionicons name="person-outline" size={16} color={COLORS.textMuted} />
            <Text style={styles.sectionLabel}>Name</Text>
          </View>
          {!editingName && (
            <TouchableOpacity onPress={startEditName} accessibilityRole="button">
              <Text style={styles.editLink}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.saluteRow}>
          <View style={styles.saluteBorder}>
            <Picker selectedValue={salutation} onValueChange={handleSalutationChange} style={styles.salutePicker}>
              {SALUTATIONS.map((s) => (
                <Picker.Item key={s} label={s} value={s} />
              ))}
            </Picker>
          </View>
          {editingName ? (
            <TextInput
              style={[styles.input, styles.nameInput]}
              value={nameDraft}
              onChangeText={setNameDraft}
              maxLength={50}
              placeholder="Your name"
              placeholderTextColor={COLORS.textMuted}
            />
          ) : (
            <Text style={styles.valueText}>{user.name}</Text>
          )}
        </View>
        <Text style={styles.hint}>Title is a local display preference only — it isn't sent to the server.</Text>
        {editingName && (
          <View style={styles.inlineActions}>
            <TouchableOpacity style={styles.smallCancelButton} onPress={() => setEditingName(false)} disabled={savingName} accessibilityRole="button">
              <Text style={styles.smallCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.smallSaveButton} onPress={saveName} disabled={savingName} accessibilityRole="button">
              {savingName ? <ActivityIndicator color={COLORS.white} size="small" /> : <Text style={styles.smallSaveText}>Save</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* --- Email --- */}
      <View style={styles.card}>
        <View style={styles.cardHeaderLabel}>
          <Ionicons name="mail-outline" size={16} color={COLORS.textMuted} />
          <Text style={styles.sectionLabel}>Email</Text>
        </View>
        <Text style={styles.valueText}>{user.email}</Text>
        {user.isEmailVerified ? (
          <View style={styles.verifiedRow}>
            <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
            <Text style={styles.verifiedBadge}>Verified</Text>
          </View>
        ) : (
          <View style={styles.unverifiedRow}>
            <Text style={styles.unverifiedBadge}>Not verified</Text>
            <TouchableOpacity onPress={handleResendVerification} disabled={resending} accessibilityRole="button">
              <Text style={styles.editLink}>{resending ? 'Sending…' : 'Resend email'}</Text>
            </TouchableOpacity>
          </View>
        )}
        <TouchableOpacity onPress={() => navigation.navigate('ChangePassword')} accessibilityRole="button" style={styles.changePasswordRow}>
          <Ionicons name="lock-closed-outline" size={15} color={COLORS.primaryText} />
          <Text style={[styles.editLink, { marginLeft: SPACING.xs }]}>Change Password</Text>
        </TouchableOpacity>
      </View>

      {/* --- Posting details --- */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLabel}>
            <Ionicons name="briefcase-outline" size={16} color={COLORS.textMuted} />
            <Text style={styles.sectionLabel}>Posting Details</Text>
          </View>
          {!editingDesignation && (
            <TouchableOpacity onPress={startEditDesignation} accessibilityRole="button">
              <Text style={styles.editLink}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        {editingDesignation ? (
          <>
            <Text style={styles.fieldLabel}>Designation</Text>
            <View style={styles.pickerBorder}>
              <Picker selectedValue={designation} onValueChange={setDesignation} style={styles.picker}>
                {DESIGNATIONS.map((d) => (
                  <Picker.Item key={d} label={d} value={d} />
                ))}
              </Picker>
            </View>
            <Text style={styles.fieldLabel}>Usual Tour Start</Text>
            <TextInput style={styles.input} value={usualTourStart} onChangeText={setUsualTourStart} maxLength={50} placeholderTextColor={COLORS.textMuted} />
            <Text style={styles.fieldLabel}>Beat Name</Text>
            <TextInput style={styles.input} value={beatName} onChangeText={setBeatName} maxLength={50} placeholderTextColor={COLORS.textMuted} />
            <Text style={styles.fieldLabel}>Forest Block</Text>
            <TextInput style={styles.input} value={forestBlock} onChangeText={setForestBlock} maxLength={50} placeholderTextColor={COLORS.textMuted} />
            <Text style={styles.fieldLabel}>Forest Range</Text>
            <TextInput style={styles.input} value={forestRange} onChangeText={setForestRange} maxLength={50} placeholderTextColor={COLORS.textMuted} />
            <View style={styles.inlineActions}>
              <TouchableOpacity style={styles.smallCancelButton} onPress={() => setEditingDesignation(false)} disabled={savingDesignation} accessibilityRole="button">
                <Text style={styles.smallCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.smallSaveButton} onPress={saveDesignation} disabled={savingDesignation} accessibilityRole="button">
                {savingDesignation ? <ActivityIndicator color={COLORS.white} size="small" /> : <Text style={styles.smallSaveText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <SummaryRow label="Designation" value={user.designation} />
            <SummaryRow label="Usual Tour Start" value={user.usualTourStart} />
            <SummaryRow label="Beat Name" value={user.beatName} />
            <SummaryRow label="Forest Block" value={user.forestBlock} />
            <SummaryRow label="Forest Range" value={user.forestRange} last />
          </>
        )}
      </View>

      {/* --- DOB (settable once) --- */}
      <View style={styles.card}>
        <View style={styles.cardHeaderLabel}>
          <Ionicons name="calendar-outline" size={16} color={COLORS.textMuted} />
          <Text style={styles.sectionLabel}>Date of Birth</Text>
        </View>
        {user.dob ? (
          <>
            <Text style={styles.valueText}>{formatDisplayDate(user.dob.split('T')[0])}</Text>
            <Text style={styles.hint}>This can only be set once. Contact support if it needs to change.</Text>
          </>
        ) : settingDob ? (
          <>
            <View style={styles.dobRow}>
              <View style={styles.dobCol}>
                <View style={styles.pickerBorder}>
                  <Picker selectedValue={dobDay} onValueChange={setDobDay} style={styles.picker}>
                    {days.map((d) => (
                      <Picker.Item key={d} label={String(d)} value={d} />
                    ))}
                  </Picker>
                </View>
              </View>
              <View style={styles.dobColWide}>
                <View style={styles.pickerBorder}>
                  <Picker selectedValue={dobMonth} onValueChange={setDobMonth} style={styles.picker}>
                    {DOB_MONTHS.map((m) => (
                      <Picker.Item key={m} label={getMonthName(m)} value={m} />
                    ))}
                  </Picker>
                </View>
              </View>
              <View style={styles.dobCol}>
                <View style={styles.pickerBorder}>
                  <Picker selectedValue={dobYear} onValueChange={setDobYear} style={styles.picker}>
                    {DOB_YEARS.map((y) => (
                      <Picker.Item key={y} label={String(y)} value={y} />
                    ))}
                  </Picker>
                </View>
              </View>
            </View>
            <View style={styles.inlineActions}>
              <TouchableOpacity style={styles.smallCancelButton} onPress={() => setSettingDob(false)} disabled={savingDob} accessibilityRole="button">
                <Text style={styles.smallCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.smallSaveButton} onPress={saveDob} disabled={savingDob} accessibilityRole="button">
                {savingDob ? <ActivityIndicator color={COLORS.white} size="small" /> : <Text style={styles.smallSaveText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <TouchableOpacity onPress={() => setSettingDob(true)} accessibilityRole="button">
            <Text style={styles.editLink}>Set Date of Birth</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* --- Subscription --- */}
      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Subscription')} accessibilityRole="button">
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLabel}>
            <Ionicons name="diamond-outline" size={16} color={COLORS.textMuted} />
            <Text style={styles.sectionLabel}>Subscription</Text>
          </View>
          <View style={styles.manageRow}>
            <Text style={styles.editLink}>Manage</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.primaryText} />
          </View>
        </View>
        <View style={[styles.subStatusPill, subscriptionActive ? styles.subStatusPillActive : styles.subStatusPillInactive]}>
          <Text style={[styles.subStatus, subscriptionActive ? styles.subStatusActive : styles.subStatusInactive]}>
            {subscriptionActive ? 'Active' : 'Inactive — diary entries are read-only'}
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} accessibilityRole="button">
        <Ionicons name="log-out-outline" size={18} color={COLORS.dangerText} />
        <Text style={styles.logoutButtonText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function SummaryRow({ label, value, last }) {
  return (
    <View style={[styles.summaryRow, last && styles.summaryRowLast]}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value || 'Not set'}</Text>
    </View>
  );
}

const AVATAR_SIZE = 96;

const styles = StyleSheet.create({
  screen: { backgroundColor: COLORS.background },
  container: { paddingBottom: SPACING.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },

  hero: {
    backgroundColor: COLORS.header,
    alignItems: 'center',
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    borderBottomLeftRadius: RADIUS.lg,
    borderBottomRightRadius: RADIUS.lg,
  },
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, borderWidth: 3, borderColor: 'rgba(255,255,255,0.35)' },
  avatarPlaceholder: { backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  avatarEditBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.header,
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroName: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.white, marginTop: SPACING.md },
  heroSubtitle: { fontSize: FONT_SIZE.base, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  avatarActionsRow: { flexDirection: 'row', gap: SPACING.lg, marginTop: SPACING.md },
  avatarActionText: { color: COLORS.white, fontWeight: '600', fontSize: FONT_SIZE.sm, textDecorationLine: 'underline' },
  avatarActionDanger: { color: '#F4B3AD' },

  errorText: { color: COLORS.dangerText, marginTop: SPACING.md, marginHorizontal: SPACING.lg, textAlign: 'center' },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginTop: SPACING.md,
    marginHorizontal: SPACING.lg,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 1 },
    }),
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardHeaderLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  manageRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  editLink: { color: COLORS.primaryText, fontWeight: '700', fontSize: FONT_SIZE.sm },
  valueText: { fontSize: FONT_SIZE.md, color: COLORS.textPrimary, marginTop: SPACING.xs },
  hint: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginTop: SPACING.xs, lineHeight: 18 },
  saluteRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.xs },
  saluteBorder: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, backgroundColor: COLORS.surface, width: 110, overflow: 'hidden' },
  salutePicker: { height: Platform.OS === 'ios' ? 100 : 50, color: COLORS.textPrimary },
  nameInput: { flex: 1, marginTop: 0 },
  fieldLabel: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: SPACING.md, fontWeight: '600' },
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
  dobRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs },
  dobCol: { flex: 1 },
  dobColWide: { flex: 1.4 },
  inlineActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.sm, marginTop: SPACING.md },
  smallCancelButton: { minHeight: TOUCH_TARGET_MIN, justifyContent: 'center', paddingHorizontal: SPACING.md },
  smallCancelText: { color: COLORS.textSecondary, fontWeight: '600' },
  smallSaveButton: {
    minHeight: TOUCH_TARGET_MIN,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
  },
  smallSaveText: { color: COLORS.white, fontWeight: '700' },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: SPACING.xs },
  verifiedBadge: { color: COLORS.success, fontWeight: '700', fontSize: FONT_SIZE.sm },
  unverifiedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.xs },
  unverifiedBadge: { color: COLORS.dangerText, fontWeight: '700', fontSize: FONT_SIZE.sm },
  changePasswordRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.md },
  summaryRow: { paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  summaryRowLast: { borderBottomWidth: 0 },
  summaryLabel: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, fontWeight: '600' },
  summaryValue: { fontSize: FONT_SIZE.md, color: COLORS.textPrimary, marginTop: 4 },
  subStatusPill: {
    alignSelf: 'flex-start',
    borderRadius: RADIUS.sm,
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
    marginTop: SPACING.sm,
  },
  subStatusPillActive: { backgroundColor: COLORS.successBg },
  subStatusPillInactive: { backgroundColor: COLORS.dangerBg },
  subStatus: { fontSize: FONT_SIZE.sm, fontWeight: '700' },
  subStatusActive: { color: COLORS.success },
  subStatusInactive: { color: COLORS.dangerText },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.lg,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
    borderRadius: RADIUS.md,
    minHeight: TOUCH_TARGET_MIN,
    borderWidth: 1.5,
    borderColor: COLORS.danger,
  },
  logoutButtonText: { color: COLORS.dangerText, fontWeight: '700', fontSize: FONT_SIZE.base },
});
