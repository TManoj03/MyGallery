import React, { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { GalleryProvider } from '@/context/gallery-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // Hide splash screen smoothly after mounting
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <GalleryProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="viewer/[id]"
              options={{
                presentation: 'fullScreenModal',
                animation: 'fade',
              }}
            />
            <Stack.Screen
              name="editor/[id]"
              options={{
                presentation: 'modal',
                animation: 'slide_from_bottom',
              }}
            />
            <Stack.Screen
              name="album/[id]"
              options={{
                presentation: 'card',
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="trash"
              options={{
                presentation: 'card',
                animation: 'slide_from_right',
              }}
            />
          </Stack>
        </GalleryProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
