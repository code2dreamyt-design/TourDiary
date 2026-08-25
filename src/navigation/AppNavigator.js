import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MainTabNavigator from './MainTabNavigator';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';
import PhotoDetailsFormScreen from '../screens/PhotoDetailsFormScreen';
import { COLORS } from '../constants/colors';

const Stack = createNativeStackNavigator();

export default function AppNavigator({ initialRouteName = 'MainTabs' }) {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.primary },
          headerTintColor: COLORS.white,
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
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
        <Stack.Screen
          name="ProfileSetup"
          component={ProfileSetupScreen}
          options={{ title: 'Set Up Your Profile' }}
          initialParams={{ mode: 'setup' }}
        />
        <Stack.Screen
          name="PhotoDetailsForm"
          component={PhotoDetailsFormScreen}
          options={{ title: 'Save Photo' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

