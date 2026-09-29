// All persisted auth/security state lives here, in the OS-level secure
// storage (iOS Keychain / Android Keystore via expo-secure-store) — never
// in plain SQLite or AsyncStorage. This is deliberately a thin, boring
// wrapper: every other module reads/writes these things through the named
// getters/setters below rather than touching SecureStore directly, so the
// storage mechanism can change in one place later if needed.
import * as SecureStore from 'expo-secure-store';

const KEYS = {
  accessToken: 'auth.accessToken',
  refreshToken: 'auth.refreshToken',
  user: 'auth.user', // cached User JSON from the server — see AuthContext
  entitlement: 'sub.entitlementToken', // signed ES256 JWT from /api/subscription/status
  entitlementActive: 'sub.active', // last-known boolean `active` flag from that same response
  highWaterMark: 'clock.highWaterMark', // ms epoch — see entitlementService.js for why this exists
  salutation: 'profile.salutation', // the one profile field with no backend equivalent (Mr./Ms./Mrs.)
};

async function getItem(key) {
  try {
    return await SecureStore.getItemAsync(key);
  } catch (e) {
    return null;
  }
}

async function setItem(key, value) {
  try {
    if (value === null || value === undefined) {
      await SecureStore.deleteItemAsync(key);
    } else {
      await SecureStore.setItemAsync(key, String(value));
    }
  } catch (e) {
    // Best-effort — a failed secure-store write shouldn't crash the app;
    // callers that truly need to know can check the return value of the
    // read they do immediately after.
  }
}

async function getJson(key) {
  const raw = await getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function setJson(key, value) {
  return setItem(key, value == null ? null : JSON.stringify(value));
}

// --- Tokens -----------------------------------------------------------
export const getAccessToken = () => getItem(KEYS.accessToken);
export const setAccessToken = (token) => setItem(KEYS.accessToken, token);
export const getRefreshToken = () => getItem(KEYS.refreshToken);
export const setRefreshToken = (token) => setItem(KEYS.refreshToken, token);

export async function setTokenPair({ accessToken, refreshToken }) {
  await Promise.all([setAccessToken(accessToken), setRefreshToken(refreshToken)]);
}

export async function clearTokens() {
  await Promise.all([setAccessToken(null), setRefreshToken(null)]);
}

// --- Cached user (overwritten wholesale on every server response that
// includes one — see AuthContext.applyUser) ------------------------------
export const getCachedUser = () => getJson(KEYS.user);
export const setCachedUser = (user) => setJson(KEYS.user, user);

// --- Subscription entitlement -------------------------------------------
export async function setEntitlement({ entitlement, active }) {
  await Promise.all([setItem(KEYS.entitlement, entitlement), setItem(KEYS.entitlementActive, active ? '1' : '0')]);
}
export const getEntitlementToken = () => getItem(KEYS.entitlement);
export async function getLastKnownActive() {
  const v = await getItem(KEYS.entitlementActive);
  return v === '1';
}

// --- Clock-rollback guard -------------------------------------------------
export const getHighWaterMark = async () => {
  const v = await getItem(KEYS.highWaterMark);
  return v ? Number(v) : 0;
};
export const setHighWaterMark = (ms) => setItem(KEYS.highWaterMark, Math.floor(ms));

// --- Local-only display preference (no backend field) ---------------------
export const getSalutation = () => getItem(KEYS.salutation);
export const setSalutation = (s) => setItem(KEYS.salutation, s);

export async function clearAll() {
  await Promise.all(Object.values(KEYS).map((k) => setItem(k, null)));
}
