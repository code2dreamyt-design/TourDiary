import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import NotesHomeScreen from '../screens/notes/NotesHomeScreen';
import SimpleNoteScreen from '../screens/notes/SimpleNoteScreen';
import ObservationScreen from '../screens/notes/ObservationScreen';
import ReminderScreen from '../screens/notes/ReminderScreen';
import NotesSettingsScreen from '../screens/notes/NotesSettingsScreen';
import NotesCameraScreen from '../screens/notes/NotesCameraScreen';
import NotesBootstrap from '../components/notes/NotesBootstrap';
import HeaderAvatar from '../components/HeaderAvatar';
import { withTrialBanner } from '../components/TrialOfferBanner';
import { COLORS } from '../constants/colors';

const Stack = createNativeStackNavigator();
const NotesHomeWithBanner = withTrialBanner(NotesHomeScreen);

// The Notebook tab: simple notes, observations (with photos) and reminders, plus
// the diary-reminder settings and a GPS-stamped camera for observation photos.
export default function NotesStackNavigator() {
  return (
    <>
      <NotesBootstrap />
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.header },
          headerTintColor: COLORS.white,
          headerTitleStyle: { fontWeight: '700' },
          headerRight: () => <HeaderAvatar />,
        }}
      >
        <Stack.Screen name="NotesHome" component={NotesHomeWithBanner} options={{ title: 'Notebook' }} />
        <Stack.Screen name="SimpleNote" component={SimpleNoteScreen} options={{ title: 'Note' }} />
        <Stack.Screen name="Observation" component={ObservationScreen} options={{ title: 'Observation' }} />
        <Stack.Screen name="Reminder" component={ReminderScreen} options={{ title: 'Reminder' }} />
        <Stack.Screen name="NotesSettings" component={NotesSettingsScreen} options={{ title: 'Reminder Settings' }} />
        {/* Full-screen over everything (including the tab bar), like the main Camera tab. */}
        <Stack.Screen
          name="NotesCamera"
          component={NotesCameraScreen}
          options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'slide_from_bottom', contentStyle: { backgroundColor: '#000' } }}
        />
      </Stack.Navigator>
    </>
  );
}
