import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../api/client';
import PasswordInput from '../../components/PasswordInput';
import { COLORS } from '../../constants/colors';
import { SPACING, RADIUS, FONT_SIZE, TOUCH_TARGET_MIN } from '../../constants/dimensions';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password);
      // Navigation reacts to isAuthenticated automatically — see AppNavigator.
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'Unable to log in. Please try again.');
      } else {
        setError('Unable to log in. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Forest App</Text>
        <Text style={styles.subtitle}>Log in to continue your tour diary.</Text>

        <Text style={styles.fieldLabel}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={COLORS.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />

        <Text style={styles.fieldLabel}>Password</Text>
        <PasswordInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          autoComplete="password"
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity style={styles.primaryButton} onPress={handleLogin} disabled={submitting} accessibilityRole="button">
          {submitting ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryButtonText}>Log In</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => navigation.navigate('ForgotPassword')}
          accessibilityRole="button"
        >
          <Text style={styles.linkText}>Forgot password?</Text>
        </TouchableOpacity>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Signup')} accessibilityRole="button">
            <Text style={styles.footerLink}>Sign up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: SPACING.xl, backgroundColor: COLORS.background, justifyContent: 'center' },
  title: { fontSize: FONT_SIZE.xxl, fontWeight: '800', color: COLORS.primary, textAlign: 'center' },
  subtitle: { fontSize: FONT_SIZE.base, color: COLORS.textSecondary, textAlign: 'center', marginTop: SPACING.sm, marginBottom: SPACING.xl },
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
  linkButton: { marginTop: SPACING.lg, alignItems: 'center', minHeight: TOUCH_TARGET_MIN, justifyContent: 'center' },
  linkText: { color: COLORS.primary, fontWeight: '600' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.md },
  footerText: { color: COLORS.textSecondary },
  footerLink: { color: COLORS.primary, fontWeight: '700' },
});
