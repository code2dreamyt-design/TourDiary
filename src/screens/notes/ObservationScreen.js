import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Image, StyleSheet, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as notesService from '../../services/notesService';
import * as photoService from '../../services/photoService';
import { importFromGallery } from '../../services/notesPhotoService';
import { takePendingPhoto } from '../../services/notesPhotoBridge';
import { Field, PrimaryButton, SectionLabel } from '../../components/td/TDParts';
import { FieldButton, LockedBanner, SwitchRow, notesStyles, NotesFooter } from '../../components/notes/NotesParts';
import { DatePickerSheet, TimePickerSheet } from '../../components/notes/NotesPickers';
import useDiscardGuard from '../../components/notes/useDiscardGuard';
import PhotoZoomViewer from '../../components/PhotoZoomViewer';
import { showToast } from '../../components/Toast';
import { MAX_OBS_PHOTOS, OBS_CATEGORIES } from '../../constants/notesData';
import { formatDateLong, formatTime12 } from '../../utils/notesTime';
import { COLORS } from '../../constants/colors';
import { SPACING, RADIUS, FONT_SIZE } from '../../constants/dimensions';
import { handleSaveError, requireWriteAccess } from './notesGuard';

function blankForm() {
  return { title: '', body: '', category: '', observedAt: new Date(), place: '', latitude: null, longitude: null, accuracy: null, pinned: false };
}
const snapshot = (form, photos) =>
  JSON.stringify({ ...form, observedAt: form.observedAt.getTime(), photos: photos.map((p) => p.uri) });

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}

// Write down something seen on patrol: what it was, when, where (typed and/or
// GPS) and up to 6 photos — taken with the stamped Notes camera or picked from
// the Gallery. Read-only (no editing, no deleting) without a subscription.
export default function ObservationScreen({ navigation, route }) {
  const noteId = route.params?.noteId || null;
  const { width } = useWindowDimensions();
  const [form, setForm] = useState(blankForm);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(!!noteId);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [access, setAccess] = useState({ checked: false, allowed: true });
  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [viewUri, setViewUri] = useState(null);
  const [errors, setErrors] = useState({});
  const initial = useRef(null);
  if (initial.current === null) initial.current = snapshot(blankForm(), []);
  const dirty = !loading && snapshot(form, photos) !== initial.current;
  const { allowLeave } = useDiscardGuard(navigation, dirty && !saving);
  const readOnly = access.checked && !access.allowed;

  useEffect(() => {
    navigation.setOptions({ title: noteId ? 'Observation' : 'New Observation' });
  }, [navigation, noteId]);

  useEffect(() => {
    if (!noteId) return;
    (async () => {
      const n = await notesService.getNote(noteId);
      if (!n) {
        showToast('This observation no longer exists.');
        navigation.goBack();
        return;
      }
      const f = {
        title: n.title, body: n.body, category: n.category, observedAt: new Date(n.observedAt || n.createdAt), place: n.place,
        latitude: n.latitude, longitude: n.longitude, accuracy: n.accuracy, pinned: n.pinned,
      };
      const ph = n.photos.map((p) => ({ uri: p.uri, mediaId: p.mediaId, takenAt: p.takenAt, latitude: p.latitude, longitude: p.longitude }));
      initial.current = snapshot(f, ph);
      setForm(f);
      setPhotos(ph);
      setLoading(false);
    })().catch(() => {
      Alert.alert('Something went wrong', 'Unable to open this observation.');
      navigation.goBack();
    });
  }, [noteId, navigation]);

  // On every focus: re-check the subscription and pick up a photo just taken with the Notes camera.
  useFocusEffect(
    useCallback(() => {
      notesService.checkWriteAccess().then((a) => setAccess({ checked: true, allowed: a.allowed })).catch(() => {});
      const p = takePendingPhoto();
      if (p) addPhotos([p]);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  function addPhotos(list) {
    setPhotos((cur) => [...cur, ...list].slice(0, MAX_OBS_PHOTOS));
    // a stamped photo carries GPS: use it for the observation if no position was set yet
    const withGps = list.find((p) => p.latitude != null && p.longitude != null);
    if (withGps) {
      setForm((f) => (f.latitude == null ? { ...f, latitude: withGps.latitude, longitude: withGps.longitude, accuracy: withGps.accuracy ?? null } : f));
    }
  }

  async function onTakePhoto() {
    if (photos.length >= MAX_OBS_PHOTOS) return;
    if (!(await requireWriteAccess(navigation))) return;
    navigation.navigate('NotesCamera');
  }

  async function onPickPhotos() {
    const room = MAX_OBS_PHOTOS - photos.length;
    if (room <= 0) return;
    if (!(await requireWriteAccess(navigation))) return;
    try {
      const picked = await importFromGallery(room);
      if (picked.length) addPhotos(picked);
    } catch (e) {
      Alert.alert('Could not add photos', 'Unable to read the selected photos. Please try again.');
    }
  }

  function removePhoto(index) {
    Alert.alert('Remove photo?', 'It is removed from this observation. A photo taken with the camera stays in your Gallery.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setPhotos((cur) => cur.filter((_, i) => i !== index)) },
    ]);
  }

  async function useMyLocation() {
    if (locating) return;
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Location permission needed', 'Allow location access to record where you made this observation.');
        return;
      }
      const pos = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }), 25000);
      set({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy });
    } catch (e) {
      Alert.alert('Could not get your location', 'Move to an open area and try again, or type the place name instead.');
    } finally {
      setLocating(false);
    }
  }

  async function onSave() {
    if (saving) return;
    const errs = {};
    if (!form.title.trim()) errs.title = 'Give the observation a short title.';
    if (!form.category) errs.category = 'Choose what kind of observation this is.';
    if (form.observedAt.getTime() > Date.now() + 60000) errs.when = 'The time cannot be in the future.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await notesService.saveObservation({ id: noteId, ...form, observedAt: form.observedAt, photos });
      allowLeave();
      showToast(noteId ? 'Observation updated' : 'Observation saved');
      navigation.goBack();
    } catch (e) {
      handleSaveError(navigation, e, 'Unable to save this observation. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!(await requireWriteAccess(navigation))) return;
    Alert.alert('Delete observation?', 'This will permanently delete this observation and its photo links. Photos taken with the camera stay in your Gallery.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await notesService.deleteNote(noteId);
            allowLeave();
            showToast('Observation deleted');
            navigation.goBack();
          } catch (e) {
            handleSaveError(navigation, e, 'Unable to delete this observation.');
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

  const tile = Math.floor((width - SPACING.lg * 2 - SPACING.sm * 2) / 3);
  const hasGps = form.latitude != null && form.longitude != null;
  const canAdd = !readOnly && photos.length < MAX_OBS_PHOTOS;

  return (
    <View style={notesStyles.screen}>
      <ScrollView contentContainerStyle={notesStyles.form} keyboardShouldPersistTaps="handled">
        {readOnly && <LockedBanner message="Subscription inactive — view only. Renew to edit this observation." onSubscribe={() => navigation.navigate('Subscription')} />}

        <SectionLabel>WHAT DID YOU SEE?</SectionLabel>
        <View style={styles.catGrid}>
          {OBS_CATEGORIES.map((c) => {
            const active = form.category === c.key;
            return (
              <TouchableOpacity
                key={c.key}
                style={[styles.catChip, active && { backgroundColor: c.color + '33', borderColor: c.color }]}
                onPress={() => set({ category: c.key })}
                disabled={readOnly}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Ionicons name={c.icon} size={18} color={active ? c.color : COLORS.textMuted} />
                <Text style={[styles.catText, active && { color: COLORS.textPrimary }]}>{c.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {errors.category ? <Text style={styles.error}>{errors.category}</Text> : null}

        <Field label="Title" value={form.title} onChangeText={(v) => set({ title: v })} placeholder="e.g. Leopard pugmarks near the nala" editable={!readOnly} maxLength={120} error={errors.title} />
        <Field
          label="Details"
          value={form.body}
          onChangeText={(v) => set({ body: v })}
          placeholder="What exactly did you notice? Numbers, condition, direction…"
          multiline
          editable={!readOnly}
          inputStyle={{ minHeight: 110, textAlignVertical: 'top' }}
        />

        <SectionLabel>WHEN</SectionLabel>
        <View style={styles.twoCol}>
          <FieldButton style={{ flex: 1 }} icon="calendar-outline" value={formatDateLong(form.observedAt)} onPress={() => setDateOpen(true)} disabled={readOnly} error={errors.when} />
          <FieldButton style={{ width: 130 }} icon="time-outline" value={formatTime12(form.observedAt)} onPress={() => setTimeOpen(true)} disabled={readOnly} />
        </View>

        <SectionLabel>WHERE</SectionLabel>
        <Field label="Place" value={form.place} onChangeText={(v) => set({ place: v })} placeholder="Beat, compartment or landmark" editable={!readOnly} maxLength={120} style={{ marginTop: 0 }} />
        <View style={styles.gpsRow}>
          <View style={{ flex: 1 }}>
            {hasGps ? (
              <>
                <Text style={styles.gpsText}>{photoService.formatLatDMS(form.latitude)}  {photoService.formatLonDMS(form.longitude)}</Text>
                {form.accuracy != null ? <Text style={styles.gpsSub}>Accuracy ± {Math.round(form.accuracy)} m</Text> : null}
              </>
            ) : (
              <Text style={styles.gpsSub}>No GPS position recorded yet</Text>
            )}
          </View>
          {!readOnly && (
            <TouchableOpacity style={styles.gpsBtn} onPress={useMyLocation} disabled={locating} accessibilityRole="button">
              {locating ? <ActivityIndicator size="small" color={COLORS.primaryText} /> : <Ionicons name="locate" size={18} color={COLORS.primaryText} />}
              <Text style={styles.gpsBtnText}>{hasGps ? 'Update' : 'Use my location'}</Text>
            </TouchableOpacity>
          )}
          {!readOnly && hasGps && (
            <TouchableOpacity style={styles.gpsClear} onPress={() => set({ latitude: null, longitude: null, accuracy: null })} accessibilityRole="button" accessibilityLabel="Clear GPS position">
              <Ionicons name="close" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <SectionLabel>{`PHOTOS  ${photos.length}/${MAX_OBS_PHOTOS}`}</SectionLabel>
        <View style={styles.photoGrid}>
          {photos.map((p, i) => (
            <PhotoTile key={`${p.uri}-${i}`} photo={p} size={tile} onOpen={() => setViewUri(p.uri)} onRemove={readOnly ? null : () => removePhoto(i)} />
          ))}
          {canAdd && (
            <>
              <TouchableOpacity style={[styles.addTile, { width: tile, height: tile }]} onPress={onTakePhoto} accessibilityRole="button" accessibilityLabel="Take a GPS-stamped photo">
                <Ionicons name="camera" size={26} color={COLORS.primaryText} />
                <Text style={styles.addText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.addTile, { width: tile, height: tile }]} onPress={onPickPhotos} accessibilityRole="button" accessibilityLabel="Add photos from the Gallery">
                <Ionicons name="images" size={26} color={COLORS.primaryText} />
                <Text style={styles.addText}>Gallery</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
        {photos.length === 0 && <Text style={notesStyles.hint}>Camera photos are stamped with GPS and time, just like your tour photos.</Text>}

        <View style={{ marginTop: SPACING.lg }}>
          <SwitchRow label="Mark as important" hint="Important observations stay at the top of your list." value={form.pinned} onValueChange={(v) => set({ pinned: v })} disabled={readOnly} />
        </View>
      </ScrollView>

      {!readOnly && (
        <NotesFooter>
          {noteId ? (
            <TouchableOpacity style={notesStyles.dangerButton} onPress={onDelete} accessibilityRole="button">
              <Text style={notesStyles.dangerButtonText}>Delete</Text>
            </TouchableOpacity>
          ) : null}
          <PrimaryButton title={saving ? 'Saving…' : 'Save observation'} onPress={onSave} disabled={saving} style={{ flex: 1 }} />
        </NotesFooter>
      )}

      <DatePickerSheet visible={dateOpen} value={form.observedAt} maxDate={new Date()} title="Date of observation" onCancel={() => setDateOpen(false)} onConfirm={(d) => { setDateOpen(false); set({ observedAt: d }); }} />
      <TimePickerSheet visible={timeOpen} value={form.observedAt} title="Time of observation" onCancel={() => setTimeOpen(false)} onConfirm={(d) => { setTimeOpen(false); set({ observedAt: d }); }} />
      <PhotoZoomViewer visible={!!viewUri} uri={viewUri} onClose={() => setViewUri(null)} />
    </View>
  );
}

function PhotoTile({ photo, size, onOpen, onRemove }) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={{ width: size, height: size }}>
      <TouchableOpacity style={styles.tile} onPress={failed ? undefined : onOpen} activeOpacity={0.85} accessibilityRole="imagebutton" accessibilityLabel="Open photo">
        {failed ? (
          <View style={styles.tileMissing}>
            <Ionicons name="image-outline" size={24} color={COLORS.textMuted} />
            <Text style={styles.tileMissingText}>Photo not found</Text>
          </View>
        ) : (
          <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFailed(true)} />
        )}
      </TouchableOpacity>
      {onRemove ? (
        <TouchableOpacity style={styles.tileX} onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel="Remove photo">
          <Ionicons name="close" size={16} color={COLORS.white} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.background },
  catText: { color: COLORS.textSecondary, fontWeight: '700', fontSize: FONT_SIZE.sm + 1 },
  error: { color: COLORS.dangerText, fontSize: FONT_SIZE.sm, marginTop: SPACING.xs },
  twoCol: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  gpsRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.md },
  gpsText: { color: COLORS.textPrimary, fontSize: FONT_SIZE.sm + 1, fontWeight: '700' },
  gpsSub: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },
  gpsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.primaryLight },
  gpsBtnText: { color: COLORS.primaryText, fontWeight: '700', fontSize: FONT_SIZE.sm + 1 },
  gpsClear: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  tile: { flex: 1, borderRadius: RADIUS.md, overflow: 'hidden', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  tileX: { position: 'absolute', top: 4, right: 4, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  tileMissing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 4 },
  tileMissingText: { color: COLORS.textMuted, fontSize: 11, textAlign: 'center', marginTop: 2 },
  addTile: { borderRadius: RADIUS.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: COLORS.primaryText, alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: COLORS.primaryLight },
  addText: { color: COLORS.primaryText, fontWeight: '700', fontSize: FONT_SIZE.sm },
});
