import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as subscriptionApi from '../api/subscriptionApi';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { showErrorToast } from './Toast';
import { isTrialOfferDone, markTrialOfferDone, refreshTrialOffer } from '../services/trialOfferService';
import { TRIAL_DAYS, getTrialOfferEndsAt, isTrialOfferOpen, trialOfferLastDayLabel } from '../config/trialOffer';
import { COLORS } from '../constants/colors';
import { SPACING, RADIUS, FONT_SIZE } from '../constants/dimensions';

const DAY_MS = 24 * 60 * 60 * 1000;

// Short versions of the backend messages so the 3-line error toast never
// cuts them off. Anything unexpected falls back to the server's own message.
function claimErrorMessage(err, user) {
  switch (err.code) {
    case 'EMAIL_NOT_VERIFIED': {
      const created = user?.createdAt ? new Date(user.createdAt).getTime() : 0;
      const justSignedUp = created && Date.now() - created < DAY_MS;
      return justSignedUp
        ? "We've sent a verification link to your email. Verify it, then tap Claim."
        : 'Please verify your email first. Go to Profile to verify, then claim.';
    }
    case 'OFFER_CLOSED':
      return 'Sorry, this free-trial offer has ended.';
    case 'ALREADY_CLAIMED':
      return "You've already used your free trial or have a subscription.";
    default:
      return err.message;
  }
}

// Slim offer strip shown at the top of the main tabs until the user claims
// the trial (or the offer ends). Purely additive: it reads existing auth
// state and calls one new endpoint; nothing else in the app depends on it.
export default function TrialOfferBanner({ onClaimed }) {
  const { user, subscriptionActive, refreshSubscriptionStatus } = useAuth();
  const userId = user?._id;
  const [done, setDone] = useState(null); // null = still reading storage (render nothing yet)
  const [claiming, setClaiming] = useState(false);
  const [, setOfferVersion] = useState(0); // re-render once the offer end date has been read from the server
  const mountedRef = useRef(true);
  useEffect(() => () => (mountedRef.current = false), []);

  useEffect(() => {
    refreshTrialOffer().then(() => {
      if (mountedRef.current) setOfferVersion((n) => n + 1);
    });
  }, []);

  useEffect(() => {
    if (!userId) return undefined;
    let alive = true;
    setDone(null);
    isTrialOfferDone(userId).then((v) => alive && setDone(v));
    return () => {
      alive = false;
    };
  }, [userId]);

  const joinedInTime = !user?.createdAt || new Date(user.createdAt).getTime() < getTrialOfferEndsAt().getTime();
  const visible = !!userId && done === false && !subscriptionActive && isTrialOfferOpen() && joinedInTime;
  if (!visible) return null;

  async function handleClaim() {
    if (claiming) return;
    setClaiming(true);
    try {
      const res = await subscriptionApi.claimTrial();
      await markTrialOfferDone(userId);
      if (mountedRef.current) setDone(true);
      await refreshSubscriptionStatus(); // stores the new entitlement + flips the app to "active"
      if (onClaimed) onClaimed();
      Alert.alert(
        res?.title || 'Your free trial has started!',
        res?.message || `Enjoy ${TRIAL_DAYS} days of full access, free.`
      );
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'OFFER_CLOSED' || err.code === 'ALREADY_CLAIMED') {
          await markTrialOfferDone(userId);
          if (mountedRef.current) setDone(true);
        }
        showErrorToast(claimErrorMessage(err, user));
      } else {
        showErrorToast('Unable to claim the offer. Please try again.');
      }
    } finally {
      if (mountedRef.current) setClaiming(false);
    }
  }

  return (
    <View style={styles.banner}>
      <Ionicons name="gift" size={22} color={COLORS.accent} />
      <View style={styles.textCol}>
        <Text style={styles.title}>{TRIAL_DAYS} days free — launch offer</Text>
        <Text style={styles.sub} numberOfLines={2}>
          Verify your email and claim before {trialOfferLastDayLabel()}. Full access, no payment.
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.button, claiming && styles.buttonBusy]}
        onPress={handleClaim}
        disabled={claiming}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        accessibilityRole="button"
        accessibilityLabel="Claim free trial"
      >
        {claiming ? <ActivityIndicator size="small" color={COLORS.white} /> : <Text style={styles.buttonText}>Claim</Text>}
      </TouchableOpacity>
    </View>
  );
}

// Wraps a tab's root screen so the banner sits right under the header, above
// the screen, without editing the screen itself. After a successful claim the
// screen is remounted once so it re-reads the (now unlocked) subscription
// state instead of keeping a stale "locked" message.
export function withTrialBanner(Screen) {
  function WithTrialBanner(props) {
    const [version, setVersion] = useState(0);
    return (
      <View style={styles.wrapper}>
        <TrialOfferBanner onClaimed={() => setVersion((v) => v + 1)} />
        <View style={styles.screenHolder}>
          <Screen key={version} {...props} />
        </View>
      </View>
    );
  }
  WithTrialBanner.displayName = `WithTrialBanner(${Screen.displayName || Screen.name || 'Screen'})`;
  return WithTrialBanner;
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: COLORS.background },
  screenHolder: { flex: 1 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
  },
  textCol: { flex: 1 },
  title: { color: COLORS.textPrimary, fontSize: FONT_SIZE.sm + 1, fontWeight: '700' },
  sub: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm - 1, marginTop: 1, lineHeight: 16 },
  button: {
    minWidth: 64,
    minHeight: 36,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  buttonBusy: { opacity: 0.8 },
  buttonText: { color: COLORS.white, fontSize: FONT_SIZE.sm, fontWeight: '700' },
});
