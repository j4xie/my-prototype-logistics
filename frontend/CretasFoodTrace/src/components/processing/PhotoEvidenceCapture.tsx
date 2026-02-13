import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Image, FlatList, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useAuthStore } from '../../store/authStore';
import { apiClient } from '../../services/api/apiClient';

interface Photo {
  uri: string;
  uploaded: boolean;
  uploading: boolean;
  serverUrl?: string;
}

interface PhotoEvidenceCaptureProps {
  batchId: number;
  stage: string;  // RAW_MATERIAL, IN_PROCESS, FINISHED, PACKAGING, QUALITY_CHECK
  onPhotosChange?: (count: number) => void;
}

export const PhotoEvidenceCapture: React.FC<PhotoEvidenceCaptureProps> = ({
  batchId, stage, onPhotosChange,
}) => {
  const { user } = useAuthStore();
  const factoryId = user?.factoryId || user?.factoryUser?.factoryId;
  const [photos, setPhotos] = useState<Photo[]>([]);

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('需要相机权限');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      // Compress image
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1024 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );

      const newPhoto: Photo = { uri: manipulated.uri, uploaded: false, uploading: false };
      setPhotos(prev => [...prev, newPhoto]);
      onPhotosChange?.(photos.length + 1);

      // Auto-upload
      uploadPhoto(photos.length, manipulated.uri);
    }
  };

  const uploadPhoto = async (index: number, uri: string) => {
    setPhotos(prev => {
      const updated = [...prev];
      if (updated[index]) updated[index] = { ...updated[index], uploading: true };
      return updated;
    });

    try {
      const formData = new FormData();
      formData.append('file', {
        uri,
        name: `batch_${batchId}_${stage}_${Date.now()}.jpg`,
        type: 'image/jpeg',
      } as any);
      formData.append('stage', stage);

      const res: any = await apiClient.post(
        `/api/mobile/${factoryId}/processing/batches/${batchId}/photos`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );

      setPhotos(prev => {
        const updated = [...prev];
        if (updated[index]) {
          updated[index] = { ...updated[index], uploaded: true, uploading: false, serverUrl: res?.data?.photoUrl };
        }
        return updated;
      });
    } catch {
      setPhotos(prev => {
        const updated = [...prev];
        if (updated[index]) updated[index] = { ...updated[index], uploading: false };
        return updated;
      });
      Alert.alert('上传失败', '照片将保存到本地，稍后重试');
    }
  };

  const stageLabels: Record<string, string> = {
    RAW_MATERIAL: '原料', IN_PROCESS: '生产中', FINISHED: '成品',
    PACKAGING: '包装', QUALITY_CHECK: '质检',
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>照片记录 - {stageLabels[stage] || stage}</Text>

      <FlatList
        data={photos}
        horizontal
        keyExtractor={(_, i) => i.toString()}
        renderItem={({ item }) => (
          <View style={styles.photoItem}>
            <Image source={{ uri: item.uri }} style={styles.thumbnail} />
            {item.uploading && (
              <View style={styles.uploadOverlay}><ActivityIndicator color="#fff" /></View>
            )}
            {item.uploaded && (
              <View style={styles.uploadedBadge}><Text style={styles.badgeText}>OK</Text></View>
            )}
          </View>
        )}
        ListFooterComponent={
          <TouchableOpacity style={styles.addPhoto} onPress={takePhoto}>
            <Text style={styles.addIcon}>+</Text>
            <Text style={styles.addText}>拍照</Text>
          </TouchableOpacity>
        }
        contentContainerStyle={styles.photoList}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginVertical: 8 },
  title: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  photoList: { gap: 8 },
  photoItem: { width: 80, height: 80, borderRadius: 8, overflow: 'hidden' },
  thumbnail: { width: 80, height: 80 },
  uploadOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  uploadedBadge: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  addPhoto: { width: 80, height: 80, borderRadius: 8, borderWidth: 2, borderColor: '#ddd', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  addIcon: { fontSize: 24, color: '#999' },
  addText: { fontSize: 12, color: '#999' },
});

export default PhotoEvidenceCapture;
