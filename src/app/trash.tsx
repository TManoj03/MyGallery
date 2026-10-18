import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';

import { useGallery } from '@/context/gallery-context';
import { useTheme } from '@/hooks/use-theme';
import { MediaItem } from '@/types/gallery';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NUM_COLUMNS = 3;
const GAP = 3;
const ITEM_WIDTH = (SCREEN_WIDTH - (NUM_COLUMNS - 1) * GAP) / NUM_COLUMNS;

export default function TrashScreen() {
  const theme = useTheme();
  const { trash, restoreFromTrash, permanentlyDelete } = useGallery();

  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(style);
      } catch {}
    }
  };

  const handleRestoreAll = () => {
    if (trash.length === 0) return;
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    restoreFromTrash(trash.map((i) => i.id));
    Alert.alert('Restored', 'All items have been restored to your gallery.');
  };

  const handleEmptyTrash = () => {
    if (trash.length === 0) return;
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);

    const emptyAction = () => {
      permanentlyDelete(trash.map((i) => i.id));
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Permanently delete all ${trash.length} items? This cannot be undone.`)) {
        emptyAction();
      }
    } else {
      Alert.alert(
        'Empty Recycle Bin?',
        `Permanently delete all ${trash.length} items? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Empty Bin', style: 'destructive', onPress: emptyAction },
        ]
      );
    }
  };

  const handleItemPress = (item: MediaItem) => {
    triggerHaptic();
    Alert.alert(
      item.title,
      'Recycle Bin item:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: () => restoreFromTrash([item.id]),
        },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: () => permanentlyDelete([item.id]),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Top Header */}
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>

        <View style={styles.headerTitleCenter}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Recently Deleted</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            {trash.length} {trash.length === 1 ? 'item' : 'items'}
          </Text>
        </View>

        <Pressable
          onPress={handleEmptyTrash}
          disabled={trash.length === 0}
          style={[styles.emptyPill, trash.length === 0 && { opacity: 0.4 }]}
        >
          <Text style={[styles.emptyPillText, { color: theme.danger }]}>Empty</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Retention Info Banner */}
        <View style={[styles.infoBanner, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="information-circle-outline" size={20} color={theme.textSecondary} />
          <Text style={[styles.infoText, { color: theme.textSecondary }]}>
            Items in the Recycle Bin will be permanently removed after 30 days.
          </Text>
        </View>

        {/* Action Button Row */}
        {trash.length > 0 && (
          <View style={styles.actionsRow}>
            <Pressable
              onPress={handleRestoreAll}
              style={[styles.actionBtn, { backgroundColor: theme.backgroundElement }]}
            >
              <Ionicons name="arrow-undo-outline" size={16} color={theme.text} />
              <Text style={[styles.actionBtnText, { color: theme.text }]}>Restore All</Text>
            </Pressable>
          </View>
        )}

        {/* Trash Media Grid */}
        {trash.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="trash-outline" size={60} color={theme.textMuted} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Recycle Bin is Empty</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              Photos and videos you delete will appear here for 30 days before being permanently removed.
            </Text>
          </View>
        ) : (
          <View style={[styles.gridContainer, { gap: GAP }]}>
            {trash.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => handleItemPress(item)}
                style={[styles.trashGridItem, { width: ITEM_WIDTH }]}
              >
                <Image source={{ uri: item.uri }} style={styles.trashImage} contentFit="cover" />
                <View style={styles.daysBadge}>
                  <Text style={styles.daysBadgeText}>29d</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerBtn: {
    padding: 6,
  },
  headerTitleCenter: {
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  emptyPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  emptyPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 14,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 4,
  },
  infoText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  trashGridItem: {
    aspectRatio: 1,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 4,
  },
  trashImage: {
    width: '100%',
    height: '100%',
  },
  daysBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  daysBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 32,
  },
});
