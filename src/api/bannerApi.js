// Maps 1:1 to the backend's banner + device routes (src/routes/banner.routes.js
// and device.routes.js). No business logic here — BannerHost is the only caller.
import { get, post } from './client';
import { PLATFORM, APP_VERSION } from '../services/bannerService';

// GET /api/banner — the server picks the single best banner for THIS user
// (audience, platform, version, schedule, priority). `exclude` is a list of
// banner ids this device has already handled, so the server can fall through
// to the next banner instead of re-sending one we would only hide again.
export function fetchBanner(excludeIds = []) {
  const params = [];
  if (PLATFORM) params.push(`platform=${PLATFORM}`);
  if (APP_VERSION) params.push(`version=${encodeURIComponent(APP_VERSION)}`);
  if (excludeIds.length) params.push(`exclude=${excludeIds.map(encodeURIComponent).join(',')}`);
  return get(`/api/banner${params.length ? `?${params.join('&')}` : ''}`);
}

// Statistics only. skipAuth so a stats call can never touch the session.
export const sendBannerEvent = (id, event) =>
  post(`/api/banner/${encodeURIComponent(id)}/event`, { event }, { skipAuth: true });

// Install / active-user tracking for the admin dashboard.
export const pingDevice = (deviceId) =>
  post('/api/devices/ping', { deviceId, platform: PLATFORM, ...(APP_VERSION ? { appVersion: APP_VERSION } : {}) });
