import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { SPACING, RADIUS, FONT_SIZE, TOUCH_TARGET_MIN } from '../../constants/dimensions';

// One look per banner type, all drawn from the app's own dark palette.
const TYPE_STYLE = {
  update: { icon: 'cloud-download', color: COLORS.primaryText, label: 'UPDATE' },
  offer: { icon: 'gift', color: COLORS.accent, label: 'OFFER' },
  reminder: { icon: 'alarm', color: COLORS.dangerText, label: 'REMINDER' },
  info: { icon: 'information-circle', color: '#7FB4E8', label: 'NOTICE' },
};

// Purely presentational. All decisions (what to show, when, what a tap does)
// live in BannerHost; this only draws the card and reports taps.
export default function BannerModal({ banner, buttons, linkError, onButtonPress, onDismiss }) {
  const { height } = useWindowDimensions();
  const look = TYPE_STYLE[banner.type] || TYPE_STYLE.info;
  const dismissible = banner.dismissible;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={dismissible ? onDismiss : undefined}
    >
      <View style={styles.backdrop}>
        {/* Tapping outside closes the card — but only when the admin allowed dismissing. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismissible ? onDismiss : undefined}
          accessible={false}
        />
        <View
          style={[styles.card, { borderColor: `${look.color}55` }]}
          accessibilityViewIsModal
          accessibilityLiveRegion="polite"
        >
          <View style={[styles.topBar, { backgroundColor: look.color }]} />

          {dismissible ? (
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onDismiss}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ) : null}

          <View style={styles.body}>
            <View style={[styles.iconWrap, { backgroundColor: `${look.color}22`, borderColor: `${look.color}55` }]}>
              <Ionicons name={look.icon} size={32} color={look.color} />
            </View>
            <Text style={[styles.chip, { color: look.color }]}>{look.label}</Text>
            <Text style={styles.title} accessibilityRole="header">
              {banner.title}
            </Text>
            <ScrollView
              style={{ maxHeight: Math.max(120, height * 0.38) }}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <Text style={styles.message}>{banner.message}</Text>
            </ScrollView>
            {linkError ? <Text style={styles.error}>Couldn't open the link. Please try again.</Text> : null}
          </View>

          <View style={styles.actions}>
            {buttons.map((b, i) => {
              const secondary = b.style === 'secondary';
              return (
                <TouchableOpacity
                  key={`${i}-${b.label}`}
                  style={[styles.button, secondary ? styles.buttonSecondary : styles.buttonPrimary]}
                  onPress={() => onButtonPress(b)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={b.label}
                >
                  <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]} numberOfLines={1}>
                    {b.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderRadius: RADIUS.lg + 4,
    overflow: 'hidden',
  },
  topBar: { height: 4, width: '100%' },
  closeBtn: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceRaised,
    zIndex: 2,
  },
  body: {
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  chip: { fontSize: FONT_SIZE.sm - 2, fontWeight: '800', letterSpacing: 1.2, marginBottom: SPACING.xs },
  title: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.lg,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  message: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.base,
    lineHeight: 22,
    textAlign: 'center',
  },
  error: { color: COLORS.dangerText, fontSize: FONT_SIZE.sm, textAlign: 'center', marginTop: SPACING.md },
  actions: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xl, gap: SPACING.sm },
  button: {
    minHeight: TOUCH_TARGET_MIN,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  buttonPrimary: { backgroundColor: COLORS.primary },
  buttonSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.border },
  buttonText: { color: COLORS.white, fontSize: FONT_SIZE.base, fontWeight: '700' },
  buttonTextSecondary: { color: COLORS.textPrimary },
});
