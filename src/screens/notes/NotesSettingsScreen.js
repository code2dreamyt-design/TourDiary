import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Linking, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as notesService from '../../services/notesService';
import * as scheduler from '../../services/reminderScheduler';
import { SectionLabel, SecondaryButton, tdShared } from '../../components/td/TDParts';
import { FieldButton, LockedBanner, MultiChips, NoticeCard, SwitchRow, notesStyles } from '../../components/notes/NotesParts';
import { TimePickerSheet } from '../../components/notes/NotesPickers';
import { showToast } from '../../components/Toast';
import { WEEKDAY_CHIPS } from '../../constants/notesData';
import { planDiary } from '../../utils/reminderPlan';
import { formatHm, friendlyDateTime, formatTime12, parseHm } from '../../utils/notesTime';
import { COLORS } from '../../constants/colors';
import { SPACING, RADIUS, FONT_SIZE } from '../../constants/dimensions';
import { explainNotifyStatus, handleSaveError, requireWriteAccess } from './notesGuard';

function timeToDate(hm) {
  const { hour, minute } = parseHm(hm);
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

// Daily diary reminder + a place to check that notifications can actually reach you.
export default function NotesSettingsScreen({ navigation }) {
  const [settings, setSettings] = useState(null);
  const [perm, setPerm] = useState('granted');
  const [access, setAccess] = useState({ checked: false, allowed: true });
  const [timeOpen, setTimeOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, p, a] = await Promise.all([notesService.getDiarySettings(), scheduler.getPermissionState(), notesService.checkWriteAccess()]);
      setSettings(s);
      setPerm(p);
      setAccess({ checked: true, allowed: a.allowed });
    } catch (e) {
      showToast('Unable to load the reminder settings.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const readOnly = access.checked && !access.allowed;

  async function update(patch) {
    if (!settings || busy) return;
    if (!(await requireWriteAccess(navigation))) return;
    const prev = settings;
    const next = { ...settings, ...patch };
    setSettings(next);
    setBusy(true);
    try {
      const res = await notesService.saveDiarySettings(next);
      setSettings(res.settings);
      setPerm(await scheduler.getPermissionState());
      explainNotifyStatus(res.notifyStatus, () => Linking.openSettings());
    } catch (e) {
      setSettings(prev);
      handleSaveError(navigation, e, 'Unable to save the diary reminder. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function toggleDay(day) {
    const has = settings.days.includes(day);
    if (has && settings.days.length === 1) {
      showToast('Keep at least one day selected.');
      return;
    }
    update({ days: has ? settings.days.filter((d) => d !== day) : [...settings.days, day].sort((a, b) => a - b) });
  }

  const nextText = useMemo(() => {
    if (!settings || !settings.enabled) return null;
    const first = planDiary({ ...settings, skipIfDone: false }, new Date(), false)[0];
    return first ? friendlyDateTime(first.at) : null;
  }, [settings]);

  async function onTest() {
    try {
      const ok = await scheduler.scheduleTest();
      setPerm(await scheduler.getPermissionState());
      if (ok) showToast('Test notification arrives in about 10 seconds.', 3500);
      else explainNotifyStatus('NO_PERMISSION', () => Linking.openSettings());
    } catch (e) {
      showToast('Could not schedule the test notification.');
    }
  }

  if (!settings) {
    return (
      <View style={notesStyles.center}>
        <ActivityIndicator size="large" color={COLORS.primaryText} />
      </View>
    );
  }

  const permOk = perm === 'granted';
  return (
    <ScrollView style={notesStyles.screen} contentContainerStyle={notesStyles.form} keyboardShouldPersistTaps="handled">
      {readOnly && <LockedBanner message="Subscription inactive — settings are view only. Renew to change them." onSubscribe={() => navigation.navigate('Subscription')} />}

      <SectionLabel>DAILY DIARY REMINDER</SectionLabel>
      <View style={tdShared.card}>
        <SwitchRow
          label="Remind me to fill my diary"
          hint="A nudge every day so no tour entry is missed."
          value={settings.enabled}
          onValueChange={(v) => update({ enabled: v })}
          disabled={readOnly || busy}
        />
        {settings.enabled && (
          <>
            <FieldButton label="Time" icon="time-outline" value={formatTime12(timeToDate(settings.time))} onPress={() => setTimeOpen(true)} disabled={readOnly || busy} />
            <Text style={styles.label}>DAYS</Text>
            <MultiChips options={WEEKDAY_CHIPS} values={settings.days} onToggle={toggleDay} disabled={readOnly || busy} />
            <View style={{ marginTop: SPACING.md }}>
              <SwitchRow
                label="Skip when today's entry is done"
                hint="No reminder if you have already completed today's diary entry."
                value={settings.skipIfDone}
                onValueChange={(v) => update({ skipIfDone: v })}
                disabled={readOnly || busy}
              />
            </View>
            {nextText ? (
              <View style={styles.next}>
                <Ionicons name="notifications" size={18} color={COLORS.primaryText} />
                <Text style={styles.nextText}>Next reminder: {nextText}</Text>
              </View>
            ) : null}
          </>
        )}
      </View>

      <SectionLabel>NOTIFICATIONS</SectionLabel>
      <View style={tdShared.card}>
        <View style={styles.statusRow}>
          <Ionicons name={permOk ? 'checkmark-circle' : 'alert-circle'} size={22} color={permOk ? COLORS.success : COLORS.accent} />
          <Text style={styles.statusText}>{permOk ? 'Notifications are allowed' : perm === 'blocked' ? 'Notifications are blocked in phone settings' : 'Notifications are not allowed yet'}</Text>
        </View>
        <View style={styles.btnRow}>
          {!permOk && (
            <SecondaryButton
              title={perm === 'blocked' ? 'Open phone settings' : 'Allow notifications'}
              style={{ flex: 1 }}
              onPress={async () => {
                if (perm === 'blocked') {
                  Linking.openSettings();
                  return;
                }
                const ok = await scheduler.ensurePermission(true);
                setPerm(await scheduler.getPermissionState());
                if (ok) scheduler.syncAll();
                else Linking.openSettings();
              }}
            />
          )}
          <SecondaryButton title="Send a test" style={{ flex: 1 }} onPress={onTest} />
        </View>
      </View>

      <NoticeCard
        icon="battery-charging-outline"
        title="To be sure alerts arrive on time"
        text="Some phones stop apps in the background to save battery. If a reminder ever comes late, open your phone's Settings, find Forest App under Battery and choose Unrestricted (or turn off battery optimisation for it)."
        actionLabel="Open phone settings"
        onAction={() => Linking.openSettings()}
      />
      <Text style={notesStyles.hint}>
        Reminders and the diary reminder need an active subscription. Your notes always stay on your phone and can be read at any time.
      </Text>

      <TimePickerSheet
        visible={timeOpen}
        value={timeToDate(settings.time)}
        title="Diary reminder time"
        onCancel={() => setTimeOpen(false)}
        onConfirm={(d) => {
          setTimeOpen(false);
          update({ time: formatHm(d.getHours(), d.getMinutes()) });
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  label: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginTop: SPACING.md, marginBottom: SPACING.sm },
  next: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.md },
  nextText: { flex: 1, color: COLORS.textPrimary, fontWeight: '600', fontSize: FONT_SIZE.sm + 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  statusText: { flex: 1, color: COLORS.textPrimary, fontWeight: '600', fontSize: FONT_SIZE.base },
  btnRow: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.md },
});
