import { DIARY_DEFAULTS } from '../constants/notesData';
import { formatHm } from '../utils/notesTime';

// Row <-> object mapping shared by the service and the notification scheduler.

function parseJsonArray(text) {
  try {
    const v = JSON.parse(text);
    return Array.isArray(v) ? v : [];
  } catch (e) {
    return [];
  }
}

export function toNote(row, photos = []) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title || '',
    body: row.body || '',
    color: row.color || '',
    pinned: !!row.pinned,
    category: row.category || '',
    observedAt: row.observed_at,
    place: row.place || '',
    latitude: row.latitude,
    longitude: row.longitude,
    accuracy: row.accuracy,
    remindAt: row.remind_at,
    baseAt: row.base_at,
    repeat: row.repeat || 'NONE',
    alerts: parseJsonArray(row.alerts).map(Number).filter((n) => Number.isFinite(n) && n > 0),
    followEvery: row.follow_every || 0,
    snoozeUntil: row.snooze_until,
    doneAt: row.done_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    photos: photos.map((p) => ({
      id: p.id,
      uri: p.uri,
      mediaId: p.media_id,
      takenAt: p.taken_at,
      latitude: p.latitude,
      longitude: p.longitude,
    })),
  };
}

/** Diary-reminder settings from the raw key/value map, with defaults for anything missing. */
export function readDiarySettings(map) {
  const m = map || {};
  const days = String(m.diary_days || '')
    .split(',')
    .map((x) => parseInt(x, 10))
    .filter((n) => n >= 1 && n <= 7);
  return {
    enabled: m.diary_enabled === '1',
    time: /^\d{1,2}:\d{2}$/.test(m.diary_time || '') ? m.diary_time : DIARY_DEFAULTS.time,
    days: days.length ? days : DIARY_DEFAULTS.days,
    skipIfDone: m.diary_skip_done == null ? DIARY_DEFAULTS.skipIfDone : m.diary_skip_done === '1',
  };
}

export function diarySettingsToEntries(s) {
  return {
    diary_enabled: s.enabled ? '1' : '0',
    diary_time: s.time,
    diary_days: s.days.join(','),
    diary_skip_done: s.skipIfDone ? '1' : '0',
  };
}

export { formatHm };
