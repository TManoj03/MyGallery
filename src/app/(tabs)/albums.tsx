import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState, useMemo } from "react";
import {
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useGallery } from "@/context/gallery-context";
import { useTheme } from "@/hooks/use-theme";

export default function AlbumsScreen() {
  const theme = useTheme();
  const { albums, favorites, trash, allMedia, createAlbum, refreshMedia } =
    useGallery();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAlbumTitle, setNewAlbumTitle] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await refreshMedia();
    setIsRefreshing(false);
  };

  // Extract pinned system albums
  const cameraAlbum = albums.find((a) => a.id === "camera");
  const favAlbum = albums.find((a) => a.id === "favorites");
  const screensAlbum = albums.find((a) => a.id === "screenshots");
  const videosAlbum = albums.find((a) => a.id === "videos");

  // Pinned system albums - only include if they contain photos/videos (count > 0)
  const pinnedList = useMemo(() => {
    const list: {
      id: string;
      title: string;
      coverUri?: string;
      count: number;
      icon: keyof typeof Ionicons.glyphMap;
      badgeColor: string;
      defaultIcon: keyof typeof Ionicons.glyphMap;
    }[] = [];

    const cameraCount = cameraAlbum?.itemCount ?? 0;
    if (cameraCount > 0) {
      list.push({
        id: "camera",
        title: "Camera",
        coverUri: cameraAlbum?.coverUri,
        count: cameraCount,
        icon: "camera",
        badgeColor: "#EB0029",
        defaultIcon: "camera-outline",
      });
    }

    const favCount = favorites.length;
    if (favCount > 0) {
      list.push({
        id: "favorites",
        title: "Favorites",
        coverUri: favAlbum?.coverUri,
        count: favCount,
        icon: "heart",
        badgeColor: "#FF2B44",
        defaultIcon: "heart-outline",
      });
    }

    const screensCount = screensAlbum?.itemCount ?? 0;
    if (screensCount > 0) {
      list.push({
        id: "screenshots",
        title: "Screenshots",
        coverUri: screensAlbum?.coverUri,
        count: screensCount,
        icon: "phone-portrait",
        badgeColor: theme.accent || "#0084FF",
        defaultIcon: "phone-portrait-outline",
      });
    }

    const videosCount = videosAlbum?.itemCount ?? 0;
    if (videosCount > 0) {
      list.push({
        id: "videos",
        title: "Videos",
        coverUri: videosAlbum?.coverUri,
        count: videosCount,
        icon: "videocam",
        badgeColor: "#A855F7",
        defaultIcon: "videocam-outline",
      });
    }

    return list;
  }, [
    cameraAlbum?.itemCount,
    cameraAlbum?.coverUri,
    favorites.length,
    favAlbum?.coverUri,
    screensAlbum?.itemCount,
    screensAlbum?.coverUri,
    videosAlbum?.itemCount,
    videosAlbum?.coverUri,
    theme.accent,
  ]);

  // Custom user albums and device folders - only shown if they contain photos or videos
  const visibleCustomAlbums = useMemo(() => {
    return albums.filter(
      (a) =>
        a.id !== "camera" &&
        a.id !== "favorites" &&
        a.id !== "screenshots" &&
        a.id !== "videos" &&
        a.id !== "trash" &&
        a.itemCount > 0,
    );
  }, [albums]);

  // Media type counts
  const videoCount = useMemo(
    () => allMedia.filter((m) => !m.isDeleted && m.mediaType === "video").length,
    [allMedia],
  );
  const burstCount = useMemo(
    () => allMedia.filter((m) => !m.isDeleted && m.mediaType === "burst").length,
    [allMedia],
  );
  const hasMediaTypes = videoCount > 0 || burstCount > 0;

  const totalVisibleCollections = pinnedList.length + visibleCustomAlbums.length;

  const handleCreateAlbum = () => {
    if (!newAlbumTitle.trim()) return;
    if (Platform.OS !== "web") {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    }
    const newId = createAlbum(newAlbumTitle.trim());
    setNewAlbumTitle("");
    setShowCreateModal(false);
    router.push(`/album/${newId}` as any);
  };

  const handleOpenAlbum = (albumId: string) => {
    if (Platform.OS !== "web") {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
    router.push(`/album/${encodeURIComponent(albumId)}` as any);
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.background }]}
      edges={["top"]}
    >
      {/* Top Header */}
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <View>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Albums
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            {totalVisibleCollections} {totalVisibleCollections === 1 ? "collection" : "collections"}
          </Text>
        </View>

        <Pressable
          onPress={() => setShowCreateModal(true)}
          style={({ pressed }) => [
            styles.createButton,
            { backgroundColor: theme.backgroundElement },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="add" size={18} color={theme.text} />
          <Text style={[styles.createText, { color: theme.text }]}>New</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
      >
        {/* Pinned OnePlus Hero Cards - only shown if they contain photos or videos */}
        {pinnedList.length > 0 && (
          <View style={styles.pinnedGrid}>
            {pinnedList.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => handleOpenAlbum(item.id)}
                style={({ pressed }) => [
                  styles.pinnedCard,
                  pinnedList.length === 1 && { width: "100%" },
                  { backgroundColor: theme.card, borderColor: theme.border },
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.pinnedCoverContainer}>
                  {item.coverUri ? (
                    <Image
                      source={{ uri: item.coverUri }}
                      style={styles.pinnedCover}
                      contentFit="cover"
                    />
                  ) : (
                    <View
                      style={[
                        styles.emptyCover,
                        { backgroundColor: theme.backgroundElement },
                      ]}
                    >
                      <Ionicons
                        name={item.defaultIcon}
                        size={28}
                        color={theme.textSecondary}
                      />
                    </View>
                  )}
                  <View
                    style={[
                      styles.pinnedIconBadge,
                      { backgroundColor: item.badgeColor },
                    ]}
                  >
                    <Ionicons name={item.icon} size={12} color="#FFFFFF" />
                  </View>
                </View>
                <View style={styles.pinnedDetails}>
                  <Text
                    style={[styles.pinnedTitle, { color: theme.text }]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  <Text
                    style={[styles.pinnedCount, { color: theme.textSecondary }]}
                  >
                    {item.count}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* Custom Albums Section - only shown if they contain photos or videos */}
        {visibleCustomAlbums.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                My Albums
              </Text>
              <Text style={[styles.sectionCount, { color: theme.textSecondary }]}>
                {visibleCustomAlbums.length}
              </Text>
            </View>

            <View style={styles.customAlbumsGrid}>
              {visibleCustomAlbums.map((album) => (
                <Pressable
                  key={album.id}
                  onPress={() => handleOpenAlbum(album.id)}
                  style={({ pressed }) => [
                    styles.customAlbumCard,
                    { backgroundColor: theme.card, borderColor: theme.border },
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.customAlbumCoverWrapper}>
                    {album.coverUri ? (
                      <Image
                        source={{ uri: album.coverUri }}
                        style={styles.customAlbumCover}
                        contentFit="cover"
                      />
                    ) : (
                      <View
                        style={[
                          styles.emptyCover,
                          { backgroundColor: theme.backgroundElement },
                        ]}
                      >
                        <Ionicons
                          name="images-outline"
                          size={32}
                          color={theme.textSecondary}
                        />
                      </View>
                    )}
                  </View>
                  <View style={styles.customAlbumInfo}>
                    <Text
                      style={[styles.customAlbumTitle, { color: theme.text }]}
                      numberOfLines={1}
                    >
                      {album.title}
                    </Text>
                    <Text
                      style={[
                        styles.customAlbumCount,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {album.itemCount} {album.itemCount === 1 ? "photo" : "photos"}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {/* Media Types Row - only shown if videos or burst shots exist */}
        {hasMediaTypes && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Media Types
              </Text>
            </View>

            <View
              style={[
                styles.utilitiesCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              {videoCount > 0 && (
                <Pressable
                  onPress={() => handleOpenAlbum("videos")}
                  style={({ pressed }) => [
                    styles.utilityRow,
                    pressed && { backgroundColor: theme.backgroundElement },
                  ]}
                >
                  <View style={[styles.utilityIcon, { backgroundColor: "#380B12" }]}>
                    <Ionicons name="videocam" size={18} color="#EB0029" />
                  </View>
                  <Text style={[styles.utilityLabel, { color: theme.text }]}>
                    Videos
                  </Text>
                  <Text style={[styles.utilityBadge, { color: theme.textSecondary }]}>
                    {videoCount}
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={theme.textMuted}
                  />
                </Pressable>
              )}

              {videoCount > 0 && burstCount > 0 && (
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
              )}

              {burstCount > 0 && (
                <Pressable
                  onPress={() => handleOpenAlbum("burst")}
                  style={({ pressed }) => [
                    styles.utilityRow,
                    pressed && { backgroundColor: theme.backgroundElement },
                  ]}
                >
                  <View style={[styles.utilityIcon, { backgroundColor: "#0B2338" }]}>
                    <Ionicons name="copy" size={18} color="#0084FF" />
                  </View>
                  <Text style={[styles.utilityLabel, { color: theme.text }]}>
                    Burst Shots
                  </Text>
                  <Text style={[styles.utilityBadge, { color: theme.textSecondary }]}>
                    {burstCount}
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={theme.textMuted}
                  />
                </Pressable>
              )}
            </View>
          </>
        )}

        {/* Empty State when no albums have any photos or videos */}
        {pinnedList.length === 0 && visibleCustomAlbums.length === 0 && !hasMediaTypes && (
          <View style={styles.emptyContainer}>
            <Ionicons name="albums-outline" size={56} color={theme.textMuted} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              No Albums with Photos
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              Albums containing photos or videos will automatically appear here.
            </Text>
          </View>
        )}

        {/* System Utilities: Recycle Bin & Private Safe */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            More Utilities
          </Text>
        </View>

        <View
          style={[
            styles.utilitiesCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          {/* Recently Deleted / Trash */}
          <Pressable
            onPress={() => router.push("/trash")}
            style={({ pressed }) => [
              styles.utilityRow,
              pressed && { backgroundColor: theme.backgroundElement },
            ]}
          >
            <View style={[styles.utilityIcon, { backgroundColor: "#380B12" }]}>
              <Ionicons name="trash" size={18} color="#EB0029" />
            </View>
            <View style={styles.utilityTextContainer}>
              <Text style={[styles.utilityLabel, { color: theme.text }]}>
                Recently Deleted
              </Text>
              <Text
                style={[styles.utilitySublabel, { color: theme.textSecondary }]}
              >
                Items permanently deleted after 30 days
              </Text>
            </View>
            <Text style={[styles.utilityBadge, { color: theme.textSecondary }]}>
              {trash.length}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={theme.textMuted}
            />
          </Pressable>
        </View>

        {/* Footer */}
        <View style={styles.footerContainer}>
          <Text style={[styles.footerText, { color: theme.textMuted }]}>
            Developed by Manoj ⚡
          </Text>
        </View>
      </ScrollView>

      {/* Create Album Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setShowCreateModal(false)}
        >
          <Pressable
            style={[styles.modalCard, { backgroundColor: theme.card }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              New Album
            </Text>
            <Text
              style={[styles.modalSubtitle, { color: theme.textSecondary }]}
            >
              Enter a name for this album
            </Text>

            <TextInput
              value={newAlbumTitle}
              onChangeText={setNewAlbumTitle}
              placeholder="e.g. Vacation, Favorites 2026"
              placeholderTextColor={theme.textMuted}
              autoFocus
              style={[
                styles.modalInput,
                {
                  color: theme.text,
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.border,
                },
              ]}
            />

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setShowCreateModal(false)}
                style={[
                  styles.modalButton,
                  { backgroundColor: theme.backgroundElement },
                ]}
              >
                <Text style={[styles.modalButtonText, { color: theme.text }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleCreateAlbum}
                style={[styles.modalButton, { backgroundColor: theme.primary }]}
              >
                <Text style={[styles.modalButtonText, { color: "#FFFFFF" }]}>
                  Create
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
  },
  createText: {
    fontSize: 13,
    fontWeight: "700",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 95,
    gap: 16,
  },
  pinnedGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  pinnedCard: {
    width: "48.5%",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
  },
  pinnedCoverContainer: {
    width: "100%",
    aspectRatio: 16 / 10,
    position: "relative",
  },
  pinnedCover: {
    width: "100%",
    height: "100%",
  },
  emptyCover: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  pinnedIconBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#EB0029",
    justifyContent: "center",
    alignItems: "center",
  },
  pinnedDetails: {
    padding: 10,
  },
  pinnedTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  pinnedCount: {
    fontSize: 12,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: "600",
  },
  customAlbumsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  customAlbumCard: {
    width: "48.5%",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
  },
  customAlbumCoverWrapper: {
    width: "100%",
    aspectRatio: 1,
  },
  customAlbumCover: {
    width: "100%",
    height: "100%",
  },
  customAlbumInfo: {
    padding: 10,
  },
  customAlbumTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  customAlbumCount: {
    fontSize: 12,
    marginTop: 2,
  },
  utilitiesCard: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
  },
  utilityRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  utilityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  utilityTextContainer: {
    flex: 1,
  },
  utilityLabel: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  utilitySublabel: {
    fontSize: 11,
    marginTop: 2,
  },
  utilityBadge: {
    fontSize: 13,
    fontWeight: "600",
    marginRight: 4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 62,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  modalSubtitle: {
    fontSize: 13,
  },
  modalInput: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
    marginTop: 4,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 8,
  },
  modalButton: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 18,
  },
  modalButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 24,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
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
