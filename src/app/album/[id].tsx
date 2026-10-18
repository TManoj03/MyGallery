import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useGallery } from '@/context/gallery-context';
import { useTheme } from '@/hooks/use-theme';
import { PhotoGridItem } from '@/components/photo-grid-item';
import { MediaItem } from '@/types/gallery';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NUM_COLUMNS = 3;
const GAP = 3;
const ITEM_WIDTH = (SCREEN_WIDTH - (NUM_COLUMNS - 1) * GAP) / NUM_COLUMNS;

export default function AlbumDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { albums, media, favorites, isSelectionMode, selectedIds, toggleSelect, setIsSelectionMode } =
    useGallery();

  const album = useMemo(() => {
    const found = albums.find((a) => a.id === id);
    if (found) return found;
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
    return undefined;
  }, [albums, id, media]);

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
          onPress={() => setIsSelectionMode(!isSelectionMode)}
          style={[styles.selectPill, { backgroundColor: theme.backgroundElement }]}
        >
          <Text style={[styles.selectPillText, { color: theme.text }]}>
            {isSelectionMode ? 'Done' : 'Select'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
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
            <Ionicons name="images-outline" size={48} color={theme.textMuted} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No photos in this album yet
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
                      toggleSelect(item.id);
                    }
                  }}
                />
              </View>
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
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
  },
  backButton: {
    backgroundColor: '#EB0029',
    padding: 10,
    borderRadius: 8,
    alignSelf: 'center',
    marginTop: 16,
  },
});
