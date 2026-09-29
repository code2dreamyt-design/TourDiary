import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import * as authApi from '../../api/authApi';
import * as secureStorage from '../../storage/secureStorage';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/colors';
import { SPACING, RADIUS, FONT_SIZE, TOUCH_TARGET_MIN } from '../../constants/dimensions';

// Reached two ways: tapping the emailed deep link (forestapp://reset-password/:token
// — see AppNavigator's linking config), which can happen whether or not the
// user is currently logged in on this device. Either way, a successful
// reset revokes ALL sessions server-side (see resetPassword in
// auth.controller.js), so this screen always ends by clearing local
// tokens too and sending the user to Login with their new password.
export default function ResetPasswordScreen({ route, navigation }) {
  const { logout } = useAuth();
  const token = route.params?.token;

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!token) {
      setError('This reset link is invalid. Please request a new one.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await authApi.resetPassword(token, newPassword);
      // Clear any local session — the server just invalidated it anyway.
      await secureStorage.clearTokens();
      await secureStorage.setCachedUser(null);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to reset your password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <View style={styles.center}>
        <Text style={styles.sentTitle}>Password changed</Text>
        <Text style={styles.sentText}>You can now log in with your new password.</Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={async () => {
            await logout().catch(() => {});
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
          }}
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonText}>Go to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Set a new password</Text>

      <Text style={styles.fieldLabel}>New Password</Text>
      <TextInput
        style={styles.input}
        value={newPassword}
        onChangeText={setNewPassword}
        placeholder="At least 8 characters"
        placeholderTextColor={COLORS.textMuted}
        secureTextEntry
      />

      <Text style={styles.fieldLabel}>Confirm Password</Text>
      <TextInput
        style={styles.input}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Re-enter password"
        placeholderTextColor={COLORS.textMuted}
        secureTextEntry
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit} disabled={submitting} accessibilityRole="button">
        {submitting ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryButtonText}>Reset Password</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: SPACING.xl, backgroundColor: COLORS.background, justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background, padding: SPACING.xl },
  title: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.primary, textAlign: 'center', marginBottom: SPACING.xl },
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
  errorText: { color: COLORS.danger, marginTop: SPACING.md, fontSize: FONT_SIZE.base },
  primaryButton: {
    marginTop: SPACING.xl,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    minHeight: TOUCH_TARGET_MIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: COLORS.white, fontWeight: '700', fontSize: FONT_SIZE.base },
  sentTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.md },
  sentText: { fontSize: FONT_SIZE.base, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 21 },
});
