// Remembers, per account, that the launch-offer banner is finished (trial
// claimed, already used, or the server said the offer is closed) so it never
// comes back on later app launches. Keyed by user id, so logging out and into
// another account never mixes the two. Best-effort: a storage failure just
// means the banner may show once more, and the server decides anyway.
import * as SecureStore from 'expo-secure-store';
import { get } from '../api/client';
import { setTrialOfferEndsAt } from '../config/trialOffer';

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

// ---- Offer end date (managed from the admin panel, served by GET /api/offer) ----
// Fetches the current end date and remembers it, so the banner follows the
// server without an app update. Best-effort: offline or on any error the last
// remembered date (or the built-in default) stays in effect, and the server
// still decides every claim. Resolves true once a value was read from the server.
const ENDS_AT_KEY = 'trial.offerEndsAt';
let cacheLoaded = false;
let inflight = null;

async function loadRemembered() {
  if (cacheLoaded) return;
  cacheLoaded = true;
  try {
    const n = Number(await SecureStore.getItemAsync(ENDS_AT_KEY));
    if (Number.isFinite(n) && n > 0) setTrialOfferEndsAt(n);
  } catch (e) {
    // best-effort
  }
}

export function refreshTrialOffer() {
  if (inflight) return inflight;
  inflight = (async () => {
    await loadRemembered();
    try {
      const data = await get('/api/offer', { skipAuth: true });
      const ms = Date.parse(data && data.endsAt);
      if (Number.isFinite(ms)) {
        setTrialOfferEndsAt(ms);
        SecureStore.setItemAsync(ENDS_AT_KEY, String(ms)).catch(() => {});
      }
      return Number.isFinite(ms);
    } catch (e) {
      return false;
    }
  })();
  inflight.finally(() => {
    inflight = null;
  });
  return inflight;
}
