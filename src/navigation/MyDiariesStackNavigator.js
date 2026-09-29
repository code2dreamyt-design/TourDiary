import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MyDiariesScreen from '../screens/MyDiariesScreen';
import CreateDiaryScreen from '../screens/CreateDiaryScreen';
import DiaryDetailsScreen from '../screens/DiaryDetailsScreen';
import HeaderAvatar from '../components/HeaderAvatar';
import { COLORS } from '../constants/colors';

const Stack = createNativeStackNavigator();

export default function MyDiariesStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.header },
        headerTintColor: COLORS.white,
        headerTitleStyle: { fontWeight: '700' },
        // Default for every screen in this stack — MyDiariesScreen adds
        // this alongside its own New/Select buttons (see that screen's
        // setOptions call); DiaryDetailsScreen overrides it entirely with
        // its own Delete button, same as it already did before.
        headerRight: () => <HeaderAvatar />,
      }}
    >
      <Stack.Screen name="MyDiariesMain" component={MyDiariesScreen} options={{ title: 'My Diaries' }} />
      <Stack.Screen name="CreateDiary" component={CreateDiaryScreen} options={{ title: 'Create Full Diary' }} />
      <Stack.Screen name="DiaryDetails" component={DiaryDetailsScreen} options={{ title: 'Diary' }} />
    </Stack.Navigator>
  );
}
