import { COLORS } from './colors';

// ---------------------------------------------------------------------------
// Notes feature: the three kinds of note and the small fixed option lists the
// editors offer. Kept in one place so screens, services and the notification
// scheduler all agree on the same keys.
// ---------------------------------------------------------------------------

export const KIND_SIMPLE = 'SIMPLE';
export const KIND_OBSERVATION = 'OBSERVATION';
export const KIND_REMINDER = 'REMINDER';

export const KIND_TABS = [
  { value: KIND_SIMPLE, label: 'Notes', icon: 'document-text-outline' },
  { value: KIND_OBSERVATION, label: 'Observations', icon: 'eye-outline' },
  { value: KIND_REMINDER, label: 'Reminders', icon: 'alarm-outline' },
];

// Card colour tags for simple notes (dark-theme tints of the app palette).
export const NOTE_COLORS = [
  { key: '', label: 'Default', bg: COLORS.surface, bar: COLORS.border },
  { key: 'GREEN', label: 'Green', bg: '#173726', bar: '#4FBF80' },
  { key: 'GOLD', label: 'Gold', bg: '#2E2814', bar: '#D0A85C' },
  { key: 'BLUE', label: 'Blue', bg: '#14283A', bar: '#5AA9E6' },
  { key: 'RED', label: 'Red', bg: '#3B1F1D', bar: '#FF8F86' },
  { key: 'PURPLE', label: 'Purple', bg: '#2A1F3A', bar: '#B392F0' },
];

export function noteColor(key) {
  return NOTE_COLORS.find((c) => c.key === (key || '')) || NOTE_COLORS[0];
}

// What was seen on patrol. `color` tints the category chip.
export const OBS_CATEGORIES = [
  { key: 'WILDLIFE', label: 'Wildlife sighting', icon: 'paw', color: '#7FD1A0' },
  { key: 'SIGNS', label: 'Animal signs', icon: 'footsteps', color: '#A8D98C' },
  { key: 'FELLING', label: 'Illegal felling', icon: 'hammer', color: '#FF8F86' },
  { key: 'POACHING', label: 'Poaching / snare', icon: 'warning', color: '#FFB070' },
  { key: 'FIRE', label: 'Forest fire', icon: 'flame', color: '#FF7A5C' },
  { key: 'ENCROACH', label: 'Encroachment', icon: 'home', color: '#D0A85C' },
  { key: 'WATER', label: 'Water source', icon: 'water', color: '#5AA9E6' },
  { key: 'PLANT', label: 'Plantation / growth', icon: 'leaf', color: '#4FBF80' },
  { key: 'PEST', label: 'Pest / disease', icon: 'bug', color: '#B392F0' },
  { key: 'OTHER', label: 'Other', icon: 'eye', color: '#AEBCB3' },
];

export function obsCategory(key) {
  return OBS_CATEGORIES.find((c) => c.key === key) || OBS_CATEGORIES[OBS_CATEGORIES.length - 1];
}

export const MAX_OBS_PHOTOS = 6;

// ---- reminders -------------------------------------------------------------
export const REPEAT_NONE = 'NONE';
export const REPEAT_OPTIONS = [
  { value: 'NONE', label: 'Once' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
];

// "Remind me ... before" choices, in minutes. The alert AT the due time is
// always sent, so it is not listed here.
export const ALERT_OPTIONS = [
  { value: 10, label: '10 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' },
  { value: 180, label: '3 hours' },
  { value: 1440, label: '1 day' },
  { value: 2880, label: '2 days' },
];
export const DEFAULT_ALERTS = [60];

// "Keep reminding me until it is done": follow-up alerts AFTER the due time.
export const FOLLOW_TIMES = 4;
export const FOLLOW_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 15, label: 'Every 15 min' },
  { value: 30, label: 'Every 30 min' },
  { value: 60, label: 'Every hour' },
];

// ---- diary reminder ----------------------------------------------------------
export const DIARY_DEFAULTS = {
  enabled: false,
  time: '18:00', // 24h "HH:mm"
  days: [1, 2, 3, 4, 5, 6, 7], // ISO weekdays, Monday = 1
  skipIfDone: true,
};
export const WEEKDAY_CHIPS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
];

// ---- notifications -----------------------------------------------------------
export const CHANNEL_REMINDERS = 'reminders';
export const CHANNEL_DIARY = 'diary';
export const ID_PREFIX_NOTE = 'note-';
export const ID_PREFIX_DIARY = 'diary-';
export const ID_TEST = 'notes-test';
// Never keep more than this many alarms scheduled with the phone (soonest first).
export const MAX_SCHEDULED = 120;
export const DIARY_WINDOW_DAYS = 21;
