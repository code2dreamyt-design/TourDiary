import React, { useRef } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Animated, PanResponder } from 'react-native';
import { COLORS } from '../constants/colors';
import { SPACING } from '../constants/dimensions';

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_MOVE_TOLERANCE = 8;

function distanceBetween(touches) {
  const [a, b] = touches;
  const dx = a.pageX - b.pageX;
  const dy = a.pageY - b.pageY;
  return Math.sqrt(dx * dx + dy * dy);
}

// Full-screen photo viewer with pinch-to-zoom (two-finger) and pan-while-
// zoomed (one-finger), plus double-tap to reset. Built entirely on React
// Native core (Animated + PanResponder) so it works in Expo Go without any
// new native dependency.
export default function PhotoZoomViewer({ visible, uri, onClose }) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  // Plain numeric mirrors of the Animated.Values above — PanResponder math
  // needs synchronous numbers, not the async Animated.Value API.
  const scaleRef = useRef(1);
  const translateRef = useRef({ x: 0, y: 0 });
  const pinchStartDistance = useRef(null);
  const pinchStartScale = useRef(1);
  const panStart = useRef({ x: 0, y: 0 });
  const lastTapTime = useRef(0);
  const lastTapPos = useRef({ x: 0, y: 0 });

  function resetZoom(animated) {
    scaleRef.current = 1;
    translateRef.current = { x: 0, y: 0 };
    if (animated) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
      ]).start();
    } else {
      scale.setValue(1);
      translateX.setValue(0);
      translateY.setValue(0);
    }
  }

  function handleClose() {
    resetZoom(false);
    onClose();
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: (evt, gesture) =>
        evt.nativeEvent.touches.length === 2 || Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2,

      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 2) {
          pinchStartDistance.current = distanceBetween(touches);
          pinchStartScale.current = scaleRef.current;
        } else {
          panStart.current = { ...translateRef.current };
        }
      },

      onPanResponderMove: (evt, gesture) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 2) {
          if (pinchStartDistance.current == null) {
            pinchStartDistance.current = distanceBetween(touches);
            pinchStartScale.current = scaleRef.current;
          }
          const currentDistance = distanceBetween(touches);
          const factor = currentDistance / pinchStartDistance.current;
          const nextScale = Math.min(Math.max(pinchStartScale.current * factor, MIN_SCALE), MAX_SCALE);
          scaleRef.current = nextScale;
          scale.setValue(nextScale);
        } else if (touches.length === 1 && scaleRef.current > 1) {
          const nextX = panStart.current.x + gesture.dx;
          const nextY = panStart.current.y + gesture.dy;
          translateRef.current = { x: nextX, y: nextY };
          translateX.setValue(nextX);
          translateY.setValue(nextY);
        }
      },

      onPanResponderRelease: (evt, gesture) => {
        pinchStartDistance.current = null;
        // Snap back to the 1x/centered state if pinched out below the
        // minimum, so the image never gets stranded mid-shrink.
        if (scaleRef.current <= MIN_SCALE) {
          resetZoom(true);
          return;
        }

        // Double-tap detection: two quick, roughly-in-place single-finger taps.
        const isTap = Math.abs(gesture.dx) < DOUBLE_TAP_MOVE_TOLERANCE && Math.abs(gesture.dy) < DOUBLE_TAP_MOVE_TOLERANCE;
        if (isTap && evt.nativeEvent.changedTouches.length === 1) {
          const now = Date.now();
          const { pageX, pageY } = evt.nativeEvent.changedTouches[0];
          const movedSinceLastTap =
            Math.abs(pageX - lastTapPos.current.x) < 40 && Math.abs(pageY - lastTapPos.current.y) < 40;
          if (now - lastTapTime.current < DOUBLE_TAP_MS && movedSinceLastTap) {
            resetZoom(true);
            lastTapTime.current = 0;
            return;
          }
          lastTapTime.current = now;
          lastTapPos.current = { x: pageX, y: pageY };
        }
      },
    })
  ).current;

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Close photo viewer"
        >
          <Text style={styles.closeText}>{'\u2715'}</Text>
        </TouchableOpacity>

        <View style={styles.imageWrap} {...panResponder.panHandlers}>
          <Animated.Image
            source={{ uri }}
            resizeMode="contain"
            style={[
              styles.image,
              {
                transform: [{ translateX }, { translateY }, { scale }],
              },
            ]}
          />
        </View>

        <Text style={styles.hint}>Pinch to zoom {'\u2022'} Double-tap to reset</Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrap: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  closeButton: {
    position: 'absolute',
    top: SPACING.xl,
    right: SPACING.lg,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: COLORS.white, fontSize: 18, fontWeight: '700' },
  hint: {
    position: 'absolute',
    bottom: SPACING.xl,
    alignSelf: 'center',
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
  },
});
