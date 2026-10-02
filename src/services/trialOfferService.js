// Remembers, per account, that the launch-offer banner is finished (trial
// claimed, already used, or the server said the offer is closed) so it never
// comes back on later app launches. Keyed by user id, so logging out and into
// another account never mixes the two. Best-effort: a storage failure just
// means the banner may show once more, and the server decides anyway.
import * as SecureStore from 'expo-secure-store';

const keyFor = (userId) => `trial.offerDone.${userId}`;

export async function isTrialOfferDone(userId) {
  try {
    return (await SecureStore.getItemAsync(keyFor(userId))) === '1';
  } catch (e) {
    return false;
  }
}

export async function markTrialOfferDone(userId) {
  try {
    await SecureStore.setItemAsync(keyFor(userId), '1');
  } catch (e) {
    // best-effort
  }
}
