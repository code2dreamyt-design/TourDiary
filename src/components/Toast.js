import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/colors';
import { SPACING, RADIUS, FONT_SIZE } from '../constants/dimensions';

// Module-level handoff from showToast() to whichever <ToastHost/> is
// currently mounted — lets any screen trigger a toast with a plain
// function call, no context/provider wiring, no navigation prop needed.
let showHandler = null;

/**
 * Shows a brief, self-dismissing banner — fades in, holds, fades out on
 * its own. Used in place of Alert.alert() for simple confirmations (e.g.
 * "Saved") that shouldn't block the screen with a native modal + dimmer.
 * No-op if <ToastHost/> isn't mounted (shouldn't happen; it's mounted once
 * in App.js), so this is always safe to call.
 */
export function showToast(message, duration = 1600) {
  if (showHandler) showHandler(message, duration);
}

// Mounted once near the app root (see App.js), above the navigator, so a
// toast survives whatever screen transition happens right after it's
// triggered (e.g. saving a photo and immediately navigating back to
// Camera). Renders nothing until showToast() is called.
export default function ToastHost() {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimeoutRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    showHandler = (msg, duration) => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      if (animRef.current) {
        animRef.current.stop();
      }
      setMessage(msg);
      animRef.current = Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.delay(duration),
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]);
      animRef.current.start(({ finished }) => {
        if (finished) setMessage(null);
      });
    };
    return () => {
      showHandler = null;
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      if (animRef.current) animRef.current.stop();
    };
  }, [opacity]);

  if (!message) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.container, { top: insets.top + SPACING.md, opacity }]}
    >
      <View style={styles.banner}>
        <Text style={styles.text} numberOfLines={2}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  banner: {
    maxWidth: '86%',
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  text: {
    color: COLORS.white,
    fontSize: FONT_SIZE.base,
    fontWeight: '600',
    textAlign: 'center',
  },
});
