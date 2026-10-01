import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import ToastHost from './src/components/Toast';
import { runMigrations } from './src/database/migrations';
import { AuthProvider } from './src/context/AuthContext';
import { COLORS } from './src/constants/colors';

export default function App() {
  // This only gates the LOCAL diary database (SQLite) being ready — auth,
  // profile, and subscription state are handled separately by
  // AuthProvider/AppNavigator, which have their own "booting" state so
  // each concern's async startup work doesn't block the other.
  const [dbReady, setDbReady] = useState(false);
  const [initError, setInitError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        await runMigrations();
        setDbReady(true);
      } catch (e) {
        setInitError('Unable to start the app database. Please restart the app.');
      }
    })();
  }, []);

  if (initError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{initError}</Text>
      </View>
    );
  }

  if (!dbReady) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primaryText} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
      <ToastHost />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background, padding: 24 },
  errorText: { color: COLORS.dangerText, fontSize: 16, textAlign: 'center' },
});
