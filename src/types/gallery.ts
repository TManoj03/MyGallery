export type MediaType = 'photo' | 'video' | 'burst' | 'live';

export type ViewDensity = 'day' | 'month' | 'year';

export interface LocationInfo {
  city?: string;
  country?: string;
  placeName?: string;
  latitude?: number;
  longitude?: number;
}

export interface ExifInfo {
  cameraModel?: string;
  lens?: string;
  aperture?: string;
  iso?: number;
  shutterSpeed?: string;
  focalLength?: string;
  fileSizeMB?: number;
  resolution?: string;
}

export interface EditAdjustments {
  brightness: number; // -100 to 100
  contrast: number; // -100 to 100
  saturation: number; // -100 to 100
  warmth: number; // -100 to 100
  highlights: number; // -100 to 100
  shadows: number; // -100 to 100
  filter: string; // 'none', 'emerald', 'vivid', 'bw_contrast', 'radiant', 'cyberpunk', 'film'
  rotation: number; // 0, 90, 180, 270
  cropRatio?: 'free' | '1:1' | '4:3' | '16:9' | '9:16';
  hasMosaic?: boolean;
}

export interface MediaItem {
  id: string;
  uri: string;
  thumbnailUri?: string;
  title: string;
  filename: string;
  creationTime: number; // unix timestamp ms
  modificationTime: number;
  duration?: number; // seconds for videos
  mediaType: MediaType;
  width: number;
  height: number;
  isFavorite: boolean;
  isDeleted: boolean;
  deletedAt?: number;
  albumIds: string[];
  category: string;
  tags?: string[];
  people?: string[];
  location?: LocationInfo;
  exif?: ExifInfo;
  edits?: EditAdjustments;
}

export type SystemAlbumType = 'camera' | 'favorites' | 'screenshots' | 'videos' | 'burst' | 'trash' | 'custom';

export interface Album {
  id: string;
  title: string;
  coverUri?: string;
  itemCount: number;
  isSystem?: boolean;
  systemType: SystemAlbumType;
  createdAt: number;
}

export interface MemoryStory {
  id: string;
  title: string;
  subtitle: string;
  coverUri: string;
  mediaIds: string[];
  date: string;
  accentColor: string;
}

export interface PersonGroup {
  id: string;
  name: string;
  avatarUri: string;
  count: number;
}

export interface PlaceGroup {
  id: string;
  city: string;
  country: string;
  coverUri: string;
  count: number;
}
