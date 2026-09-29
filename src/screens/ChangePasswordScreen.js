import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Alert } from 'react-native';
import * as authApi from '../api/authApi';
import { ApiError } from '../api/client';
import PasswordInput from '../components/PasswordInput';
import { showErrorToast } from '../components/Toast';
import { COLORS } from '../constants/colors';
import { SPACING, RADIUS, FONT_SIZE, TOUCH_TARGET_MIN } from '../constants/dimensions';

export default function ChangePasswordScreen({ navigation }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit() {
    setError(null);
    if (!currentPassword || newPassword.length < 8) {
      setError('Enter your current password and a new password of at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      Alert.alert('Password Changed', 'Your password has been updated.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      showErrorToast(err instanceof ApiError ? err.message : 'Unable to change your password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.fieldLabel}>Current Password</Text>
      <PasswordInput value={currentPassword} onChangeText={setCurrentPassword} />

      <Text style={styles.fieldLabel}>New Password</Text>
      <PasswordInput value={newPassword} onChangeText={setNewPassword} placeholder="At least 8 characters" />

      <Text style={styles.fieldLabel}>Confirm New Password</Text>
      <PasswordInput value={confirmPassword} onChangeText={setConfirmPassword} />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TouchableOpacity style={styles.saveButton} onPress={handleSubmit} disabled={submitting} accessibilityRole="button">
        {submitting ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.saveButtonText}>Change Password</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: SPACING.lg, backgroundColor: COLORS.background, flexGrow: 1 },
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
  errorText: { color: COLORS.dangerText, marginTop: SPACING.md },
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
