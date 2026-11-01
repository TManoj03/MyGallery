import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Platform,
  Alert,
  ScrollView,
  Modal,
  ActivityIndicator,
  type GestureResponderEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { useEvent, useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, FlatList } from 'react-native-gesture-handler';

import { useGallery } from '@/context/gallery-context';
import { useTheme } from '@/hooks/use-theme';
import { MediaItem } from '@/types/gallery';
import { shareMediaItem } from '@/services/media-share';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

function triggerHaptic(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (Platform.OS !== 'web') {
    try {
      Haptics.impactAsync(style);
    } catch {}
  }
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const secStr = secs < 10 ? `0${secs}` : `${secs}`;
  if (hours > 0) {
    const minStr = mins < 10 ? `0${mins}` : `${mins}`;
    return `${hours}:${minStr}:${secStr}`;
  }
  return `${mins}:${secStr}`;
}

function setPlayerMuted(playerInstance: any, muted: boolean) {
  playerInstance.muted = muted;
}

function setPlayerCurrentTime(playerInstance: any, time: number) {
  playerInstance.currentTime = time;
}

function setPlayerPlaybackRate(playerInstance: any, rate: number) {
  playerInstance.playbackRate = rate;
}

function setPlayerLoop(playerInstance: any, loop: boolean) {
  playerInstance.loop = loop;
}

function getNow(): number {
  return Date.now();
}

interface VideoPlayerItemProps {
  uri: string;
  isActive: boolean;
  showChrome: boolean;
  onToggleControls: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
}

const PLAYBACK_SPEEDS = [0.5, 1.0, 1.25, 1.5, 2.0];

function GalleryVideoItem({
  uri,
  isActive,
  showChrome,
  onToggleControls,
  onNext,
  onPrevious,
}: VideoPlayerItemProps) {
  const insets = useSafeAreaInsets();
  const videoViewRef = useRef<VideoView>(null);
  const [contentFit, setContentFit] = useState<'contain' | 'cover'>('contain');
  const [isMuted, setIsMuted] = useState(true);
  const [isLooping, setIsLooping] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isSpeedBoosted, setIsSpeedBoosted] = useState(false);
  const [progressBarWidth, setProgressBarWidth] = useState(0);

  // Real-time scrubbing state
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPositionFraction, setScrubPositionFraction] = useState(0);

  // Double-tap visual feedback state (-10s / +10s)
  const [seekFeedback, setSeekFeedback] = useState<{
    side: 'left' | 'right';
    seconds: number;
  } | null>(null);

  // Speed toast indicator state
  const [speedNotification, setSpeedNotification] = useState<number | null>(null);

  // Refs for smooth gestures and zero-latency drag tracking
  const progressBarWidthRef = useRef(0);
  const durationRef = useRef(0);
  const isScrubbingRef = useRef(false);
  const lastSeekTimeRef = useRef(0);

  const lastTapRef = useRef<{ time: number; x: number } | null>(null);
  const singleTapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speedNotificationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isHoldingSpeedRef = useRef(false);
  const speedBeforeBoostRef = useRef(1.0);
  const isLoopingRef = useRef(true);

  useEffect(() => {
    isLoopingRef.current = isLooping;
  }, [isLooping]);

  const player = useVideoPlayer(uri, (p) => {
    p.muted = true;
    p.loop = true;
    p.timeUpdateEventInterval = 0.25;
    if (isActive) {
      p.play();
    }
  });

  useEffect(() => {
    setPlayerMuted(player, true);
  }, [player]);

  const [currentTime, setCurrentTime] = useState(0);

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  useEventListener(player, 'timeUpdate', ({ currentTime: newTime }) => {
    if (!isScrubbingRef.current) {
      setCurrentTime(newTime);
    }
  });

  useEventListener(player, 'playToEnd', () => {
    if (!isLoopingRef.current) {
      player.pause();
    }
  });

  useEffect(() => {
    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, player]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
      }
      if (seekFeedbackTimerRef.current) {
        clearTimeout(seekFeedbackTimerRef.current);
      }
      if (speedNotificationTimerRef.current) {
        clearTimeout(speedNotificationTimerRef.current);
      }
    };
  }, []);

  const duration = Math.max(0, player.duration || 0);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  const handlePlayPause = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  const handleSeekBy = (seconds: number) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    player.seekBy(seconds);
  };

  const handleCycleSpeed = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length;
    const nextSpeed = PLAYBACK_SPEEDS[nextIndex];
    setPlaybackSpeed(nextSpeed);
    setPlayerPlaybackRate(player, nextSpeed);
    speedBeforeBoostRef.current = nextSpeed;

    setSpeedNotification(nextSpeed);
    if (speedNotificationTimerRef.current) {
      clearTimeout(speedNotificationTimerRef.current);
    }
    speedNotificationTimerRef.current = setTimeout(() => {
      setSpeedNotification(null);
      speedNotificationTimerRef.current = null;
    }, 1200);
  };

  const handleToggleLoop = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    const next = !isLooping;
    setIsLooping(next);
    setPlayerLoop(player, next);
  };

  const handleToggleMute = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setPlayerMuted(player, !player.muted);
    setIsMuted(player.muted);
  };

  const handleReplay = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    player.replay();
  };

  const handleToggleFit = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setContentFit((prev) => (prev === 'contain' ? 'cover' : 'contain'));
  };

  const handleFullscreen = async () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await videoViewRef.current?.enterFullscreen();
    } catch (err) {
      console.warn('Fullscreen entry not supported or failed:', err);
    }
  };

  // Double-tap to seek (left -10s, right +10s) with cumulative second count
  const handleDoubleTapSeek = (delta: number) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    player.seekBy(delta);

    const side = delta < 0 ? 'left' : 'right';
    setSeekFeedback((prev) => {
      const currentSeconds = prev && prev.side === side ? prev.seconds : 0;
      return {
        side,
        seconds: currentSeconds + Math.abs(delta),
      };
    });

    if (seekFeedbackTimerRef.current) {
      clearTimeout(seekFeedbackTimerRef.current);
    }
    seekFeedbackTimerRef.current = setTimeout(() => {
      setSeekFeedback(null);
      seekFeedbackTimerRef.current = null;
    }, 750);
  };

  // Long-press hold for 2.0x playback speed
  const handleLongPressStart = () => {
    if (isHoldingSpeedRef.current) return;
    isHoldingSpeedRef.current = true;
    speedBeforeBoostRef.current = player.playbackRate || playbackSpeed;
    setPlayerPlaybackRate(player, 2.0);
    setIsSpeedBoosted(true);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleLongPressEnd = () => {
    if (!isHoldingSpeedRef.current) return;
    isHoldingSpeedRef.current = false;
    setPlayerPlaybackRate(player, speedBeforeBoostRef.current);
    setIsSpeedBoosted(false);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
  };

  // Backdrop touch handler distinguishing single tap (toggle controls) and double-tap (seek)
  const handleBackdropPress = (e: GestureResponderEvent) => {
    if (isHoldingSpeedRef.current) {
      return;
    }

    const now = getNow();
    const x = e.nativeEvent.locationX;
    const isDoubleTap =
      lastTapRef.current &&
      now - lastTapRef.current.time < 300 &&
      Math.abs(x - lastTapRef.current.x) < 80;

    if (isDoubleTap) {
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
        singleTapTimeoutRef.current = null;
      }
      lastTapRef.current = null;

      if (x < SCREEN_WIDTH * 0.42) {
        handleDoubleTapSeek(-10);
      } else if (x > SCREEN_WIDTH * 0.58) {
        handleDoubleTapSeek(10);
      } else {
        handlePlayPause();
      }
    } else {
      lastTapRef.current = { time: now, x };
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
      }
      singleTapTimeoutRef.current = setTimeout(() => {
        onToggleControls();
        singleTapTimeoutRef.current = null;
      }, 260);
    }
  };

  // Interactive scrubber drag handling via PanResponder
  const handleScrubStart = (locationX: number) => {
    const width = progressBarWidthRef.current;
    if (width <= 0 || durationRef.current <= 0) return;
    isScrubbingRef.current = true;
    setIsScrubbing(true);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);

    const frac = Math.max(0, Math.min(1, locationX / width));
    setScrubPositionFraction(frac);
    const targetTime = frac * durationRef.current;
    setPlayerCurrentTime(player, targetTime);
  };

  const handleScrubMove = (currentX: number) => {
    const width = progressBarWidthRef.current;
    if (width <= 0 || durationRef.current <= 0 || !isScrubbingRef.current) return;

    const frac = Math.max(0, Math.min(1, currentX / width));
    setScrubPositionFraction(frac);

    const now = getNow();
    if (now - lastSeekTimeRef.current > 50) {
      lastSeekTimeRef.current = now;
      const targetTime = frac * durationRef.current;
      setPlayerCurrentTime(player, targetTime);
    }
  };

  const handleScrubEnd = (currentX: number) => {
    const width = progressBarWidthRef.current;
    if (width > 0 && durationRef.current > 0 && isScrubbingRef.current) {
      const frac = Math.max(0, Math.min(1, currentX / width));
      const targetTime = frac * durationRef.current;
      setPlayerCurrentTime(player, targetTime);
      setCurrentTime(targetTime);
      triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    }
    isScrubbingRef.current = false;
    setIsScrubbing(false);
  };

  const startPageXRef = useRef(0);
  const startLocationXRef = useRef(0);

  const handleTouchStart = (e: GestureResponderEvent) => {
    startPageXRef.current = e.nativeEvent.pageX;
    startLocationXRef.current = e.nativeEvent.locationX;
    handleScrubStart(e.nativeEvent.locationX);
  };

  const handleTouchMove = (e: GestureResponderEvent) => {
    const deltaX = e.nativeEvent.pageX - startPageXRef.current;
    const currentX = startLocationXRef.current + deltaX;
    handleScrubMove(currentX);
  };

  const handleTouchEnd = (e: GestureResponderEvent) => {
    const deltaX = e.nativeEvent.pageX - startPageXRef.current;
    const currentX = startLocationXRef.current + deltaX;
    handleScrubEnd(currentX);
  };

  const handleTouchCancel = () => {
    isScrubbingRef.current = false;
    setIsScrubbing(false);
  };

  const handlePreviousPress = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    if (currentTime > 3) {
      player.replay();
    } else if (onPrevious) {
      onPrevious();
    }
  };

  const handleNextPress = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    if (onNext) {
      onNext();
    }
  };

  const progressFraction = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
  const activeFraction = isScrubbing ? scrubPositionFraction : progressFraction;
  const displayTime = isScrubbing ? activeFraction * duration : currentTime;

  return (
    <View style={styles.pageContainer}>
      <VideoView
        ref={videoViewRef}
        player={player}
        style={styles.mainMedia}
        contentFit={contentFit}
        nativeControls={false}
      />

      {/* Backdrop touch target: handles single-tap (toggle chrome), double-tap (-10s / +10s), and press-and-hold (2x speed) */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={handleBackdropPress}
        onLongPress={handleLongPressStart}
        onPressOut={handleLongPressEnd}
        delayLongPress={350}
      />

      {/* Top Floating Speed Indicator (Active on Long-Press or Speed Cycle) */}
      {(isSpeedBoosted || speedNotification !== null) && (
        <View style={styles.speedBoostBadge} pointerEvents="none">
          <Ionicons name="flash" size={14} color="#FFD60A" />
          <Text style={styles.speedBoostText}>
            {isSpeedBoosted ? '2.0× Speed' : `${speedNotification}× Speed`}
          </Text>
        </View>
      )}

      {/* Double-Tap Seek Feedback Badges (-10s / +10s) */}
      {seekFeedback && (
        <View
          style={[
            styles.seekFeedbackOverlay,
            seekFeedback.side === 'left' ? styles.seekFeedbackLeft : styles.seekFeedbackRight,
          ]}
          pointerEvents="none"
        >
          <View style={styles.seekFeedbackPill}>
            <Ionicons
              name={seekFeedback.side === 'left' ? 'play-back' : 'play-forward'}
              size={26}
              color="#FFFFFF"
            />
            <Text style={styles.seekFeedbackText}>
              {seekFeedback.side === 'left' ? `-${seekFeedback.seconds}s` : `+${seekFeedback.seconds}s`}
            </Text>
          </View>
        </View>
      )}

      {/* Controls Overlay displayed when showChrome is true */}
      {showChrome && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {/* Centered Transport Controls: Previous, -10s, Play/Pause, +10s, Next */}
          <View style={styles.videoCenterOverlay} pointerEvents="box-none">
            <View style={styles.videoCenterControls} pointerEvents="auto">
              {/* Previous Media / Rewind */}
              <Pressable
                onPress={handlePreviousPress}
                disabled={!onPrevious && currentTime <= 3}
                style={({ pressed }) => [
                  styles.videoNavCircle,
                  (!onPrevious && currentTime <= 3) && styles.disabledButton,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="play-skip-back" size={24} color="#FFFFFF" />
              </Pressable>

              {/* Seek -10s */}
              <Pressable
                onPress={() => handleSeekBy(-10)}
                style={({ pressed }) => [styles.videoSeekCircle, pressed && styles.pressed]}
              >
                <Ionicons name="play-back" size={18} color="#FFFFFF" />
                <Text style={styles.seekLabel}>10</Text>
              </Pressable>

              {/* Main OnePlus Red Play/Pause Button */}
              <Pressable
                onPress={handlePlayPause}
                style={({ pressed }) => [styles.videoPlayPauseButton, pressed && styles.pressed]}
              >
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={34}
                  color="#FFFFFF"
                  style={!isPlaying ? { marginLeft: 3 } : undefined}
                />
              </Pressable>

              {/* Seek +10s */}
              <Pressable
                onPress={() => handleSeekBy(10)}
                style={({ pressed }) => [styles.videoSeekCircle, pressed && styles.pressed]}
              >
                <Ionicons name="play-forward" size={18} color="#FFFFFF" />
                <Text style={styles.seekLabel}>10</Text>
              </Pressable>

              {/* Next Media */}
              <Pressable
                onPress={handleNextPress}
                disabled={!onNext}
                style={({ pressed }) => [
                  styles.videoNavCircle,
                  !onNext && styles.disabledButton,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="play-skip-forward" size={24} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>

          {/* Unified Video Playback Control Deck positioned right above bottom filmstrip */}
          <View
            style={[
              styles.videoPlaybackDeck,
              { bottom: Math.max(insets.bottom, 16) + 120 },
            ]}
            pointerEvents="auto"
          >
            {/* Quick Tools Row (Play/Pause, Speed, Loop, Mute, Fit, Replay, Fullscreen) - Pure Icons */}
            <View style={styles.videoQuickActionsRow}>
              {/* Play / Pause */}
              <Pressable
                onPress={handlePlayPause}
                style={({ pressed }) => [
                  styles.videoPillButton,
                  styles.videoPlayPill,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={18}
                  color="#FFFFFF"
                  style={!isPlaying ? { marginLeft: 2 } : undefined}
                />
              </Pressable>

              {/* Playback Speed Cycle */}
              <Pressable
                onPress={handleCycleSpeed}
                style={({ pressed }) => [
                  styles.videoPillButton,
                  playbackSpeed !== 1.0 && styles.videoPillButtonActiveSpeed,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name="speedometer-outline"
                  size={18}
                  color={playbackSpeed !== 1.0 ? '#FFD60A' : '#FFFFFF'}
                />
              </Pressable>

              {/* Loop / Play Once Toggle */}
              <Pressable
                onPress={handleToggleLoop}
                style={({ pressed }) => [
                  styles.videoPillButton,
                  isLooping && styles.videoPillButtonActiveLoop,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name={isLooping ? 'repeat' : 'arrow-forward'}
                  size={18}
                  color={isLooping ? '#0084FF' : '#FFFFFF'}
                />
              </Pressable>

              {/* Mute / Unmute */}
              <Pressable
                onPress={handleToggleMute}
                style={({ pressed }) => [
                  styles.videoPillButton,
                  isMuted && styles.videoPillButtonActive,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name={isMuted ? 'volume-mute' : 'volume-high'}
                  size={18}
                  color={isMuted ? '#FF453A' : '#FFFFFF'}
                />
              </Pressable>

              {/* Screen Fit (Contain / Cover) */}
              <Pressable
                onPress={handleToggleFit}
                style={({ pressed }) => [styles.videoPillButton, pressed && styles.pressed]}
              >
                <Ionicons
                  name={contentFit === 'cover' ? 'contract-outline' : 'scan-outline'}
                  size={18}
                  color="#FFFFFF"
                />
              </Pressable>

              {/* Replay */}
              <Pressable
                onPress={handleReplay}
                style={({ pressed }) => [styles.videoPillButton, pressed && styles.pressed]}
              >
                <Ionicons name="refresh" size={18} color="#FFFFFF" />
              </Pressable>

              {/* Native Fullscreen */}
              <Pressable
                onPress={handleFullscreen}
                style={({ pressed }) => [styles.videoPillButton, pressed && styles.pressed]}
              >
                <Ionicons name="expand" size={18} color="#FFFFFF" />
              </Pressable>
            </View>

            {/* Video Scrubber & Interactive Drag Timeline */}
            <View style={styles.videoScrubberRow}>
              <Text style={styles.timecodeText}>{formatTime(displayTime)}</Text>

              <View
                style={styles.progressBarWrapper}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchCancel}
                onLayout={(e) => {
                  const width = e.nativeEvent.layout.width;
                  setProgressBarWidth(width);
                  progressBarWidthRef.current = width;
                }}
              >
                {/* Floating Preview Timecode Bubble above thumb during dragging */}
                {isScrubbing && progressBarWidth > 0 && (
                  <View
                    style={[
                      styles.scrubberPreviewBubble,
                      {
                        left: `${activeFraction * 100}%`,
                      },
                    ]}
                    pointerEvents="none"
                  >
                    <Text style={styles.scrubberPreviewText}>
                      {formatTime(displayTime)}
                    </Text>
                    <View style={styles.scrubberPreviewArrow} />
                  </View>
                )}

                <View
                  style={[
                    styles.progressBarTrack,
                    isScrubbing && styles.progressBarTrackActive,
                  ]}
                >
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${activeFraction * 100}%` },
                      isScrubbing && styles.progressBarFillActive,
                    ]}
                  />
                  <View
                    style={[
                      styles.progressBarThumb,
                      { left: `${activeFraction * 100}%` },
                      isScrubbing && styles.progressBarThumbScrubbing,
                    ]}
                  />
                </View>
              </View>

              <Text style={styles.timecodeText}>{formatTime(duration)}</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

interface ZoomableImageItemProps {
  uri: string;
  isActive: boolean;
  isZoomed: boolean;
  parentListRef?: React.RefObject<any>;
  onToggleControls: () => void;
  onZoomChange: (isZoomed: boolean) => void;
}

function ZoomableImageItem({
  uri,
  isActive,
  isZoomed,
  parentListRef,
  onToggleControls,
  onZoomChange,
}: ZoomableImageItemProps) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const resetZoom = () => {
    'worklet';
    scale.value = withTiming(1, { duration: 250 });
    savedScale.value = 1;
    translateX.value = withTiming(0, { duration: 250 });
    translateY.value = withTiming(0, { duration: 250 });
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    runOnJS(onZoomChange)(false);
  };

  // Two-finger pinch gesture
  let pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
      runOnJS(onZoomChange)(true);
    })
    .onUpdate((e) => {
      const nextScale = savedScale.value * e.scale;
      const clampedScale = Math.max(1, Math.min(nextScale, 5));
      scale.value = clampedScale;

      // Restrict translations within screen boundaries as scale shrinks
      const maxTx = (SCREEN_WIDTH * (clampedScale - 1)) / 2;
      const maxTy = (SCREEN_HEIGHT * (clampedScale - 1)) / 2;
      if (Math.abs(translateX.value) > maxTx) {
        translateX.value = Math.sign(translateX.value) * maxTx;
      }
      if (Math.abs(translateY.value) > maxTy) {
        translateY.value = Math.sign(translateY.value) * maxTy;
      }
    })
    .onEnd(() => {
      if (scale.value < 1.08) {
        resetZoom();
      } else {
        savedScale.value = scale.value;
        runOnJS(onZoomChange)(true);
      }
    });

  if (parentListRef) {
    pinchGesture = pinchGesture.simultaneousWithExternalGesture(parentListRef);
  }

  // Pan gesture active only while zoomed, preventing interference with pager swiping
  const panGesture = Gesture.Pan()
    .enabled(isZoomed)
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      if (scale.value > 1.05) {
        const maxTx = (SCREEN_WIDTH * (scale.value - 1)) / 2;
        const maxTy = (SCREEN_HEIGHT * (scale.value - 1)) / 2;
        const nextX = savedTranslateX.value + e.translationX;
        const nextY = savedTranslateY.value + e.translationY;
        translateX.value = Math.max(-maxTx, Math.min(maxTx, nextX));
        translateY.value = Math.max(-maxTy, Math.min(maxTy, nextY));
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  // Double-tap to quick zoom in/out
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(250)
    .onEnd((_e, success) => {
      if (success) {
        if (scale.value > 1.1) {
          resetZoom();
        } else {
          scale.value = withTiming(2.5, { duration: 250 });
          savedScale.value = 2.5;
          runOnJS(onZoomChange)(true);
        }
      }
    });

  // Single-tap to toggle top and bottom viewer chrome
  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd((_e, success) => {
      if (success) {
        runOnJS(onToggleControls)();
      }
    });

  const taps = Gesture.Exclusive(doubleTap, singleTap);
  const pinchAndPan = Gesture.Simultaneous(pinchGesture, panGesture);
  const composedGestures = Gesture.Simultaneous(pinchAndPan, taps);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  // Reset zoom state when this item is no longer the active page
  useEffect(() => {
    if (!isActive) {
      resetZoom();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  return (
    <View style={styles.pageContainer}>
      <GestureDetector gesture={composedGestures}>
        <Animated.View style={[styles.imageWrapper, animatedStyle]}>
          <Image
            source={{ uri }}
            style={styles.mainMedia}
            contentFit="contain"
            transition={150}
            cachePolicy="memory-disk"
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

export default function MediaViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { media, toggleFavorite, deleteToTrash } = useGallery();

  const [currentId, setCurrentId] = useState<string>(id || '');
  const [showControls, setShowControls] = useState<boolean>(true);
  const [showExifModal, setShowExifModal] = useState<boolean>(false);
  const [isZoomed, setIsZoomed] = useState<boolean>(false);
  const [isSharing, setIsSharing] = useState<boolean>(false);

  const mediaListRef = useRef<FlatList<MediaItem>>(null);
  const filmstripScrollRef = useRef<ScrollView>(null);

  // Compute initial index from passed id
  const initialIndex = Math.max(0, media.findIndex((item) => item.id === (id || currentId)));

  // Find active media item
  const currentItem = media.find((item) => item.id === currentId) || media[0];
  const currentIndex = media.findIndex((item) => item.id === currentId);

  // Sync initial filmstrip scroll
  useEffect(() => {
    if (initialIndex >= 0) {
      setTimeout(() => {
        filmstripScrollRef.current?.scrollTo({
          x: Math.max(0, initialIndex * 50 - SCREEN_WIDTH / 2 + 25),
          animated: false,
        });
      }, 200);
    }
  }, [initialIndex]);

  if (!currentItem || media.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <Text style={{ color: '#FFFFFF', fontSize: 16 }}>Media not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
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

  const handleToggleControls = () => {
    setShowControls(!showControls);
  };

  const handleFavorite = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    toggleFavorite(currentItem.id);
  };

  const handleShareCurrentItem = async () => {
    if (!currentItem || isSharing) return;
    triggerHaptic();
    setIsSharing(true);
    try {
      await shareMediaItem(currentItem);
    } finally {
      setIsSharing(false);
    }
  };

  const handleDelete = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    const deleteAction = () => {
      deleteToTrash([currentItem.id]);
      router.back();
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Move this item to Recycle Bin?')) {
        deleteAction();
      }
    } else {
      Alert.alert(
        'Move to Recycle Bin?',
        'This item will be kept in the Recycle Bin for 30 days.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: deleteAction },
        ]
      );
    }
  };

  // Filmstrip thumbnail tap
  const handleSelectThumbnail = (targetId: string, index: number) => {
    triggerHaptic();
    setCurrentId(targetId);
    setIsZoomed(false);
    try {
      mediaListRef.current?.scrollToIndex({ index, animated: true });
    } catch {
      mediaListRef.current?.scrollToOffset({ offset: index * SCREEN_WIDTH, animated: true });
    }
    filmstripScrollRef.current?.scrollTo({
      x: Math.max(0, index * 50 - SCREEN_WIDTH / 2 + 25),
      animated: true,
    });
  };

  const handleNext = () => {
    if (currentIndex < media.length - 1) {
      const nextIndex = currentIndex + 1;
      handleSelectThumbnail(media[nextIndex].id, nextIndex);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      handleSelectThumbnail(media[prevIndex].id, prevIndex);
    }
  };

  const formattedDate = new Date(currentItem.creationTime).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={styles.container}>
      {/* Horizontal Swipeable Media Pager (Swiping between photos and videos with pinch zoom) */}
      <FlatList
        ref={mediaListRef}
        data={media}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        scrollEnabled={!isZoomed}
        showsHorizontalScrollIndicator={false}
        bounces={false}
        decelerationRate="fast"
        initialScrollIndex={initialIndex >= 0 ? initialIndex : 0}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            mediaListRef.current?.scrollToOffset({
              offset: info.index * SCREEN_WIDTH,
              animated: false,
            });
          }, 100);
        }}
        onScrollBeginDrag={() => {
          setIsZoomed(false);
        }}
        onMomentumScrollEnd={(e) => {
          setIsZoomed(false);
          const newIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          if (newIndex >= 0 && newIndex < media.length) {
            const newMedia = media[newIndex];
            if (newMedia && newMedia.id !== currentId) {
              setCurrentId(newMedia.id);
              filmstripScrollRef.current?.scrollTo({
                x: Math.max(0, newIndex * 50 - SCREEN_WIDTH / 2 + 25),
                animated: true,
              });
            }
          }
        }}
        renderItem={({ item }) => {
          const isItemActive = item.id === currentId;

          if (item.mediaType === 'video') {
            return (
              <GalleryVideoItem
                uri={item.uri}
                isActive={isItemActive}
                showChrome={showControls}
                onToggleControls={handleToggleControls}
                onNext={currentIndex < media.length - 1 ? handleNext : undefined}
                onPrevious={currentIndex > 0 ? handlePrevious : undefined}
              />
            );
          }

          return (
            <ZoomableImageItem
              uri={item.uri}
              isActive={isItemActive}
              isZoomed={isZoomed}
              parentListRef={mediaListRef}
              onToggleControls={handleToggleControls}
              onZoomChange={setIsZoomed}
            />
          );
        }}
        windowSize={3}
        maxToRenderPerBatch={2}
        initialNumToRender={1}
      />

      {/* Top Header Chrome */}
      {showControls && (
        <SafeAreaView edges={['top']} style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.iconCircle, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </Pressable>

          <View style={styles.titleInfo}>
            <View style={styles.titleRow}>
              {currentItem.mediaType === 'burst' && (
                <View style={styles.burstHeaderBadge}>
                  <Ionicons name="copy" size={11} color="#0084FF" />
                  <Text style={styles.burstHeaderBadgeText}>Burst</Text>
                </View>
              )}
              <Text style={styles.headerTitle} numberOfLines={1}>
                {currentItem.title}
              </Text>
            </View>
            <Text style={styles.headerSubtitle}>
              {currentIndex + 1} of {media.length}
            </Text>
          </View>

          <View style={styles.headerRightActions}>
            <Pressable
              onPress={() => setShowExifModal(true)}
              style={({ pressed }) => [styles.iconCircle, pressed && styles.pressed]}
            >
              <Ionicons name="information-circle-outline" size={24} color="#FFFFFF" />
            </Pressable>
          </View>
        </SafeAreaView>
      )}

      {/* Bottom Filmstrip and Toolbar Chrome */}
      {showControls && (
        <View style={[styles.bottomContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {/* OnePlus Filmstrip Scrubber */}
          <View style={styles.filmstripWrapper}>
            <ScrollView
              ref={filmstripScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filmstripContent}
            >
              {media.map((item, idx) => {
                const isActive = item.id === currentItem.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => handleSelectThumbnail(item.id, idx)}
                    style={[
                      styles.filmstripThumb,
                      isActive && styles.activeFilmstripThumb,
                    ]}
                  >
                    <Image
                      source={{ uri: item.thumbnailUri || item.uri }}
                      style={styles.filmstripImage}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      recyclingKey={item.id}
                      transition={0}
                    />
                    {item.mediaType === 'video' && (
                      <View style={styles.filmstripVideoIndicator}>
                        <Ionicons name="play" size={8} color="#FFFFFF" />
                      </View>
                    )}
                    {item.mediaType === 'burst' && (
                      <View style={[styles.filmstripVideoIndicator, { backgroundColor: '#0084FF' }]}>
                        <Ionicons name="copy" size={7} color="#FFFFFF" />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Bottom Action Bar */}
          <View style={styles.toolbarRow}>
            {/* Share */}
            <Pressable
              onPress={handleShareCurrentItem}
              disabled={isSharing}
              style={({ pressed }) => [
                styles.toolButton,
                pressed && styles.pressed,
                isSharing && { opacity: 0.6 },
              ]}
            >
              {isSharing ? (
                <ActivityIndicator size="small" color="#FFFFFF" style={{ height: 22 }} />
              ) : (
                <Ionicons name="share-outline" size={22} color="#FFFFFF" />
              )}
              <Text style={styles.toolLabel}>{isSharing ? 'Sharing…' : 'Share'}</Text>
            </Pressable>

            {/* Favorite */}
            <Pressable
              onPress={handleFavorite}
              style={({ pressed }) => [styles.toolButton, pressed && styles.pressed]}
            >
              <Ionicons
                name={currentItem.isFavorite ? 'heart' : 'heart-outline'}
                size={22}
                color={currentItem.isFavorite ? '#FF2B44' : '#FFFFFF'}
              />
              <Text style={[styles.toolLabel, currentItem.isFavorite && { color: '#FF2B44' }]}>
                {currentItem.isFavorite ? 'Favorited' : 'Favorite'}
              </Text>
            </Pressable>

            {/* Edit (Available for Photos) */}
            {currentItem.mediaType !== 'video' && (
              <Pressable
                onPress={() => {
                  triggerHaptic();
                  router.push(`/editor/${currentItem.id}` as any);
                }}
                style={({ pressed }) => [styles.toolButton, pressed && styles.pressed]}
              >
                <Ionicons name="color-wand-outline" size={22} color="#FFFFFF" />
                <Text style={styles.toolLabel}>Edit</Text>
              </Pressable>
            )}

            {/* Delete */}
            <Pressable
              onPress={handleDelete}
              style={({ pressed }) => [styles.toolButton, pressed && styles.pressed]}
            >
              <Ionicons name="trash-outline" size={22} color="#FFFFFF" />
              <Text style={styles.toolLabel}>Delete</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Hasselblad EXIF Info Drawer Modal */}
      <Modal
        visible={showExifModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowExifModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowExifModal(false)}>
          <Pressable
            style={[styles.exifSheet, { backgroundColor: theme.card }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.exifHandle} />

            <View style={styles.exifHeader}>
              <View>
                <Text style={[styles.exifTitle, { color: theme.text }]}>Details</Text>
                <Text style={[styles.exifFilename, { color: theme.textSecondary }]}>
                  {currentItem.filename}
                </Text>
              </View>
              <Pressable
                onPress={() => setShowExifModal(false)}
                style={styles.exifCloseButton}
              >
                <Ionicons name="close" size={22} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.exifContent}>
              {/* Date & Time */}
              <View style={styles.exifRow}>
                <Ionicons name="time-outline" size={20} color={theme.primary} />
                <View style={styles.exifRowInfo}>
                  <Text style={[styles.exifRowLabel, { color: theme.textSecondary }]}>Date & Time</Text>
                  <Text style={[styles.exifRowValue, { color: theme.text }]}>{formattedDate}</Text>
                </View>
              </View>

              {/* Media Type & Dimensions */}
              <View style={styles.exifRow}>
                <Ionicons
                  name={currentItem.mediaType === 'video' ? 'videocam-outline' : 'image-outline'}
                  size={20}
                  color={theme.accent}
                />
                <View style={styles.exifRowInfo}>
                  <Text style={[styles.exifRowLabel, { color: theme.textSecondary }]}>Type & Dimensions</Text>
                  <Text style={[styles.exifRowValue, { color: theme.text }]}>
                    {currentItem.mediaType.toUpperCase()} • {currentItem.width} × {currentItem.height}
                    {currentItem.duration ? ` • ${currentItem.duration}s` : ''}
                  </Text>
                </View>
              </View>

              {/* Camera Model */}
              <View style={styles.exifRow}>
                <Ionicons name="camera-outline" size={20} color="#EB0029" />
                <View style={styles.exifRowInfo}>
                  <Text style={[styles.exifRowLabel, { color: theme.textSecondary }]}>Camera Model</Text>
                  <Text style={[styles.exifRowValue, { color: theme.text }]}>
                    {currentItem.exif?.cameraModel || 'OnePlus Camera'}
                  </Text>
                </View>
              </View>

              {/* Exposure Settings Grid (if photo with exif) */}
              {currentItem.exif?.aperture && (
                <View style={[styles.exposureGrid, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                  <View style={styles.exposureItem}>
                    <Text style={[styles.exposureVal, { color: theme.text }]}>
                      {currentItem.exif.aperture}
                    </Text>
                    <Text style={[styles.exposureLbl, { color: theme.textSecondary }]}>Aperture</Text>
                  </View>
                  <View style={styles.exposureItem}>
                    <Text style={[styles.exposureVal, { color: theme.text }]}>
                      {currentItem.exif.shutterSpeed || '1/500s'}
                    </Text>
                    <Text style={[styles.exposureLbl, { color: theme.textSecondary }]}>Shutter</Text>
                  </View>
                  <View style={styles.exposureItem}>
                    <Text style={[styles.exposureVal, { color: theme.text }]}>
                      ISO {currentItem.exif.iso || '100'}
                    </Text>
                    <Text style={[styles.exposureLbl, { color: theme.textSecondary }]}>ISO</Text>
                  </View>
                  <View style={styles.exposureItem}>
                    <Text style={[styles.exposureVal, { color: theme.text }]}>
                      {currentItem.exif.focalLength || '23mm'}
                    </Text>
                    <Text style={[styles.exposureLbl, { color: theme.textSecondary }]}>Focal</Text>
                  </View>
                </View>
              )}

              {/* Geolocation */}
              {currentItem.location && (
                <View style={styles.exifRow}>
                  <Ionicons name="location-outline" size={20} color="#00BA88" />
                  <View style={styles.exifRowInfo}>
                    <Text style={[styles.exifRowLabel, { color: theme.textSecondary }]}>Location</Text>
                    <Text style={[styles.exifRowValue, { color: theme.text }]}>
                      {currentItem.location.placeName || currentItem.location.city}
                      {currentItem.location.country ? `, ${currentItem.location.country}` : ''}
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
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
  backButton: {
    padding: 12,
    backgroundColor: '#EB0029',
    borderRadius: 8,
  },
  pageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  imageWrapper: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainMedia: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  videoControlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  videoPlaybackDeck: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: 'rgba(20, 20, 20, 0.90)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    zIndex: 25,
  },
  videoQuickActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 4,
  },
  videoQuickActionsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 24,
  },
  videoPillButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPillButtonActive: {
    backgroundColor: 'rgba(255, 69, 58, 0.18)',
    borderColor: 'rgba(255, 69, 58, 0.4)',
  },
  videoPillButtonActiveSpeed: {
    backgroundColor: 'rgba(255, 214, 10, 0.18)',
    borderColor: 'rgba(255, 214, 10, 0.45)',
  },
  videoPillButtonActiveLoop: {
    backgroundColor: 'rgba(0, 132, 255, 0.18)',
    borderColor: 'rgba(0, 132, 255, 0.45)',
  },
  videoPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  videoPlayPill: {
    backgroundColor: '#EB0029',
    borderColor: '#EB0029',
  },
  videoCenterOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  videoCenterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    zIndex: 25,
  },
  videoPlayPauseButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#EB0029',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#EB0029',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  videoNavCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(24, 24, 24, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoSeekCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(24, 24, 24, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  seekLabel: {
    position: 'absolute',
    bottom: 3,
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.35,
  },
  speedBoostBadge: {
    position: 'absolute',
    top: 54,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 214, 10, 0.5)',
    shadowColor: '#FFD60A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 40,
  },
  speedBoostText: {
    color: '#FFD60A',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  seekFeedbackOverlay: {
    position: 'absolute',
    top: '42%',
    zIndex: 25,
  },
  seekFeedbackLeft: {
    left: 40,
  },
  seekFeedbackRight: {
    right: 40,
  },
  seekFeedbackPill: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    gap: 4,
    minWidth: 70,
  },
  seekFeedbackText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  videoScrubberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timecodeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    minWidth: 38,
    textAlign: 'center',
  },
  progressBarWrapper: {
    flex: 1,
    height: 30,
    justifyContent: 'center',
  },
  scrubberPreviewBubble: {
    position: 'absolute',
    bottom: 24,
    marginLeft: -26,
    backgroundColor: 'rgba(18, 18, 18, 0.95)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 6,
  },
  scrubberPreviewText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  scrubberPreviewArrow: {
    position: 'absolute',
    bottom: -4,
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 4,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(18, 18, 18, 0.95)',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    position: 'relative',
    overflow: 'visible',
    justifyContent: 'center',
  },
  progressBarTrackActive: {
    height: 8,
    borderRadius: 4,
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EB0029',
  },
  progressBarFillActive: {
    height: 8,
    borderRadius: 4,
  },
  progressBarThumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    marginLeft: -7,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 4,
  },
  progressBarThumbScrubbing: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginLeft: -10,
    borderWidth: 2,
    borderColor: '#EB0029',
    backgroundColor: '#FFFFFF',
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 8,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    zIndex: 30,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleInfo: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  burstHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0, 132, 255, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 132, 255, 0.45)',
  },
  burstHeaderBadgeText: {
    color: '#0084FF',
    fontSize: 10,
    fontWeight: '700',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 11,
    marginTop: 2,
  },
  headerRightActions: {
    flexDirection: 'row',
    gap: 8,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingTop: 10,
    zIndex: 30,
  },
  filmstripWrapper: {
    height: 52,
    marginBottom: 10,
  },
  filmstripContent: {
    paddingHorizontal: 16,
    gap: 6,
    alignItems: 'center',
  },
  filmstripThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1C1C1E',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    position: 'relative',
  },
  activeFilmstripThumb: {
    borderWidth: 2.5,
    borderColor: '#EB0029',
    transform: [{ scale: 1.1 }],
    shadowColor: '#EB0029',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 6,
  },
  filmstripImage: {
    width: '100%',
    height: '100%',
  },
  filmstripVideoIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 6,
    padding: 2,
  },
  toolbarRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  toolButton: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  toolLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  exifSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '75%',
  },
  exifHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#666',
    alignSelf: 'center',
    marginBottom: 14,
  },
  exifHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  exifTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  exifFilename: {
    fontSize: 12,
    marginTop: 2,
  },
  exifCloseButton: {
    padding: 6,
  },
  exifContent: {
    gap: 16,
    paddingBottom: 32,
  },
  exifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  exifRowInfo: {
    flex: 1,
  },
  exifRowLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  exifRowValue: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  exposureGrid: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
  },
  exposureItem: {
    flex: 1,
    alignItems: 'center',
  },
  exposureVal: {
    fontSize: 14,
    fontWeight: '700',
  },
  exposureLbl: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  pressed: {
    opacity: 0.7,
  },
});
