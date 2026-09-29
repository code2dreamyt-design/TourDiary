import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../api/client';
import { showErrorToast } from '../../components/Toast';
import { COLORS } from '../../constants/colors';
import { SPACING, RADIUS, FONT_SIZE, TOUCH_TARGET_MIN } from '../../constants/dimensions';

// Shown once, right after DesignationSetupScreen succeeds (see
// AuthContext's showProfilePicPrompt / AppNavigator's routing). Unlike
// designation setup, this step is explicitly skippable — either button
// dismisses it and the gate in AppNavigator falls through to MainTabs.
export default function ProfilePicSetupScreen() {
  const { uploadProfilePic, dismissProfilePicPrompt } = useAuth();
  const [localUri, setLocalUri] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Photo library access is needed to choose a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setLocalUri(result.assets[0].uri);
      setError(null);
    }
  }

  async function handleSave() {
    if (!localUri) return;
    setUploading(true);
    setError(null);
    try {
      await uploadProfilePic(localUri, 'image/jpeg');
      dismissProfilePicPrompt();
    } catch (err) {
      showErrorToast(err instanceof ApiError ? err.message : 'Unable to upload your photo. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add a profile picture</Text>
      <Text style={styles.subtitle}>Optional — you can also do this later from your Profile tab.</Text>

      <TouchableOpacity style={styles.avatarWrap} onPress={pickImage} accessibilityRole="button">
        {localUri ? (
          <Image source={{ uri: localUri }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarPlaceholderText}>Tap to choose</Text>
          </View>
        )}
      </TouchableOpacity>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.primaryButton, !localUri && styles.primaryButtonDisabled]}
        onPress={handleSave}
        disabled={!localUri || uploading}
        accessibilityRole="button"
      >
        {uploading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryButtonText}>Save Photo</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.skipButton} onPress={dismissProfilePicPrompt} disabled={uploading} accessibilityRole="button">
        <Text style={styles.skipText}>Skip for now</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: SPACING.xl, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.primaryText, textAlign: 'center' },
  subtitle: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, textAlign: 'center', marginTop: SPACING.sm, marginBottom: SPACING.xl },
  avatarWrap: { marginBottom: SPACING.xl },
  avatar: { width: 140, height: 140, borderRadius: 70 },
  avatarPlaceholder: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  avatarPlaceholderText: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },
  errorText: { color: COLORS.dangerText, marginBottom: SPACING.md },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    minHeight: TOUCH_TARGET_MIN,
    minWidth: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: COLORS.white, fontWeight: '700', fontSize: FONT_SIZE.base },
  skipButton: { marginTop: SPACING.lg, minHeight: TOUCH_TARGET_MIN, justifyContent: 'center' },
  skipText: { color: COLORS.textSecondary, fontWeight: '600' },
});
