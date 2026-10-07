import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, ActivityIndicator, Image, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import * as notesService from '../../services/notesService';
import { PrimaryButton } from '../../components/td/TDParts';
import { EmptyState, LockedBanner, SegmentTabs } from '../../components/notes/NotesParts';
import { showToast } from '../../components/Toast';
import { KIND_OBSERVATION, KIND_REMINDER, KIND_SIMPLE, KIND_TABS, noteColor, obsCategory } from '../../constants/notesData';
import { effectiveDue } from '../../utils/reminderPlan';
import { alertsSummary, groupReminders, noteMatchesSearch, reminderWhenText, repeatLabel } from '../../utils/notesFormat';
import { formatDateShort, formatTime12, friendlyDateTime, overdueText } from '../../utils/notesTime';
import { COLORS } from '../../constants/colors';
import { SPACING, RADIUS, FONT_SIZE, TOUCH_TARGET_MIN, CAMERA_CLEARANCE } from '../../constants/dimensions';
import { handleSaveError, requireWriteAccess } from './notesGuard';

const NEW_LABEL = { [KIND_SIMPLE]: '+ New note', [KIND_OBSERVATION]: '+ New observation', [KIND_REMINDER]: '+ New reminder' };
const NEW_ROUTE = { [KIND_SIMPLE]: 'SimpleNote', [KIND_OBSERVATION]: 'Observation', [KIND_REMINDER]: 'Reminder' };
const SEARCH_HINT = { [KIND_SIMPLE]: 'Search notes', [KIND_OBSERVATION]: 'Search observations or places', [KIND_REMINDER]: 'Search reminders' };

function hmLabel(hm) {
  const [h, m] = String(hm).split(':').map((x) => parseInt(x, 10));
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return formatTime12(d);
}

// The Notes tab: simple notes, observations and reminders, kept apart by a
// switcher. Everything is always readable; creating, editing, completing and
// deleting need an active subscription (checked again by notesService).
export default function NotesHomeScreen({ navigation }) {
  const { subscriptionActive } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({ simple: [], observations: [], reminders: [] });
  const [diary, setDiary] = useState(null);
  const [tab, setTab] = useState(KIND_SIMPLE);
  const [search, setSearch] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [now, setNow] = useState(new Date());

  const load = useCallback(async () => {
    setError(null);
    try {
      const [all, d] = await Promise.all([notesService.listAll(), notesService.getDiarySettings()]);
      setData(all);
      setDiary(d);
    } catch (e) {
      setError('Unable to load your notes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      setNow(new Date());
      const id = setInterval(() => setNow(new Date()), 30000);
      return () => clearInterval(id);
    }, [load])
  );

  const filtered = useMemo(() => {
    const src = tab === KIND_SIMPLE ? data.simple : tab === KIND_OBSERVATION ? data.observations : data.reminders;
    return src.filter((n) => noteMatchesSearch(n, search));
  }, [data, tab, search]);

  const grouped = useMemo(() => groupReminders(data.reminders, now), [data.reminders, now]);
  const counts = useMemo(
    () => ({
      [KIND_SIMPLE]: data.simple.length,
      [KIND_OBSERVATION]: data.observations.length,
      [KIND_REMINDER]: grouped.overdue.length + grouped.today.length + grouped.upcoming.length,
    }),
    [data, grouped]
  );

  const rows = useMemo(() => {
    const out = [];
    if (tab === KIND_SIMPLE) {
      for (let i = 0; i < filtered.length; i += 2) out.push({ type: 'pair', key: `p${filtered[i].id}`, items: [filtered[i], filtered[i + 1] || null] });
    } else if (tab === KIND_OBSERVATION) {
      filtered.forEach((n) => out.push({ type: 'obs', key: `o${n.id}`, note: n }));
    } else {
      const g = groupReminders(filtered, now);
      const section = (key, title, list, tone, collapsible) => {
        if (!list.length) return;
        out.push({ type: 'sec', key: `s-${key}`, title, count: list.length, tone, collapsible, open: collapsible ? showDone : true });
        if (!collapsible || showDone) list.forEach((n) => out.push({ type: 'rem', key: `r${n.id}`, note: n }));
      };
      section('over', 'OVERDUE', g.overdue, 'danger');
      section('today', 'TODAY', g.today, 'primary');
      section('up', 'UPCOMING', g.upcoming, 'muted');
      section('done', 'DONE', g.done, 'muted', true);
    }
    return out;
  }, [tab, filtered, now, showDone]);

  async function onNew() {
    if (!(await requireWriteAccess(navigation))) return;
    navigation.navigate(NEW_ROUTE[tab]);
  }

  async function onToggleDone(n) {
    if (busyId) return;
    if (!(await requireWriteAccess(navigation))) return;
    setBusyId(n.id);
    try {
      if (n.doneAt) {
        await notesService.reopenReminder(n.id);
        showToast('Reminder is active again');
      } else {
        const res = await notesService.completeReminder(n.id);
        showToast(res.next ? `Done. Next: ${friendlyDateTime(res.next)}` : 'Marked as done');
      }
      await load();
    } catch (e) {
      handleSaveError(navigation, e, 'Unable to update this reminder.');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primaryText} />
      </View>
    );
  }

  const emptyAll = filtered.length === 0;
  const total = tab === KIND_SIMPLE ? data.simple.length : tab === KIND_OBSERVATION ? data.observations.length : data.reminders.length;

  const header = (
    <View>
      {!subscriptionActive && <LockedBanner message="Subscription inactive — view only. Renew to add or change notes." onSubscribe={() => navigation.navigate('Subscription')} />}

      <TouchableOpacity style={styles.diaryCard} onPress={() => navigation.navigate('NotesSettings')} accessibilityRole="button" accessibilityLabel="Diary reminder settings">
        <View style={styles.diaryIcon}>
          <Ionicons name={diary && diary.enabled ? 'notifications' : 'notifications-off-outline'} size={20} color={diary && diary.enabled ? COLORS.primaryText : COLORS.textMuted} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.diaryTitle}>Daily diary reminder</Text>
          <Text style={styles.diarySub}>
            {diary && diary.enabled ? `On · every day at ${hmLabel(diary.time)}${diary.days.length < 7 ? ` · ${diary.days.length} days a week` : ''}` : 'Off · tap to set a daily nudge'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
      </TouchableOpacity>

      <SegmentTabs tabs={KIND_TABS} value={tab} onChange={(t) => { setTab(t); setSearch(''); }} counts={counts} />

      <PrimaryButton title={NEW_LABEL[tab]} onPress={onNew} style={{ marginTop: SPACING.md }} />
      {total > 0 && (
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder={SEARCH_HINT[tab]}
          placeholderTextColor={COLORS.textMuted}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.list}
      data={rows}
      keyExtractor={(r) => r.key}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={header}
      ListEmptyComponent={
        emptyAll ? (
          total === 0 ? (
            tab === KIND_SIMPLE ? (
              <EmptyState icon="document-text-outline" title="No notes yet" text="Jot down anything you want to remember. Tap “+ New note” to start." />
            ) : tab === KIND_OBSERVATION ? (
              <EmptyState icon="eye-outline" title="No observations yet" text="Record what you see on patrol, with photos and the place. Tap “+ New observation”." />
            ) : (
              <EmptyState icon="alarm-outline" title="No reminders yet" text="Add a patrol, a summons or a call from higher-ups and get alerted at the right time." />
            )
          ) : (
            <EmptyState icon="search" title="Nothing found" text="No items match your search." />
          )
        ) : null
      }
      renderItem={({ item }) => {
        if (item.type === 'pair') {
          return (
            <View style={styles.pairRow}>
              <SimpleCard note={item.items[0]} onPress={() => navigation.navigate('SimpleNote', { noteId: item.items[0].id })} />
              {item.items[1] ? <SimpleCard note={item.items[1]} onPress={() => navigation.navigate('SimpleNote', { noteId: item.items[1].id })} /> : <View style={{ flex: 1 }} />}
            </View>
          );
        }
        if (item.type === 'obs') return <ObservationCard note={item.note} onPress={() => navigation.navigate('Observation', { noteId: item.note.id })} />;
        if (item.type === 'sec') {
          return (
            <TouchableOpacity
              style={styles.secHead}
              disabled={!item.collapsible}
              onPress={() => setShowDone((v) => !v)}
              accessibilityRole={item.collapsible ? 'button' : 'header'}
            >
              <Text style={[styles.secTitle, item.tone === 'danger' && { color: COLORS.dangerText }, item.tone === 'primary' && { color: COLORS.primaryText }]}>
                {item.title} · {item.count}
              </Text>
              {item.collapsible ? <Ionicons name={item.open ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.textMuted} /> : null}
            </TouchableOpacity>
          );
        }
        return (
          <ReminderRow
            note={item.note}
            now={now}
            busy={busyId === item.note.id}
            onToggle={() => onToggleDone(item.note)}
            onPress={() => navigation.navigate('Reminder', { noteId: item.note.id })}
          />
        );
      }}
    />
  );
}

// ---- rows ---------------------------------------------------------------------------

function SimpleCard({ note, onPress }) {
  const c = noteColor(note.color);
  return (
    <TouchableOpacity style={[styles.simple, { backgroundColor: c.bg, borderLeftColor: c.bar }]} onPress={onPress} activeOpacity={0.85} accessibilityRole="button">
      <View style={styles.simpleTop}>
        <Text style={styles.simpleTitle} numberOfLines={2}>{note.title || 'Untitled note'}</Text>
        {note.pinned ? <Ionicons name="pin" size={15} color={COLORS.accent} /> : null}
      </View>
      {note.body ? <Text style={styles.simpleBody} numberOfLines={6}>{note.body}</Text> : null}
      <Text style={styles.simpleDate}>{formatDateShort(new Date(note.updatedAt))}</Text>
    </TouchableOpacity>
  );
}

function ObservationCard({ note, onPress }) {
  const cat = obsCategory(note.category);
  const [failed, setFailed] = useState(false);
  const cover = note.photos[0];
  const seen = new Date(note.observedAt || note.createdAt);
  return (
    <TouchableOpacity style={styles.obs} onPress={onPress} activeOpacity={0.85} accessibilityRole="button">
      <View style={[styles.obsThumb, { backgroundColor: cat.color + '26' }]}>
        {cover && !failed ? (
          <Image source={{ uri: cover.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFailed(true)} />
        ) : (
          <Ionicons name={cat.icon} size={30} color={cat.color} />
        )}
        {note.photos.length > 1 ? (
          <View style={styles.obsCount}>
            <Ionicons name="images" size={11} color={COLORS.white} />
            <Text style={styles.obsCountText}>{note.photos.length}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.obsTop}>
          <View style={[styles.catPill, { backgroundColor: cat.color + '26' }]}>
            <Ionicons name={cat.icon} size={12} color={cat.color} />
            <Text style={[styles.catPillText, { color: cat.color }]} numberOfLines={1}>{cat.label}</Text>
          </View>
          {note.pinned ? <Ionicons name="star" size={15} color={COLORS.accent} /> : null}
        </View>
        <Text style={styles.obsTitle} numberOfLines={2}>{note.title}</Text>
        <Text style={styles.obsMeta} numberOfLines={1}>
          {formatDateShort(seen)} · {formatTime12(seen)}
        </Text>
        {note.place ? <Text style={styles.obsMeta} numberOfLines={1}>📍 {note.place}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

function ReminderRow({ note, now, busy, onToggle, onPress }) {
  const done = !!note.doneAt;
  const due = done ? null : effectiveDue(note, now);
  const overdue = !done && due && due.getTime() <= now.getTime();
  return (
    <TouchableOpacity style={[styles.rem, overdue && styles.remOverdue]} onPress={onPress} activeOpacity={0.85} accessibilityRole="button">
      <TouchableOpacity
        style={styles.remCheck}
        onPress={onToggle}
        disabled={busy}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={done ? 'Mark as not done' : 'Mark as done'}
      >
        {busy ? (
          <ActivityIndicator size="small" color={COLORS.primaryText} />
        ) : (
          <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={28} color={done ? COLORS.success : overdue ? COLORS.dangerText : COLORS.primaryText} />
        )}
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={[styles.remTitle, done && styles.remTitleDone]} numberOfLines={2}>{note.title}</Text>
        {done ? (
          <Text style={styles.remMeta}>Completed {friendlyDateTime(new Date(note.doneAt), now)}</Text>
        ) : (
          <>
            <Text style={[styles.remWhen, overdue && { color: COLORS.dangerText }]}>
              {overdue ? `${overdueText(due, now)} · ` : ''}
              {reminderWhenText(note, now)}
            </Text>
            <Text style={styles.remMeta} numberOfLines={1}>
              {note.repeat !== 'NONE' ? `${repeatLabel(note.repeat)} · ` : ''}
              {alertsSummary(note)}
            </Text>
          </>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  list: { padding: SPACING.lg, paddingBottom: CAMERA_CLEARANCE, flexGrow: 1 },
  error: { color: COLORS.dangerText, marginTop: SPACING.sm },
  diaryCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, marginBottom: SPACING.md },
  diaryIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  diaryTitle: { color: COLORS.textPrimary, fontWeight: '700', fontSize: FONT_SIZE.base },
  diarySub: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginTop: 1 },
  search: { marginTop: SPACING.md, minHeight: TOUCH_TARGET_MIN, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, color: COLORS.textPrimary, paddingHorizontal: SPACING.md, fontSize: FONT_SIZE.base },
  pairRow: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.md },
  simple: { flex: 1, borderRadius: RADIUS.lg, borderLeftWidth: 5, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, minHeight: 110 },
  simpleTop: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.xs },
  simpleTitle: { flex: 1, color: COLORS.textPrimary, fontWeight: '700', fontSize: FONT_SIZE.base },
  simpleBody: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm + 1, lineHeight: 19, marginTop: SPACING.xs },
  simpleDate: { color: COLORS.textMuted, fontSize: 11, marginTop: SPACING.sm, fontWeight: '600' },
  obs: { flexDirection: 'row', gap: SPACING.md, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, marginTop: SPACING.md },
  obsThumb: { width: 84, height: 84, borderRadius: RADIUS.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  obsCount: { position: 'absolute', right: 4, bottom: 4, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  obsCountText: { color: COLORS.white, fontSize: 11, fontWeight: '700' },
  obsTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  catPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 1 },
  catPillText: { fontSize: 11, fontWeight: '700' },
  obsTitle: { color: COLORS.textPrimary, fontWeight: '700', fontSize: FONT_SIZE.base, marginTop: 4 },
  obsMeta: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginTop: 2 },
  secHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40, marginTop: SPACING.md },
  secTitle: { color: COLORS.textMuted, fontWeight: '700', fontSize: FONT_SIZE.sm, letterSpacing: 0.6 },
  rem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, marginTop: SPACING.sm },
  remOverdue: { borderColor: COLORS.dangerBg, backgroundColor: '#241A19' },
  remCheck: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  remTitle: { color: COLORS.textPrimary, fontWeight: '700', fontSize: FONT_SIZE.base },
  remTitleDone: { color: COLORS.textMuted, textDecorationLine: 'line-through' },
  remWhen: { color: COLORS.primaryText, fontWeight: '700', fontSize: FONT_SIZE.sm, marginTop: 2 },
  remMeta: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginTop: 2 },
});
