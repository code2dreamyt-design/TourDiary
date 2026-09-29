import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import * as authApi from '../../api/authApi';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/colors';
import { SPACING, RADIUS, FONT_SIZE, TOUCH_TARGET_MIN } from '../../constants/dimensions';

export default function VerifyEmailScreen({ route, navigation }) {
  const { isAuthenticated, refreshProfile } = useAuth();
  const token = route.params?.token;
  const [status, setStatus] = useState('verifying'); // 'verifying' | 'success' | 'error'
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      if (!token) {
        setStatus('error');
        setMessage('This verification link is invalid.');
        return;
      }
      try {
        await authApi.verifyEmail(token);
        if (!active) return;
        setStatus('success');
        // If already logged in on this device, refresh the cached user so
        // isEmailVerified flips true immediately in the UI.
        if (isAuthenticated) refreshProfile().catch(() => {});
      } catch (err) {
        if (!active) return;
        setStatus('error');
        setMessage(err instanceof ApiError ? err.message : 'This link is invalid or has expired.');
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  function handleContinue() {
    if (isAuthenticated) {
      navigation.getParent()?.navigate('MainTabs') ?? navigation.navigate('MainTabs');
    } else {
      navigation.navigate('Login');
    }
  }

  return (
    <View style={styles.center}>
      {status === 'verifying' && (
        <>
          <ActivityIndicator size="large" color={COLORS.primaryText} />
          <Text style={styles.text}>Verifying your email…</Text>
        </>
      )}
      {status === 'success' && (
        <>
          <Text style={styles.title}>Email verified</Text>
          <Text style={styles.text}>Your email address has been confirmed.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={handleContinue} accessibilityRole="button">
            <Text style={styles.primaryButtonText}>Continue</Text>
          </TouchableOpacity>
        </>
      )}
      {status === 'error' && (
        <>
          <Text style={styles.title}>Verification failed</Text>
          <Text style={styles.text}>{message}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={handleContinue} accessibilityRole="button">
            <Text style={styles.primaryButtonText}>{isAuthenticated ? 'Back to App' : 'Go to Login'}</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background, padding: SPACING.xl },
  title: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  text: { fontSize: FONT_SIZE.base, color: COLORS.textSecondary, textAlign: 'center', marginTop: SPACING.md, lineHeight: 21 },
  primaryButton: {
    marginTop: SPACING.xl,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    minHeight: TOUCH_TARGET_MIN,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: COLORS.white, fontWeight: '700', fontSize: FONT_SIZE.base },
});
