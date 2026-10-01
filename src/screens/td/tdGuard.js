import { Alert } from 'react-native';
import * as tdService from '../../services/tdService';

// Shared "subscription required" UX for the TD screens — same wording and
// Subscribe -> 'Subscription' screen flow the diary uses (see DiaryDetailsScreen).

/** Shows the locked message; only offers "Subscribe" when a subscription is actually the problem. */
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
 * Checks the AUTHORITATIVE gate (the signed, offline-verified entitlement in
 * tdService — not just the on-screen "active" flag) before letting the user
 * start creating / editing / deleting / exporting. Returns true if allowed;
 * otherwise shows the alert and returns false. tdService re-checks on the
 * actual write, so this is for early feedback, not the only line of defence.
 */
export async function requireWriteAccess(navigation) {
  try {
    const access = await tdService.checkWriteAccess();
    if (access.allowed) return true;
    showLockedAlert(navigation, access.reason, access.message);
    return false;
  } catch (e) {
    Alert.alert('Something went wrong', 'Unable to check your subscription. Please try again.');
    return false;
  }
}
