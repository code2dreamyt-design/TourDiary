import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { FONT_SIZE, SPACING } from '../constants/dimensions';
import { showToast } from './Toast';

// Ionicons name for each tab, without the focused/unfocused suffix —
// resolved below to the filled variant when focused, "-outline" otherwise.
const TAB_ICON_NAMES = {
  Home: 'home',
  MyDiaries: 'book',
  TD: 'calculator',
};

const TAB_LABELS = {
  Home: 'Home',
  MyDiaries: 'My Diaries',
  TD: 'TD',
};

// Custom tab bar so the Camera button can float in a fixed spot,
// independent of how many regular tabs sit around it (adding another
// regular tab later never needs to move or resize it).
export default function AppTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const visibleRoutes = state.routes.filter((r) => r.name !== 'Camera');
  const cameraRoute = state.routes.find((r) => r.name === 'Camera');
  const cameraFocused = state.routes[state.index]?.name === 'Camera';

  // The whole bottom bar (regular tabs + floating camera button) hides
  // completely while the Camera screen is active — nothing to navigate to
  // while composing a shot, and it keeps the viewfinder full-screen.
  if (cameraFocused) return null;

  const bottomInset = Math.max(insets.bottom, SPACING.sm);

  function goTo(route, isFocused) {
    // TD is not a real feature yet — tapping it gives feedback without
    // actually navigating anywhere (see TDPlaceholderScreen for the
    // fallback if it's ever reached another way).
    if (route.name === 'TD') {
      showToast('TD Calculator — coming soon.');
      return;
    }
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });
    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  }

  return (
    <View style={[styles.wrapper, { paddingBottom: bottomInset }]}>
      {cameraRoute && (
        <TouchableOpacity
          onPress={() => goTo(cameraRoute, cameraFocused)}
          style={[styles.cameraButton, { bottom: BAR_HEIGHT + bottomInset + CAMERA_GAP }]}
          accessibilityRole="button"
          accessibilityLabel="Camera"
        >
          <Ionicons name="camera" size={24} color={COLORS.white} />
        </TouchableOpacity>
      )}

      <View style={styles.row}>
        {visibleRoutes.map((route) => {
          const isFocused = state.routes[state.index]?.key === route.key;
          const options = descriptors[route.key]?.options || {};
          const label = options.tabBarLabel ?? TAB_LABELS[route.name] ?? route.name;
          const iconName = `${TAB_ICON_NAMES[route.name] || 'ellipse'}${isFocused ? '' : '-outline'}`;
          return (
            <TouchableOpacity
              key={route.key}
              onPress={() => goTo(route, isFocused)}
              style={styles.tabButton}
              accessibilityRole="button"
              accessibilityState={{ selected: isFocused }}
            >
              <Ionicons name={iconName} size={22} color={isFocused ? COLORS.primary : COLORS.textMuted} />
              <Text style={[styles.label, isFocused && styles.labelFocused]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const BAR_HEIGHT = 58;
const CAMERA_SIZE = 54;
const CAMERA_GAP = 14; // space between the button and the top of the bar

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: -2 },
      },
      android: { elevation: 8 },
    }),
  },
  row: {
    flexDirection: 'row',
    height: BAR_HEIGHT,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: { fontSize: FONT_SIZE.sm - 2, color: COLORS.textMuted },
  labelFocused: { color: COLORS.primary, fontWeight: '700' },
  cameraButton: {
    position: 'absolute',
    right: SPACING.lg,
    width: CAMERA_SIZE,
    height: CAMERA_SIZE,
    borderRadius: CAMERA_SIZE / 2,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.surface,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
      },
      android: { elevation: 6 },
    }),
  },
});
