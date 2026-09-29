import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import RazorpayCheckout from 'react-native-razorpay';
import * as subscriptionApi from '../api/subscriptionApi';
import { useAuth } from '../context/AuthContext';
import { verifyEntitlementToken } from '../services/entitlementService';
import * as secureStorage from '../storage/secureStorage';
import { ApiError } from '../api/client';
import { COLORS } from '../constants/colors';
import { SPACING, RADIUS, FONT_SIZE, TOUCH_TARGET_MIN } from '../constants/dimensions';

// Display-only labels. The amount actually charged is decided server-side
// (backend src/config/plan.js: monthly = 5900 paise, yearly = 59900 paise)
// and returned by POST /api/subscription/checkout — the client never sends
// a price. If you change plan.js, update these labels to match.
const PLANS = [
  { key: 'monthly', label: 'Monthly', priceLabel: '\u20B959 / month' },
  { key: 'yearly', label: 'Yearly', priceLabel: '\u20B9599 / year' },
];

export default function SubscriptionScreen() {
  const { user, subscriptionActive, refreshSubscriptionStatus } = useAuth();
  const [loading, setLoading] = useState(true);
  const [paidUntil, setPaidUntil] = useState(null);
  const [payingPlan, setPayingPlan] = useState(null); // which plan's checkout is in flight
  const [activating, setActivating] = useState(false); // waiting for the webhook to land
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await refreshSubscriptionStatus();
      const token = await secureStorage.getEntitlementToken();
      const payload = verifyEntitlementToken(token);
      setPaidUntil(payload?.paidUntil || null);
    } catch (e) {
      setError('Unable to load subscription status.');
    } finally {
      setLoading(false);
    }
  }, [refreshSubscriptionStatus]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Activation is webhook-driven server-side — see webhook.controller.js —
  // so a successful Razorpay checkout doesn't itself flip access. We poll
  // the status a few times right after checkout completes to catch the
  // webhook landing, rather than making the user manually refresh.
  async function pollForActivation() {
    setActivating(true);
    for (let attempt = 0; attempt < 8; attempt++) {
      await new Promise((r) => setTimeout(r, 1500));
      try {
        const res = await subscriptionApi.getSubscriptionStatus();
        if (res.active) {
          await load();
          setActivating(false);
          Alert.alert('Subscription Active', 'Your subscription is now active.');
          return;
        }
      } catch (e) {
        // keep polling — transient network hiccups shouldn't abort this
      }
    }
    setActivating(false);
    Alert.alert(
      'Payment received',
      "We're still confirming your payment with the server. If your subscription doesn't activate in a few minutes, please contact support."
    );
    load();
  }

  async function handleSubscribe(planKey) {
    setPayingPlan(planKey);
    setError(null);
    try {
      const order = await subscriptionApi.createCheckoutOrder(planKey);
      const options = {
        description: `Forest App ${planKey === 'monthly' ? 'Monthly' : 'Yearly'} Subscription`,
        currency: order.currency,
        key: order.keyId,
        amount: order.amount,
        order_id: order.orderId,
        name: 'Forest App',
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
        },
        theme: { color: COLORS.primary },
      };
      await RazorpayCheckout.open(options);
      // Reaching here means Razorpay reported a successful payment on the
      // client side. That's still just a client-side signal though — real
      // activation only happens once the backend's webhook verifies and
      // records the payment (see subscription.service.js / webhook.controller.js).
      await pollForActivation();
    } catch (err) {
      // Razorpay's SDK rejects with { code, description } on cancel/failure,
      // not an ApiError — handle both shapes.
      if (err instanceof ApiError) {
        setError(err.message || 'Unable to start checkout. Please try again.');
      } else if (err?.description) {
        // User-cancelled or payment failed client-side — not a real error
        // worth alarming over unless it's something other than a cancel.
        if (err.code !== 0) {
          setError(err.description);
        }
      } else {
        setError('Unable to complete checkout. Please try again.');
      }
    } finally {
      setPayingPlan(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={[styles.statusCard, subscriptionActive ? styles.statusCardActive : styles.statusCardInactive]}>
        <Text style={styles.statusTitle}>{subscriptionActive ? 'Subscription Active' : 'No Active Subscription'}</Text>
        {subscriptionActive && paidUntil ? (
          <Text style={styles.statusSub}>Renews / expires {new Date(paidUntil).toDateString()}</Text>
        ) : (
          <Text style={styles.statusSub}>
            Subscribe to keep creating and editing tour diary entries. Existing entries stay viewable either way.
          </Text>
        )}
      </View>

      {activating && (
        <View style={styles.activatingBox}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={styles.activatingText}>Confirming your payment…</Text>
        </View>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {PLANS.map((plan) => (
        <TouchableOpacity
          key={plan.key}
          style={styles.planCard}
          onPress={() => handleSubscribe(plan.key)}
          disabled={!!payingPlan || activating}
          accessibilityRole="button"
        >
          <View>
            <Text style={styles.planLabel}>{plan.label}</Text>
            <Text style={styles.planPrice}>{plan.priceLabel}</Text>
          </View>
          {payingPlan === plan.key ? (
            <ActivityIndicator color={COLORS.primary} />
          ) : (
            <Text style={styles.planCta}>{subscriptionActive ? 'Renew' : 'Subscribe'}</Text>
          )}
        </TouchableOpacity>
      ))}

      <Text style={styles.footnote}>
        Renewing early adds the new plan's days on top of your remaining time — you never lose paid time by renewing
        before it expires.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: SPACING.lg, backgroundColor: COLORS.background, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  statusCard: { borderRadius: RADIUS.lg, padding: SPACING.lg, borderWidth: 1.5, marginBottom: SPACING.lg },
  statusCardActive: { backgroundColor: COLORS.successBg, borderColor: COLORS.success },
  statusCardInactive: { backgroundColor: COLORS.surface, borderColor: COLORS.border },
  statusTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.textPrimary },
  statusSub: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: SPACING.xs, lineHeight: 18 },
  activatingBox: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  activatingText: { color: COLORS.textSecondary },
  errorText: { color: COLORS.danger, marginBottom: SPACING.md },
  planCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    minHeight: TOUCH_TARGET_MIN,
  },
  planLabel: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.textPrimary },
  planPrice: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  planCta: { color: COLORS.primary, fontWeight: '700' },
  footnote: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginTop: SPACING.md, lineHeight: 18, textAlign: 'center' },
});
