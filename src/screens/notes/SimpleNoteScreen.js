import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as notesService from '../../services/notesService';
import { PrimaryButton } from '../../components/td/TDParts';
import { LockedBanner, SwitchRow, notesStyles, NotesFooter } from '../../components/notes/NotesParts';
import useDiscardGuard from '../../components/notes/useDiscardGuard';
import { showToast } from '../../components/Toast';
import { NOTE_COLORS, noteColor } from '../../constants/notesData';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../constants/dimensions';
import { handleSaveError, requireWriteAccess } from './notesGuard';

const BLANK = { title: '', body: '', color: '', pinned: false };

// Create / view / edit one simple note. Without an active subscription the note
// opens read-only (reading is never locked); saving needs the subscription.
export default function SimpleNoteScreen({ navigation, route }) {
  const noteId = route.params?.noteId || null;
  const [form, setForm] = useState(BLANK);
  const [loading, setLoading] = useState(!!noteId);
  const [saving, setSaving] = useState(false);
  const [access, setAccess] = useState({ checked: false, allowed: true, message: null });
  const initial = useRef(JSON.stringify(BLANK));
  const dirty = !loading && JSON.stringify(form) !== initial.current;
  const { allowLeave } = useDiscardGuard(navigation, dirty && !saving);
  const readOnly = access.checked && !access.allowed;

  useEffect(() => {
    navigation.setOptions({ title: noteId ? 'Note' : 'New Note' });
  }, [navigation, noteId]);

  // load once
  useEffect(() => {
    if (!noteId) return;
    (async () => {
      const n = await notesService.getNote(noteId);
      if (!n) {
        showToast('This note no longer exists.');
        navigation.goBack();
        return;
      }
      const f = { title: n.title, body: n.body, color: n.color, pinned: n.pinned };
      initial.current = JSON.stringify(f);
      setForm(f);
      setLoading(false);
    })().catch(() => {
      Alert.alert('Something went wrong', 'Unable to open this note.');
      navigation.goBack();
    });
  }, [noteId, navigation]);

  // re-check the subscription every time the screen is shown (e.g. after renewing)
  useFocusEffect(
    useCallback(() => {
      notesService.checkWriteAccess().then((a) => setAccess({ checked: true, allowed: a.allowed, message: a.message })).catch(() => {});
    }, [])
  );

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  async function onSave() {
    if (saving) return;
    setSaving(true);
    try {
      await notesService.saveSimple({ id: noteId, ...form });
      allowLeave();
      showToast(noteId ? 'Note updated' : 'Note saved');
      navigation.goBack();
    } catch (e) {
      handleSaveError(navigation, e, 'Unable to save this note. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!(await requireWriteAccess(navigation))) return;
    Alert.alert('Delete note?', 'This will permanently delete this note. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await notesService.deleteNote(noteId);
            allowLeave();
            showToast('Note deleted');
            navigation.goBack();
          } catch (e) {
            handleSaveError(navigation, e, 'Unable to delete this note.');
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={notesStyles.center}>
        <ActivityIndicator size="large" color={COLORS.primaryText} />
      </View>
    );
  }

  const tint = noteColor(form.color);
  return (
    <View style={notesStyles.screen}>
      <ScrollView contentContainerStyle={notesStyles.form} keyboardShouldPersistTaps="handled">
        {readOnly && <LockedBanner message="Subscription inactive — view only. Renew to edit this note." onSubscribe={() => navigation.navigate('Subscription')} />}

        <View style={[styles.paper, { backgroundColor: tint.bg, borderLeftColor: tint.bar }]}>
          <TextInput
            style={notesStyles.titleInput}
            value={form.title}
            onChangeText={(v) => set({ title: v })}
            placeholder="Title (optional)"
            placeholderTextColor={COLORS.textMuted}
            editable={!readOnly}
            maxLength={120}
          />
          <TextInput
            style={notesStyles.bodyInput}
            value={form.body}
            onChangeText={(v) => set({ body: v })}
            placeholder="Write anything you want to remember…"
            placeholderTextColor={COLORS.textMuted}
            multiline
            editable={!readOnly}
            autoFocus={!noteId}
          />
        </View>

        <Text style={styles.label}>COLOUR</Text>
        <View style={styles.swatchRow}>
          {NOTE_COLORS.map((c) => {
            const active = c.key === form.color;
            return (
              <TouchableOpacity
                key={c.key || 'default'}
                style={[styles.swatch, { backgroundColor: c.bg, borderColor: c.bar }, active && styles.swatchActive]}
                onPress={() => set({ color: c.key })}
                disabled={readOnly}
                accessibilityRole="button"
                accessibilityLabel={`${c.label} colour`}
                accessibilityState={{ selected: active }}
              >
                {active && <Ionicons name="checkmark" size={18} color={COLORS.white} />}
              </TouchableOpacity>
            );
          })}
        </View>

        <SwitchRow label="Pin to top" hint="Pinned notes stay at the top of your list." value={form.pinned} onValueChange={(v) => set({ pinned: v })} disabled={readOnly} />
      </ScrollView>

      {!readOnly && (
        <NotesFooter>
          {noteId ? (
            <TouchableOpacity style={notesStyles.dangerButton} onPress={onDelete} accessibilityRole="button">
              <Text style={notesStyles.dangerButtonText}>Delete</Text>
            </TouchableOpacity>
          ) : null}
          <PrimaryButton title={saving ? 'Saving…' : 'Save note'} onPress={onSave} disabled={saving} style={{ flex: 1 }} />
        </NotesFooter>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  paper: { borderRadius: 14, borderLeftWidth: 5, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm },
  label: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginTop: SPACING.lg, marginBottom: SPACING.sm },
  swatchRow: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md },
  swatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  swatchActive: { borderWidth: 3, borderColor: COLORS.white },
});
