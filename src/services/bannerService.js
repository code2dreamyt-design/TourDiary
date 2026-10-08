// Local helpers for the remote banner feature: what platform/version this
// build is, which banners this account has already seen, a stable anonymous
// device id, and strict validation of whatever the server sends back.
// Everything here is best-effort — a storage failure must never break the app.
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import appConfig from '../../app.json';

const VERSION_RE = /^\d+(\.\d+){0,3}$/;
const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

// The installed build's version is app.json's expo.version (that is what the
// native build embeds). Banner min/max version targeting compares against it,
// so bump app.json's version on every release.
const rawVersion = String(appConfig?.expo?.version ?? '');
export const APP_VERSION = VERSION_RE.test(rawVersion) ? rawVersion : null;
export const PLATFORM = Platform.OS === 'android' || Platform.OS === 'ios' ? Platform.OS : null;

// --- "Show once" memory, per account --------------------------------------
const SEEN_MAX = 40; // newest 40 ids; keeps the value well under SecureStore's 2 KB comfort limit
const seenKey = (userId) => `banner.seen.${userId}`;

export async function getSeenIds(userId) {
  try {
    const raw = await SecureStore.getItemAsync(seenKey(userId));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string' && OBJECT_ID_RE.test(x)) : [];
  } catch (e) {
    return [];
  }
}

export async function markSeen(userId, bannerId) {
  try {
    const current = await getSeenIds(userId);
    const next = [...current.filter((id) => id !== bannerId), bannerId].slice(-SEEN_MAX);
    await SecureStore.setItemAsync(seenKey(userId), JSON.stringify(next));
  } catch (e) {
    // best-effort: worst case the banner shows once more
  }
}

// --- Anonymous device id (random, created once, no personal data) -----------
const DEVICE_KEY = 'device.id';
let cachedDeviceId = null;

function generateDeviceId() {
  let s = '';
  for (let i = 0; i < 32; i += 1) s += Math.floor(Math.random() * 16).toString(16);
  return `dev-${s}`;
}

export async function getDeviceId() {
  if (cachedDeviceId) return cachedDeviceId;
  try {
    const existing = await SecureStore.getItemAsync(DEVICE_KEY);
    if (existing && existing.length >= 8 && existing.length <= 100) {
      cachedDeviceId = existing;
      return existing;
    }
  } catch (e) {
    // fall through and create one
  }
  const fresh = generateDeviceId();
  try {
    await SecureStore.setItemAsync(DEVICE_KEY, fresh);
  } catch (e) {
    // still usable for this session
  }
  cachedDeviceId = fresh;
  return fresh;
}

// --- Validation of the server response (defence in depth) -------------------
const TYPES = ['update', 'offer', 'reminder', 'info'];
const ACTIONS = ['open_url', 'deeplink', 'dismiss'];

function normalizeButton(b) {
  if (!b || typeof b !== 'object') return null;
  const label = typeof b.label === 'string' ? b.label.trim() : '';
  if (!label || !ACTIONS.includes(b.action)) return null;
  const style = b.style === 'secondary' ? 'secondary' : 'primary';
  if (b.action === 'dismiss') return { label, action: 'dismiss', url: null, style };
  const url = typeof b.url === 'string' ? b.url.trim() : '';
  const ok =
    b.action === 'open_url'
      ? /^https:\/\/\S+$/i.test(url)
      : /^[a-z][a-z0-9+.-]*:\/\/\S+$/i.test(url) && !/^(javascript|data|file):/i.test(url);
  return ok ? { label, action: b.action, url, style } : null;
}

// Returns a clean banner object, or null if the payload is empty/malformed.
export function normalizeBanner(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.id !== 'string' || !OBJECT_ID_RE.test(raw.id)) return null;
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  const message = typeof raw.message === 'string' ? raw.message.trim() : '';
  if (!title || !message) return null;
  const buttons = (Array.isArray(raw.buttons) ? raw.buttons : []).map(normalizeButton).filter(Boolean).slice(0, 3);
  return {
    id: raw.id,
    type: TYPES.includes(raw.type) ? raw.type : 'info',
    title,
    message,
    dismissible: raw.dismissible !== false,
    showAgain: raw.showAgain === 'every_launch' ? 'every_launch' : 'once',
    buttons,
  };
}
