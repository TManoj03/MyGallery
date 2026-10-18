import * as MediaLibrary from 'expo-media-library/legacy';
import { Platform } from 'react-native';
import { Album, MediaItem } from '@/types/gallery';

export interface LocalMediaResult {
  items: MediaItem[];
  albums: Album[];
  permissionGranted: boolean;
}

export async function checkMediaPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return true;
  }
  try {
    const { status } = await MediaLibrary.getPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function requestMediaPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return true;
  }
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function fetchLocalDeviceMedia(): Promise<LocalMediaResult> {
  const isGranted = await checkMediaPermissions();
  if (!isGranted) {
    return {
      items: [],
      albums: [],
      permissionGranted: false,
    };
  }

  try {
    // Fetch local device assets sorted by newest first
    const assetsResult = await MediaLibrary.getAssetsAsync({
      first: 250,
      mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
      sortBy: [[MediaLibrary.SortBy.creationTime, false]],
    });

    // Fetch device albums
    let deviceAlbums: MediaLibrary.Album[] = [];
    try {
      deviceAlbums = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });
    } catch {}

    const mappedItems: MediaItem[] = assetsResult.assets.map((asset) => {
      const isVideo =
        asset.mediaType === MediaLibrary.MediaType.video ||
        /\.(mp4|mov|m4v|3gp|webm|mkv|avi)$/i.test(asset.filename || '') ||
        (asset.duration != null && asset.duration > 0);
      const cleanTitle = asset.filename ? asset.filename.replace(/\.[^/.]+$/, '').replace(/_/g, ' ') : 'Photo';

      // Infer category from filename
      let category = isVideo ? 'Videos' : 'Camera';
      const lowerName = (asset.filename || '').toLowerCase();
      const isBurst = lowerName.includes('burst');
      if (lowerName.includes('screenshot') || lowerName.includes('screen')) {
        category = 'Screenshots';
      } else if (lowerName.includes('download')) {
        category = 'Downloads';
      } else if (lowerName.includes('whatsapp')) {
        category = 'WhatsApp';
      }

      const mediaType = isVideo ? 'video' : isBurst ? 'burst' : 'photo';
      const albumIds = isBurst ? [category.toLowerCase(), 'burst'] : [category.toLowerCase()];

      return {
        id: asset.id,
        uri: asset.uri,
        thumbnailUri: asset.uri,
        title: cleanTitle,
        filename: asset.filename || 'media',
        creationTime: asset.creationTime ? asset.creationTime : Date.now(),
        modificationTime: asset.modificationTime ? asset.modificationTime : Date.now(),
        duration: asset.duration ? Math.round(asset.duration) : undefined,
        mediaType,
        width: asset.width || 1920,
        height: asset.height || 1080,
        isFavorite: false,
        isDeleted: false,
        albumIds,
        category,
        exif: {
          cameraModel: 'Device Storage',
          resolution: `${asset.width || 0} × ${asset.height || 0}`,
          fileSizeMB: undefined,
        },
      };
    });

    // Map system albums
    const mappedAlbums: Album[] = [
      {
        id: 'camera',
        title: 'Camera',
        coverUri: mappedItems.find((i) => i.category === 'Camera')?.uri || mappedItems[0]?.uri,
        itemCount: mappedItems.filter((i) => i.category === 'Camera').length,
        isSystem: true,
        systemType: 'camera',
        createdAt: Date.now(),
      },
      {
        id: 'favorites',
        title: 'Favorites',
        coverUri: mappedItems.find((i) => i.isFavorite)?.uri,
        itemCount: 0,
        isSystem: true,
        systemType: 'favorites',
        createdAt: Date.now(),
      },
      {
        id: 'screenshots',
        title: 'Screenshots',
        coverUri: mappedItems.find((i) => i.category === 'Screenshots')?.uri,
        itemCount: mappedItems.filter((i) => i.category === 'Screenshots').length,
        isSystem: true,
        systemType: 'screenshots',
        createdAt: Date.now(),
      },
      {
        id: 'videos',
        title: 'Videos',
        coverUri: mappedItems.find((i) => i.mediaType === 'video')?.uri,
        itemCount: mappedItems.filter((i) => i.mediaType === 'video').length,
        isSystem: true,
        systemType: 'videos',
        createdAt: Date.now(),
      },
      {
        id: 'burst',
        title: 'Burst Shots',
        coverUri: mappedItems.find((i) => i.mediaType === 'burst')?.uri,
        itemCount: mappedItems.filter((i) => i.mediaType === 'burst').length,
        isSystem: true,
        systemType: 'burst',
        createdAt: Date.now(),
      },
      {
        id: 'trash',
        title: 'Recycle Bin',
        coverUri: undefined,
        itemCount: 0,
        isSystem: true,
        systemType: 'trash',
        createdAt: Date.now(),
      },
    ];

    // Add device folders that have photos
    deviceAlbums.forEach((alb) => {
      const lower = alb.title.toLowerCase();
      if (!['camera', 'screenshots', 'favorites', 'videos', 'recent', 'recents', 'burst', 'trash'].includes(lower)) {
        mappedAlbums.push({
          id: alb.id,
          title: alb.title,
          coverUri: undefined,
          itemCount: alb.assetCount,
          isSystem: false,
          systemType: 'custom',
          createdAt: Date.now(),
        });
      }
    });

    return {
      items: mappedItems,
      albums: mappedAlbums,
      permissionGranted: true,
    };
  } catch (error) {
    console.warn('Error fetching local device media:', error);
    return {
      items: [],
      albums: [],
      permissionGranted: false,
    };
  }
}

/**
 * Permanently delete assets from the device's physical media store.
 * Triggers native system dialog on Android/iOS.
 */
export async function deleteAssetsFromDevice(ids: string[]): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  if (!ids || ids.length === 0) return true;

  try {
    const success = await MediaLibrary.deleteAssetsAsync(ids);
    return success;
  } catch (error) {
    console.warn('Failed to delete assets from device storage:', error);
    return false;
  }
}
