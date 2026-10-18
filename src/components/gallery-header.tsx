import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/hooks/use-theme';
import { useGallery } from '@/context/gallery-context';
import { DensitySwitcher } from './density-switcher';

const CATEGORIES = ['All', 'Camera', 'Screenshots', 'Videos', 'Downloads', 'WhatsApp'];

interface GalleryHeaderProps {
  photoCount: number;
  onCameraPress?: () => void;
}

export function GalleryHeader({ photoCount, onCameraPress }: GalleryHeaderProps) {
  const theme = useTheme();
  const {
    viewDensity,
    setViewDensity,
    isSelectionMode,
    setIsSelectionMode,
    clearSelection,
    selectedIds,
    searchQuery,
    setSearchQuery,
    activeCategoryFilter,
    setActiveCategoryFilter,
  } = useGallery();

  const [showSearch, setShowSearch] = useState(false);

  const toggleSearch = () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
    if (showSearch) {
      setSearchQuery('');
    }
    setShowSearch(!showSearch);
  };

  const handleSelectionToggle = () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }
    if (isSelectionMode) {
      clearSelection();
    } else {
      setIsSelectionMode(true);
    }
  };

  return (
    <View style={[styles.headerContainer, { backgroundColor: theme.background }]}>
      {/* Top action row */}
      <View style={styles.topRow}>
        <View style={styles.titleColumn}>
          {isSelectionMode ? (
            <Text style={[styles.title, { color: theme.text }]}>
              {selectedIds.length === 0 ? 'Select items' : `${selectedIds.length} Selected`}
            </Text>
          ) : (
            <>
              <Text style={[styles.title, { color: theme.text }]}>Photos</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                {photoCount} {photoCount === 1 ? 'item' : 'items'} • Local Storage
              </Text>
            </>
          )}
        </View>

        <View style={styles.actionsRow}>
          {!isSelectionMode && (
            <>
              <Pressable
                onPress={toggleSearch}
                style={({ pressed }) => [
                  styles.iconButton,
                  { backgroundColor: theme.backgroundElement },
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name={showSearch ? 'close' : 'search'}
                  size={19}
                  color={showSearch ? theme.primary : theme.text}
                />
              </Pressable>

              <Pressable
                onPress={onCameraPress}
                style={({ pressed }) => [
                  styles.iconButton,
                  { backgroundColor: theme.backgroundElement },
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="camera-outline" size={20} color={theme.text} />
              </Pressable>
            </>
          )}

          <Pressable
            onPress={handleSelectionToggle}
            style={({ pressed }) => [
              styles.selectPill,
              {
                backgroundColor: isSelectionMode
                  ? theme.primary
                  : theme.backgroundElement,
              },
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.selectText,
                { color: isSelectionMode ? '#FFFFFF' : theme.text },
              ]}
            >
              {isSelectionMode ? 'Cancel' : 'Select'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Expandable Search Input */}
      {showSearch && (
        <View style={[styles.searchBox, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <Ionicons name="search" size={17} color={theme.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search local photos, folders..."
            placeholderTextColor={theme.textMuted}
            style={[styles.searchInput, { color: theme.text }]}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color={theme.textMuted} />
            </Pressable>
          )}
        </View>
      )}

      {/* Controls row: Density Switcher & Category chips */}
      {!isSelectionMode && (
        <View style={styles.secondaryControls}>
          <DensitySwitcher density={viewDensity} onChange={setViewDensity} />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            {CATEGORIES.map((cat) => {
              const isCatActive =
                cat === 'All'
                  ? activeCategoryFilter === null
                  : activeCategoryFilter?.toLowerCase() === cat.toLowerCase();

              return (
                <Pressable
                  key={cat}
                  onPress={() => {
                    if (Platform.OS !== 'web') {
                      try {
                        Haptics.selectionAsync();
                      } catch {}
                    }
                    setActiveCategoryFilter(cat === 'All' ? null : cat);
                  }}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: isCatActive
                        ? theme.text
                        : theme.backgroundElement,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      { color: isCatActive ? theme.background : theme.textSecondary },
                    ]}
                  >
                    {cat}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleColumn: {
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
    letterSpacing: 0.1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  secondaryControls: {
    gap: 10,
  },
  categoryScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.96 }],
  },
});
