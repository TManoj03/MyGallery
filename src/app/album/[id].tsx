import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  BackHandler,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useGallery } from '@/context/gallery-context';
import { useTheme } from '@/hooks/use-theme';
import { PhotoGridItem } from '@/components/photo-grid-item';
import { SelectionBottomBar } from '@/components/selection-bottom-bar';
import { AddToAlbumModal } from '@/components/add-to-album-modal';
import { MediaItem } from '@/types/gallery';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NUM_COLUMNS = 3;
const GAP = 3;
const ITEM_WIDTH = (SCREEN_WIDTH - (NUM_COLUMNS - 1) * GAP) / NUM_COLUMNS;

export default function AlbumDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const {
    albums,
    media,
    favorites,
    isSelectionMode,
    selectedIds,
    toggleSelect,
    setIsSelectionMode,
    clearSelection,
  } = useGallery();

  const [showAddToAlbumModal, setShowAddToAlbumModal] = useState(false);

  useEffect(() => {
    return () => {
      clearSelection();
    };
  }, [clearSelection]);

  useEffect(() => {
    if (!isSelectionMode) return;
    const backAction = () => {
      clearSelection();
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [isSelectionMode, clearSelection]);

  const album = useMemo(() => {
    const found = albums.find((a) => a.id === id);
    if (found) return found;

    if (id === 'videos') {
      return {
        id: 'videos',
        title: 'Videos',
        itemCount: media.filter((m) => m.mediaType === 'video').length,
        isSystem: true,
        systemType: 'videos' as const,
        createdAt: 0,
      };
    }
    if (id === 'burst') {
      return {
        id: 'burst',
        title: 'Burst Shots',
        itemCount: media.filter((m) => m.mediaType === 'burst').length,
        isSystem: true,
        systemType: 'burst' as const,
        createdAt: 0,
      };
    }
    if (id === 'camera') {
      return {
        id: 'camera',
        title: 'Camera',
        itemCount: media.filter((m) => m.albumIds.includes('camera')).length,
        isSystem: true,
        systemType: 'camera' as const,
        createdAt: 0,
      };
    }
    if (id === 'favorites') {
      return {
        id: 'favorites',
        title: 'Favorites',
        itemCount: favorites.length,
        isSystem: true,
        systemType: 'favorites' as const,
        createdAt: 0,
      };
    }
    if (id === 'screenshots') {
      return {
        id: 'screenshots',
        title: 'Screenshots',
        itemCount: media.filter((m) => m.albumIds.includes('screenshots')).length,
        isSystem: true,
        systemType: 'screenshots' as const,
        createdAt: 0,
      };
    }
    return undefined;
  }, [albums, id, media, favorites]);

  // Filter items in this album
  const albumMedia = useMemo(() => {
    if (!album) return [];
    if (album.id === 'camera') {
      return media.filter((m) => m.albumIds.includes('camera'));
    }
    if (album.id === 'favorites') {
      return favorites;
    }
    if (album.id === 'screenshots') {
      return media.filter((m) => m.albumIds.includes('screenshots'));
    }
    if (album.id === 'videos') {
      return media.filter((m) => m.mediaType === 'video');
    }
    if (album.id === 'burst') {
      return media.filter((m) => m.mediaType === 'burst');
    }
    return media.filter((m) => m.albumIds.includes(album.id));
  }, [album, media, favorites]);

  if (!album) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text, textAlign: 'center', marginTop: 40 }}>Album not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={{ color: '#FFFFFF' }}>Go Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const handleItemPress = (item: MediaItem) => {
    if (isSelectionMode) {
      toggleSelect(item.id);
    } else {
      router.push(`/viewer/${item.id}` as any);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Top Header */}
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>

        <View style={styles.headerTitleCenter}>
          <Text style={[styles.albumTitleText, { color: theme.text }]} numberOfLines={1}>
            {album.title}
          </Text>
          <Text style={[styles.albumSubtitleText, { color: theme.textSecondary }]}>
            {albumMedia.length} {albumMedia.length === 1 ? 'item' : 'items'}
          </Text>
        </View>

        <Pressable
          onPress={() => {
            if (isSelectionMode) {
              clearSelection();
            } else {
              setIsSelectionMode(true);
            }
          }}
          style={[
            styles.selectPill,
            {
              backgroundColor: isSelectionMode ? theme.primary : theme.backgroundElement,
            },
          ]}
        >
          <Text
            style={[
              styles.selectPillText,
              { color: isSelectionMode ? '#FFFFFF' : theme.text },
            ]}
          >
            {isSelectionMode ? 'Cancel' : 'Select'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          isSelectionMode && { paddingBottom: 110 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Cover Hero Banner */}
        {album.coverUri && (
          <View style={styles.heroBanner}>
            <Image source={{ uri: album.coverUri }} style={styles.heroImage} contentFit="cover" />
            <View style={styles.heroGradient} />
            <View style={styles.heroDetails}>
              <Text style={styles.heroAlbumTitle}>{album.title}</Text>
              <Text style={styles.heroAlbumCount}>
                {albumMedia.length} Photos & Videos
              </Text>
            </View>
          </View>
        )}

        {/* Media Grid */}
        {albumMedia.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons
              name={
                album.id === 'videos'
                  ? 'videocam-outline'
                  : album.id === 'burst'
                  ? 'copy-outline'
                  : album.id === 'favorites'
                  ? 'heart-outline'
                  : album.id === 'screenshots'
                  ? 'phone-portrait-outline'
                  : 'images-outline'
              }
              size={56}
              color={theme.textMuted}
            />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {album.id === 'videos'
                ? 'No Videos'
                : album.id === 'burst'
                ? 'No Burst Shots'
                : album.id === 'favorites'
                ? 'No Favorites'
                : album.id === 'screenshots'
                ? 'No Screenshots'
                : 'No Photos'}
            </Text>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {album.id === 'videos'
                ? 'Videos recorded or saved on this device will appear here'
                : album.id === 'burst'
                ? 'Burst shot sequences will appear here'
                : album.id === 'favorites'
                ? 'Photos and videos you mark as favorite will appear here'
                : album.id === 'screenshots'
                ? 'Screenshots captured on this device will appear here'
                : 'No photos in this album yet'}
            </Text>
          </View>
        ) : (
          <View style={[styles.gridContainer, { gap: GAP }]}>
            {albumMedia.map((item) => (
              <View key={item.id} style={{ width: ITEM_WIDTH }}>
                <PhotoGridItem
                  item={item}
                  density="day"
                  isSelected={selectedIds.includes(item.id)}
                  isSelectionMode={isSelectionMode}
                  onPress={() => handleItemPress(item)}
                  onLongPress={() => {
                    if (!isSelectionMode) {
                      setIsSelectionMode(true);
                    }
                    toggleSelect(item.id);
                  }}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Multi-Select Floating Action Bar */}
      <SelectionBottomBar
        onAddToAlbumPress={() => setShowAddToAlbumModal(true)}
      />

      {/* Add To Album Modal */}
      <AddToAlbumModal
        visible={showAddToAlbumModal}
        onClose={() => setShowAddToAlbumModal(false)}
      />
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
    paddingHorizontal: 12,
  },
  albumTitleText: {
    fontSize: 17,
    fontWeight: '700',
  },
  albumSubtitleText: {
    fontSize: 11,
    marginTop: 2,
  },
  selectPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  selectPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroBanner: {
    width: '100%',
    height: 180,
    position: 'relative',
    marginBottom: 8,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  heroDetails: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
  },
  heroAlbumTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  heroAlbumCount: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    marginTop: 4,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 18,
  },
  backButton: {
    backgroundColor: '#EB0029',
    padding: 10,
    borderRadius: 8,
    alignSelf: 'center',
    marginTop: 16,
  },
});
