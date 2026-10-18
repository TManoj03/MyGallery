import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { MediaItem, ViewDensity } from '@/types/gallery';
import { useTheme } from '@/hooks/use-theme';

interface PhotoGridItemProps {
  item: MediaItem;
  density: ViewDensity;
  isSelected: boolean;
  isSelectionMode: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

export function PhotoGridItem({
  item,
  density,
  isSelected,
  isSelectionMode,
  onPress,
  onLongPress,
}: PhotoGridItemProps) {
  const theme = useTheme();

  const handleLongPress = () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }
    onLongPress();
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Adjust aspect ratio and styling based on density
  const getAspectRatio = () => {
    if (density === 'day') {
      return item.width > item.height ? 4 / 3 : 3 / 4;
    }
    return 1; // Month and Year are square grids
  };

  const showBadges = density !== 'year';

  return (
    <Pressable
      onPress={onPress}
      onLongPress={handleLongPress}
      delayLongPress={250}
      style={({ pressed }) => [
        styles.container,
        { aspectRatio: getAspectRatio() },
        isSelected && styles.selectedBorder,
        pressed && styles.pressed,
      ]}
    >
      <Image
        source={{ uri: item.uri }}
        style={styles.image}
        contentFit="cover"
        transition={200}
        cachePolicy="memory-disk"
      />

      {/* Dim overlay when selected */}
      {isSelected && <View style={styles.selectedOverlay} />}

      {/* Selection checkbox badge */}
      {isSelectionMode && (
        <View style={styles.checkboxContainer}>
          <View
            style={[
              styles.checkboxCircle,
              isSelected
                ? [styles.checkboxChecked, { backgroundColor: theme.primary, borderColor: theme.primary }]
                : styles.checkboxUnchecked,
            ]}
          >
            {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
          </View>
        </View>
      )}

      {/* Favorite Heart Badge */}
      {showBadges && item.isFavorite && !isSelectionMode && (
        <View style={styles.favoriteBadge}>
          <Ionicons name="heart" size={12} color="#FF2B44" />
        </View>
      )}

      {/* Video duration pill */}
      {showBadges && item.mediaType === 'video' && (
        <View style={styles.videoBadge}>
          <Ionicons name="play" size={10} color="#FFFFFF" style={{ marginRight: 3 }} />
          <Text style={styles.videoText}>{formatDuration(item.duration)}</Text>
        </View>
      )}

      {/* Burst mode pill */}
      {showBadges && item.mediaType === 'burst' && (
        <View style={styles.burstBadge}>
          <Ionicons name="copy-outline" size={10} color="#FFFFFF" style={{ marginRight: 3 }} />
          <Text style={styles.burstText}>Burst</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#1E2024',
    borderRadius: 4,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  pressed: {
    opacity: 0.88,
  },
  selectedBorder: {
    borderWidth: 2,
    borderColor: '#EB0029',
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(235, 0, 41, 0.22)',
  },
  checkboxContainer: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  checkboxCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  checkboxUnchecked: {
    borderColor: 'rgba(255, 255, 255, 0.85)',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  checkboxChecked: {
    borderColor: '#EB0029',
  },
  favoriteBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  videoText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  burstBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  burstText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});
