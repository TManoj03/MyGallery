import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/hooks/use-theme';
import { ViewDensity } from '@/types/gallery';

interface DensitySwitcherProps {
  density: ViewDensity;
  onChange: (density: ViewDensity) => void;
}

export function DensitySwitcher({ density, onChange }: DensitySwitcherProps) {
  const theme = useTheme();

  const handleSelect = (val: ViewDensity) => {
    if (val !== density) {
      if (Platform.OS !== 'web') {
        try {
          Haptics.selectionAsync();
        } catch {}
      }
      onChange(val);
    }
  };

  const options: { key: ViewDensity; label: string }[] = [
    { key: 'day', label: 'Days' },
    { key: 'month', label: 'Months' },
    { key: 'year', label: 'Years' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      {options.map((opt) => {
        const isSelected = density === opt.key;
        return (
          <Pressable
            key={opt.key}
            onPress={() => handleSelect(opt.key)}
            style={[
              styles.optionPill,
              isSelected && [styles.selectedPill, { backgroundColor: theme.card }],
            ]}
          >
            <Text
              style={[
                styles.optionText,
                { color: isSelected ? theme.text : theme.textSecondary },
                isSelected && styles.selectedOptionText,
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'center',
  },
  optionPill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 16,
  },
  selectedPill: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  optionText: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  selectedOptionText: {
    fontWeight: '700',
  },
});
