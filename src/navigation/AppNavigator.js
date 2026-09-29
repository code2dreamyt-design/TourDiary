import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as ExpoLinking from 'expo-linking';
import MainTabNavigator from './MainTabNavigator';
import PhotoDetailsFormScreen from '../screens/PhotoDetailsFormScreen';
import SubscriptionScreen from '../screens/SubscriptionScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import ProfileScreen from '../screens/ProfileScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import VerifyEmailScreen from '../screens/auth/VerifyEmailScreen';
import DesignationSetupScreen from '../screens/auth/DesignationSetupScreen';
import ProfilePicSetupScreen from '../screens/auth/ProfilePicSetupScreen';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../constants/colors';
import { APP_SCHEME } from '../config/api';

const Stack = createNativeStackNavigator();

// Deep-link routing. Both forms are accepted:
//   forestapp://verify-email/TOKEN            (custom scheme, always works once the app is installed)
//   https://forestapp-backend.onrender.com/verify-email/TOKEN  (only if the backend's domain is
//     later registered as a verified Universal/App Link — see deeplink.controller.js on the backend
//     for why the https link exists at all: it's the email-safe bridge into the custom scheme above)
const linking = {
  prefixes: [ExpoLinking.createURL('/'), `${APP_SCHEME}://`],
  config: {
    screens: {
      VerifyEmail: 'verify-email/:token',
      ResetPassword: 'reset-password/:token',
    },
  },
};

// Dark navigation theme: without it, React Navigation paints its default
// LIGHT background behind every screen (visible as white flashes during
// transitions and when a list overscrolls).
const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: COLORS.primaryText,
    background: COLORS.background,
    card: COLORS.header,
    text: COLORS.white,
    border: COLORS.border,
    notification: COLORS.danger,
  },
};

const screenOptions = {
  headerStyle: { backgroundColor: COLORS.header },
  headerTintColor: COLORS.white,
  headerTitleStyle: { fontWeight: '700' },
};

export default function AppNavigator() {
  const { booting, isAuthenticated, needsDesignationSetup, showProfilePicPrompt } = useAuth();

  if (booting) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primaryText} />
      </View>
    );
  }

  return (
    <NavigationContainer linking={linking} theme={navTheme}>
      <Stack.Navigator screenOptions={screenOptions}>
        {!isAuthenticated ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Signup" component={SignupScreen} options={{ title: 'Create Account' }} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Forgot Password' }} />
          </>
        ) : needsDesignationSetup ? (
          <Stack.Screen
            name="DesignationSetup"
            component={DesignationSetupScreen}
            options={{ title: 'Your Details', headerLeft: () => null, gestureEnabled: false }}
          />
        ) : showProfilePicPrompt ? (
          <Stack.Screen name="ProfilePicSetup" component={ProfilePicSetupScreen} options={{ headerShown: false, gestureEnabled: false }} />
        ) : (
          <>
            <Stack.Screen
              name="MainTabs"
              component={MainTabNavigator}
              // Without this, the Stack's transition container defaults to
              // white. The Camera tab paints its own black background, but
              // only *after* it renders — so on the pop transition back from
              // PhotoDetailsForm (a light screen), this white container is
              // what's actually visible for a frame or two first, showing up
              // as a rapid white blink. Black here removes that gap.
              options={{ headerShown: false, contentStyle: { backgroundColor: '#000' } }}
            />
            <Stack.Screen name="PhotoDetailsForm" component={PhotoDetailsFormScreen} options={{ title: 'Save Photo' }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'My Profile' }} />
            <Stack.Screen name="Subscription" component={SubscriptionScreen} options={{ title: 'Subscription' }} />
            <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Change Password' }} />
          </>
        )}

        {/* Always reachable regardless of auth state — these are the
            targets of the emailed deep links (see `linking` above) and can
            legitimately arrive whether the user is logged in or not. */}
        <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} options={{ title: 'Verify Email' }} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ title: 'Reset Password' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
