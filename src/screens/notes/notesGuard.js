import { Alert } from 'react-native';
import * as notesService from '../../services/notesService';

// "Subscription required" UX for the Notes screens — same wording and
// Subscribe -> 'Subscription' screen flow the diary and TD calculator use.

export function showLockedAlert(navigation, reason, message) {
  const subscriptionIssue = reason === 'EXPIRED' || reason === 'NO_ENTITLEMENT';
  if (!subscriptionIssue) {
    Alert.alert('Unavailable', message);
    return;
  }
  Alert.alert('Subscription Required', message, [
    { text: 'Not Now', style: 'cancel' },
    { text: 'Subscribe', onPress: () => navigation.navigate('Subscription') },
  ]);
}

/**
 * Early check before the user starts creating / editing. Returns true if
 * allowed; otherwise shows the alert and returns false. notesService re-checks
 * on the actual write, so this is for feedback, not the only line of defence.
 */
export async function requireWriteAccess(navigation) {
  try {
    const access = await notesService.checkWriteAccess();
    if (access.allowed) return true;
    showLockedAlert(navigation, access.reason, access.message);
    return false;
  } catch (e) {
    Alert.alert('Something went wrong', 'Unable to check your subscription. Please try again.');
    return false;
  }
}

/** Shared handling for errors thrown by notesService on a save/delete. */
export function handleSaveError(navigation, e, fallbackMessage) {
  if (e && e.code === 'WRITE_LOCKED') showLockedAlert(navigation, e.reason, e.message);
  else if (e && e.code === 'VALIDATION') Alert.alert('Check the details', e.message);
  else Alert.alert('Something went wrong', fallbackMessage || 'Unable to save. Please try again.');
}

/** Tell the user when notifications could not be set up. Silent when everything is fine. */
export function explainNotifyStatus(status, openSettings) {
  if (status === 'NO_PERMISSION') {
    Alert.alert(
      'Notifications are off',
      'Your reminder is saved, but Forest App is not allowed to send notifications, so you will not be alerted. Turn them on in your phone settings.',
      [{ text: 'Not Now', style: 'cancel' }, { text: 'Open Settings', onPress: openSettings }]
    );
  }
}
