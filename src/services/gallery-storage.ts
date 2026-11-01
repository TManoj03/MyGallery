import AsyncStorage from '@react-native-async-storage/async-storage';
import { Album, EditAdjustments } from '@/types/gallery';

const STORAGE_KEYS = {
  FAVORITES: '@oneplus_gallery_favorite_ids',
  TRASH: '@oneplus_gallery_trash_map', // { [id: string]: number }
  CUSTOM_ALBUMS: '@oneplus_gallery_custom_albums', // Album[]
  ALBUM_MEDIA: '@oneplus_gallery_album_media_map', // { [albumId: string]: string[] }
  EDITS: '@oneplus_gallery_edits_map', // { [id: string]: EditAdjustments }
  PERMANENTLY_DELETED: '@oneplus_gallery_permanently_deleted_ids', // string[]
};

export async function loadFavoriteIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.FAVORITES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Failed to load favorite IDs:', e);
    return [];
  }
}

export async function saveFavoriteIds(ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(ids));
  } catch (e) {
    console.warn('Failed to save favorite IDs:', e);
  }
}

export async function loadTrashMap(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.TRASH);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch (e) {
    console.warn('Failed to load trash map:', e);
    return {};
  }
}

export async function saveTrashMap(map: Record<string, number>): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.TRASH, JSON.stringify(map));
  } catch (e) {
    console.warn('Failed to save trash map:', e);
  }
}

export async function loadCustomAlbums(): Promise<Album[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.CUSTOM_ALBUMS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Failed to load custom albums:', e);
    return [];
  }
}

export async function saveCustomAlbums(albums: Album[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.CUSTOM_ALBUMS, JSON.stringify(albums));
  } catch (e) {
    console.warn('Failed to save custom albums:', e);
  }
}

export async function loadAlbumMediaMap(): Promise<Record<string, string[]>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.ALBUM_MEDIA);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch (e) {
    console.warn('Failed to load album media map:', e);
    return {};
  }
}

export async function saveAlbumMediaMap(map: Record<string, string[]>): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.ALBUM_MEDIA, JSON.stringify(map));
  } catch (e) {
    console.warn('Failed to save album media map:', e);
  }
}

export async function loadEditsMap(): Promise<Record<string, EditAdjustments>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.EDITS);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch (e) {
    console.warn('Failed to load edits map:', e);
    return {};
  }
}

export async function saveEditsMap(map: Record<string, EditAdjustments>): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.EDITS, JSON.stringify(map));
  } catch (e) {
    console.warn('Failed to save edits map:', e);
  }
}

export async function loadPermanentlyDeletedIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.PERMANENTLY_DELETED);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Failed to load permanently deleted IDs:', e);
    return [];
  }
}

export async function savePermanentlyDeletedIds(ids: string[]): Promise<void> {
  try {
    // Keep up to 2000 IDs to avoid unbounded storage growth
    const capped = ids.slice(-2000);
    await AsyncStorage.setItem(STORAGE_KEYS.PERMANENTLY_DELETED, JSON.stringify(capped));
  } catch (e) {
    console.warn('Failed to save permanently deleted IDs:', e);
  }
}

