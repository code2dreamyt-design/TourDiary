// ---------------------------------------------------------------------------
// Local notifications for Notes reminders and the daily diary reminder.
//
// Everything here is idempotent: syncAll() works out the complete set of
// notifications that SHOULD exist (utils/reminderPlan.js) and makes the phone's
// scheduled list match it — scheduling what is missing/changed and cancelling
// what is stale. It is safe (and cheap) to call at any time: on app open, when
// the app goes to the background, after every save, and when the subscription
// changes. Runs are queued so two calls never overlap.
//
// SUBSCRIPTION RULES: with no active subscription nothing is scheduled and
// everything already scheduled is cancelled (the notes themselves stay safe on
// the phone). While active, no alert is ever scheduled for a moment after the
// paid period ends, so a lapse cannot keep firing reminders.
// ---------------------------------------------------------------------------
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as repo from '../repositories/notesRepository';
import * as secureStorage from '../storage/secureStorage';
import { verifyEntitlementToken } from './entitlementService';
import { checkWriteAccess } from './notesAccess';
import { readDiarySettings, toNote } from './notesModel';
import { buildContent, planDiary, planReminder } from '../utils/reminderPlan';
import { localDateKey } from '../utils/notesTime';
import {
  CHANNEL_DIARY,
  CHANNEL_REMINDERS,
  ID_PREFIX_DIARY,
  ID_PREFIX_NOTE,
  ID_TEST,
  MAX_SCHEDULED,
} from '../constants/notesData';

const ACCENT = '#2F7D50';

// ---- one-time setup --------------------------------------------------------------

let configured = false;

/** Foreground behaviour + Android channels. Idempotent; retried if it ever fails. */
export async function setupNotifications() {
  if (configured) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_REMINDERS, {
      name: 'Reminders',
      description: 'Alerts for the reminders you set in Notes',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 200, 250],
      lightColor: ACCENT,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: true,
    });
    await Notifications.setNotificationChannelAsync(CHANNEL_DIARY, {
      name: 'Diary reminder',
      description: 'Daily nudge to fill in your tour diary',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 150, 200],
      lightColor: ACCENT,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
  configured = true;
}

// ---- permission ------------------------------------------------------------------

/** 'granted' | 'undetermined' | 'denied' (can still ask) | 'blocked' (only the phone's Settings can fix it). */
export async function getPermissionState() {
  try {
    const p = await Notifications.getPermissionsAsync();
    if (p.granted) return 'granted';
    if (p.status === 'undetermined') return 'undetermined';
    return p.canAskAgain === false ? 'blocked' : 'denied';
  } catch (e) {
    return 'denied';
  }
}

/** Asks for permission if allowed to. Returns true when notifications may be shown. */
export async function ensurePermission(prompt) {
  try {
    const state = await getPermissionState();
    if (state === 'granted') return true;
    if (!prompt || state === 'blocked') return false;
    const res = await Notifications.requestPermissionsAsync();
    return !!res.granted;
  } catch (e) {
    return false;
  }
}

// ---- sync ------------------------------------------------------------------------

async function getPaidUntilMs() {
  try {
    const payload = verifyEntitlementToken(await secureStorage.getEntitlementToken());
    const ms = payload && payload.paidUntil ? new Date(payload.paidUntil).getTime() : NaN;
    return Number.isFinite(ms) ? ms : null;
  } catch (e) {
    return null;
  }
}

function isManaged(identifier) {
  return (
    typeof identifier === 'string' &&
    (identifier.startsWith(ID_PREFIX_NOTE) || identifier.startsWith(ID_PREFIX_DIARY))
  );
}

async function scheduleOne(entry) {
  await Notifications.scheduleNotificationAsync({
    identifier: entry.id,
    content: {
      title: entry.title,
      body: entry.body,
      data: entry.data,
      sound: true,
      color: ACCENT,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: entry.at,
      channelId: entry.channelId,
    },
  });
}

async function runSync() {
  await setupNotifications();

  const existing = (await Notifications.getAllScheduledNotificationsAsync()).filter((n) => isManaged(n.identifier));

  // No subscription -> clear everything we own; the notes stay on the phone.
  const access = await checkWriteAccess();
  if (!access.allowed) {
    await Promise.all(existing.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
    return { status: 'LOCKED', scheduled: 0 };
  }

  if ((await getPermissionState()) !== 'granted') return { status: 'NO_PERMISSION', scheduled: 0 };

  const now = new Date();
  const paidUntil = await getPaidUntilMs();

  const wanted = [];

  // reminders
  const reminderRows = await repo.listPendingReminderRows();
  reminderRows.forEach((row) => {
    const note = toNote(row);
    planReminder(note, now).forEach((item) => {
      const content = buildContent(item, note);
      wanted.push({
        id: item.id,
        at: item.at,
        title: content.title,
        body: content.body,
        channelId: CHANNEL_REMINDERS,
        data: { type: 'reminder', noteId: note.id },
      });
    });
  });

  // daily diary reminder
  const diary = readDiarySettings(await repo.getAllSettings());
  if (diary.enabled) {
    let doneToday = false;
    if (diary.skipIfDone) {
      try {
        doneToday = await repo.isDiaryEntryDone(localDateKey(now));
      } catch (e) {
        doneToday = false;
      }
    }
    planDiary(diary, now, doneToday).forEach((item) => {
      const content = buildContent(item, null);
      wanted.push({
        id: item.id,
        at: item.at,
        title: content.title,
        body: content.body,
        channelId: CHANNEL_DIARY,
        data: { type: 'diary' },
      });
    });
  }

  // never beyond the paid period, soonest first, within the alarm budget
  const final = wanted
    .filter((w) => !paidUntil || w.at.getTime() <= paidUntil)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, MAX_SCHEDULED);

  const existingSig = new Map();
  existing.forEach((n) => existingSig.set(n.identifier, n.content && n.content.data ? n.content.data.sig : null));

  let scheduled = 0;
  for (const entry of final) {
    entry.data.sig = `${entry.at.getTime()}|${entry.title}|${entry.body}`;
    if (existingSig.get(entry.id) === entry.data.sig) {
      scheduled++;
      continue; // already on the phone, unchanged
    }
    try {
      await scheduleOne(entry);
      scheduled++;
    } catch (e) {
      // one bad item must not stop the rest
    }
  }

  const keep = new Set(final.map((f) => f.id));
  await Promise.all(
    existing.filter((n) => !keep.has(n.identifier)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );

  return { status: 'OK', scheduled };
}

let running = null;
let rerun = false;

/**
 * Brings the phone's scheduled notifications in line with the saved reminders
 * and diary-reminder settings. Never throws. Calls made while a run is in
 * progress are merged into one follow-up run.
 * Resolves to { status: 'OK' | 'LOCKED' | 'NO_PERMISSION' | 'ERROR', scheduled }.
 */
export function syncAll() {
  if (running) {
    rerun = true;
    return running;
  }
  running = (async () => {
    let result = { status: 'ERROR', scheduled: 0 };
    do {
      rerun = false;
      try {
        result = await runSync();
      } catch (e) {
        result = { status: 'ERROR', scheduled: 0 };
      }
    } while (rerun);
    return result;
  })().finally(() => {
    running = null;
  });
  return running;
}

/** Fires one test notification in ~10 seconds so the user can confirm alerts reach them. */
export async function scheduleTest() {
  await setupNotifications();
  if (!(await ensurePermission(true))) return false;
  await Notifications.scheduleNotificationAsync({
    identifier: ID_TEST,
    content: {
      title: 'Forest App test',
      body: 'Notifications are working. Your reminders will appear like this.',
      sound: true,
      color: ACCENT,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 10,
      channelId: CHANNEL_REMINDERS,
    },
  });
  return true;
}
