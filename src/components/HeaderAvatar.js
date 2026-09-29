import React from 'react';
import { TouchableOpacity, Image, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { SPACING } from '../constants/dimensions';

const SIZE = 34;

// Small tappable avatar shown in the header of the main screens — this is
// how Profile is reached now, instead of a bottom tab (see AppTabBar /
// MainTabNavigator). Shows the user's photo if they've set one, or a
// generic silhouette placeholder otherwise (same pattern as Instagram /
// WhatsApp). Purely a navigation shortcut — all profile editing still
// happens on ProfileScreen itself.
export default function HeaderAvatar() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const uri = user?.profilepic?.url;

  return (
    <TouchableOpacity
      onPress={() => navigation.navigate('Profile')}
      style={styles.wrapper}
      accessibilityRole="button"
      accessibilityLabel="Open profile"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      {uri ? (
        <Image source={{ uri }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.placeholder]}>
          <Ionicons name="person" size={18} color="#FFFFFF" />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginRight: SPACING.md },
  avatar: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  placeholder: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
