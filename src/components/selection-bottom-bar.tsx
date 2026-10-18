import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/hooks/use-theme';
import { useGallery } from '@/context/gallery-context';
import { shareMultipleMediaItems } from '@/services/media-share';

interface SelectionBottomBarProps {
  onAddToAlbumPress: () => void;
}

export function SelectionBottomBar({ onAddToAlbumPress }: SelectionBottomBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const {
    isSelectionMode,
    selectedIds,
    allMedia,
    deleteToTrash,
    toggleFavorite,
    clearSelection,
  } = useGallery();

  const [isSharing, setIsSharing] = useState(false);

  if (!isSelectionMode) return null;

  const count = selectedIds.length;
  const hasSelection = count > 0;

  const triggerHaptic = () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }
  };

  const handleFavoriteAll = () => {
    if (!hasSelection) return;
    triggerHaptic();
    selectedIds.forEach((id) => toggleFavorite(id));
    clearSelection();
  };

  const handleDeleteAll = () => {
    if (!hasSelection) return;
    triggerHaptic();

    if (Platform.OS === 'web') {
      if (window.confirm(`Move ${count} items to Recycle Bin?`)) {
        deleteToTrash(selectedIds);
      }
    } else {
      Alert.alert(
        'Move to Recycle Bin?',
        `These ${count} items will be kept in the Recycle Bin for 30 days before permanent deletion.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => deleteToTrash(selectedIds),
          },
        ]
      );
    }
  };

  const handleShare = async () => {
    if (!hasSelection || isSharing) return;
    triggerHaptic();
    const selectedItems = allMedia.filter((item) => selectedIds.includes(item.id));
    if (selectedItems.length === 0) return;

    setIsSharing(true);
    try {
      await shareMultipleMediaItems(selectedItems);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.card,
          borderTopColor: theme.border,
          paddingBottom: Math.max(insets.bottom, 12),
        },
      ]}
    >
      <Pressable
        onPress={handleShare}
        disabled={!hasSelection || isSharing}
        style={({ pressed }) => [
          styles.actionButton,
          (!hasSelection || isSharing) && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        {isSharing ? (
          <ActivityIndicator size="small" color={theme.text} style={{ height: 22 }} />
        ) : (
          <Ionicons name="share-outline" size={22} color={hasSelection ? theme.text : theme.textMuted} />
        )}
        <Text style={[styles.actionLabel, { color: hasSelection ? theme.text : theme.textMuted }]}>
          {isSharing ? 'Sharing…' : 'Share'}
        </Text>
      </Pressable>

      <Pressable
        onPress={handleFavoriteAll}
        disabled={!hasSelection}
        style={({ pressed }) => [styles.actionButton, !hasSelection && styles.disabled, pressed && styles.pressed]}
      >
        <Ionicons name="heart-outline" size={22} color={hasSelection ? '#FF2B44' : theme.textMuted} />
        <Text style={[styles.actionLabel, { color: hasSelection ? theme.text : theme.textMuted }]}>
          Favorite
        </Text>
      </Pressable>

      <Pressable
        onPress={onAddToAlbumPress}
        disabled={!hasSelection}
        style={({ pressed }) => [styles.actionButton, !hasSelection && styles.disabled, pressed && styles.pressed]}
      >
        <Ionicons name="folder-outline" size={22} color={hasSelection ? theme.text : theme.textMuted} />
        <Text style={[styles.actionLabel, { color: hasSelection ? theme.text : theme.textMuted }]}>
          Add to
        </Text>
      </Pressable>

      <Pressable
        onPress={handleDeleteAll}
        disabled={!hasSelection}
        style={({ pressed }) => [styles.actionButton, !hasSelection && styles.disabled, pressed && styles.pressed]}
      >
        <Ionicons name="trash-outline" size={22} color={hasSelection ? theme.danger : theme.textMuted} />
        <Text style={[styles.actionLabel, { color: hasSelection ? theme.danger : theme.textMuted }]}>
          Delete
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 10,
    zIndex: 100,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    gap: 4,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
});
