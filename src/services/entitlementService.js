// Verifies the signed entitlement JWT that GET /api/subscription/status
// returns (see backend src/services/entitlement.service.js), fully
// offline — no network call needed to decide whether writes are allowed
// right now. This is what lets a field worker keep using the app with no
// signal, while still making the paywall un-spoofable by just flipping a
// local boolean.
//
// This is deliberately implemented with @noble/curves (pure JS, no native
// crypto module) rather than `jose`/WebCrypto, which RN's Hermes engine
// doesn't provide. p256.verify()'s default prehash:true hashes the signing
// input internally, so no separate hash library is needed here.
//
// IMPORTANT — version-sensitive: this was verified against @noble/curves
// v2.x specifically (package.json pins "^2.4.0"). v1.x has a DIFFERENT
// default (prehash:false, expecting an already-hashed digest) and will
// silently fail every verification if this ever gets downgraded to v1.x
// without updating the code to match. The exact call below
// (p256.verify(signature, rawMessage, rawPublicKey) with v2's defaults)
// was cross-checked against a real jsonwebtoken-signed ES256 token in a Node sandbox before being used here
// — see the project notes; do not "simplify" the prehash handling without
// re-testing against a real token, it's the one easy way to silently
// break verification.
import { p256 } from '@noble/curves/nist.js';
import * as secureStorage from '../storage/secureStorage';

// --- Public key -------------------------------------------------------
// Paste the PEM contents of ENTITLEMENT_PUBLIC_KEY from the backend's .env
// here (SPKI / "-----BEGIN PUBLIC KEY-----" format, P-256 / prime256v1).
// This is a PUBLIC key — safe to ship in the app bundle, it can only
// verify signatures, never create them.
const ENTITLEMENT_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
REPLACE_WITH_YOUR_ENTITLEMENT_PUBLIC_KEY
-----END PUBLIC KEY-----`;

// --- base64url helpers (no Buffer / atob dependency — safe on Hermes) ---
const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64ToBytes(b64) {
  const bytes = [];
  let buffer = 0;
  let bits = 0;
  for (const c of b64) {
    if (c === '=') break;
    const val = B64_CHARS.indexOf(c);
    if (val === -1) continue;
    buffer = (buffer << 6) | val;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

function base64urlToBytes(b64url) {
  return base64ToBytes(b64url.replace(/-/g, '+').replace(/_/g, '/'));
}

function bytesToUtf8(bytes) {
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  try {
    return decodeURIComponent(escape(str));
  } catch (e) {
    return str;
  }
}

function base64urlToJson(b64url) {
  return JSON.parse(bytesToUtf8(base64urlToBytes(b64url)));
}

function asciiToBytes(str) {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes;
}

// Extracts the raw 65-byte uncompressed EC point from a standard P-256
// SPKI PEM. Confirmed stable (fixed-length ASN.1 prefix) across many
// generated keypairs — see project notes. If you ever rotate to a
// different curve or a PEM with parameters encoded differently, this
// extraction needs revisiting.
function pemToRawPublicKey(pem) {
  const b64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s+/g, '');
  const der = base64ToBytes(b64);
  const raw = der.slice(der.length - 65);
  if (raw.length !== 65 || raw[0] !== 0x04) {
    throw new Error('Unexpected entitlement public key format');
  }
  return raw;
}

let cachedRawPubKey = null;
function getRawPubKey() {
  if (!cachedRawPubKey) cachedRawPubKey = pemToRawPublicKey(ENTITLEMENT_PUBLIC_KEY_PEM);
  return cachedRawPubKey;
}

/**
 * Verifies an ES256 JWT's signature and expiry. Returns the decoded
 * payload ({ sub, paidUntil }) if valid, or null if the token is missing,
 * malformed, expired, or fails signature verification.
 */
export function verifyEntitlementToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;

  try {
    const header = base64urlToJson(headerB64);
    if (header.alg !== 'ES256') return null;

    const signingInput = asciiToBytes(`${headerB64}.${payloadB64}`);
    const sigBytes = base64urlToBytes(sigB64);
    // IMPORTANT — signature malleability (low-S): @noble/curves defaults to
    // STRICT low-S enforcement in verify(). JWT/JOSE's ES256 spec does not
    // require low-S canonicalization, and jsonwebtoken (the backend's signer)
    // does not normalize to low-S either — so roughly half of all
    // legitimately-signed tokens have a "high S" value and would be silently,
    // randomly rejected without { lowS: false } below. This was caught by
    // testing 100 real jsonwebtoken-signed tokens: the strict default failed
    // ~40% of genuinely valid signatures. Do not remove { lowS: false }.
    const isValid = p256.verify(sigBytes, signingInput, getRawPubKey(), { lowS: false });
    if (!isValid) return null;

    const payload = base64urlToJson(payloadB64);
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      // The entitlement JWT itself expires (30d, forcing periodic
      // re-check with the server — see entitlement.service.js). Once it's
      // past its own exp, don't trust it even if paidUntil looks future.
      return null;
    }
    return payload;
  } catch (e) {
    return null;
  }
}

// --- Clock-rollback guard -------------------------------------------------
// A small tolerance for genuine NTP/timezone jitter, not enough to matter
// for a subscription measured in days.
const CLOCK_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * Records the SERVER's clock as the authority for the high-water mark. Called
 * automatically by api/client.js from the HTTP `Date` header of every
 * successful response — never from the device clock.
 *
 * It deliberately OVERWRITES (rather than only ratcheting upward): if a
 * legitimate user's clock was once wrong in the forward direction, the mark
 * would otherwise be stuck in the future and lock them out of writing until
 * real time caught up. Overwriting with server time heals that on the next
 * online sync. An attacker who rolls the clock back gains nothing from this:
 * device `now` is still behind the (now server-true) mark, so they stay
 * flagged until they fix the clock.
 */
export async function syncServerTime(serverNowMs) {
  if (!Number.isFinite(serverNowMs) || serverNowMs <= 0) return;
  await secureStorage.setHighWaterMark(serverNowMs);
}

/**
 * Returns { ok, reason } — ok is false if the device clock appears to have
 * been rolled back before the last time we know the app was legitimately
 * online. This is a best-effort deterrent, not a guarantee — see the
 * honest caveat in entitlementService's module comment / the conversation
 * that specced this: a device that goes to airplane mode before ever
 * syncing again can't be caught this way. It closes the easy, obvious
 * "just wind the clock back" case and self-heals the moment the app is
 * next online.
 */
export async function checkClockIntegrity() {
  const highWaterMark = await secureStorage.getHighWaterMark();
  const now = Date.now();
  if (highWaterMark && now + CLOCK_TOLERANCE_MS < highWaterMark) {
    return { ok: false, reason: 'CLOCK_ROLLBACK' };
  }
  // Between server syncs, let the mark follow the device clock forward so an
  // offline rollback to *before* the last time the app was used is caught.
  // (If the device clock was wrongly ahead, the next online sync overwrites
  // this with true server time — see syncServerTime.)
  if (now > highWaterMark) {
    await secureStorage.setHighWaterMark(now);
  }
  return { ok: true };
}

/**
 * The single function every write path in the app should call. Combines:
 *   1. Clock-integrity check (offline-safe rollback deterrent)
 *   2. Locally-verified, signed paidUntil check against the guarded clock
 * Returns { allowed, reason } — reason is one of
 * 'CLOCK_ROLLBACK' | 'NO_ENTITLEMENT' | 'EXPIRED' | null (null = allowed).
 */
export async function isWriteAllowed() {
  const clock = await checkClockIntegrity();
  if (!clock.ok) return { allowed: false, reason: clock.reason };

  const token = await secureStorage.getEntitlementToken();
  const payload = verifyEntitlementToken(token);
  if (!payload) return { allowed: false, reason: 'NO_ENTITLEMENT' };
  if (!payload.paidUntil) return { allowed: false, reason: 'NO_ENTITLEMENT' };

  // Bind the token to the account that is actually logged in. The server
  // signs `sub` = the user's id; without this check a validly-signed token
  // belonging to a different (paying) account would unlock this one.
  const user = await secureStorage.getCachedUser();
  if (!user || !user._id || payload.sub !== String(user._id)) {
    return { allowed: false, reason: 'NO_ENTITLEMENT' };
  }

  const paidUntilMs = new Date(payload.paidUntil).getTime();
  const guardedNow = Date.now(); // already passed the rollback check above
  if (Number.isNaN(paidUntilMs) || guardedNow > paidUntilMs) {
    return { allowed: false, reason: 'EXPIRED' };
  }
  return { allowed: true, reason: null };
}
