import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { useGallery } from '@/context/gallery-context';

export interface FloatingTabBarProps {
  state: {
    index: number;
    routes: { key: string; name: string; params?: any }[];
  };
  descriptors: Record<string, { options: any }>;
  navigation: any;
}

export function FloatingTabBar({ state, descriptors, navigation }: FloatingTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isSelectionMode } = useGallery();

  // Hide floating tab bar in selection mode so SelectionBottomBar takes over cleanly
  if (isSelectionMode) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        { bottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 16) },
      ]}
    >
      <View
        style={[
          styles.capsule,
          {
            backgroundColor: theme.card,
            borderColor: theme.border,
            shadowColor: '#000',
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;

          const onPress = () => {
            if (Platform.OS !== 'web') {
              try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              } catch {}
            }

            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const isPhotos = route.name === 'index';
          const iconName = isPhotos
            ? isFocused
              ? 'images'
              : 'images-outline'
            : isFocused
            ? 'folder'
            : 'folder-outline';
          const label = isPhotos ? 'Photos' : 'Albums';

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={({ pressed }) => [
                styles.tabItem,
                isFocused && [styles.activeTabItem, { backgroundColor: theme.primaryMuted }],
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name={iconName as any}
                size={18}
                color={isFocused ? theme.primary : theme.textSecondary}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: isFocused ? theme.primary : theme.textSecondary },
                  isFocused && styles.activeTabLabel,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 90,
  },
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 32,
    borderWidth: 1,
    gap: 6,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 8,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 24,
    gap: 8,
  },
  activeTabItem: {
    // Subtle background highlight behind active item
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  activeTabLabel: {
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.96 }],
  },
});
