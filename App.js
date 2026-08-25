import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import ToastHost from './src/components/Toast';
import { runMigrations } from './src/database/migrations';
import * as profileService from './src/services/profileService';
import { COLORS } from './src/constants/colors';

export default function App() {
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState(null);
  const [initialRoute, setInitialRoute] = useState('MainTabs');

  useEffect(() => {
    (async () => {
      try {
        await runMigrations();
        const profileComplete = await profileService.hasProfile();
        setInitialRoute(profileComplete ? 'MainTabs' : 'ProfileSetup');
        setReady(true);
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

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AppNavigator initialRouteName={initialRoute} />
      <ToastHost />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F8F6', padding: 24 },
  errorText: { color: '#B3261E', fontSize: 16, textAlign: 'center' },
});
