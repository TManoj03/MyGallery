import * as MediaLibrary from 'expo-media-library/legacy';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { Album, MediaItem } from '@/types/gallery';

export interface LocalMediaResult {
  items: MediaItem[];
  albums: Album[];
  permissionGranted: boolean;
}

export const DEFAULT_SYSTEM_ALBUMS: Album[] = [
  {
    id: 'camera',
    title: 'Camera',
    coverUri: undefined,
    itemCount: 0,
    isSystem: true,
    systemType: 'camera',
    createdAt: Date.now(),
  },
  {
    id: 'favorites',
    title: 'Favorites',
    coverUri: undefined,
    itemCount: 0,
    isSystem: true,
    systemType: 'favorites',
    createdAt: Date.now(),
  },
  {
    id: 'screenshots',
    title: 'Screenshots',
    coverUri: undefined,
    itemCount: 0,
    isSystem: true,
    systemType: 'screenshots',
    createdAt: Date.now(),
  },
  {
    id: 'videos',
    title: 'Videos',
    coverUri: undefined,
    itemCount: 0,
    isSystem: true,
    systemType: 'videos',
    createdAt: Date.now(),
  },
  {
    id: 'burst',
    title: 'Burst Shots',
    coverUri: undefined,
    itemCount: 0,
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

/**
 * Parse date from common media filenames when EXIF / MediaStore creationTime is missing.
 * e.g., IMG_20240315_142301.jpg, Screenshot_2024-03-15-14-23-01.png, WhatsApp Image 2024-03-15 at 14.23.01.jpeg, 1710500000000.jpg
 */
function parseTimestampFromFilename(filename: string): number | null {
  if (!filename) return null;

  // 1. Check for Unix timestamp in milliseconds (13 digits: 15... to 19...)
  const unixMsMatch = filename.match(/\b(1[5-9]\d{11})\b/);
  if (unixMsMatch) {
    const ts = parseInt(unixMsMatch[1], 10);
    if (!isNaN(ts) && ts > 1500000000000 && ts < 2500000000000) {
      return ts;
    }
  }

  // 2. Check for Unix timestamp in seconds (10 digits: 15... to 19...)
  const unixSecMatch = filename.match(/\b(1[5-9]\d{8})\b/);
  if (unixSecMatch) {
    const ts = parseInt(unixSecMatch[1], 10) * 1000;
    if (!isNaN(ts) && ts > 1500000000000 && ts < 2500000000000) {
      return ts;
    }
  }

  // 3. Check for YYYYMMDD_HHMMSS or YYYY-MM-DD or WhatsApp format
  const dateMatch = filename.match(
    /\b(20[123]\d)[-_]?([01]\d)[-_]?([0-3]\d)(?:[-_ .]?([0-2]\d)[-_.:]?([0-5]\d)[-_.:]?([0-5]\d)?)?\b/
  );
  if (dateMatch) {
    const year = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10) - 1;
    const day = parseInt(dateMatch[3], 10);
    const hour = dateMatch[4] ? parseInt(dateMatch[4], 10) : 12;
    const minute = dateMatch[5] ? parseInt(dateMatch[5], 10) : 0;
    const second = dateMatch[6] ? parseInt(dateMatch[6], 10) : 0;

    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      const d = new Date(year, month, day, hour, minute, second);
      const time = d.getTime();
      if (!isNaN(time) && time > 0) {
        return time;
      }
    }
  }

  return null;
}

/**
 * Normalizes creation and modification timestamps to milliseconds.
 * NEVER returns Date.now() so asset dates are completely deterministic and don't shuffle on refresh.
 */
function getStableMediaTimestamps(asset: MediaLibrary.Asset): { creationTime: number; modificationTime: number } {
  let cTime = typeof asset.creationTime === 'number' ? asset.creationTime : 0;
  // If creationTime is in seconds (10 digits), convert to ms
  if (cTime > 0 && cTime < 10000000000) {
    cTime *= 1000;
  }

  let mTime = typeof asset.modificationTime === 'number' ? asset.modificationTime : 0;
  // If modificationTime is in seconds (10 digits), convert to ms
  if (mTime > 0 && mTime < 10000000000) {
    mTime *= 1000;
  }

  // If creationTime is missing or 0, fallback to modificationTime, then filename date
  if (cTime <= 0) {
    if (mTime > 0) {
      cTime = mTime;
    } else {
      const fromName = parseTimestampFromFilename(asset.filename);
      if (fromName) {
        cTime = fromName;
        mTime = fromName;
      }
    }
  }

  // If modificationTime is missing or 0, fallback to creationTime
  if (mTime <= 0) {
    mTime = cTime;
  }

  // Stable fallback: Never use dynamic Date.now()!
  if (cTime < 0 || isNaN(cTime)) cTime = 0;
  if (mTime < 0 || isNaN(mTime)) mTime = 0;

  return { creationTime: cTime, modificationTime: mTime };
}

export async function fetchLocalDeviceMedia(): Promise<LocalMediaResult> {
  const isGranted = await checkMediaPermissions();
  if (!isGranted) {
    return {
      items: [],
      albums: DEFAULT_SYSTEM_ALBUMS,
      permissionGranted: false,
    };
  }

  try {
    // Fetch local device assets sorted newest first.
    // Use dual sort [creationTime DESC, modificationTime DESC] for reliable ordering.
    let assets: MediaLibrary.Asset[] = [];
    let after: string | undefined = undefined;
    let hasNextPage = true;

    // Fetch in pages up to 1000 assets so full library is accessible
    while (hasNextPage && assets.length < 1000) {
      const pageResult = await MediaLibrary.getAssetsAsync({
        first: 500,
        after,
        mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
        sortBy: [
          [MediaLibrary.SortBy.creationTime, false],
          [MediaLibrary.SortBy.modificationTime, false],
        ],
      });

      assets = assets.concat(pageResult.assets);
      hasNextPage = pageResult.hasNextPage;
      after = pageResult.endCursor;
      if (!after || pageResult.assets.length === 0) break;
    }

    // Fetch device albums
    let deviceAlbums: MediaLibrary.Album[] = [];
    try {
      deviceAlbums = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });
    } catch {}

    // Concurrently map which assets belong to which device album
    const assetIdToAlbumIds = new Map<string, string[]>();
    const assetIdToAlbumTitles = new Map<string, string[]>();

    await Promise.all(
      deviceAlbums.map(async (alb) => {
        if (!alb.id || alb.assetCount <= 0) return;
        try {
          const res = await MediaLibrary.getAssetsAsync({
            album: alb.id,
            first: 1000,
            mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
          });
          for (const a of res.assets) {
            const currentIds = assetIdToAlbumIds.get(a.id) || [];
            if (!currentIds.includes(alb.id)) {
              currentIds.push(alb.id);
            }
            assetIdToAlbumIds.set(a.id, currentIds);

            const currentTitles = assetIdToAlbumTitles.get(a.id) || [];
            if (!currentTitles.includes(alb.title)) {
              currentTitles.push(alb.title);
            }
            assetIdToAlbumTitles.set(a.id, currentTitles);
          }
        } catch {}
      })
    );

    const mappedItems: MediaItem[] = assets.map((asset) => {
      const isVideo =
        asset.mediaType === MediaLibrary.MediaType.video ||
        /\.(mp4|mov|m4v|3gp|webm|mkv|avi)$/i.test(asset.filename || '') ||
        (asset.duration != null && asset.duration > 0);
      const cleanTitle = asset.filename ? asset.filename.replace(/\.[^/.]+$/, '').replace(/_/g, ' ') : 'Photo';

      // Albums this asset belongs to on device
      const albumIds: string[] = [...(assetIdToAlbumIds.get(asset.id) || [])];
      const albumTitles: string[] = [...(assetIdToAlbumTitles.get(asset.id) || [])];

      // 1. Direct bucket ID from Android cursor if available on asset object
      const directBucketId = (asset as any).albumId || (asset as any).bucketId;
      if (directBucketId && !albumIds.includes(directBucketId)) {
        albumIds.push(directBucketId);
        const matchingDeviceAlb = deviceAlbums.find((d) => d.id === directBucketId);
        if (matchingDeviceAlb && !albumTitles.includes(matchingDeviceAlb.title)) {
          albumTitles.push(matchingDeviceAlb.title);
        }
      }

      // 2. Infer parent directory name from local URI path
      const lowerName = (asset.filename || '').toLowerCase();
      const lowerUri = (asset.uri || '').toLowerCase();
      try {
        const cleanUri = (asset.uri || '').split('?')[0];
        const segments = cleanUri.split('/');
        if (segments.length >= 2) {
          const folderName = decodeURIComponent(segments[segments.length - 2]);
          if (folderName && !albumTitles.includes(folderName)) {
            albumTitles.push(folderName);
          }
          const matchedAlb = deviceAlbums.find(
            (d) => d.title.toLowerCase() === folderName.toLowerCase()
          );
          if (matchedAlb && !albumIds.includes(matchedAlb.id)) {
            albumIds.push(matchedAlb.id);
          }
        }
      } catch {}

      const isBurst = lowerName.includes('burst');
      if (isBurst && !albumIds.includes('burst')) {
        albumIds.push('burst');
      }

      // Check whether this asset's album titles match any recognized pattern
      const hasAlbum = (term: string) =>
        albumTitles.some((t) => t.toLowerCase().includes(term.toLowerCase()));

      let category = '';

      if (
        hasAlbum('twitter') ||
        albumTitles.some((t) => t.trim().toLowerCase() === 'x') ||
        lowerName.includes('twitter') ||
        lowerName.startsWith('twitter_') ||
        lowerName.startsWith('x_') ||
        lowerUri.includes('/twitter/') ||
        lowerUri.includes('/x/') ||
        lowerUri.includes('twitter')
      ) {
        category = 'Twitter';
        if (!albumIds.includes('twitter')) albumIds.push('twitter');
        if (!albumIds.includes('x')) albumIds.push('x');
        const twitterAlb = deviceAlbums.find(
          (d) => d.title.toLowerCase().includes('twitter') || d.title.toLowerCase() === 'x'
        );
        if (twitterAlb && !albumIds.includes(twitterAlb.id)) {
          albumIds.push(twitterAlb.id);
        }

        // Clean out generic download identifiers so Twitter media doesn't pollute Downloads album
        const downloadAlbIds = new Set(
          deviceAlbums
            .filter((d) => d.title.toLowerCase().includes('download'))
            .map((d) => d.id)
        );
        for (let i = albumIds.length - 1; i >= 0; i--) {
          if (
            albumIds[i] === 'downloads' ||
            albumIds[i] === 'download' ||
            downloadAlbIds.has(albumIds[i])
          ) {
            albumIds.splice(i, 1);
          }
        }
        for (let i = albumTitles.length - 1; i >= 0; i--) {
          if (albumTitles[i].toLowerCase().includes('download')) {
            albumTitles.splice(i, 1);
          }
        }
      } else if (
        hasAlbum('whatsapp') ||
        lowerName.includes('whatsapp') ||
        lowerName.includes('wa00') ||
        lowerName.startsWith('wp_') ||
        lowerUri.includes('whatsapp')
      ) {
        category = 'WhatsApp';
        if (!albumIds.includes('whatsapp')) albumIds.push('whatsapp');

        // Clean out generic download identifiers so WhatsApp media doesn't pollute Downloads
        const downloadAlbIds = new Set(
          deviceAlbums
            .filter((d) => d.title.toLowerCase().includes('download'))
            .map((d) => d.id)
        );
        for (let i = albumIds.length - 1; i >= 0; i--) {
          if (
            albumIds[i] === 'downloads' ||
            albumIds[i] === 'download' ||
            downloadAlbIds.has(albumIds[i])
          ) {
            albumIds.splice(i, 1);
          }
        }
        for (let i = albumTitles.length - 1; i >= 0; i--) {
          if (albumTitles[i].toLowerCase().includes('download')) {
            albumTitles.splice(i, 1);
          }
        }

        if (isVideo) {
          const whatsappVideoAlb = deviceAlbums.find(
            (d) =>
              d.title.toLowerCase().includes('whatsapp') &&
              d.title.toLowerCase().includes('video')
          );
          if (whatsappVideoAlb && !albumIds.includes(whatsappVideoAlb.id)) {
            albumIds.push(whatsappVideoAlb.id);
          }
          if (!albumIds.includes('whatsapp-video')) albumIds.push('whatsapp-video');
        } else {
          const whatsappImagesAlb = deviceAlbums.find(
            (d) =>
              d.title.toLowerCase().includes('whatsapp') &&
              (d.title.toLowerCase().includes('image') || !d.title.toLowerCase().includes('video'))
          );
          if (whatsappImagesAlb && !albumIds.includes(whatsappImagesAlb.id)) {
            albumIds.push(whatsappImagesAlb.id);
          }
          if (!albumIds.includes('whatsapp-images')) albumIds.push('whatsapp-images');
        }
      } else if (
        hasAlbum('screenshot') ||
        lowerName.includes('screenshot') ||
        lowerName.includes('screen_') ||
        lowerUri.includes('screenshot')
      ) {
        category = 'Screenshots';
        if (!albumIds.includes('screenshots')) albumIds.push('screenshots');
      } else if (
        hasAlbum('download') ||
        lowerName.includes('download') ||
        lowerUri.includes('/download/') ||
        lowerUri.includes('/downloads/') ||
        lowerUri.includes('download')
      ) {
        category = 'Downloads';
        if (!albumIds.includes('downloads')) albumIds.push('downloads');
        if (!albumIds.includes('download')) albumIds.push('download');
        const matchingDownloadAlbs = deviceAlbums.filter((d) =>
          d.title.toLowerCase().includes('download')
        );
        matchingDownloadAlbs.forEach((d) => {
          if (!albumIds.includes(d.id)) {
            albumIds.push(d.id);
          }
        });
      } else if (
        hasAlbum('instagram') ||
        lowerName.includes('instagram') ||
        lowerUri.includes('instagram')
      ) {
        category = 'Instagram';
        if (!albumIds.includes('instagram')) albumIds.push('instagram');
      } else if (
        hasAlbum('telegram') ||
        lowerName.includes('telegram') ||
        lowerUri.includes('telegram')
      ) {
        category = 'Telegram';
        if (!albumIds.includes('telegram')) albumIds.push('telegram');
      } else if (
        hasAlbum('camera') ||
        hasAlbum('dcim') ||
        hasAlbum('100andro') ||
        lowerName.startsWith('img_') ||
        lowerName.startsWith('pxl_') ||
        lowerName.startsWith('dsc_') ||
        lowerName.startsWith('sam_')
      ) {
        category = 'Camera';
        if (!albumIds.includes('camera')) albumIds.push('camera');
      } else if (albumTitles.length > 0) {
        // Use device album title as category
        const primaryTitle = albumTitles[0];
        category = primaryTitle.charAt(0).toUpperCase() + primaryTitle.slice(1);
        const norm = primaryTitle.toLowerCase().replace(/\s+/g, '-');
        if (!albumIds.includes(norm)) albumIds.push(norm);
      } else {
        // Fallback if not matched to any album
        category = isVideo ? 'Videos' : 'Camera';
        if (!isVideo && !albumIds.includes('camera')) {
          albumIds.push('camera');
        }
      }

      // Also add all detected album titles in lowercase to albumIds for flexible matching
      albumTitles.forEach((t) => {
        const tLower = t.toLowerCase();
        if (!albumIds.includes(tLower)) {
          albumIds.push(tLower);
        }
      });

      const mediaType = isVideo ? 'video' : isBurst ? 'burst' : 'photo';
      if (isVideo && !albumIds.includes('videos')) {
        albumIds.push('videos');
      }

      const { creationTime, modificationTime } = getStableMediaTimestamps(asset);

      return {
        id: asset.id,
        uri: asset.uri,
        thumbnailUri: asset.uri,
        title: cleanTitle,
        filename: asset.filename || 'media',
        creationTime,
        modificationTime,
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

    // Sort mappedItems deterministically: newest first, tie-break by modificationTime and id
    mappedItems.sort((a, b) => {
      if (b.creationTime !== a.creationTime) {
        return b.creationTime - a.creationTime;
      }
      if (b.modificationTime !== a.modificationTime) {
        return b.modificationTime - a.modificationTime;
      }
      return b.id.localeCompare(a.id);
    });

    // Map system albums
    const cameraItems = mappedItems.filter((i) => i.albumIds.includes('camera'));
    const screenshotsItems = mappedItems.filter((i) => i.albumIds.includes('screenshots'));
    const videoItems = mappedItems.filter((i) => i.mediaType === 'video');
    const burstItems = mappedItems.filter((i) => i.mediaType === 'burst');

    const mappedAlbums: Album[] = [
      {
        id: 'camera',
        title: 'Camera',
        coverUri: cameraItems[0]?.uri || mappedItems[0]?.uri,
        itemCount: cameraItems.length,
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
        coverUri: screenshotsItems[0]?.uri,
        itemCount: screenshotsItems.length,
        isSystem: true,
        systemType: 'screenshots',
        createdAt: Date.now(),
      },
      {
        id: 'videos',
        title: 'Videos',
        coverUri: videoItems[0]?.uri,
        itemCount: videoItems.length,
        isSystem: true,
        systemType: 'videos',
        createdAt: Date.now(),
      },
      {
        id: 'burst',
        title: 'Burst Shots',
        coverUri: burstItems[0]?.uri,
        itemCount: burstItems.length,
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

    // Map custom device albums and apply deduplication across all collections
    const rawAlbums: Album[] = [
      ...mappedAlbums,
      ...deviceAlbums
        .filter((alb) => {
          const lower = alb.title.toLowerCase().trim();
          return ![
            'camera',
            'dcim',
            '100andro',
            'camera roll',
            'screenshots',
            'screenshot',
            'screen capture',
            'screen_capture',
            'videos',
            'video',
            'movies',
            'recent',
            'recents',
            'burst',
            'trash',
          ].includes(lower);
        })
        .map((alb) => ({
          id: alb.id,
          title: alb.title,
          coverUri: undefined,
          itemCount: 0,
          isSystem: false,
          systemType: 'custom' as const,
          createdAt: Date.now(),
        })),
    ];

    const deduplicated = deduplicateAlbums(rawAlbums, mappedItems);

    return {
      items: mappedItems,
      albums: deduplicated,
      permissionGranted: true,
    };
  } catch (error) {
    console.warn('Error fetching local device media:', error);
    return {
      items: [],
      albums: DEFAULT_SYSTEM_ALBUMS,
      permissionGranted: false,
    };
  }
}

/**
 * Resolves all media items belonging to a given album using unified rules.
 * This ensures the item count displayed on the album card outside matches
 * the items displayed inside the album detail screen 100% of the time.
 */
export function getAlbumMedia(
  album: { id: string; title: string; systemType?: string; isSystem?: boolean },
  items: MediaItem[],
  favoritesList: MediaItem[] = []
): MediaItem[] {
  if (!album) return [];
  const source = items.filter((m) => !m.isDeleted);

  // 1. System: Camera
  if (album.id === 'camera' || album.systemType === 'camera') {
    return source.filter((m) => m.albumIds.includes('camera') || m.category === 'Camera');
  }

  // 2. System: Favorites
  if (album.id === 'favorites' || album.systemType === 'favorites') {
    return favoritesList.length > 0
      ? favoritesList.filter((m) => !m.isDeleted)
      : source.filter((m) => m.isFavorite);
  }

  // 3. System: Screenshots
  if (album.id === 'screenshots' || album.systemType === 'screenshots') {
    return source.filter(
      (m) =>
        m.albumIds.includes('screenshots') ||
        m.category === 'Screenshots' ||
        (m.uri || '').toLowerCase().includes('screenshot')
    );
  }

  // 4. System: Videos
  if (album.id === 'videos' || album.systemType === 'videos') {
    return source.filter((m) => m.mediaType === 'video');
  }

  // 5. System: Burst
  if (album.id === 'burst' || album.systemType === 'burst') {
    return source.filter((m) => m.mediaType === 'burst');
  }

  const albumIdLower = album.id.toLowerCase();
  const titleLower = album.title.toLowerCase().trim();

  const isVideoAlbum = albumIdLower === 'videos' || titleLower.includes('video');
  const isImageOnlyAlbum =
    titleLower.includes('image') ||
    titleLower.includes('photo') ||
    titleLower.includes('picture');

  return source.filter((m) => {
    // Constraint: Video album must only contain videos
    if (isVideoAlbum && m.mediaType !== 'video') return false;
    // Constraint: Image album must never contain videos
    if (isImageOnlyAlbum && m.mediaType === 'video') return false;

    // Detect dedicated app media to prevent cross-contamination
    const isTwitterMedia =
      m.category?.toLowerCase() === 'twitter' ||
      m.albumIds.includes('twitter') ||
      m.albumIds.includes('x') ||
      (m.uri || '').toLowerCase().includes('/twitter/') ||
      (m.uri || '').toLowerCase().includes('/x/') ||
      (m.filename || '').toLowerCase().includes('twitter');

    const isWhatsAppMedia =
      m.category?.toLowerCase() === 'whatsapp' ||
      m.albumIds.includes('whatsapp') ||
      (m.uri || '').toLowerCase().includes('whatsapp');

    // 1. Twitter / X album
    if (
      titleLower.includes('twitter') ||
      titleLower === 'x' ||
      albumIdLower === 'twitter' ||
      albumIdLower === 'x'
    ) {
      if (m.category && m.category.toLowerCase() !== 'twitter' && !isTwitterMedia) {
        return false;
      }
      return (
        isTwitterMedia ||
        m.albumIds.includes(album.id) ||
        m.albumIds.includes(albumIdLower)
      );
    }

    // 2. Downloads / Download album (matches both singular and plural e.g. "Download", "Downloads")
    if (titleLower.includes('download') || albumIdLower.includes('download')) {
      // Strictly exclude dedicated app media (Twitter/X, WhatsApp, Instagram, Telegram)
      if (isTwitterMedia || isWhatsAppMedia) return false;
      if (m.category?.toLowerCase() === 'instagram' || m.albumIds.includes('instagram')) return false;
      if (m.category?.toLowerCase() === 'telegram' || m.albumIds.includes('telegram')) return false;

      return (
        m.category?.toLowerCase() === 'downloads' ||
        m.category?.toLowerCase() === 'download' ||
        m.albumIds.includes('downloads') ||
        m.albumIds.includes('download') ||
        m.albumIds.includes(album.id) ||
        m.albumIds.includes(albumIdLower) ||
        (m.uri || '').toLowerCase().includes('/download/') ||
        (m.uri || '').toLowerCase().includes('/downloads/')
      );
    }

    // 3. WhatsApp separation: Video vs Images
    if (titleLower.includes('whatsapp') || albumIdLower.includes('whatsapp')) {
      if (!isWhatsAppMedia) return false;
      if (titleLower.includes('video')) return m.mediaType === 'video';
      if (titleLower.includes('image')) return m.mediaType !== 'video';
      return true;
    }

    // Direct ID match (for other custom/device albums)
    if (m.albumIds.includes(album.id) || m.albumIds.includes(albumIdLower)) {
      return true;
    }

    // Direct title match or singular/plural variants
    if (
      m.albumIds.includes(titleLower) ||
      (m.category && m.category.toLowerCase() === titleLower)
    ) {
      return true;
    }

    // Instagram
    if (titleLower.includes('instagram') || albumIdLower.includes('instagram')) {
      return (
        m.category?.toLowerCase() === 'instagram' ||
        m.albumIds.includes('instagram') ||
        (m.uri || '').toLowerCase().includes('instagram')
      );
    }

    // Telegram
    if (titleLower.includes('telegram') || albumIdLower.includes('telegram')) {
      return (
        m.category?.toLowerCase() === 'telegram' ||
        m.albumIds.includes('telegram') ||
        (m.uri || '').toLowerCase().includes('telegram')
      );
    }

    // Check if album title matches folder name in uri path (for other custom folders)
    // Avoid single-character false positives (e.g. titleLower === 'x')
    if (titleLower.length > 1) {
      try {
        const cleanUri = (m.uri || '').toLowerCase().split('?')[0];
        const segments = cleanUri.split('/');
        if (segments.length >= 2) {
          const folderName = decodeURIComponent(segments[segments.length - 2]);
          if (
            folderName === titleLower ||
            folderName.includes(titleLower) ||
            titleLower.includes(folderName)
          ) {
            return true;
          }
        }
      } catch {}
    }

    return false;
  });
}

/**
 * Deduplicates and resolves all albums across the entire gallery:
 * 1. Pinned system albums (Camera, Favorites, Screenshots, Videos, Burst, Recycle Bin) are always preserved.
 * 2. Custom/device folders that duplicate pinned system albums (e.g. DCIM, 100ANDRO, Screenshot, Movies) are removed.
 * 3. Specific sub-albums take precedence over redundant generic parent albums:
 *    - "WhatsApp Images" and "WhatsApp Video" take precedence over generic "WhatsApp".
 *    - "Telegram Images" and "Telegram Video" take precedence over generic "Telegram".
 *    - "Downloads" takes precedence over "Download".
 * 4. Universal Content-Signature Check:
 *    If any two albums contain the exact same set of media items, only the single most
 *    descriptive album is kept, eliminating duplicate content 100% across all albums.
 * 5. Albums with 0 items are excluded from display.
 */
export function deduplicateAlbums(
  rawAlbums: Album[],
  items: MediaItem[],
  favorites: MediaItem[] = []
): Album[] {
  if (!rawAlbums || rawAlbums.length === 0) return [];

  // Pinned system album IDs
  const systemIds = new Set(['camera', 'favorites', 'screenshots', 'videos', 'burst', 'trash']);

  // Pre-calculate pinned system media signatures
  const cameraItems = getAlbumMedia({ id: 'camera', title: 'Camera', systemType: 'camera' }, items, favorites);
  const cameraSig = cameraItems.map((m) => m.id).sort().join(',');

  const screenshotsItems = getAlbumMedia({ id: 'screenshots', title: 'Screenshots', systemType: 'screenshots' }, items, favorites);
  const screenshotsSig = screenshotsItems.map((m) => m.id).sort().join(',');

  const videosItems = getAlbumMedia({ id: 'videos', title: 'Videos', systemType: 'videos' }, items, favorites);
  const videosSig = videosItems.map((m) => m.id).sort().join(',');

  const burstItems = getAlbumMedia({ id: 'burst', title: 'Burst Shots', systemType: 'burst' }, items, favorites);
  const burstSig = burstItems.map((m) => m.id).sort().join(',');

  const systemSignatures = new Set(
    [cameraSig, screenshotsSig, videosSig, burstSig].filter(Boolean)
  );

  const systemAlbums: Album[] = [];
  const customCandidates: { album: Album; items: MediaItem[]; signature: string }[] = [];
  const seenAlbumIds = new Set<string>();

  // Excluded system-equivalent device bucket names
  const excludedFolderTitles = new Set([
    'camera',
    'dcim',
    '100andro',
    'camera roll',
    'screenshots',
    'screenshot',
    'screen capture',
    'screen_capture',
    'screen recorder',
    'screen recording',
    'screen recordings',
    'videos',
    'video',
    'movies',
    'movie',
    'recent',
    'recents',
    'burst',
    'trash',
  ]);

  for (const alb of rawAlbums) {
    if (!alb || !alb.id) continue;
    if (seenAlbumIds.has(alb.id)) continue;
    seenAlbumIds.add(alb.id);

    const isSystem = Boolean(alb.isSystem || systemIds.has(alb.id) || systemIds.has(alb.systemType || ''));
    const albItems = getAlbumMedia(alb, items, favorites);

    const enriched: Album = {
      ...alb,
      itemCount: albItems.length,
      coverUri: albItems.length > 0 ? albItems[0].uri : alb.coverUri,
    };

    if (isSystem) {
      systemAlbums.push(enriched);
    } else {
      // Must contain photos or videos
      if (albItems.length === 0) continue;

      const lowerTitle = alb.title.toLowerCase().trim();

      // Exclude duplicate system-equivalent device folders
      if (excludedFolderTitles.has(lowerTitle)) {
        continue;
      }

      const sig = albItems.map((m) => m.id).sort().join(',');

      // If custom album has identical media as an existing pinned system album, drop it
      if (systemSignatures.has(sig)) {
        continue;
      }

      customCandidates.push({ album: enriched, items: albItems, signature: sig });
    }
  }

  // 1. Detect if specific sub-albums exist for WhatsApp / Telegram
  const hasSpecificWhatsApp = customCandidates.some((c) => {
    const t = c.album.title.toLowerCase();
    return (
      t.includes('whatsapp') &&
      (t.includes('image') || t.includes('video') || t.includes('photo'))
    );
  });

  const hasSpecificTelegram = customCandidates.some((c) => {
    const t = c.album.title.toLowerCase();
    return t.includes('telegram') && (t.includes('image') || t.includes('video'));
  });

  // 2. Filter out redundant generic parent albums if specific sub-albums exist
  const candidatesFiltered = customCandidates.filter((c) => {
    const t = c.album.title.toLowerCase().trim();
    if (hasSpecificWhatsApp && t === 'whatsapp') {
      return false; // Drop generic "WhatsApp" because "WhatsApp Images" / "WhatsApp Video" exists
    }
    if (hasSpecificTelegram && t === 'telegram') {
      return false; // Drop generic "Telegram" because "Telegram Images" exists
    }
    return true;
  });

  // 3. Universal Content-Signature Deduplication for Custom Albums
  // If two albums share the exact same set of media items, keep only the most specific album title
  const signatureToBestAlbum = new Map<string, { album: Album; items: MediaItem[] }>();

  for (const candidate of candidatesFiltered) {
    const existing = signatureToBestAlbum.get(candidate.signature);
    if (!existing) {
      signatureToBestAlbum.set(candidate.signature, {
        album: candidate.album,
        items: candidate.items,
      });
    } else {
      // Compare titles to pick the most descriptive / standard title
      const curTitle = candidate.album.title.toLowerCase().trim();
      const exTitle = existing.album.title.toLowerCase().trim();

      let curScore = 0;
      let exScore = 0;

      // Prefer titles mentioning image, video, photo
      if (curTitle.includes('image') || curTitle.includes('photo')) curScore += 4;
      if (exTitle.includes('image') || exTitle.includes('photo')) exScore += 4;
      if (curTitle.includes('video')) curScore += 4;
      if (exTitle.includes('video')) exScore += 4;

      // Prefer standard plurals (e.g. "Downloads" over "Download")
      if (curTitle.endsWith('s')) curScore += 2;
      if (exTitle.endsWith('s')) exScore += 2;

      // Prefer "X" if compared to legacy "Twitter"
      if (curTitle === 'x') curScore += 3;
      if (exTitle === 'x') exScore += 3;

      // Tie-breaker: longer / more descriptive title
      curScore += curTitle.length * 0.1;
      exScore += exTitle.length * 0.1;

      if (curScore > exScore) {
        signatureToBestAlbum.set(candidate.signature, {
          album: candidate.album,
          items: candidate.items,
        });
      }
    }
  }

  const finalCustomAlbums = Array.from(signatureToBestAlbum.values()).map((v) => v.album);

  return [...systemAlbums, ...finalCustomAlbums];
}

export interface DeleteAssetTarget {
  id: string;
  uri?: string;
}

async function safelyDeletePhysicalFile(uri: string): Promise<boolean> {
  if (!uri) return false;
  try {
    const fileUri = uri.startsWith('file://')
      ? uri
      : uri.startsWith('/')
      ? `file://${uri}`
      : uri;
    await FileSystem.deleteAsync(fileUri, { idempotent: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Permanently delete assets from the device's physical media store.
 * Triggers native system dialog on Android/iOS.
 * Handles Android 11+ scoped storage restrictions where non-media files
 * (such as downloads with generic MIME types) throw "All requested items must be Media items".
 */
export async function deleteAssetsFromDevice(
  targets: (string | DeleteAssetTarget)[],
  uris?: string[]
): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  if (!targets || targets.length === 0) return true;

  const normalizedTargets: DeleteAssetTarget[] = targets.map((t, index) => {
    if (typeof t === 'string') {
      return { id: t, uri: uris?.[index] };
    }
    return t;
  });

  const ids = normalizedTargets.map((t) => t.id).filter(Boolean);
  if (ids.length === 0) return true;

  if (Platform.OS === 'android') {
    // On Android 11+ (API 30+), MediaStore.createDeleteRequest requires all items to have
    // MIME types mapped to images, video, or audio.
    // If an asset has a generic MIME type (e.g. application/octet-stream from downloads),
    // MediaLibrary maps it to 'content://media/external/file/...' which throws
    // "IllegalArgumentException: All requested items must be Media items".
    // We pre-screen items to separate true MediaStore media items from generic file items.
    const mediaIds: string[] = [];
    const nonMediaTargets: DeleteAssetTarget[] = [];

    await Promise.all(
      normalizedTargets.map(async (target) => {
        try {
          const contentUri = await MediaLibrary.getAssetContentUriAsync(target.id);
          if (
            contentUri &&
            (contentUri.includes('/images/') ||
              contentUri.includes('/video/') ||
              contentUri.includes('/audio/'))
          ) {
            mediaIds.push(target.id);
          } else {
            nonMediaTargets.push(target);
          }
        } catch {
          // If contentUri check fails, try MediaLibrary first
          mediaIds.push(target.id);
        }
      })
    );

    let anySuccess = false;

    // 1. Delete standard media items via MediaLibrary (one native permission prompt for the batch)
    if (mediaIds.length > 0) {
      try {
        const batchSuccess = await MediaLibrary.deleteAssetsAsync(mediaIds);
        if (batchSuccess) {
          anySuccess = true;
        }
      } catch (batchError: any) {
        const msg = String(batchError?.message || batchError || '');
        // If user tapped "Cancel" on the native OS dialog, respect user cancellation
        if (
          msg.toLowerCase().includes('grant write permission') ||
          msg.toLowerCase().includes('user cancelled')
        ) {
          return false;
        }

        // If batch failed with "must be Media items" or other error, fallback to individual items
        for (const singleId of mediaIds) {
          try {
            await MediaLibrary.deleteAssetsAsync([singleId]);
            anySuccess = true;
          } catch (singleError: any) {
            const singleMsg = String(singleError?.message || singleError || '');
            if (
              singleMsg.toLowerCase().includes('grant write permission') ||
              singleMsg.toLowerCase().includes('user cancelled')
            ) {
              return false;
            }
            // Non-media or rejected item -> try FileSystem
            const target = normalizedTargets.find((t) => t.id === singleId);
            if (target) {
              nonMediaTargets.push(target);
            }
          }
        }
      }
    }

    // 2. For non-media items (e.g. downloads, raw files), delete directly from FileSystem
    for (const nonMedia of nonMediaTargets) {
      if (nonMedia.uri) {
        const fsSuccess = await safelyDeletePhysicalFile(nonMedia.uri);
        if (fsSuccess) {
          anySuccess = true;
        }
      }
    }

    // If only non-media items existed and were processed (or if any succeeded), return true
    return anySuccess || nonMediaTargets.length > 0;
  }

  // iOS / default
  try {
    const success = await MediaLibrary.deleteAssetsAsync(ids);
    return success;
  } catch (error: any) {
    const msg = String(error?.message || error || '');
    if (
      msg.toLowerCase().includes('grant write permission') ||
      msg.toLowerCase().includes('user cancelled')
    ) {
      return false;
    }
    console.warn('Failed to delete assets from device storage:', error);
    return false;
  }
}

