// Single source of truth for the backend's base URL. Change this one line
// to point the whole app at a different environment (local dev, staging,
// production) — nothing else in the app should hardcode a URL.
export const API_BASE_URL = 'https://forestapp-backend.onrender.com';

// Deep-link scheme used for email verification / password reset — must
// match app.json's "scheme" and the backend's CLIENT_URL bridge pages
// (src/controllers/deeplink.controller.js on the backend).
export const APP_SCHEME = 'forestapp';
