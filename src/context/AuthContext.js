import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as authApi from '../api/authApi';
import * as userApi from '../api/userApi';
import * as subscriptionApi from '../api/subscriptionApi';
import * as secureStorage from '../storage/secureStorage';
import { setOnSessionExpired } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [booting, setBooting] = useState(true); // still loading cached state from secure storage
  const [user, setUser] = useState(null); // cached User object from the backend, or null if logged out
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [refreshingProfile, setRefreshingProfile] = useState(false);
  // Deliberately NOT persisted — this is a one-shot "just finished
  // designation setup" nudge for the current app session only. If the app
  // is killed before the user acts on it, it simply won't reappear (the
  // step is skippable by design, not a re-entrant gate).
  const [showProfilePicPrompt, setShowProfilePicPrompt] = useState(false);

  const isMountedRef = useRef(true);
  useEffect(() => () => (isMountedRef.current = false), []);

  // Wholesale-overwrite the cached user, both in state and secure storage —
  // never a partial merge, so the app never quietly keeps a stale field
  // around. Every screen that gets a fresh `user` back from an API call
  // should route it through this.
  const applyUser = useCallback(async (nextUser) => {
    setUser(nextUser);
    await secureStorage.setCachedUser(nextUser);
  }, []);

  // Same idea for the profile-picture-removed case: the backend's
  // DELETE /remove/profile response has no `user` field at all, so we
  // patch the cached copy ourselves rather than waiting on one.
  const clearCachedProfilePic = useCallback(async () => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, profilepic: { url: undefined, publicId: undefined } };
      secureStorage.setCachedUser(next);
      return next;
    });
  }, []);

  const applySubscription = useCallback(async ({ active, entitlement }) => {
    setSubscriptionActive(!!active);
    await secureStorage.setEntitlement({ entitlement, active: !!active });
  }, []);

  const refreshSubscriptionStatus = useCallback(async () => {
    try {
      const res = await subscriptionApi.getSubscriptionStatus();
      await applySubscription(res);
      return res;
    } catch (e) {
      // Offline or server error — keep whatever was last cached; the
      // signed entitlement token (verified locally) is what actually
      // gates writes, not this live flag. See entitlementService.js.
      return null;
    }
  }, [applySubscription]);

  const refreshProfile = useCallback(async () => {
    setRefreshingProfile(true);
    try {
      const res = await authApi.getMe();
      await applyUser(res.user);
        return res.user;
    } finally {
      if (isMountedRef.current) setRefreshingProfile(false);
    }
  }, [applyUser]);

  const logout = useCallback(async () => {
    try {
      const refreshToken = await secureStorage.getRefreshToken();
      if (refreshToken) await authApi.logout(refreshToken).catch(() => {});
    } finally {
      await secureStorage.clearTokens();
      await secureStorage.setCachedUser(null);
      await secureStorage.setEntitlement({ entitlement: null, active: false });
      setUser(null);
      setSubscriptionActive(false);
    }
  }, []);

  // Wired into the API client so an unrecoverable refresh (stolen/expired
  // session) anywhere in the app forces the UI back to the login screen,
  // without every single screen needing its own 401 handling.
  useEffect(() => {
    setOnSessionExpired(() => {
      secureStorage.clearTokens();
      secureStorage.setCachedUser(null);
      setUser(null);
      setSubscriptionActive(false);
    });
  }, []);

  // Boot: hydrate from secure storage instantly (so the UI doesn't flash a
  // logged-out state while waiting on the network), then reconcile with
  // the server in the background.
  useEffect(() => {
    (async () => {
      try {
        const [cachedUser, accessToken, lastActive] = await Promise.all([
          secureStorage.getCachedUser(),
          secureStorage.getAccessToken(),
          secureStorage.getLastKnownActive(),
        ]);
        if (cachedUser && accessToken) {
          setUser(cachedUser);
          setSubscriptionActive(lastActive);
        }
      } finally {
        if (isMountedRef.current) setBooting(false);
      }

      // Background reconciliation — never blocks first paint.
      const accessToken = await secureStorage.getAccessToken();
      if (accessToken) {
        refreshProfile().catch(() => {});
        refreshSubscriptionStatus().catch(() => {});
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signup = useCallback(
    async (name, email, password) => {
      const res = await authApi.signup(name, email, password);
      await secureStorage.setTokenPair({ accessToken: res.accessToken, refreshToken: res.refreshToken });
      await applyUser(res.user);
        await refreshSubscriptionStatus();
      return res.user;
    },
    [applyUser, refreshSubscriptionStatus]
  );

  const login = useCallback(
    async (email, password) => {
      const res = await authApi.login(email, password);
      await secureStorage.setTokenPair({ accessToken: res.accessToken, refreshToken: res.refreshToken });
      await applyUser(res.user);
        await refreshSubscriptionStatus();
      return res.user;
    },
    [applyUser, refreshSubscriptionStatus]
  );

  const value = {
    booting,
    refreshingProfile,
    user,
    isAuthenticated: !!user,
    // The mandatory post-signup step (designation/beat/block/range) isn't
    // done yet — see user.controller.js's completeOrUpdateDesignation,
    // which is the only place profileCompleted gets set true.
    needsDesignationSetup: !!user && !user.profileCompleted,
    subscriptionActive,
    applyUser,
    clearCachedProfilePic,
    refreshProfile,
    refreshSubscriptionStatus,
    signup,
    login,
    logout,
    // Convenience passthroughs so screens don't need to also import
    // userApi directly just to keep the cached user in sync afterward.
    uploadProfilePic: async (uri, mime) => {
      const res = await userApi.uploadProfilePic(uri, mime);
      await applyUser(res.user);
      return res.user;
    },
    removeProfilePic: async () => {
      await userApi.removeProfilePic();
      await clearCachedProfilePic();
    },
    updateName: async (name) => {
      const res = await userApi.updateName(name);
      await applyUser(res.user);
      return res.user;
    },
    updateDesignation: async (fields) => {
      const wasIncomplete = !user?.profileCompleted;
      const res = await userApi.updateDesignation(fields);
      await applyUser(res.user);
      if (wasIncomplete && res.user?.profileCompleted) {
        setShowProfilePicPrompt(true);
      }
      return res.user;
    },
    showProfilePicPrompt,
    dismissProfilePicPrompt: () => setShowProfilePicPrompt(false),
    updateDob: async (dob) => {
      const res = await userApi.updateDob(dob);
      await applyUser(res.user);
      return res.user;
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
