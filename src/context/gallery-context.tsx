import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import {
  Album,
  EditAdjustments,
  MediaItem,
  ViewDensity,
} from '@/types/gallery';
import {
  fetchLocalDeviceMedia,
  deleteAssetsFromDevice,
  checkMediaPermissions,
  requestMediaPermissions,
  DEFAULT_SYSTEM_ALBUMS,
} from '@/services/local-media';
import {
  loadFavoriteIds,
  saveFavoriteIds,
  loadTrashMap,
  saveTrashMap,
  loadCustomAlbums,
  saveCustomAlbums,
  loadAlbumMediaMap,
  saveAlbumMediaMap,
  loadEditsMap,
  saveEditsMap,
} from '@/services/gallery-storage';

interface GalleryContextValue {
  // Media lists
  media: MediaItem[];
  allMedia: MediaItem[];
  albums: Album[];
  favorites: MediaItem[];
  trash: MediaItem[];

  // Local device media status
  hasPermission: boolean | null;
  isLoadingMedia: boolean;
  requestPermission: () => Promise<boolean>;
  refreshMedia: () => Promise<void>;

  // View state
  viewDensity: ViewDensity;
  setViewDensity: (density: ViewDensity) => void;

  // Selection state
  isSelectionMode: boolean;
  selectedIds: string[];
  setIsSelectionMode: (active: boolean) => void;
  toggleSelect: (id: string) => void;
  selectAll: (ids?: string[]) => void;
  clearSelection: () => void;

  // Search & Filter
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeCategoryFilter: string | null;
  setActiveCategoryFilter: (category: string | null) => void;

  // Actions
  toggleFavorite: (id: string) => void;
  deleteToTrash: (ids: string[]) => void;
  restoreFromTrash: (ids: string[]) => void;
  permanentlyDelete: (ids: string[]) => Promise<void>;
  createAlbum: (title: string, initialMediaIds?: string[]) => string;
  addToAlbum: (mediaIds: string[], albumId: string) => void;
  updateMediaEdits: (id: string, edits: EditAdjustments) => void;
  getMediaById: (id: string) => MediaItem | undefined;
}

const GalleryContext = createContext<GalleryContextValue | null>(null);

function enrichItems(
  deviceItems: MediaItem[],
  favSet: Set<string>,
  trash: Record<string, number>,
  edits: Record<string, EditAdjustments>,
  albumMedia: Record<string, string[]>
): MediaItem[] {
  return deviceItems.map((item) => {
    const deletedTimestamp = trash[item.id];
    const extraAlbums = albumMedia[item.id] || [];
    const combinedAlbums = Array.from(new Set([...item.albumIds, ...extraAlbums]));
    return {
      ...item,
      isFavorite: favSet.has(item.id),
      isDeleted: Boolean(deletedTimestamp),
      deletedAt: deletedTimestamp || undefined,
      edits: edits[item.id] || item.edits,
      albumIds: combinedAlbums,
    };
  });
}

export function GalleryProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [albumsState, setAlbumsState] = useState<Album[]>(DEFAULT_SYSTEM_ALBUMS);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isLoadingMedia, setIsLoadingMedia] = useState<boolean>(true);

  const [viewDensity, setViewDensity] = useState<ViewDensity>('day');
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | null>(null);

  // Persistent storage caches
  const favoriteIdsRef = useRef<Set<string>>(new Set());
  const trashMapRef = useRef<Record<string, number>>({});
  const customAlbumsRef = useRef<Album[]>([]);
  const albumMediaMapRef = useRef<Record<string, string[]>>({});
  const editsMapRef = useRef<Record<string, EditAdjustments>>({});

  const triggerHaptic = useCallback(() => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
  }, []);

  const loadMedia = useCallback(async () => {
    setIsLoadingMedia(true);
    const isGranted = await checkMediaPermissions();
    setHasPermission(isGranted);

    if (!isGranted) {
      setItems([]);
      setAlbumsState(DEFAULT_SYSTEM_ALBUMS);
      setIsLoadingMedia(false);
      return;
    }

    // 1. Load persistent user data from AsyncStorage
    const [storedFavs, storedTrash, storedCustomAlbums, storedAlbumMedia, storedEdits] =
      await Promise.all([
        loadFavoriteIds(),
        loadTrashMap(),
        loadCustomAlbums(),
        loadAlbumMediaMap(),
        loadEditsMap(),
      ]);

    const favSet = new Set(storedFavs);
    favoriteIdsRef.current = favSet;
    trashMapRef.current = storedTrash;
    customAlbumsRef.current = storedCustomAlbums;
    albumMediaMapRef.current = storedAlbumMedia;
    editsMapRef.current = storedEdits;

    // 2. Fetch fresh device assets
    const result = await fetchLocalDeviceMedia();

    // 3. Merge persistent favorites, trash, edits, and custom album mappings
    const enriched = enrichItems(
      result.items,
      favSet,
      storedTrash,
      storedEdits,
      storedAlbumMedia
    );

    setItems(enriched);

    // Merge system albums and custom albums
    const allAlbums = [...result.albums, ...storedCustomAlbums];
    setAlbumsState(allAlbums);
    setIsLoadingMedia(false);
  }, []);

  // Fetch local device media on mount
  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      if (!isMounted) return;
      const isGranted = await checkMediaPermissions();
      if (!isMounted) return;
      setHasPermission(isGranted);

      if (!isGranted) {
        setItems([]);
        setAlbumsState(DEFAULT_SYSTEM_ALBUMS);
        setIsLoadingMedia(false);
        return;
      }

      const [storedFavs, storedTrash, storedCustomAlbums, storedAlbumMedia, storedEdits] =
        await Promise.all([
          loadFavoriteIds(),
          loadTrashMap(),
          loadCustomAlbums(),
          loadAlbumMediaMap(),
          loadEditsMap(),
        ]);

      if (!isMounted) return;
      const favSet = new Set(storedFavs);
      favoriteIdsRef.current = favSet;
      trashMapRef.current = storedTrash;
      customAlbumsRef.current = storedCustomAlbums;
      albumMediaMapRef.current = storedAlbumMedia;
      editsMapRef.current = storedEdits;

      const result = await fetchLocalDeviceMedia();
      if (!isMounted) return;
      const enriched = enrichItems(
        result.items,
        favSet,
        storedTrash,
        storedEdits,
        storedAlbumMedia
      );

      setItems(enriched);
      const allAlbums = [...result.albums, ...storedCustomAlbums];
      setAlbumsState(allAlbums);
      setIsLoadingMedia(false);
    }

    initialize();

    return () => {
      isMounted = false;
    };
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    triggerHaptic();
    setIsLoadingMedia(true);
    const granted = await requestMediaPermissions();
    setHasPermission(granted);
    if (granted) {
      await loadMedia();
    } else {
      setIsLoadingMedia(false);
    }
    return granted;
  }, [triggerHaptic, loadMedia]);

  const refreshMedia = useCallback(async () => {
    await loadMedia();
  }, [loadMedia]);

  // Filtered views
  const media = useMemo(() => {
    let result = items.filter((item) => !item.isDeleted);

    if (activeCategoryFilter) {
      result = result.filter(
        (item) => item.category.toLowerCase() === activeCategoryFilter.toLowerCase()
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.filename.toLowerCase().includes(q)
      );
    }

    return result.sort((a, b) => b.creationTime - a.creationTime);
  }, [items, searchQuery, activeCategoryFilter]);

  const favorites = useMemo(
    () => items.filter((item) => item.isFavorite && !item.isDeleted),
    [items]
  );

  const trash = useMemo(
    () => items.filter((item) => item.isDeleted),
    [items]
  );

  // Dynamic albums with accurate counts
  const albums = useMemo(() => {
    return albumsState.map((album) => {
      let count = 0;
      let cover = album.coverUri;
      if (album.id === 'camera') {
        const cam = items.filter((i) => !i.isDeleted && i.albumIds.includes('camera'));
        count = cam.length;
        if (cam.length > 0) cover = cam[0].uri;
      } else if (album.id === 'favorites') {
        count = favorites.length;
        if (favorites.length > 0) cover = favorites[0].uri;
      } else if (album.id === 'screenshots') {
        const screens = items.filter((i) => !i.isDeleted && i.albumIds.includes('screenshots'));
        count = screens.length;
        if (screens.length > 0) cover = screens[0].uri;
      } else if (album.id === 'videos') {
        const vids = items.filter((i) => !i.isDeleted && i.mediaType === 'video');
        count = vids.length;
        if (vids.length > 0) cover = vids[0].uri;
      } else if (album.id === 'burst') {
        const bursts = items.filter((i) => !i.isDeleted && i.mediaType === 'burst');
        count = bursts.length;
        if (bursts.length > 0) cover = bursts[0].uri;
      } else {
        const customItems = items.filter((i) => !i.isDeleted && i.albumIds.includes(album.id));
        count = customItems.length;
        if (customItems.length > 0) cover = customItems[0].uri;
      }
      return { ...album, itemCount: count, coverUri: cover };
    });
  }, [albumsState, items, favorites]);

  // Selection handlers
  const toggleSelect = useCallback(
    (id: string) => {
      triggerHaptic();
      setSelectedIds((prev) => {
        if (prev.includes(id)) {
          return prev.filter((item) => item !== id);
        } else {
          return [...prev, id];
        }
      });
    },
    [triggerHaptic]
  );

  const selectAll = useCallback((idsToSelect?: string[]) => {
    triggerHaptic();
    if (idsToSelect) {
      setSelectedIds(idsToSelect);
      setIsSelectionMode(true);
    } else {
      setSelectedIds(media.map((m) => m.id));
      setIsSelectionMode(true);
    }
  }, [media, triggerHaptic]);

  const clearSelection = useCallback(() => {
    triggerHaptic();
    setSelectedIds([]);
    setIsSelectionMode(false);
  }, [triggerHaptic]);

  // Actions
  const toggleFavorite = useCallback(
    (id: string) => {
      triggerHaptic();
      setItems((prev) => {
        const next = prev.map((item) =>
          item.id === id ? { ...item, isFavorite: !item.isFavorite } : item
        );
        const target = next.find((item) => item.id === id);
        if (target) {
          if (target.isFavorite) {
            favoriteIdsRef.current.add(id);
          } else {
            favoriteIdsRef.current.delete(id);
          }
          saveFavoriteIds(Array.from(favoriteIdsRef.current));
        }
        return next;
      });
    },
    [triggerHaptic]
  );

  const deleteToTrash = useCallback(
    (ids: string[]) => {
      triggerHaptic();
      const now = Date.now();
      const updatedTrash = { ...trashMapRef.current };
      ids.forEach((id) => {
        updatedTrash[id] = now;
      });
      trashMapRef.current = updatedTrash;
      saveTrashMap(updatedTrash);

      setItems((prev) =>
        prev.map((item) =>
          ids.includes(item.id)
            ? { ...item, isDeleted: true, deletedAt: now }
            : item
        )
      );
      clearSelection();
    },
    [triggerHaptic, clearSelection]
  );

  const restoreFromTrash = useCallback(
    (ids: string[]) => {
      triggerHaptic();
      const updatedTrash = { ...trashMapRef.current };
      ids.forEach((id) => {
        delete updatedTrash[id];
      });
      trashMapRef.current = updatedTrash;
      saveTrashMap(updatedTrash);

      setItems((prev) =>
        prev.map((item) =>
          ids.includes(item.id)
            ? { ...item, isDeleted: false, deletedAt: undefined }
            : item
        )
      );
      clearSelection();
    },
    [triggerHaptic, clearSelection]
  );

  const permanentlyDelete = useCallback(
    async (ids: string[]) => {
      triggerHaptic();

      // 1. Physically delete from device storage
      await deleteAssetsFromDevice(ids);

      // 2. Remove from trash map and favorites
      const updatedTrash = { ...trashMapRef.current };
      ids.forEach((id) => {
        delete updatedTrash[id];
        favoriteIdsRef.current.delete(id);
      });
      trashMapRef.current = updatedTrash;
      saveTrashMap(updatedTrash);
      saveFavoriteIds(Array.from(favoriteIdsRef.current));

      // 3. Remove from state
      setItems((prev) => prev.filter((item) => !ids.includes(item.id)));
      clearSelection();
    },
    [triggerHaptic, clearSelection]
  );

  const createAlbum = useCallback((title: string, initialMediaIds: string[] = []): string => {
    triggerHaptic();
    const newId = `album_${Date.now()}`;
    const newAlbum: Album = {
      id: newId,
      title: title.trim() || 'Untitled Album',
      coverUri: initialMediaIds.length > 0
        ? items.find((i) => i.id === initialMediaIds[0])?.uri
        : undefined,
      itemCount: initialMediaIds.length,
      isSystem: false,
      systemType: 'custom',
      createdAt: Date.now(),
    };

    const updatedCustom = [...customAlbumsRef.current, newAlbum];
    customAlbumsRef.current = updatedCustom;
    saveCustomAlbums(updatedCustom);
    setAlbumsState((prev) => [...prev, newAlbum]);

    if (initialMediaIds.length > 0) {
      const updatedMap = { ...albumMediaMapRef.current };
      initialMediaIds.forEach((mediaId) => {
        const existing = updatedMap[mediaId] || [];
        if (!existing.includes(newId)) {
          updatedMap[mediaId] = [...existing, newId];
        }
      });
      albumMediaMapRef.current = updatedMap;
      saveAlbumMediaMap(updatedMap);

      setItems((prev) =>
        prev.map((item) =>
          initialMediaIds.includes(item.id)
            ? { ...item, albumIds: [...item.albumIds, newId] }
            : item
        )
      );
    }
    return newId;
  }, [items, triggerHaptic]);

  const addToAlbum = useCallback((mediaIds: string[], albumId: string) => {
    triggerHaptic();
    const updatedMap = { ...albumMediaMapRef.current };
    mediaIds.forEach((mediaId) => {
      const existing = updatedMap[mediaId] || [];
      if (!existing.includes(albumId)) {
        updatedMap[mediaId] = [...existing, albumId];
      }
    });
    albumMediaMapRef.current = updatedMap;
    saveAlbumMediaMap(updatedMap);

    setItems((prev) =>
      prev.map((item) =>
        mediaIds.includes(item.id) && !item.albumIds.includes(albumId)
          ? { ...item, albumIds: [...item.albumIds, albumId] }
          : item
      )
    );
    clearSelection();
  }, [triggerHaptic, clearSelection]);

  const updateMediaEdits = useCallback((id: string, edits: EditAdjustments) => {
    triggerHaptic();
    const updatedEdits = { ...editsMapRef.current, [id]: edits };
    editsMapRef.current = updatedEdits;
    saveEditsMap(updatedEdits);

    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, edits, modificationTime: Date.now() } : item
      )
    );
  }, [triggerHaptic]);

  const getMediaById = useCallback(
    (id: string) => items.find((item) => item.id === id),
    [items]
  );

  const value = useMemo(
    () => ({
      media,
      allMedia: items,
      albums,
      favorites,
      trash,
      hasPermission,
      isLoadingMedia,
      requestPermission,
      refreshMedia,
      viewDensity,
      setViewDensity,
      isSelectionMode,
      selectedIds,
      setIsSelectionMode,
      toggleSelect,
      selectAll,
      clearSelection,
      searchQuery,
      setSearchQuery,
      activeCategoryFilter,
      setActiveCategoryFilter,
      toggleFavorite,
      deleteToTrash,
      restoreFromTrash,
      permanentlyDelete,
      createAlbum,
      addToAlbum,
      updateMediaEdits,
      getMediaById,
    }),
    [
      media,
      items,
      albums,
      favorites,
      trash,
      hasPermission,
      isLoadingMedia,
      requestPermission,
      refreshMedia,
      viewDensity,
      isSelectionMode,
      selectedIds,
      toggleSelect,
      selectAll,
      clearSelection,
      searchQuery,
      activeCategoryFilter,
      toggleFavorite,
      deleteToTrash,
      restoreFromTrash,
      permanentlyDelete,
      createAlbum,
      addToAlbum,
      updateMediaEdits,
      getMediaById,
    ]
  );

  return <GalleryContext.Provider value={value}>{children}</GalleryContext.Provider>;
}

export function useGallery() {
  const context = useContext(GalleryContext);
  if (!context) {
    throw new Error('useGallery must be used within a GalleryProvider');
  }
  return context;
}
