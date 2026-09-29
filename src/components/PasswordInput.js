import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { SPACING, RADIUS, FONT_SIZE, TOUCH_TARGET_MIN } from '../constants/dimensions';

// Drop-in replacement for a `secureTextEntry` TextInput, with a show/hide
// eye toggle on the right (the same pattern most apps use). Matches the
// app's standard input box exactly — every prop except `secureTextEntry`
// (which this owns) passes straight through to the underlying TextInput,
// so callers only need to swap the tag name.
export default function PasswordInput({ style, ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.wrapper}>
      <TextInput
        style={[styles.input, style]}
        secureTextEntry={!visible}
        placeholderTextColor={COLORS.textMuted}
        {...props}
      />
      <TouchableOpacity
        onPress={() => setVisible((v) => !v)}
        style={styles.eyeButton}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Hide password' : 'Show password'}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginTop: SPACING.xs, justifyContent: 'center' },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    paddingRight: SPACING.xl + SPACING.md,
    fontSize: FONT_SIZE.base,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.surface,
    minHeight: TOUCH_TARGET_MIN,
  },
  eyeButton: {
    position: 'absolute',
    right: SPACING.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
