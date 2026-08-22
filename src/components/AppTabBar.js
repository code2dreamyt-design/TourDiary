import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/colors';
import { FONT_SIZE, SPACING } from '../constants/dimensions';

const TAB_ICONS = {
  Home: '\u2302', // house
  MyDiaries: '\u2637', // book-ish glyph
  Profile: '\u263A', // person-ish glyph
};

const TAB_LABELS = {
  Home: 'Home',
  MyDiaries: 'My Diaries',
  Profile: 'My Profile',
};

// Custom tab bar so the Camera button can float dead-center above the bar,
// regardless of how many regular tabs sit on either side of it (adding a
// Settings tab later just adds another regular tab — the floating button
// never needs to move or be renumbered).
export default function AppTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const visibleRoutes = state.routes.filter((r) => r.name !== 'Camera');
  const cameraRoute = state.routes.find((r) => r.name === 'Camera');
  const cameraFocused = state.routes[state.index]?.name === 'Camera';

  function goTo(route, isFocused) {
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
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, SPACING.sm) }]}>
      <View style={styles.row}>
        {visibleRoutes.map((route) => {
          const isFocused = state.routes[state.index]?.key === route.key;
          const options = descriptors[route.key]?.options || {};
          const label = options.tabBarLabel ?? TAB_LABELS[route.name] ?? route.name;
          return (
            <TouchableOpacity
              key={route.key}
              onPress={() => goTo(route, isFocused)}
              style={styles.tabButton}
              accessibilityRole="button"
              accessibilityState={{ selected: isFocused }}
            >
              <Text style={[styles.icon, isFocused && styles.iconFocused]}>{TAB_ICONS[route.name] || '\u2022'}</Text>
              <Text style={[styles.label, isFocused && styles.labelFocused]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {cameraRoute && (
        <TouchableOpacity
          onPress={() => goTo(cameraRoute, cameraFocused)}
          style={styles.cameraButton}
          accessibilityRole="button"
          accessibilityLabel="Camera"
        >
          <Text style={styles.cameraIcon}>{'\u25CF'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const BAR_HEIGHT = 58;
const CAMERA_SIZE = 60;

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  row: {
    flexDirection: 'row',
    height: BAR_HEIGHT,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 20, color: COLORS.textMuted },
  iconFocused: { color: COLORS.primary },
  label: { fontSize: FONT_SIZE.sm - 2, color: COLORS.textMuted, marginTop: 2 },
  labelFocused: { color: COLORS.primary, fontWeight: '700' },
  cameraButton: {
    position: 'absolute',
    left: '50%',
    marginLeft: -(CAMERA_SIZE / 2),
    top: -(CAMERA_SIZE / 2 - 6),
    width: CAMERA_SIZE,
    height: CAMERA_SIZE,
    borderRadius: CAMERA_SIZE / 2,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
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
  cameraIcon: { color: COLORS.white, fontSize: 24 },
});
