import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Linking, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as notesService from '../../services/notesService';
import * as scheduler from '../../services/reminderScheduler';
import { ChipSelect, Field, PrimaryButton, SectionLabel } from '../../components/td/TDParts';
import { FieldButton, LockedBanner, MultiChips, NoticeCard, notesStyles, NotesFooter } from '../../components/notes/NotesParts';
import { DatePickerSheet, TimePickerSheet } from '../../components/notes/NotesPickers';
import useDiscardGuard from '../../components/notes/useDiscardGuard';
import { showToast } from '../../components/Toast';
import { ALERT_OPTIONS, DEFAULT_ALERTS, FOLLOW_OPTIONS, REPEAT_OPTIONS } from '../../constants/notesData';
import { effectiveDue, planReminder } from '../../utils/reminderPlan';
import { addDays, formatDateLong, formatTime12, friendlyDateTime, offsetLabel, overdueText, startOfDay } from '../../utils/notesTime';
import { repeatLabel } from '../../utils/notesFormat';
import { COLORS } from '../../constants/colors';
import { SPACING, RADIUS, FONT_SIZE, TOUCH_TARGET_MIN } from '../../constants/dimensions';
import { explainNotifyStatus, handleSaveError, requireWriteAccess } from './notesGuard';

function defaultWhen() {
  const d = new Date(Date.now() + 60 * 60000);
  d.setSeconds(0, 0);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5); // rolls the hour over by itself at :60
  return d;
}

function blankForm() {
  return { title: '', body: '', when: defaultWhen(), repeat: 'NONE', alerts: [...DEFAULT_ALERTS], followEvery: 0 };
}

const snapshot = (f) =>
  JSON.stringify({ title: f.title, body: f.body, when: f.when.getTime(), repeat: f.repeat, alerts: [...f.alerts].sort((a, b) => a - b), followEvery: f.followEvery });

function quickPicks(nowMs) {
  const out = [{ key: 'h1', label: 'In 1 hour', at: new Date(Math.ceil((nowMs + 3600000) / 60000) * 60000) }];
  const evening = new Date(nowMs);
  evening.setHours(18, 0, 0, 0);
  if (evening.getTime() > nowMs + 15 * 60000) out.push({ key: 'eve', label: 'Today 6 PM', at: evening });
  const tomorrow = addDays(startOfDay(new Date(nowMs)), 1);
  tomorrow.setHours(9, 0, 0, 0);
  out.push({ key: 'tom', label: 'Tomorrow 9 AM', at: tomorrow });
  const week = addDays(startOfDay(new Date(nowMs)), 7);
  week.setHours(9, 0, 0, 0);
  out.push({ key: 'wk', label: 'Next week 9 AM', at: week });
  return out;
}

// Create / view / edit a reminder: when, how often it repeats, which advance
// alerts to send ("1 day before", "1 hour before"…), and whether to keep
// nudging after the due time until it is marked done.
export default function ReminderScreen({ navigation, route }) {
  const noteId = route.params?.noteId || null;
  const fromNotification = !!route.params?.fromNotification;
  const [form, setForm] = useState(blankForm);
  const [stored, setStored] = useState(null);
  const [loading, setLoading] = useState(!!noteId);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [access, setAccess] = useState({ checked: false, allowed: true });
  const [perm, setPerm] = useState('granted');
  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const [tick, setTick] = useState(Date.now());
  const initial = useRef(null);
  if (initial.current === null) initial.current = snapshot(blankForm());
  const dirty = !loading && snapshot(form) !== initial.current;
  const { allowLeave } = useDiscardGuard(navigation, dirty && !saving);
  const readOnly = access.checked && !access.allowed;

  useEffect(() => {
    navigation.setOptions({ title: noteId ? 'Reminder' : 'New Reminder' });
  }, [navigation, noteId]);

  const applyNote = useCallback((n, resetForm) => {
    setStored(n);
    if (resetForm) {
      const f = { title: n.title, body: n.body, when: new Date(n.remindAt), repeat: n.repeat, alerts: n.alerts, followEvery: n.followEvery };
      initial.current = snapshot(f);
      setForm(f);
    }
  }, []);

  useEffect(() => {
    if (!noteId) return;
    (async () => {
      const n = await notesService.getNote(noteId);
      if (!n) {
        showToast('This reminder no longer exists.');
        navigation.goBack();
        return;
      }
      applyNote(n, true);
      setLoading(false);
    })().catch(() => {
      Alert.alert('Something went wrong', 'Unable to open this reminder.');
      navigation.goBack();
    });
  }, [noteId, navigation, applyNote]);

  useFocusEffect(
    useCallback(() => {
      notesService.checkWriteAccess().then((a) => setAccess({ checked: true, allowed: a.allowed })).catch(() => {});
      scheduler.getPermissionState().then(setPerm).catch(() => {});
      setTick(Date.now());
      const id = setInterval(() => setTick(Date.now()), 30000);
      return () => clearInterval(id);
    }, [])
  );

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const now = new Date(tick);

  // advance alerts whose moment has already passed cannot be chosen for a one-off reminder
  const disabledAlerts = useMemo(() => {
    if (form.repeat !== 'NONE') return [];
    return ALERT_OPTIONS.filter((o) => form.when.getTime() - o.value * 60000 <= Date.now()).map((o) => o.value);
  }, [form.when, form.repeat, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const firstAlert = useMemo(() => {
    const plan = planReminder(
      { id: 0, remindAt: form.when.toISOString(), baseAt: form.when.toISOString(), repeat: form.repeat, alerts: form.alerts, followEvery: 0, doneAt: null },
      new Date()
    );
    if (!plan.length) return null;
    const p = plan[0];
    return { text: friendlyDateTime(p.at, new Date()), kind: p.type === 'before' ? `${offsetLabel(p.minutes)} before` : 'at the time' };
  }, [form.when, form.repeat, form.alerts, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleAlert(value) {
    setForm((f) => ({ ...f, alerts: f.alerts.includes(value) ? f.alerts.filter((v) => v !== value) : [...f.alerts, value] }));
  }

  async function onSave() {
    if (saving) return;
    const errs = {};
    if (!form.title.trim()) errs.title = 'Give the reminder a title.';
    const changedTime = !stored || new Date(stored.remindAt).getTime() !== form.when.getTime();
    if (changedTime && form.when.getTime() <= Date.now()) errs.when = 'Pick a time in the future.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const res = await notesService.saveReminder({
        id: noteId, title: form.title, body: form.body, remindAt: form.when, repeat: form.repeat, alerts: form.alerts, followEvery: form.followEvery,
      });
      allowLeave();
      showToast(`Reminder set for ${friendlyDateTime(form.when)}`);
      navigation.goBack();
      explainNotifyStatus(res.notifyStatus, () => Linking.openSettings());
    } catch (e) {
      handleSaveError(navigation, e, 'Unable to save this reminder. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function runAction(fn, onOk) {
    if (busy) return;
    setBusy(true);
    try {
      onOk(await fn());
    } catch (e) {
      handleSaveError(navigation, e, 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const onDone = () =>
    runAction(() => notesService.completeReminder(noteId), (res) => {
      allowLeave();
      showToast(res.next ? `Done. Next: ${friendlyDateTime(res.next)}` : 'Marked as done');
      navigation.goBack();
    });
  const onSnooze = (option, label) =>
    runAction(() => notesService.snoozeReminder(noteId, option), (res) => {
      applyNote(res.note, false);
      showToast(`Snoozed to ${friendlyDateTime(res.until)}`);
      explainNotifyStatus(res.notifyStatus, () => Linking.openSettings());
    });
  const onReopen = () =>
    runAction(() => notesService.reopenReminder(noteId), (res) => {
      applyNote(res.note, false);
      showToast('Reminder is active again');
    });

  async function onDelete() {
    if (!(await requireWriteAccess(navigation))) return;
    Alert.alert('Delete reminder?', 'This will permanently delete this reminder and cancel its alerts. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await notesService.deleteNote(noteId);
            allowLeave();
            showToast('Reminder deleted');
            navigation.goBack();
          } catch (e) {
            handleSaveError(navigation, e, 'Unable to delete this reminder.');
          }
        },
      },
    ]);
  }

  async function onFixPermission() {
    if (perm === 'blocked') {
      Linking.openSettings();
      return;
    }
    const ok = await scheduler.ensurePermission(true);
    setPerm(await scheduler.getPermissionState());
    if (ok) scheduler.syncAll();
    else Linking.openSettings();
  }

  if (loading) {
    return (
      <View style={notesStyles.center}>
        <ActivityIndicator size="large" color={COLORS.primaryText} />
      </View>
    );
  }

  const pending = stored && !stored.doneAt;
  const due = pending ? effectiveDue(stored, now) : null;
  const overdue = pending && due && due.getTime() <= now.getTime();

  return (
    <View style={notesStyles.screen}>
      <ScrollView contentContainerStyle={notesStyles.form} keyboardShouldPersistTaps="handled">
        {readOnly && <LockedBanner message="Subscription inactive — view only. Renew to edit this reminder." onSubscribe={() => navigation.navigate('Subscription')} />}

        {stored && (
          <View style={[styles.status, overdue && styles.statusOverdue, stored.doneAt && styles.statusDone]}>
            <Ionicons
              name={stored.doneAt ? 'checkmark-circle' : overdue ? 'alert-circle' : 'alarm'}
              size={22}
              color={stored.doneAt ? COLORS.success : overdue ? COLORS.dangerText : COLORS.primaryText}
            />
            <View style={{ flex: 1, marginLeft: SPACING.md }}>
              {stored.doneAt ? (
                <Text style={styles.statusTitle}>Completed {friendlyDateTime(new Date(stored.doneAt), now)}</Text>
              ) : (
                <>
                  <Text style={[styles.statusTitle, overdue && { color: COLORS.dangerText }]}>
                    {overdue ? overdueText(due, now) : `Next alert time: ${friendlyDateTime(due, now)}`}
                  </Text>
                  <Text style={styles.statusSub}>
                    {stored.snoozeUntil && due.getTime() === new Date(stored.snoozeUntil).getTime() ? 'Snoozed' : repeatLabel(stored.repeat)}
                    {fromNotification && overdue ? ' · This reminder just went off' : ''}
                  </Text>
                </>
              )}
            </View>
          </View>
        )}

        {!readOnly && stored && pending && (
          <View style={styles.actionCard}>
            <TouchableOpacity style={styles.doneBtn} onPress={onDone} disabled={busy} accessibilityRole="button">
              <Ionicons name="checkmark" size={20} color={COLORS.white} />
              <Text style={styles.doneBtnText}>{stored.repeat !== 'NONE' ? 'Done — go to next' : 'Mark as done'}</Text>
            </TouchableOpacity>
            <Text style={styles.actionLabel}>SNOOZE</Text>
            <View style={styles.snoozeRow}>
              <TouchableOpacity style={styles.snoozeBtn} onPress={() => onSnooze(10)} disabled={busy} accessibilityRole="button"><Text style={styles.snoozeText}>10 min</Text></TouchableOpacity>
              <TouchableOpacity style={styles.snoozeBtn} onPress={() => onSnooze(60)} disabled={busy} accessibilityRole="button"><Text style={styles.snoozeText}>1 hour</Text></TouchableOpacity>
              <TouchableOpacity style={styles.snoozeBtn} onPress={() => onSnooze('TOMORROW')} disabled={busy} accessibilityRole="button"><Text style={styles.snoozeText}>Tomorrow 9 AM</Text></TouchableOpacity>
            </View>
          </View>
        )}
        {!readOnly && stored && stored.doneAt && (
          <TouchableOpacity style={styles.reopenBtn} onPress={onReopen} disabled={busy} accessibilityRole="button">
            <Ionicons name="refresh" size={18} color={COLORS.primaryText} />
            <Text style={styles.reopenText}>Reopen this reminder</Text>
          </TouchableOpacity>
        )}

        {perm !== 'granted' && !readOnly && (
          <NoticeCard
            tone="warn"
            title="Notifications are off"
            text="Forest App cannot alert you until notifications are allowed. Your reminders are still saved."
            actionLabel={perm === 'blocked' ? 'Open phone settings' : 'Allow notifications'}
            onAction={onFixPermission}
          />
        )}

        <Field label="What do you need to remember?" value={form.title} onChangeText={(v) => set({ title: v })} placeholder="e.g. Group patrol, call from DFO, court summons" editable={!readOnly} maxLength={120} error={errors.title} style={{ marginTop: SPACING.lg }} />
        <Field label="Notes (optional)" value={form.body} onChangeText={(v) => set({ body: v })} placeholder="Place, who to meet, documents to carry…" multiline editable={!readOnly} inputStyle={{ minHeight: 90, textAlignVertical: 'top' }} />

        <SectionLabel>WHEN</SectionLabel>
        {!readOnly && (
          <View style={styles.quickRow}>
            {quickPicks(tick).map((q) => (
              <TouchableOpacity key={q.key} style={styles.quick} onPress={() => set({ when: q.at })} accessibilityRole="button">
                <Text style={styles.quickText}>{q.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <View style={styles.twoCol}>
          <FieldButton style={{ flex: 1 }} icon="calendar-outline" value={formatDateLong(form.when)} onPress={() => setDateOpen(true)} disabled={readOnly} error={errors.when} />
          <FieldButton style={{ width: 130 }} icon="time-outline" value={formatTime12(form.when)} onPress={() => setTimeOpen(true)} disabled={readOnly} />
        </View>

        <SectionLabel>REPEAT</SectionLabel>
        <ChipSelect options={REPEAT_OPTIONS} value={form.repeat} onChange={(v) => set({ repeat: v })} disabled={readOnly} />

        <SectionLabel>REMIND ME BEFORE</SectionLabel>
        <MultiChips options={ALERT_OPTIONS} values={form.alerts} onToggle={toggleAlert} disabledValues={disabledAlerts} disabled={readOnly} />
        <Text style={notesStyles.hint}>You always get an alert at the exact time. Pick extra alerts to be warned earlier.</Text>

        <SectionLabel>KEEP REMINDING ME IF NOT DONE</SectionLabel>
        <ChipSelect options={FOLLOW_OPTIONS} value={form.followEvery} onChange={(v) => set({ followEvery: v })} disabled={readOnly} />
        {form.followEvery > 0 && <Text style={notesStyles.hint}>Up to 4 follow-up alerts after the due time. They stop when you mark the reminder done.</Text>}

        <View style={styles.preview}>
          <Ionicons name="notifications" size={20} color={COLORS.primaryText} />
          <Text style={styles.previewText}>
            {firstAlert ? `First alert: ${firstAlert.text} (${firstAlert.kind})` : 'No alert is left to send. Pick a later time.'}
          </Text>
        </View>
      </ScrollView>

      {!readOnly && (
        <NotesFooter>
          {noteId ? (
            <TouchableOpacity style={notesStyles.dangerButton} onPress={onDelete} accessibilityRole="button">
              <Text style={notesStyles.dangerButtonText}>Delete</Text>
            </TouchableOpacity>
          ) : null}
          <PrimaryButton title={saving ? 'Saving…' : noteId ? 'Save changes' : 'Set reminder'} onPress={onSave} disabled={saving} style={{ flex: 1 }} />
        </NotesFooter>
      )}

      <DatePickerSheet visible={dateOpen} value={form.when} minDate={new Date()} title="Reminder date" onCancel={() => setDateOpen(false)} onConfirm={(d) => { setDateOpen(false); set({ when: d }); }} />
      <TimePickerSheet visible={timeOpen} value={form.when} title="Reminder time" onCancel={() => setTimeOpen(false)} onConfirm={(d) => { setTimeOpen(false); set({ when: d }); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  status: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, marginBottom: SPACING.md },
  statusOverdue: { backgroundColor: COLORS.dangerBg, borderColor: COLORS.dangerBg },
  statusDone: { backgroundColor: COLORS.successBg, borderColor: COLORS.successBg },
  statusTitle: { color: COLORS.textPrimary, fontWeight: '700', fontSize: FONT_SIZE.base },
  statusSub: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginTop: 2 },
  actionCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, marginBottom: SPACING.md },
  doneBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, minHeight: TOUCH_TARGET_MIN + 4, borderRadius: RADIUS.md, backgroundColor: COLORS.primary },
  doneBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONT_SIZE.md },
  actionLabel: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginTop: SPACING.md, marginBottom: SPACING.sm },
  snoozeRow: { flexDirection: 'row', gap: SPACING.sm },
  snoozeBtn: { flex: 1, minHeight: 44, borderRadius: RADIUS.md, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  snoozeText: { color: COLORS.primaryText, fontWeight: '700', fontSize: FONT_SIZE.sm, textAlign: 'center' },
  reopenBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, minHeight: TOUCH_TARGET_MIN, borderRadius: RADIUS.md, backgroundColor: COLORS.primaryLight, marginBottom: SPACING.md },
  reopenText: { color: COLORS.primaryText, fontWeight: '700' },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.xs },
  quick: { minHeight: 40, paddingHorizontal: SPACING.md, borderRadius: 20, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  quickText: { color: COLORS.primaryText, fontWeight: '700', fontSize: FONT_SIZE.sm },
  twoCol: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  preview: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.lg },
  previewText: { flex: 1, color: COLORS.textPrimary, fontWeight: '600', fontSize: FONT_SIZE.sm + 1, lineHeight: 19 },
});
