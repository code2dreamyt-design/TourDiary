import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../../context/AuthContext';
import * as scheduler from '../../services/reminderScheduler';

// Renders nothing. Mounted once (inside the Notes tab, which is not lazy) while
// the user is signed in, and does three jobs:
//   1. sets up notification channels / foreground behaviour,
//   2. keeps the phone's scheduled alerts in step with the saved reminders —
//      on start, whenever the app comes back to the front or goes to the
//      background (so filling today's diary then leaving cancels today's diary
//      nudge), and whenever the subscription turns on or off, and
//   3. opens the right screen when the user taps a notification.

let lastHandled = null; // survives re-mounts so one tap never navigates twice

export default function NotesBootstrap() {
  const navigation = useNavigation();
  const { subscriptionActive } = useAuth();
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    scheduler.setupNotifications().catch(() => {});
  }, []);

  useEffect(() => {
    scheduler.syncAll();
  }, [subscriptionActive]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' || state === 'background') scheduler.syncAll();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!response || !response.notification) return;
    const key = `${response.notification.request.identifier}:${response.notification.date}`;
    if (lastHandled === key) return;
    lastHandled = key;
    const data = (response.notification.request.content && response.notification.request.content.data) || {};
    if (data.type === 'reminder' && data.noteId) {
      navigation.navigate('Notes', { screen: 'Reminder', params: { noteId: data.noteId, fromNotification: true }, initial: false });
    } else if (data.type === 'diary') {
      navigation.navigate('Home');
    }
  }, [response, navigation]);

  return null;
}
