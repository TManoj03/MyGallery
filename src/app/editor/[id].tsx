import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useGallery } from '@/context/gallery-context';
import { EditAdjustments } from '@/types/gallery';

type EditorTab = 'crop' | 'filter' | 'adjust' | 'mosaic';

const FILTERS = [
  { id: 'none', name: 'Original', color: '#888' },
  { id: 'emerald', name: 'Emerald', color: '#00BA88' },
  { id: 'radiant', name: 'Radiant', color: '#F59E0B' },
  { id: 'vivid', name: 'Vivid', color: '#EB0029' },
  { id: 'bw_contrast', name: 'B&W Master', color: '#333' },
  { id: 'cyberpunk', name: 'Cyberpunk', color: '#A855F7' },
  { id: 'film', name: 'Film Vintage', color: '#B45309' },
];

export default function PhotoEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { getMediaById, updateMediaEdits } = useGallery();

  const item = getMediaById(id || '');

  const [activeTab, setActiveTab] = useState<EditorTab>('crop');
  const [rotation, setRotation] = useState<number>(0);
  const [activeCropRatio, setActiveCropRatio] = useState<'free' | '1:1' | '4:3' | '16:9' | '9:16'>('free');
  const [selectedFilter, setSelectedFilter] = useState<string>('none');
  const [brightness, setBrightness] = useState<number>(0);
  const [contrast, setContrast] = useState<number>(0);
  const [saturation, setSaturation] = useState<number>(0);
  const [warmth, setWarmth] = useState<number>(0);
  const [hasMosaic, setHasMosaic] = useState<boolean>(false);
  const [isComparing, setIsComparing] = useState<boolean>(false);

  if (!item) {
    return (
      <View style={styles.errorContainer}>
        <Text style={{ color: '#FFFFFF' }}>Image not found</Text>
        <Pressable onPress={() => router.back()} style={styles.errorButton}>
          <Text style={{ color: '#FFFFFF' }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(style);
      } catch {}
    }
  };

  const handleRotate = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleReset = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setRotation(0);
    setActiveCropRatio('free');
    setSelectedFilter('none');
    setBrightness(0);
    setContrast(0);
    setSaturation(0);
    setWarmth(0);
    setHasMosaic(false);
  };

  const handleSave = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    const edits: EditAdjustments = {
      brightness,
      contrast,
      saturation,
      warmth,
      highlights: 0,
      shadows: 0,
      filter: selectedFilter,
      rotation,
      cropRatio: activeCropRatio,
      hasMosaic,
    };
    updateMediaEdits(item.id, edits);
    router.back();
  };

  // Determine filter tone overlay
  const getFilterOverlayStyle = () => {
    if (isComparing || selectedFilter === 'none') return null;
    switch (selectedFilter) {
      case 'emerald':
        return { backgroundColor: 'rgba(0, 186, 136, 0.14)' };
      case 'radiant':
        return { backgroundColor: 'rgba(245, 158, 11, 0.16)' };
      case 'vivid':
        return { backgroundColor: 'rgba(235, 0, 41, 0.14)' };
      case 'bw_contrast':
        return { backgroundColor: 'rgba(0, 0, 0, 0.45)' };
      case 'cyberpunk':
        return { backgroundColor: 'rgba(168, 85, 247, 0.18)' };
      case 'film':
        return { backgroundColor: 'rgba(180, 83, 9, 0.15)' };
      default:
        return null;
    }
  };

  // Determine aspect ratio for crop preview
  const getCanvasAspectRatio = () => {
    if (activeCropRatio === '1:1') return 1;
    if (activeCropRatio === '4:3') return 4 / 3;
    if (activeCropRatio === '16:9') return 16 / 9;
    if (activeCropRatio === '9:16') return 9 / 16;
    return item.width / item.height;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Top Header Bar */}
      <View style={styles.headerBar}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}
        >
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </Pressable>

        <Pressable
          onPressIn={() => setIsComparing(true)}
          onPressOut={() => setIsComparing(false)}
          style={styles.compareBtn}
        >
          <Ionicons name="swap-horizontal" size={16} color="#FFFFFF" />
          <Text style={styles.compareText}>Hold to Compare</Text>
        </Pressable>

        <View style={styles.headerRightActions}>
          <Pressable onPress={handleReset} style={styles.resetBtn}>
            <Text style={styles.resetText}>Reset</Text>
          </Pressable>
          <Pressable onPress={handleSave} style={styles.saveBtn}>
            <Text style={styles.saveText}>Save</Text>
          </Pressable>
        </View>
      </View>

      {/* Center Image Canvas */}
      <View style={styles.canvasContainer}>
        <View
          style={[
            styles.canvasFrame,
            {
              aspectRatio: getCanvasAspectRatio(),
              transform: [{ rotate: `${rotation}deg` }],
            },
          ]}
        >
          <Image
            source={{ uri: item.uri }}
            style={styles.canvasImage}
            contentFit="contain"
          />

          {/* Filter Tone Overlay */}
          <View style={[StyleSheet.absoluteFill, getFilterOverlayStyle()]} />

          {/* Simulated Mosaic / Privacy Redaction Overlay */}
          {hasMosaic && (
            <View style={styles.mosaicCensorBox}>
              <View style={styles.mosaicGrid}>
                {Array.from({ length: 24 }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.mosaicPixel,
                      { backgroundColor: i % 2 === 0 ? '#444' : '#222' },
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.mosaicBadge}>REDACTED</Text>
            </View>
          )}
        </View>
      </View>

      {/* Editor Tool Configuration Deck */}
      <View style={[styles.toolDeck, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {/* Tool Tab Sub-controls */}
        <View style={styles.subControlContainer}>
          {activeTab === 'crop' && (
            <View style={styles.cropToolsRow}>
              <Pressable onPress={handleRotate} style={styles.subToolBtn}>
                <Ionicons name="refresh" size={20} color="#FFFFFF" />
                <Text style={styles.subToolLbl}>Rotate 90°</Text>
              </Pressable>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ratioScroll}>
                {(['free', '1:1', '4:3', '16:9', '9:16'] as const).map((ratio) => (
                  <Pressable
                    key={ratio}
                    onPress={() => {
                      triggerHaptic();
                      setActiveCropRatio(ratio);
                    }}
                    style={[
                      styles.ratioPill,
                      activeCropRatio === ratio && styles.activeRatioPill,
                    ]}
                  >
                    <Text style={[styles.ratioText, activeCropRatio === ratio && styles.activeRatioText]}>
                      {ratio.toUpperCase()}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {activeTab === 'filter' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
              {FILTERS.map((f) => {
                const isSelected = selectedFilter === f.id;
                return (
                  <Pressable
                    key={f.id}
                    onPress={() => {
                      triggerHaptic();
                      setSelectedFilter(f.id);
                    }}
                    style={[styles.filterItem, isSelected && styles.activeFilterItem]}
                  >
                    <View style={[styles.filterColorSwatch, { backgroundColor: f.color }]} />
                    <Text style={[styles.filterName, isSelected && { color: '#EB0029', fontWeight: '700' }]}>
                      {f.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {activeTab === 'adjust' && (
            <View style={styles.adjustRow}>
              {[
                { name: 'Bright', val: brightness, set: setBrightness },
                { name: 'Contrast', val: contrast, set: setContrast },
                { name: 'Color', val: saturation, set: setSaturation },
                { name: 'Warmth', val: warmth, set: setWarmth },
              ].map((adj) => (
                <Pressable
                  key={adj.name}
                  onPress={() => {
                    triggerHaptic();
                    adj.set(adj.val === 25 ? 0 : 25);
                  }}
                  style={[styles.adjustBtn, adj.val !== 0 && styles.activeAdjustBtn]}
                >
                  <Text style={[styles.adjustName, adj.val !== 0 && { color: '#EB0029' }]}>{adj.name}</Text>
                  <Text style={styles.adjustVal}>{adj.val > 0 ? `+${adj.val}` : adj.val}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {activeTab === 'mosaic' && (
            <View style={styles.mosaicRow}>
              <Text style={styles.mosaicInfo}>
                Tap to toggle privacy redaction mosaic on center document/faces
              </Text>
              <Pressable
                onPress={() => {
                  triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
                  setHasMosaic(!hasMosaic);
                }}
                style={[styles.mosaicToggleBtn, hasMosaic && { backgroundColor: '#EB0029' }]}
              >
                <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.mosaicToggleText}>
                  {hasMosaic ? 'Remove Redaction' : 'Apply Mosaic Redaction'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Main Tab Switcher Bar */}
        <View style={styles.tabSwitcher}>
          <Pressable
            onPress={() => {
              triggerHaptic();
              setActiveTab('crop');
            }}
            style={[styles.tabBtn, activeTab === 'crop' && styles.activeTabBtn]}
          >
            <Ionicons name="crop" size={20} color={activeTab === 'crop' ? '#EB0029' : '#FFFFFF'} />
            <Text style={[styles.tabLbl, activeTab === 'crop' && { color: '#EB0029' }]}>Crop</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              triggerHaptic();
              setActiveTab('filter');
            }}
            style={[styles.tabBtn, activeTab === 'filter' && styles.activeTabBtn]}
          >
            <Ionicons name="color-filter" size={20} color={activeTab === 'filter' ? '#EB0029' : '#FFFFFF'} />
            <Text style={[styles.tabLbl, activeTab === 'filter' && { color: '#EB0029' }]}>Filters</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              triggerHaptic();
              setActiveTab('adjust');
            }}
            style={[styles.tabBtn, activeTab === 'adjust' && styles.activeTabBtn]}
          >
            <Ionicons name="options" size={20} color={activeTab === 'adjust' ? '#EB0029' : '#FFFFFF'} />
            <Text style={[styles.tabLbl, activeTab === 'adjust' && { color: '#EB0029' }]}>Adjust</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              triggerHaptic();
              setActiveTab('mosaic');
            }}
            style={[styles.tabBtn, activeTab === 'mosaic' && styles.activeTabBtn]}
          >
            <Ionicons name="finger-print" size={20} color={activeTab === 'mosaic' ? '#EB0029' : '#FFFFFF'} />
            <Text style={[styles.tabLbl, activeTab === 'mosaic' && { color: '#EB0029' }]}>Mosaic</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  errorButton: {
    padding: 12,
    backgroundColor: '#EB0029',
    borderRadius: 8,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  headerBtn: {
    padding: 6,
  },
  compareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 4,
  },
  compareText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resetBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  resetText: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  saveBtn: {
    backgroundColor: '#EB0029',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  saveText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  canvasContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  canvasFrame: {
    width: '90%',
    maxHeight: '80%',
    overflow: 'hidden',
    position: 'relative',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  canvasImage: {
    width: '100%',
    height: '100%',
  },
  mosaicCensorBox: {
    position: 'absolute',
    top: '30%',
    left: '20%',
    width: '60%',
    height: '35%',
    borderWidth: 1,
    borderColor: '#EB0029',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mosaicGrid: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    flexWrap: 'wrap',
    opacity: 0.8,
  },
  mosaicPixel: {
    width: '16.66%',
    height: '25%',
  },
  mosaicBadge: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 2,
    backgroundColor: 'rgba(235, 0, 41, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  toolDeck: {
    backgroundColor: '#121316',
    borderTopWidth: 1,
    borderTopColor: '#26282E',
  },
  subControlContainer: {
    paddingVertical: 14,
    minHeight: 74,
    justifyContent: 'center',
  },
  cropToolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  subToolBtn: {
    alignItems: 'center',
    gap: 2,
    paddingRight: 12,
    borderRightWidth: 1,
    borderRightColor: '#2B2D33',
  },
  subToolLbl: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  ratioScroll: {
    gap: 8,
    paddingLeft: 4,
  },
  ratioPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#1F2125',
  },
  activeRatioPill: {
    backgroundColor: '#EB0029',
  },
  ratioText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  activeRatioText: {
    fontWeight: '800',
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 14,
  },
  filterItem: {
    alignItems: 'center',
    gap: 6,
    width: 64,
  },
  activeFilterItem: {
    transform: [{ scale: 1.05 }],
  },
  filterColorSwatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  filterName: {
    color: '#FFFFFF',
    fontSize: 11,
    textAlign: 'center',
  },
  adjustRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
  },
  adjustBtn: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#1F2125',
  },
  activeAdjustBtn: {
    borderWidth: 1,
    borderColor: '#EB0029',
  },
  adjustName: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  adjustVal: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 10,
    marginTop: 2,
  },
  mosaicRow: {
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  mosaicInfo: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    textAlign: 'center',
  },
  mosaicToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2125',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  mosaicToggleText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  tabSwitcher: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#202226',
  },
  tabBtn: {
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  activeTabBtn: {
    transform: [{ scale: 1.05 }],
  },
  tabLbl: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
});
