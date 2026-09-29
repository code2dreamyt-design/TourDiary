import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { SPACING, FONT_SIZE } from '../constants/dimensions';

// Placeholder behind the "TD" tab. In normal use this is never actually
// seen — AppTabBar intercepts the tab press and shows a toast instead of
// navigating here (see AppTabBar.js's goTo). This still exists as a safe
// fallback so the tab has a real screen to point at, not a functioning
// feature yet.
export default function TDPlaceholderScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name="calculator-outline" size={30} color={COLORS.primary} />
      </View>
      <Text style={styles.title}>TD Calculator</Text>
      <Text style={styles.subtitle}>Coming soon.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background, padding: SPACING.xl },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  title: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.textPrimary },
  subtitle: { fontSize: FONT_SIZE.base, color: COLORS.textMuted, marginTop: SPACING.xs },
});
