// ============================================================================
// TEMPORARY — shows a pop-up telling you whether the public key pasted into
// entitlementService.js is correct.  It does nothing else, changes no app
// state, and never throws.
//
// HOW IT WORKS
//   1. On app start: checks the key was pasted and is a valid P-256 key.
//   2. After you are logged in: asks your backend for a fresh signed
//      entitlement (GET /api/subscription/status — the same call the app
//      already makes) and verifies its signature with the key in the app.
//
// HOW TO REMOVE (after you have seen the green ✅ message)
//   Quick:    set  ENABLE_KEY_CHECK = false  below.   (nothing shows anymore)
//   Clean:    1) delete this file (src/debug/EntitlementKeyCheck.js)
//             2) in App.js delete the import line and the
//                <EntitlementKeyCheck /> line
//             3) optional: delete the "TEMP — PUBLIC KEY SELF-CHECK" block at
//                the bottom of src/services/entitlementService.js
// ============================================================================
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import * as subscriptionApi from '../api/subscriptionApi';
import { __checkPublicKeyFormat, __diagnoseToken } from '../services/entitlementService';

const ENABLE_KEY_CHECK = true;

const REMOVE_HINT =
  'You can now remove this check: set ENABLE_KEY_CHECK = false in src/debug/EntitlementKeyCheck.js (or delete that file and its 2 lines in App.js).';

function report(title, message) {
  console.log(`[EntitlementKeyCheck] ${title} — ${message}`);
  try {
    Alert.alert(title, message);
  } catch (e) {
    // never let a debug pop-up break the app
  }
}

export default function EntitlementKeyCheck() {
  const { isAuthenticated } = useAuth();
  const formatChecked = useRef(false);
  const liveChecked = useRef(false);

  // Step 1 — key format (runs once at start-up, no login needed).
  useEffect(() => {
    if (!ENABLE_KEY_CHECK || formatChecked.current) return;
    formatChecked.current = true;
    try {
      const f = __checkPublicKeyFormat();
      if (f.ok) return;
      if (f.reason === 'PLACEHOLDER') {
        report(
          '❌ Public key NOT set',
          'entitlementService.js still contains the placeholder text.\n\nPaste your real public key (the "-----BEGIN PUBLIC KEY-----" block from your generator script) into ENTITLEMENT_PUBLIC_KEY_PEM, then reload the app.'
        );
      } else {
        report(
          '❌ Public key is invalid',
          `The text pasted in ENTITLEMENT_PUBLIC_KEY_PEM is not a valid P-256 public key.\n\nMake sure you copied the whole block, including the BEGIN and END lines, and that it came from the prime256v1 generator script.\n\nDetail: ${f.detail || 'unknown'}`
        );
      }
    } catch (e) {
      report('❌ Key check crashed', String((e && e.message) || e));
    }
  }, []);

  // Step 2 — real signature check against a token from YOUR backend.
  useEffect(() => {
    if (!ENABLE_KEY_CHECK || !isAuthenticated || liveChecked.current) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled || liveChecked.current) return;
      liveChecked.current = true;
      try {
        const f = __checkPublicKeyFormat();
        if (!f.ok) return; // already reported in step 1

        let res;
        try {
          res = await subscriptionApi.getSubscriptionStatus();
        } catch (e) {
          report(
            '⚠️ Key format OK — signature not tested',
            `Could not get a signed token from the server (${(e && e.message) || 'network error'}).\n\nCheck your connection / that the backend is running, then restart the app to test again.`
          );
          return;
        }

        const d = __diagnoseToken(res && res.entitlement);
        if (d.ok) {
          const p = d.payload || {};
          report(
            '✅ Entitlement key is CORRECT',
            `The signature from your server was verified with the public key in the app.\n\npaidUntil: ${p.paidUntil || 'none (no active subscription)'}\n\n${REMOVE_HINT}`
          );
          return;
        }

        const explain = {
          SIGNATURE_MISMATCH:
            'The server signed a token, but the public key in the app does NOT match the private key on the server.\n\nFix: the public key and ENTITLEMENT_PRIVATE_KEY must come from the SAME run of the generator. Update the server env (e.g. on Render), restart the backend, and paste the matching public key here.',
          NO_TOKEN: 'The server response had no "entitlement" token. Check GET /api/subscription/status on the backend.',
          MALFORMED: 'The token from the server is not a valid JWT (should have 3 parts).',
          BAD_ALG: `The token uses algorithm "${d.detail}" but the app expects ES256.`,
          EXPIRED: 'The token from the server is already expired. Check the server clock.',
        };
        report('❌ Entitlement key check FAILED', explain[d.reason] || `Reason: ${d.reason}`);
      } catch (e) {
        report('❌ Key check crashed', String((e && e.message) || e));
      }
    }, 1500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isAuthenticated]);

  return null;
}
