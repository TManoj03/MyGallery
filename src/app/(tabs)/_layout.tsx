import React from 'react';
import { Tabs } from 'expo-router';

import { FloatingTabBar } from '@/components/floating-tab-bar';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Photos',
        }}
      />
      <Tabs.Screen
        name="albums"
        options={{
          title: 'Albums',
        }}
      />
    </Tabs>
  );
}
