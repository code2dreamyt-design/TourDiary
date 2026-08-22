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
        <Stack.Screen name="MainTabs" component={MainTabNavigator} options={{ headerShown: false }} />
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

