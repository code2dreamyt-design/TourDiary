import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import DiaryDetailsScreen from '../screens/DiaryDetailsScreen';
import { COLORS } from '../constants/colors';

const Stack = createNativeStackNavigator();

export default function HomeStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.primary },
        headerTintColor: COLORS.white,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="HomeMain" component={HomeScreen} options={{ title: 'Tour Diary' }} />
      <Stack.Screen name="DiaryDetails" component={DiaryDetailsScreen} options={{ title: 'Diary' }} />
    </Stack.Navigator>
  );
}
