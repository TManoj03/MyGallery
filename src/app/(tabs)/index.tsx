import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useMemo, useState, useEffect } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Dimensions,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AddToAlbumModal } from "@/components/add-to-album-modal";
import { GalleryHeader } from "@/components/gallery-header";
import { PhotoGridItem } from "@/components/photo-grid-item";
import { SelectionBottomBar } from "@/components/selection-bottom-bar";
import { useGallery } from "@/context/gallery-context";
import { useTheme } from "@/hooks/use-theme";
import { MediaItem } from "@/types/gallery";
import { DateGroup, groupMediaByDate } from "@/utils/date-grouping";

export default function PhotosScreen() {
  const theme = useTheme();
  const {
    media,
    viewDensity,
    isSelectionMode,
    selectedIds,
    toggleSelect,
    selectAll,
    setIsSelectionMode,
    clearSelection,
    searchQuery,
    hasPermission,
    isLoadingMedia,
    requestPermission,
    refreshMedia,
  } = useGallery();

  const [showAddToAlbumModal, setShowAddToAlbumModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!isSelectionMode) return;
    const backAction = () => {
      clearSelection();
      return true;
    };
    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
    return () => backHandler.remove();
  }, [isSelectionMode, clearSelection]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await refreshMedia();
    setIsRefreshing(false);
  };

  // Group media chronologically
  const dateGroups: DateGroup[] = useMemo(() => {
    return groupMediaByDate(media);
  }, [media]);

  // Determine grid columns based on density
  const numColumns = useMemo(() => {
    if (viewDensity === "year") return 6;
    if (viewDensity === "month") return 4;
    return 3; // 'day'
  }, [viewDensity]);

  const screenWidth = Dimensions.get("window").width;
  const gridGap =
    viewDensity === "year" ? 1.5 : viewDensity === "month" ? 2 : 3;
  const itemWidth = (screenWidth - (numColumns - 1) * gridGap) / numColumns;

  const handleItemPress = (item: MediaItem) => {
    if (isSelectionMode) {
      toggleSelect(item.id);
    } else {
      router.push(`/viewer/${item.id}` as any);
    }
  };

  const handleItemLongPress = (item: MediaItem) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
    }
    toggleSelect(item.id);
  };

  const handleSelectDateGroup = (group: DateGroup) => {
    if (Platform.OS !== "web") {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
    const groupItemIds = group.items.map((i) => i.id);
    const allSelected = groupItemIds.every((id) => selectedIds.includes(id));

    if (allSelected) {
      // Unselect this group's items
      const next = selectedIds.filter((id) => !groupItemIds.includes(id));
      selectAll(next);
    } else {
      // Add all items in this group
      const next = Array.from(new Set([...selectedIds, ...groupItemIds]));
      selectAll(next);
    }
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.background }]}
      edges={["top"]}
    >
      {/* Header */}
      <GalleryHeader photoCount={media.length} />

      {/* Main Content */}
      {hasPermission === false ? (
        <View style={styles.permissionContainer}>
          <View
            style={[
              styles.permissionIconCircle,
              { backgroundColor: "#380B12" },
            ]}
          >
            <Ionicons name="images" size={44} color="#EB0029" />
          </View>
          <Text style={[styles.permissionTitle, { color: theme.text }]}>
            Access Device Photos
          </Text>
          <Text
            style={[styles.permissionSubtitle, { color: theme.textSecondary }]}
          >
            To view, organize, and edit your local images, grant Gallery
            permission to access your device storage.
          </Text>
          <Pressable
            onPress={requestPermission}
            style={({ pressed }) => [
              styles.grantButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="key-outline"
              size={18}
              color="#FFFFFF"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.grantButtonText}>Grant Access</Text>
          </Pressable>
        </View>
      ) : isLoadingMedia ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading local images...
          </Text>
        </View>
      ) : media.length === 0 ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
            />
          }
        >
          <Ionicons name="images-outline" size={64} color={theme.textMuted} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            No Local Photos Found
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            {searchQuery
              ? `No results matching "${searchQuery}"`
              : "Pull down to refresh or capture new photos with your camera."}
          </Text>
          <View style={styles.footerContainer}>
            <Text style={[styles.footerText, { color: theme.textMuted }]}>
              Developed by Manoj⚡
            </Text>
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            isSelectionMode && { paddingBottom: 110 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
            />
          }
        >
          {dateGroups.map((group) => {
            const allInGroupSelected =
              group.items.length > 0 &&
              group.items.every((i) => selectedIds.includes(i.id));

            return (
              <View key={group.id} style={styles.dateGroupContainer}>
                {/* Date Group Header */}
                <View style={styles.dateHeaderRow}>
                  <View style={styles.dateTextContainer}>
                    <Text style={[styles.dateTitle, { color: theme.text }]}>
                      {group.title}
                    </Text>
                    {group.subtitle && (
                      <Text
                        style={[
                          styles.dateSubtitle,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {group.subtitle}
                      </Text>
                    )}
                  </View>

                  {/* Batch Select for this Date */}
                  {isSelectionMode && (
                    <Pressable
                      onPress={() => handleSelectDateGroup(group)}
                      style={({ pressed }) => [
                        styles.groupSelectPill,
                        {
                          backgroundColor: allInGroupSelected
                            ? theme.primary
                            : theme.backgroundElement,
                        },
                        pressed && styles.pressed,
                      ]}
                    >
                      <Ionicons
                        name={
                          allInGroupSelected
                            ? "checkmark-circle"
                            : "ellipse-outline"
                        }
                        size={15}
                        color={
                          allInGroupSelected ? "#FFFFFF" : theme.textSecondary
                        }
                        style={{ marginRight: 4 }}
                      />
                      <Text
                        style={[
                          styles.groupSelectText,
                          {
                            color: allInGroupSelected
                              ? "#FFFFFF"
                              : theme.textSecondary,
                          },
                        ]}
                      >
                        {allInGroupSelected ? "Selected" : "Select all"}
                      </Text>
                    </Pressable>
                  )}
                </View>

                {/* Media Grid for this date */}
                <View style={[styles.gridContainer, { gap: gridGap }]}>
                  {group.items.map((item) => (
                    <View key={item.id} style={{ width: itemWidth }}>
                      <PhotoGridItem
                        item={item}
                        density={viewDensity}
                        isSelected={selectedIds.includes(item.id)}
                        isSelectionMode={isSelectionMode}
                        onPress={() => handleItemPress(item)}
                        onLongPress={() => handleItemLongPress(item)}
                      />
                    </View>
                  ))}
                </View>
              </View>
            );
          })}

          {/* Footer */}
          <View style={styles.footerContainer}>
            <Text style={[styles.footerText, { color: theme.textMuted }]}>
              Developed by Manoj⚡
            </Text>
          </View>
        </ScrollView>
      )}

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
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 95,
  },
  dateGroupContainer: {
    marginBottom: 16,
  },
  dateHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dateTextContainer: {
    flex: 1,
  },
  dateTitle: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  dateSubtitle: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  groupSelectPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  groupSelectText: {
    fontSize: 11,
    fontWeight: "700",
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.75,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 36,
    gap: 14,
  },
  permissionIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  permissionSubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  grantButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EB0029",
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 8,
  },
  grantButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: "500",
  },
  footerContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  footerText: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 0.4,
  },
});
