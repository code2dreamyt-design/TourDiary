import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MyDiariesScreen from '../screens/MyDiariesScreen';
import CreateDiaryScreen from '../screens/CreateDiaryScreen';
import DiaryDetailsScreen from '../screens/DiaryDetailsScreen';
import { COLORS } from '../constants/colors';

const Stack = createNativeStackNavigator();

export default function MyDiariesStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.primary },
        headerTintColor: COLORS.white,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="MyDiariesMain" component={MyDiariesScreen} options={{ title: 'My Diaries' }} />
      <Stack.Screen name="CreateDiary" component={CreateDiaryScreen} options={{ title: 'Create Full Diary' }} />
      <Stack.Screen name="DiaryDetails" component={DiaryDetailsScreen} options={{ title: 'Diary' }} />
    </Stack.Navigator>
  );
}
