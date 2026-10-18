import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/hooks/use-theme';
import { useGallery } from '@/context/gallery-context';

interface AddToAlbumModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AddToAlbumModal({ visible, onClose }: AddToAlbumModalProps) {
  const theme = useTheme();
  const { albums, selectedIds, addToAlbum, createAlbum } = useGallery();
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newAlbumTitle, setNewAlbumTitle] = useState('');

  const handleSelectAlbum = (albumId: string) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    }
    addToAlbum(selectedIds, albumId);
    onClose();
  };

  const handleCreateAndAdd = () => {
    if (!newAlbumTitle.trim()) return;
    if (Platform.OS !== 'web') {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    }
    createAlbum(newAlbumTitle.trim(), selectedIds);
    setNewAlbumTitle('');
    setIsCreatingNew(false);
    onClose();
  };

  const availableAlbums = albums.filter((a) => a.id !== 'trash' && a.id !== 'safe');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.modalSheet, { backgroundColor: theme.card }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.sheetHeader}>
            <View style={styles.handle} />
            <Text style={[styles.sheetTitle, { color: theme.text }]}>Add to Album</Text>
            <Text style={[styles.sheetSubtitle, { color: theme.textSecondary }]}>
              {selectedIds.length} {selectedIds.length === 1 ? 'item' : 'items'} selected
            </Text>
          </View>

          {isCreatingNew ? (
            <View style={styles.createBox}>
              <TextInput
                value={newAlbumTitle}
                onChangeText={setNewAlbumTitle}
                placeholder="Enter album name"
                placeholderTextColor={theme.textMuted}
                autoFocus
                style={[
                  styles.createInput,
                  { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border },
                ]}
              />
              <View style={styles.createActions}>
                <Pressable
                  onPress={() => setIsCreatingNew(false)}
                  style={[styles.button, { backgroundColor: theme.backgroundElement }]}
                >
                  <Text style={[styles.buttonText, { color: theme.text }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleCreateAndAdd}
                  style={[styles.button, { backgroundColor: theme.primary }]}
                >
                  <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Create & Add</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => setIsCreatingNew(true)}
              style={[styles.newAlbumButton, { backgroundColor: theme.backgroundElement }]}
            >
              <Ionicons name="add-circle" size={24} color={theme.primary} />
              <Text style={[styles.newAlbumText, { color: theme.text }]}>Create New Album</Text>
            </Pressable>
          )}

          <ScrollView style={styles.albumList} contentContainerStyle={{ paddingBottom: 24 }}>
            {availableAlbums.map((album) => (
              <Pressable
                key={album.id}
                onPress={() => handleSelectAlbum(album.id)}
                style={({ pressed }) => [
                  styles.albumRow,
                  { borderBottomColor: theme.border },
                  pressed && { backgroundColor: theme.backgroundElement },
                ]}
              >
                <View style={styles.coverWrapper}>
                  {album.coverUri ? (
                    <Image source={{ uri: album.coverUri }} style={styles.coverImage} contentFit="cover" />
                  ) : (
                    <View style={[styles.coverFallback, { backgroundColor: theme.backgroundElement }]}>
                      <Ionicons name="images-outline" size={20} color={theme.textSecondary} />
                    </View>
                  )}
                </View>

                <View style={styles.albumInfo}>
                  <Text style={[styles.albumTitle, { color: theme.text }]}>{album.title}</Text>
                  <Text style={[styles.albumCount, { color: theme.textSecondary }]}>
                    {album.itemCount} items
                  </Text>
                </View>

                <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    maxHeight: '75%',
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#8E9299',
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sheetSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  newAlbumButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    marginBottom: 16,
  },
  newAlbumText: {
    fontSize: 15,
    fontWeight: '600',
  },
  createBox: {
    gap: 12,
    marginBottom: 16,
  },
  createInput: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
  },
  createActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  albumList: {
    flexGrow: 0,
  },
  albumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  coverWrapper: {
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 14,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  albumInfo: {
    flex: 1,
  },
  albumTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  albumCount: {
    fontSize: 12,
    marginTop: 2,
  },
});
