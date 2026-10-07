import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';

/**
 * Asks "Discard changes?" when the user tries to leave an editor with unsaved
 * edits (back button, header back, swipe). Call allowLeave() right before
 * navigating away after a successful save / delete.
 */
export default function useDiscardGuard(navigation, isDirty) {
  const allow = useRef(false);
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (allow.current || !isDirty) return;
      e.preventDefault();
      Alert.alert('Discard changes?', 'You have unsaved changes. Leave without saving?', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
    return unsubscribe;
  }, [navigation, isDirty]);
  return {
    allowLeave: () => {
      allow.current = true;
    },
  };
}
