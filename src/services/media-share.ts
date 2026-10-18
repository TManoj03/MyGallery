import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library/legacy';
import { Share, Platform, Alert } from 'react-native';
import { MediaItem } from '@/types/gallery';

/**
 * Resolves a shareable local file URI for any MediaItem.
 * - For remote test items (HTTP/HTTPS), downloads to cache first if needed.
 * - For iOS asset URIs (ph:// or assets-library://), resolves via MediaLibrary.getAssetInfoAsync.
 * - For local file / content URIs, uses them directly.
 */
export async function getShareableLocalUri(
  item: MediaItem
): Promise<{ uri: string; mimeType: string }> {
  const isVideo =
    item.mediaType === 'video' ||
    /\.(mp4|mov|m4v|3gp|webm|mkv|avi)$/i.test(item.filename || item.uri);

  let ext = isVideo ? 'mp4' : 'jpg';
  const nameMatch = (item.filename || item.uri).match(/\.([a-zA-Z0-9]+)($|\?)/);
  if (nameMatch && nameMatch[1]) {
    ext = nameMatch[1].toLowerCase();
  }

  const mimeType = isVideo
    ? ext === 'mov'
      ? 'video/quicktime'
      : 'video/mp4'
    : ext === 'png'
    ? 'image/png'
    : ext === 'webp'
    ? 'image/webp'
    : 'image/jpeg';

  // 1. Remote HTTP/HTTPS URL (e.g. sample test data in Expo Go)
  if (item.uri.startsWith('http://') || item.uri.startsWith('https://')) {
    try {
      const sanitizedId = item.id.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `gallery_share_${sanitizedId}.${ext}`;
      const destinationFile = new File(Paths.cache, filename);

      if (!destinationFile.exists) {
        await File.downloadFileAsync(item.uri, destinationFile, { idempotent: true });
      }
      return { uri: destinationFile.uri, mimeType };
    } catch (downloadErr) {
      console.warn('File.downloadFileAsync failed, falling back:', downloadErr);
      try {
        const legacyFS = await import('expo-file-system/legacy');
        if (legacyFS && legacyFS.downloadAsync && legacyFS.cacheDirectory) {
          const target = `${legacyFS.cacheDirectory}gallery_share_${item.id}.${ext}`;
          const res = await legacyFS.downloadAsync(item.uri, target);
          return { uri: res.uri, mimeType };
        }
      } catch (legacyErr) {
        console.warn('Legacy download also failed:', legacyErr);
      }
      return { uri: item.uri, mimeType };
    }
  }

  // 2. iOS Photo Library URI (ph:// or assets-library://)
  if (item.uri.startsWith('ph://') || item.uri.startsWith('assets-library://')) {
    try {
      const assetInfo = await MediaLibrary.getAssetInfoAsync(item.id);
      if (assetInfo?.localUri) {
        return { uri: assetInfo.localUri, mimeType };
      }
    } catch (assetErr) {
      console.warn('MediaLibrary.getAssetInfoAsync failed:', assetErr);
    }
  }

  // 3. Local content:// or file:// URI
  return { uri: item.uri, mimeType };
}

/**
 * Shares a single MediaItem using the native system share sheet.
 * Falls back to React Native Share if expo-sharing is unavailable or rejected.
 */
export async function shareMediaItem(item: MediaItem): Promise<boolean> {
  if (!item) return false;

  // Web platform check
  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: item.title,
          text: item.title,
          url: item.uri,
        });
        return true;
      } catch {
        return false;
      }
    } else {
      try {
        await Share.share({
          title: item.title,
          message: `${item.title}: ${item.uri}`,
          url: item.uri,
        });
        return true;
      } catch {
        return false;
      }
    }
  }

  try {
    const isAvailable = await Sharing.isAvailableAsync();
    const { uri: localUri, mimeType } = await getShareableLocalUri(item);

    // If local file or content URI is ready and expo-sharing is available
    if (isAvailable && (localUri.startsWith('file://') || localUri.startsWith('content://'))) {
      const isVideo = mimeType.startsWith('video');
      await Sharing.shareAsync(localUri, {
        mimeType,
        dialogTitle: item.title ? `Share ${item.title}` : 'Share Media',
        UTI: isVideo ? 'public.mpeg-4' : 'public.jpeg',
      });
      return true;
    }

    // Fallback: React Native Share
    await Share.share(
      Platform.OS === 'ios'
        ? {
            url: localUri,
            title: item.title,
          }
        : {
            title: item.title,
            message: `${item.title}\n${localUri}`,
          }
    );
    return true;
  } catch (error: any) {
    const msg = error?.message?.toLowerCase() || '';
    // Normal user dismissals
    if (
      msg.includes('user did not share') ||
      msg.includes('cancel') ||
      msg.includes('dismiss') ||
      msg.includes('abort')
    ) {
      return false;
    }

    console.warn('Native share error, trying React Native Share fallback:', error);
    try {
      await Share.share({
        title: item.title,
        message: item.title,
        url: item.uri,
      });
      return true;
    } catch {
      Alert.alert('Sharing Unavailable', 'Unable to open share options for this item.');
      return false;
    }
  }
}

/**
 * Shares multiple selected MediaItems.
 * If 1 item is selected, shares directly.
 * If multiple items are selected, provides the user the option to share
 * the first item or share all items sequentially.
 */
export async function shareMultipleMediaItems(items: MediaItem[]): Promise<void> {
  if (!items || items.length === 0) return;

  if (items.length === 1) {
    await shareMediaItem(items[0]);
    return;
  }

  Alert.alert(
    `Share ${items.length} Items`,
    `You have selected ${items.length} items to share. Choose an option:`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: `Share First (${items[0].title || 'Photo'})`,
        onPress: () => {
          shareMediaItem(items[0]);
        },
      },
      {
        text: `Share All (${items.length}) in Sequence`,
        onPress: async () => {
          for (let i = 0; i < items.length; i++) {
            await shareMediaItem(items[i]);
            if (i < items.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          }
        },
      },
    ]
  );
}
