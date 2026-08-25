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
        // Same white-container gap as the Stack's contentStyle fix (see
        // AppNavigator) but for the tab-switch container underneath the
        // Camera scene specifically — only this tab needs it since Home /
        // MyDiaries / Profile all use the app's light background.
        options={{ headerShown: false, sceneStyle: { backgroundColor: '#000' } }}
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
