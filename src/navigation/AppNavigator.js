import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import CurrentDiaryScreen from '../screens/CurrentDiaryScreen';
import CreateDiaryScreen from '../screens/CreateDiaryScreen';
import MyDiariesScreen from '../screens/MyDiariesScreen';
import DiaryDetailsScreen from '../screens/DiaryDetailsScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';
import { COLORS } from '../constants/colors';

const Stack = createNativeStackNavigator();

export default function AppNavigator({ initialRouteName = 'Home' }) {
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
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Tour Diary' }} />
        <Stack.Screen name="CurrentDiary" component={CurrentDiaryScreen} options={{ title: 'Current Diary' }} />
        <Stack.Screen name="CreateDiary" component={CreateDiaryScreen} options={{ title: 'Create Full Diary' }} />
        <Stack.Screen name="MyDiaries" component={MyDiariesScreen} options={{ title: 'My Diaries' }} />
        <Stack.Screen name="DiaryDetails" component={DiaryDetailsScreen} options={{ title: 'Diary' }} />
        <Stack.Screen
          name="ProfileSetup"
          component={ProfileSetupScreen}
          options={{ title: 'Set Up Your Profile' }}
          initialParams={{ mode: initialRouteName === 'ProfileSetup' ? 'setup' : 'edit' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
