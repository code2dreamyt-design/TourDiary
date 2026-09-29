import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import DiaryDetailsScreen from '../screens/DiaryDetailsScreen';
import HeaderAvatar from '../components/HeaderAvatar';
import { COLORS } from '../constants/colors';

const Stack = createNativeStackNavigator();

export default function HomeStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.header },
        headerTintColor: COLORS.white,
        headerTitleStyle: { fontWeight: '700' },
        // Default for every screen in this stack — DiaryDetailsScreen
        // overrides this with its own Delete button via setOptions, same
        // as it already did before this avatar existed.
        headerRight: () => <HeaderAvatar />,
      }}
    >
      <Stack.Screen name="HomeMain" component={HomeScreen} options={{ title: 'Tour Diary' }} />
      <Stack.Screen name="DiaryDetails" component={DiaryDetailsScreen} options={{ title: 'Diary' }} />
    </Stack.Navigator>
  );
}
