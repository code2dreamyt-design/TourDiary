import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../api/client';
import PasswordInput from '../../components/PasswordInput';
import { COLORS } from '../../constants/colors';
import { SPACING, RADIUS, FONT_SIZE, TOUCH_TARGET_MIN } from '../../constants/dimensions';

export default function SignupScreen({ navigation }) {
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  async function handleSignup() {
    setError(null);
    setFieldErrors({});
    if (!name.trim() || !email.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setSubmitting(true);
    try {
      await signup(name.trim(), email.trim(), password);
      // On success, isAuthenticated flips true and AppNavigator routes to
      // DesignationSetup automatically (profileCompleted starts false).
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'Unable to create your account. Please try again.');
        if (err.errors) setFieldErrors(err.errors);
      } else {
        setError('Unable to create your account. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Set up your Forest App account.</Text>

        <Text style={styles.fieldLabel}>Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
        maxLength={50}
          placeholder="e.g. Ramesh Kumar"
          placeholderTextColor={COLORS.textMuted}
        />
        {fieldErrors.name ? <Text style={styles.fieldError}>{fieldErrors.name[0]}</Text> : null}

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
        {fieldErrors.email ? <Text style={styles.fieldError}>{fieldErrors.email[0]}</Text> : null}

        <Text style={styles.fieldLabel}>Password</Text>
        <PasswordInput
          value={password}
          onChangeText={setPassword}
          placeholder="At least 8 characters"
          autoComplete="password-new"
        />
        {fieldErrors.password ? <Text style={styles.fieldError}>{fieldErrors.password[0]}</Text> : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity style={styles.primaryButton} onPress={handleSignup} disabled={submitting} accessibilityRole="button">
          {submitting ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryButtonText}>Create Account</Text>}
        </TouchableOpacity>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')} accessibilityRole="button">
            <Text style={styles.footerLink}>Log in</Text>
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
  fieldError: { color: COLORS.danger, fontSize: FONT_SIZE.sm, marginTop: 4 },
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
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.lg },
  footerText: { color: COLORS.textSecondary },
  footerLink: { color: COLORS.primary, fontWeight: '700' },
});
