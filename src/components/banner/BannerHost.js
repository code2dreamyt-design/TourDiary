import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { getMe } from '../../api/authApi';
import { fetchBanner, sendBannerEvent, pingDevice } from '../../api/bannerApi';
import { PLATFORM, getDeviceId, getSeenIds, markSeen, normalizeBanner } from '../../services/bannerService';
import BannerModal from './BannerModal';

// Remote banners (managed from the admin panel at /admin on the backend).
//
// WHEN IT SHOWS
//   Once the user is logged in AND past the one-time setup screens, i.e. when
//   the real app (tabs) is on screen: on every app open, right after a login,
//   and again if the app comes back from the background after 10+ minutes.
//   It never shows on the login / signup / setup screens.
//
// RULES
//   - The server decides which banner suits this user (audience, platform,
//     version, schedule, priority). This file only decides how/when to show it.
//   - "once"          -> shown a single time per account, then never again.
//   - "every_launch"  -> shown on every app open (at most once per app session).
//   - Not dismissible -> no X, no tap-outside, no back button; it closes only
//                        through a "dismiss" button (e.g. a forced update).
//   - A banner problem (offline, slow server, bad data) is silent: the app
//     carries on exactly as before.

// Set to false to stop sending the install / active-user ping.
const SEND_DEVICE_PING = true;

const CHECK_TIMEOUT_MS = 20000; // a late answer after this is ignored
const REFRESH_AFTER_BACKGROUND_MS = 10 * 60 * 1000;
const MAX_EXCLUDE = 50;
const DISMISS_FALLBACK = [{ label: 'Got it', action: 'dismiss', url: null, style: 'primary' }];

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

// Resolves to a clean banner object, or null when there is nothing to show.
async function loadEligibleBanner(userId, sessionIds) {
  // Makes sure the access token is fresh (the API client refreshes it on
  // demand). The banner endpoint itself never reports an expired token — it
  // would silently treat the user as logged out and skip targeted banners.
  await getMe();

  if (SEND_DEVICE_PING && PLATFORM) {
    getDeviceId()
      .then(pingDevice)
      .catch(() => {});
  }

  const seen = await getSeenIds(userId);
  const exclude = [...new Set([...sessionIds, ...seen.slice().reverse()])].slice(0, MAX_EXCLUDE);
  const res = await fetchBanner(exclude);
  const banner = normalizeBanner(res && res.banner);
  // The second check also protects us if the server is an older version that
  // ignores `exclude`.
  if (!banner || exclude.includes(banner.id)) return null;
  return banner;
}

export default function BannerHost() {
  const { booting, user, isAuthenticated, needsDesignationSetup, showProfilePicPrompt } = useAuth();
  const userId = user && user._id ? String(user._id) : null;
  const ready = !booting && isAuthenticated && !!userId && !needsDesignationSetup && !showProfilePicPrompt;

  const [banner, setBanner] = useState(null);
  const [linkError, setLinkError] = useState(false);

  const bannerRef = useRef(null); // always mirrors `banner`, readable inside callbacks
  const userIdRef = useRef(null);
  const closedRef = useRef(false);
  const clickedRef = useRef(false);
  const pressingRef = useRef(false);
  const sessionIdsRef = useRef(new Map()); // userId -> Set of banner ids already shown this app session

  const sessionSet = (uid) => {
    let s = sessionIdsRef.current.get(uid);
    if (!s) {
      s = new Set();
      sessionIdsRef.current.set(uid, s);
    }
    return s;
  };

  // Logged-out app open: still count the install / active device.
  useEffect(() => {
    if (!SEND_DEVICE_PING || booting || isAuthenticated || !PLATFORM) return;
    getDeviceId()
      .then(pingDevice)
      .catch(() => {});
  }, [booting, isAuthenticated]);

  const closeBanner = useCallback((reason) => {
    const b = bannerRef.current;
    if (!b || closedRef.current) return;
    closedRef.current = true;
    bannerRef.current = null;
    setBanner(null);
    setLinkError(false);
    // Dismissible "once" banners are remembered the moment they appear; the
    // non-dismissible ones only count as seen once they are actually closed.
    if (!b.dismissible && b.showAgain === 'once' && userIdRef.current) markSeen(userIdRef.current, b.id);
    if (reason === 'dismissed') sendBannerEvent(b.id, 'dismissed').catch(() => {});
  }, []);

  const onButtonPress = useCallback(
    async (btn) => {
      const b = bannerRef.current;
      if (!b || closedRef.current || pressingRef.current) return;
      if (btn.action === 'dismiss') {
        closeBanner('dismissed');
        return;
      }
      pressingRef.current = true;
      try {
        if (!clickedRef.current) {
          clickedRef.current = true;
          sendBannerEvent(b.id, 'clicked').catch(() => {});
        }
        try {
          await Linking.openURL(btn.url);
        } catch (e) {
          if (bannerRef.current === b) setLinkError(true);
          return;
        }
        if (bannerRef.current === b) {
          setLinkError(false);
          if (b.dismissible) closeBanner('clicked');
        }
      } finally {
        pressingRef.current = false;
      }
    },
    [closeBanner]
  );

  useEffect(() => {
    userIdRef.current = ready ? userId : null;

    if (!ready) {
      // Logged out (or back in a setup screen): make sure nothing lingers.
      bannerRef.current = null;
      setBanner(null);
      setLinkError(false);
      return undefined;
    }

    let cancelled = false;
    let checking = false;
    let leftAt = null;

    const display = (b) => {
      sessionSet(userId).add(b.id);
      bannerRef.current = b;
      closedRef.current = false;
      clickedRef.current = false;
      setLinkError(false);
      setBanner(b);
      sendBannerEvent(b.id, 'shown').catch(() => {});
      if (b.dismissible && b.showAgain === 'once') markSeen(userId, b.id);
    };

    const check = async () => {
      if (checking || bannerRef.current) return;
      checking = true;
      try {
        const found = await withTimeout(loadEligibleBanner(userId, [...sessionSet(userId)]), CHECK_TIMEOUT_MS);
        if (cancelled || !found || bannerRef.current) return;
        display(found);
      } catch (e) {
        // offline / slow server / anything else: silently show nothing
      } finally {
        checking = false;
      }
    };

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        leftAt = Date.now();
      } else if (state === 'active') {
        const away = leftAt ? Date.now() - leftAt : 0;
        leftAt = null;
        if (away >= REFRESH_AFTER_BACKGROUND_MS) check();
      }
    });

    check();

    return () => {
      cancelled = true;
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, userId]);

  if (!banner) return null;

  return (
    <BannerModal
      banner={banner}
      buttons={banner.buttons.length ? banner.buttons : DISMISS_FALLBACK}
      linkError={linkError}
      onButtonPress={onButtonPress}
      onDismiss={() => closeBanner('dismissed')}
    />
  );
}
