// Thin fetch wrapper shared by every API module (authApi, userApi,
// subscriptionApi). Responsibilities, and ONLY these:
//   1. Prefix API_BASE_URL and set JSON headers (unless sending FormData).
//   2. Attach `Authorization: Bearer <accessToken>` when one is stored.
//   3. On a 401 with code TOKEN_EXPIRED, transparently refresh once and
//      retry the original request — concurrent 401s during that refresh
//      are queued rather than each firing their own refresh call.
//   4. Normalize errors into a single ApiError shape screens can rely on.
import { API_BASE_URL } from '../config/api';
import * as secureStorage from '../storage/secureStorage';
import { syncServerTime } from '../services/entitlementService';

export class ApiError extends Error {
  constructor(message, { status, code, errors } = {}) {
    super(message || 'Something went wrong. Please try again.');
    this.status = status;
    this.code = code;
    this.errors = errors; // Zod fieldErrors object from the backend, when present
  }
}

// Set by AuthContext on mount so the client can force a full logout when a
// refresh is unrecoverable (stolen/expired session) — avoided a circular
// import by injecting this rather than importing AuthContext here.
let onSessionExpired = null;
export function setOnSessionExpired(fn) {
  onSessionExpired = fn;
}

let refreshPromise = null; // in-flight refresh, shared by any request that piles up behind it

async function doRefresh() {
  const currentRefreshToken = await secureStorage.getRefreshToken();
  if (!currentRefreshToken) {
    throw new ApiError('Not logged in', { status: 401, code: 'NO_TOKEN' });
  }
  const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: currentRefreshToken }),
  });
  const data = await safeJson(res);
  if (!res.ok) {
    throw new ApiError(data?.message, { status: res.status, code: data?.code });
  }
  await secureStorage.setTokenPair({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  return data.accessToken;
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch (e) {
    return null;
  }
}

/**
 * @param {string} path e.g. '/api/auth/login'
 * @param {object} options { method, body, isForm, skipAuth, _retry }
 */
export async function apiRequest(path, options = {}) {
  const { method = 'GET', body, isForm = false, skipAuth = false } = options;

  const headers = {};
  if (!isForm) headers['Content-Type'] = 'application/json';

  if (!skipAuth) {
    const accessToken = await secureStorage.getAccessToken();
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
  } catch (networkErr) {
    throw new ApiError('Unable to reach the server. Check your connection and try again.', {
      status: 0,
      code: 'NETWORK_ERROR',
    });
  }

  const data = await safeJson(res);

  // Any response from our server tells us the true current time (HTTP Date
  // header). That is the authority for the clock-rollback guard — see
  // entitlementService.syncServerTime. Never derive it from the device clock.
  const serverDate = res.headers && res.headers.get && res.headers.get('date');
  if (serverDate) {
    const serverMs = new Date(serverDate).getTime();
    syncServerTime(serverMs).catch(() => {});
  }

  if (res.ok) return data;

  // Transparent-refresh path: only for an authenticated request whose
  // access token has expired — never for /login, /signup, /refresh itself.
  if (res.status === 401 && data?.code === 'TOKEN_EXPIRED' && !skipAuth && !options._retry) {
    try {
      if (!refreshPromise) {
        refreshPromise = doRefresh().finally(() => {
          refreshPromise = null;
        });
      }
      await refreshPromise;
      return apiRequest(path, { ...options, _retry: true });
    } catch (refreshErr) {
      await secureStorage.clearTokens();
      if (onSessionExpired) onSessionExpired();
      throw new ApiError('Your session has expired. Please log in again.', { status: 401, code: 'SESSION_EXPIRED' });
    }
  }

  // Any other 401/INVALID_TOKEN also means the session is unrecoverable.
  if (res.status === 401 && !skipAuth) {
    await secureStorage.clearTokens();
    if (onSessionExpired) onSessionExpired();
  }

  // Backend validation failures are { message: 'Validation failed', errors: { field: [msg] } }
  // (see backend middlewares/validate.js). 'Validation failed' alone tells a
  // user nothing, so promote the first specific field message instead.
  let message = data?.message;
  if (data?.errors && typeof data.errors === 'object') {
    const firstField = Object.values(data.errors).find((v) => Array.isArray(v) && v.length > 0);
    if (firstField) message = firstField[0];
  }
  throw new ApiError(message, { status: res.status, code: data?.code, errors: data?.errors });
}

export const get = (path, options) => apiRequest(path, { ...options, method: 'GET' });
export const post = (path, body, options) => apiRequest(path, { ...options, method: 'POST', body });
export const patch = (path, body, options) => apiRequest(path, { ...options, method: 'PATCH', body });
export const del = (path, options) => apiRequest(path, { ...options, method: 'DELETE' });
