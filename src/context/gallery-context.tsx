import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { Platform, AppState } from 'react-native';
import * as MediaLibrary from 'expo-media-library/legacy';

import {
  Album,
  EditAdjustments,
  MediaItem,
  ViewDensity,
  SortOrder,
} from '@/types/gallery';
import {
  fetchLocalDeviceMedia,
  deleteAssetsFromDevice,
  checkMediaPermissions,
  requestMediaPermissions,
  DEFAULT_SYSTEM_ALBUMS,
  deduplicateAlbums,
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
  loadPermanentlyDeletedIds,
  savePermanentlyDeletedIds,
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

  // Sort order
  sortOrder: SortOrder;
  setSortOrder: (order: SortOrder) => void;
  toggleSortOrder: () => void;

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
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | null>(null);

  // Persistent storage caches
  const favoriteIdsRef = useRef<Set<string>>(new Set());
  const trashMapRef = useRef<Record<string, number>>({});
  const permanentlyDeletedIdsRef = useRef<Set<string>>(new Set());
  const customAlbumsRef = useRef<Album[]>([]);
  const albumMediaMapRef = useRef<Record<string, string[]>>({});
  const editsMapRef = useRef<Record<string, EditAdjustments>>({});
  const isRefreshingRef = useRef(false);

  const triggerHaptic = useCallback(() => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
  }, []);

  const toggleSortOrder = useCallback(() => {
    triggerHaptic();
    setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
  }, [triggerHaptic]);

  const loadMedia = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;

    try {
      setIsLoadingMedia(true);
      const isGranted = await checkMediaPermissions();
      setHasPermission(isGranted);

      if (!isGranted) {
        setItems([]);
        setAlbumsState(DEFAULT_SYSTEM_ALBUMS);
        return;
      }

      // 1. Load persistent user data from AsyncStorage
      const [
        storedFavs,
        storedTrash,
        storedCustomAlbums,
        storedAlbumMedia,
        storedEdits,
        storedPermanentlyDeleted,
      ] = await Promise.all([
        loadFavoriteIds(),
        loadTrashMap(),
        loadCustomAlbums(),
        loadAlbumMediaMap(),
        loadEditsMap(),
        loadPermanentlyDeletedIds(),
      ]);

      const favSet = new Set(storedFavs);
      const permDeletedSet = new Set(storedPermanentlyDeleted);
      favoriteIdsRef.current = favSet;
      permanentlyDeletedIdsRef.current = permDeletedSet;
      trashMapRef.current = storedTrash;
      customAlbumsRef.current = storedCustomAlbums;
      albumMediaMapRef.current = storedAlbumMedia;
      editsMapRef.current = storedEdits;

      // 2. Fetch fresh device assets
      const result = await fetchLocalDeviceMedia();

      // Filter out any assets permanently deleted by the user
      const filteredDeviceItems = result.items.filter(
        (item) => !permDeletedSet.has(item.id)
      );

      // 3. Merge persistent favorites, trash, edits, and custom album mappings
      const enriched = enrichItems(
        filteredDeviceItems,
        favSet,
        storedTrash,
        storedEdits,
        storedAlbumMedia
      );

      setItems(enriched);

      // Merge system albums and custom albums
      const allAlbums = [...result.albums, ...storedCustomAlbums];
      setAlbumsState(allAlbums);
    } finally {
      setIsLoadingMedia(false);
      isRefreshingRef.current = false;
    }
  }, []);

  // Fetch local device media on mount
  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  // Automatically refresh when returning to the app from camera or other apps
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && hasPermission) {
        loadMedia();
      }
    });
    return () => {
      subscription.remove();
    };
  }, [hasPermission, loadMedia]);

  // Automatically refresh when MediaLibrary reports changes on device
  useEffect(() => {
    let subscription: any;
    try {
      subscription = MediaLibrary.addListener(() => {
        if (hasPermission) {
          loadMedia();
        }
      });
    } catch {}
    return () => {
      subscription?.remove?.();
    };
  }, [hasPermission, loadMedia]);

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

  // Filtered views with 100% deterministic sorting and tie-breaker
  const media = useMemo(() => {
    let result = items.filter((item) => !item.isDeleted);

    if (activeCategoryFilter) {
      const catLower = activeCategoryFilter.toLowerCase();
      result = result.filter((item) => {
        if (catLower === 'videos') {
          return item.mediaType === 'video' || item.category.toLowerCase() === 'videos';
        }
        return item.category.toLowerCase() === catLower;
      });
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

    return result.sort((a, b) => {
      if (sortOrder === 'desc') {
        // Newest on top: highest timestamp first
        if (b.creationTime !== a.creationTime) {
          return b.creationTime - a.creationTime;
        }
        if (b.modificationTime !== a.modificationTime) {
          return b.modificationTime - a.modificationTime;
        }
        return b.id.localeCompare(a.id);
      } else {
        // Oldest on top: lowest timestamp first
        if (a.creationTime !== b.creationTime) {
          return a.creationTime - b.creationTime;
        }
        if (a.modificationTime !== b.modificationTime) {
          return a.modificationTime - b.modificationTime;
        }
        return a.id.localeCompare(b.id);
      }
    });
  }, [items, searchQuery, activeCategoryFilter, sortOrder]);

  const favorites = useMemo(
    () =>
      items
        .filter((item) => item.isFavorite && !item.isDeleted)
        .sort((a, b) => {
          if (b.creationTime !== a.creationTime) {
            return b.creationTime - a.creationTime;
          }
          if (b.modificationTime !== a.modificationTime) {
            return b.modificationTime - a.modificationTime;
          }
          return b.id.localeCompare(a.id);
        }),
    [items]
  );

  const trash = useMemo(
    () =>
      items
        .filter((item) => item.isDeleted)
        .sort((a, b) => {
          const bDel = b.deletedAt || b.creationTime;
          const aDel = a.deletedAt || a.creationTime;
          if (bDel !== aDel) return bDel - aDel;
          return b.id.localeCompare(a.id);
        }),
    [items]
  );

  // Dynamic albums with accurate counts and zero duplicate content across all albums
  const albums = useMemo(() => {
    return deduplicateAlbums(albumsState, items, favorites);
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

      // Find full items if available so we have both id and uri
      const itemsToDelete = items.filter((item) => ids.includes(item.id));
      const targets =
        itemsToDelete.length > 0
          ? itemsToDelete.map((i) => ({ id: i.id, uri: i.uri }))
          : ids.map((id) => ({ id }));

      // 1. Physically delete from device storage
      const success = await deleteAssetsFromDevice(targets);
      if (!success) {
        return;
      }

      // 2. Remove from trash map, favorites, and register permanently deleted
      const updatedTrash = { ...trashMapRef.current };
      const updatedPermanentlyDeleted = new Set(permanentlyDeletedIdsRef.current);
      ids.forEach((id) => {
        delete updatedTrash[id];
        favoriteIdsRef.current.delete(id);
        updatedPermanentlyDeleted.add(id);
      });
      trashMapRef.current = updatedTrash;
      permanentlyDeletedIdsRef.current = updatedPermanentlyDeleted;
      saveTrashMap(updatedTrash);
      saveFavoriteIds(Array.from(favoriteIdsRef.current));
      savePermanentlyDeletedIds(Array.from(updatedPermanentlyDeleted));

      // 3. Remove from state
      setItems((prev) => prev.filter((item) => !ids.includes(item.id)));
      clearSelection();
    },
    [items, triggerHaptic, clearSelection]
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
      sortOrder,
      setSortOrder,
      toggleSortOrder,
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
      sortOrder,
      toggleSortOrder,
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
