/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#121316',
    textSecondary: '#6B7280',
    textMuted: '#9CA3AF',
    background: '#F7F8FA',
    backgroundElement: '#FFFFFF',
    backgroundElevated: '#FFFFFF',
    backgroundSelected: '#E5E7EB',
    card: '#FFFFFF',
    border: '#E8EAEE',
    primary: '#EB0029', // OnePlus Signature Red
    primaryMuted: '#FFEBEE',
    accent: '#0084FF',
    accentCyan: '#00C4B4',
    success: '#00BA88',
    warning: '#F59E0B',
    danger: '#EB0029',
    overlay: 'rgba(0, 0, 0, 0.4)',
    glass: 'rgba(255, 255, 255, 0.85)',
    shadow: 'rgba(0, 0, 0, 0.06)',
  },
  dark: {
    text: '#FFFFFF',
    textSecondary: '#9CA3AF',
    textMuted: '#6B7280',
    background: '#000000', // AMOLED Black
    backgroundElement: '#141518',
    backgroundElevated: '#1D1F24',
    backgroundSelected: '#2A2D35',
    card: '#141518',
    border: '#26282E',
    primary: '#EB0029', // OnePlus Signature Red
    primaryMuted: '#380B12',
    accent: '#0084FF',
    accentCyan: '#00C4B4',
    success: '#00BA88',
    warning: '#F59E0B',
    danger: '#EB0029',
    overlay: 'rgba(0, 0, 0, 0.75)',
    glass: 'rgba(20, 21, 24, 0.85)',
    shadow: 'rgba(0, 0, 0, 0.4)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
