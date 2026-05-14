/**
 * AttachmentUploadButton — 拍照 / 选文件 → 上传 OSS → 注册元数据.
 *
 * 用法:
 *   <AttachmentUploadButton
 *     entityType="PURCHASE_ORDER"
 *     entityId={order.id}
 *     onUploaded={() => setRefreshKey(k => k + 1)}
 *   />
 *
 * @author Cretas Team — Track C
 * @since 2026-05-15 (C-ATT-1 Day 4)
 */

import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Button } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import {
  attachmentApi,
  Attachment,
  AttachmentEntityType,
  AttachmentFileCategory,
} from '../../services/api/attachmentApi';

interface Props {
  entityType: AttachmentEntityType;
  entityId: string;
  factoryId?: string;
  businessTag?: string;
  fileCategory?: AttachmentFileCategory;
  onUploaded?: (att: Attachment) => void;
  /** 默认 ['camera', 'gallery']. 设 ['camera'] 强制只能拍照. */
  sources?: Array<'camera' | 'gallery'>;
  buttonLabel?: string;
}

export function AttachmentUploadButton({
  entityType,
  entityId,
  factoryId,
  businessTag,
  fileCategory,
  onUploaded,
  sources = ['camera', 'gallery'],
  buttonLabel,
}: Props) {
  const [uploading, setUploading] = useState(false);

  const pickFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('需要相机权限');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      await handleUpload(result.assets[0]);
    }
  };

  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('需要相册权限');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      await handleUpload(result.assets[0]);
    }
  };

  const handleUpload = async (asset: ImagePicker.ImagePickerAsset) => {
    setUploading(true);
    try {
      // RN expo-image-picker 不一定给 size — 用 FileSystem.getInfoAsync 兜底
      let size = asset.fileSize ?? 0;
      if (!size) {
        const info = await FileSystem.getInfoAsync(asset.uri, { size: true });
        size = info.exists && 'size' in info ? (info.size as number) : 0;
      }

      const fileName = asset.fileName ?? `upload_${Date.now()}.${guessExt(asset.uri, asset.mimeType)}`;
      const fileType = asset.mimeType ?? guessMime(asset.uri);

      const saved = await attachmentApi.uploadAndRegister(
        { uri: asset.uri, name: fileName, type: fileType, size },
        entityType,
        entityId,
        { businessTag, description: undefined, fileCategory },
        factoryId
      );
      onUploaded?.(saved);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '上传失败';
      Alert.alert('上传失败', msg);
    } finally {
      setUploading(false);
    }
  };

  const triggerPicker = () => {
    if (sources.length === 1) {
      sources[0] === 'camera' ? pickFromCamera() : pickFromGallery();
      return;
    }
    Alert.alert('上传附件', '选择来源', [
      { text: '拍照', onPress: pickFromCamera },
      { text: '从相册', onPress: pickFromGallery },
      { text: '取消', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.wrap}>
      <Button
        mode="contained"
        icon="paperclip"
        onPress={triggerPicker}
        loading={uploading}
        disabled={uploading}
      >
        {buttonLabel ?? '添加附件'}
      </Button>
    </View>
  );
}

function guessExt(uri: string, mime?: string): string {
  if (mime?.startsWith('image/')) return mime.replace('image/', '');
  if (mime?.startsWith('video/')) return mime.replace('video/', '');
  const dot = uri.lastIndexOf('.');
  return dot > 0 ? uri.substring(dot + 1) : 'bin';
}

function guessMime(uri: string): string {
  const ext = uri.toLowerCase().split('.').pop() ?? '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    pdf: 'application/pdf',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
  };
  return map[ext] ?? 'application/octet-stream';
}

const styles = StyleSheet.create({
  wrap: { marginVertical: 8 },
});
