import React, { useCallback, useLayoutEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as diaryService from '../services/diaryService';
import HeaderAvatar from '../components/HeaderAvatar';
import { COLORS } from '../constants/colors';
import { SPACING, RADIUS, FONT_SIZE, TOUCH_TARGET_MIN } from '../constants/dimensions';
import { getMonthName } from '../utils/dateUtils';

export default function MyDiariesScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [diaries, setDiaries] = useState([]);
  const [error, setError] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await diaryService.getAllDiaries();
      setDiaries(list);
    } catch (e) {
      setError('Unable to load your diaries.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      // Leaving and re-entering this screen should always start fresh,
      // not still mid-selection from a previous visit.
      return () => {
        setSelectMode(false);
        setSelectedIds([]);
      };
    }, [load])
  );

  function toggleSelectMode() {
    setSelectMode((v) => !v);
    setSelectedIds([]);
  }

  function toggleSelected(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleLongPress(item) {
    if (!selectMode) {
      setSelectMode(true);
      setSelectedIds([item.id]);
    }
  }

  function handleCardPress(item) {
    if (selectMode) {
      toggleSelected(item.id);
    } else {
      navigation.navigate('DiaryDetails', { diaryId: item.id });
    }
  }

  function confirmDeleteOne(item) {
    Alert.alert(
      'Delete Diary?',
      `This will permanently delete the ${getMonthName(item.month)} ${item.year} diary and all its entries. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await diaryService.deleteDiary(item.id);
              await load();
            } catch (e) {
              if (e.code === 'WRITE_LOCKED') {
                Alert.alert('Subscription Required', e.message);
              } else {
                Alert.alert('Delete Failed', 'Unable to delete this diary. Please try again.');
              }
            }
          },
        },
      ]
    );
  }

  function confirmDeleteSelected() {
    const count = selectedIds.length;
    if (count === 0) return;
    Alert.alert(
      `Delete ${count} ${count === 1 ? 'Diary' : 'Diaries'}?`,
      'This will permanently delete the selected diaries and all their entries. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await diaryService.deleteDiaries(selectedIds);
              setSelectMode(false);
              setSelectedIds([]);
              await load();
            } catch (e) {
              if (e.code === 'WRITE_LOCKED') {
                Alert.alert('Subscription Required', e.message);
              } else {
                Alert.alert('Delete Failed', 'Unable to delete the selected diaries. Please try again.');
              }
            }
          },
        },
      ]
    );
  }

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerRow}>
          {!selectMode && (
            <TouchableOpacity
              onPress={() => navigation.navigate('CreateDiary')}
              accessibilityRole="button"
              style={styles.headerButton}
            >
              <Text style={styles.headerButtonText}>+ New</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={toggleSelectMode} accessibilityRole="button" style={styles.headerButton}>
            <Text style={styles.headerButtonText}>{selectMode ? 'Cancel' : 'Select'}</Text>
          </TouchableOpacity>
          <HeaderAvatar />
        </View>
      ),
    });
  }, [navigation, selectMode]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primaryText} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (diaries.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No diaries yet. Create one from the Home screen.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        contentContainerStyle={styles.list}
        data={diaries}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => {
          const isSelected = selectedIds.includes(item.id);
          return (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => handleCardPress(item)}
              onLongPress={() => handleLongPress(item)}
              style={[styles.card, isSelected && styles.cardSelected]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  {selectMode && (
                    <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                      {isSelected && <Text style={styles.checkboxMark}>✓</Text>}
                    </View>
                  )}
                  <Text style={styles.cardTitle}>
                    {getMonthName(item.month)} {item.year}
                  </Text>
                </View>
                <Text style={styles.percent}>{item.percent}%</Text>
              </View>
              <Text style={styles.cardSub}>
                {item.completed} / {item.total} days completed
              </Text>

              {!selectMode && (
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.openButton}
                    onPress={() => navigation.navigate('DiaryDetails', { diaryId: item.id })}
                    accessibilityRole="button"
                  >
                    <Text style={styles.openButtonText}>Open</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => confirmDeleteOne(item)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />

      {selectMode && (
        <View style={styles.selectionBar}>
          <Text style={styles.selectionCount}>{selectedIds.length} selected</Text>
          <TouchableOpacity
            style={[styles.selectionDeleteButton, selectedIds.length === 0 && styles.selectionDeleteButtonDisabled]}
            onPress={confirmDeleteSelected}
            disabled={selectedIds.length === 0}
            accessibilityRole="button"
          >
            <Text style={styles.selectionDeleteText}>Delete Selected</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: SPACING.lg, backgroundColor: COLORS.background, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background, padding: SPACING.lg },
  errorText: { color: COLORS.dangerText, fontSize: FONT_SIZE.base },
  emptyText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.base, textAlign: 'center' },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  cardSelected: {
    borderColor: COLORS.primaryText,
    borderWidth: 2,
    backgroundColor: COLORS.primaryLight,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  cardTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.textPrimary },
  percent: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.primaryText },
  cardSub: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: SPACING.xs },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: COLORS.primaryText,
    marginRight: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  checkboxChecked: { backgroundColor: COLORS.primary },
  checkboxMark: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  actionRow: { flexDirection: 'row', marginTop: SPACING.md, gap: SPACING.md },
  openButton: {
    flex: 1,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
    minHeight: TOUCH_TARGET_MIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openButtonText: { color: COLORS.primaryText, fontWeight: '700' },
  deleteButton: {
    flex: 1,
    backgroundColor: COLORS.dangerBg,
    borderRadius: RADIUS.md,
    minHeight: TOUCH_TARGET_MIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: { color: COLORS.dangerText, fontWeight: '700' },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  headerButton: { paddingHorizontal: SPACING.md, minHeight: TOUCH_TARGET_MIN, justifyContent: 'center' },
  headerButtonText: { color: COLORS.white, fontWeight: '700', fontSize: FONT_SIZE.base },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  selectionCount: { fontSize: FONT_SIZE.base, color: COLORS.textSecondary, fontWeight: '600' },
  selectionDeleteButton: {
    backgroundColor: COLORS.danger,
    borderRadius: RADIUS.md,
    minHeight: TOUCH_TARGET_MIN,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionDeleteButtonDisabled: { backgroundColor: COLORS.lockedFill },
  selectionDeleteText: { color: COLORS.white, fontWeight: '700' },
});
