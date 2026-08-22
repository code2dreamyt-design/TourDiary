import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeStackNavigator from './HomeStackNavigator';
import MyDiariesStackNavigator from './MyDiariesStackNavigator';
import CameraCaptureScreen from '../screens/CameraCaptureScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';
import AppTabBar from '../components/AppTabBar';
import { COLORS } from '../constants/colors';

const Tab = createBottomTabNavigator();

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <AppTabBar {...props} />}
    >
      <Tab.Screen name="Home" component={HomeStackNavigator} />
      <Tab.Screen name="MyDiaries" component={MyDiariesStackNavigator} />
      <Tab.Screen
        name="Camera"
        component={CameraCaptureScreen}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileSetupScreen}
        initialParams={{ mode: 'edit' }}
        options={{
          headerShown: true,
          title: 'My Profile',
          headerStyle: { backgroundColor: COLORS.primary },
          headerTintColor: COLORS.white,
          headerTitleStyle: { fontWeight: '700' },
        }}
      />
    </Tab.Navigator>
  );
}
