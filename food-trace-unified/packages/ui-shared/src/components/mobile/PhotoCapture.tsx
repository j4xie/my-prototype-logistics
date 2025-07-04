import React, { useState } from 'react';
import { View, StyleSheet, ViewStyle, Image, Alert } from 'react-native';
import { Text, Button, IconButton, Chip } from 'react-native-paper';
import { Card } from '../base/Card';
import { Modal } from '../base/Modal';

export interface PhotoCaptureProps {
  visible: boolean;
  onClose: () => void;
  onCapture: (photoUri: string) => void;
  title?: string;
  maxPhotos?: number;
  allowMultiple?: boolean;
}

export const PhotoCapture: React.FC<PhotoCaptureProps> = ({
  visible,
  onClose,
  onCapture,
  title = '拍照',
  maxPhotos = 1,
  allowMultiple = false,
}) => {
  const [photos, setPhotos] = useState<string[]>([]);
  const [cameraReady, setCameraReady] = useState(false);

  const handleTakePhoto = async () => {
    try {
      // 在真实的React Native环境中，这里应该使用expo-camera
      // 模拟拍照
      const mockPhotoUri = `photo_${Date.now()}.jpg`;
      
      if (allowMultiple) {
        if (photos.length < maxPhotos) {
          setPhotos(prev => [...prev, mockPhotoUri]);
        } else {
          Alert.alert('提示', `最多只能拍摄${maxPhotos}张照片`);
        }
      } else {
        onCapture(mockPhotoUri);
        onClose();
      }
    } catch (error) {
      Alert.alert('拍照失败', '请稍后重试');
    }
  };

  const handleSelectFromGallery = () => {
    // 从相册选择
    Alert.alert('功能提示', '从相册选择功能正在开发中');
  };

  const handleDeletePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleConfirm = () => {
    if (photos.length > 0) {
      // 如果允许多张，返回所有照片
      if (allowMultiple) {
        photos.forEach(photo => onCapture(photo));
      } else {
        onCapture(photos[0]);
      }
      setPhotos([]);
      onClose();
    }
  };

  const renderCameraView = () => (
    <View style={styles.cameraContainer}>
      {/* 相机预览区域 */}
      <View style={styles.cameraPreview}>
        <Text variant="bodyLarge" style={styles.cameraText}>
          相机预览区域
        </Text>
        <Text variant="bodyMedium" style={styles.cameraHint}>
          (在真实设备上将显示相机画面)
        </Text>
      </View>

      {/* 拍照按钮 */}
      <View style={styles.captureControls}>
        <IconButton
          icon="image"
          mode="contained"
          size={30}
          onPress={handleSelectFromGallery}
          style={styles.galleryButton}
        />
        
        <IconButton
          icon="camera"
          mode="contained"
          size={50}
          onPress={handleTakePhoto}
          style={styles.captureButton}
        />
        
        <IconButton
          icon="cog"
          mode="contained"
          size={30}
          onPress={() => Alert.alert('设置', '相机设置功能开发中')}
          style={styles.settingsButton}
        />
      </View>

      {/* 照片计数 */}
      {allowMultiple && (
        <View style={styles.photoCounter}>
          <Chip icon="camera">
            {photos.length}/{maxPhotos}
          </Chip>
        </View>
      )}
    </View>
  );

  const renderPhotoPreview = () => (
    <View style={styles.previewContainer}>
      <Text variant="titleMedium" style={styles.previewTitle}>
        已拍摄照片 ({photos.length})
      </Text>
      
      <View style={styles.photoGrid}>
        {photos.map((photo, index) => (
          <View key={index} style={styles.photoItem}>
            <View style={styles.photoPlaceholder}>
              <Text variant="bodySmall">照片 {index + 1}</Text>
            </View>
            <IconButton
              icon="close"
              size={16}
              onPress={() => handleDeletePhoto(index)}
              style={styles.deleteButton}
            />
          </View>
        ))}
      </View>

      <View style={styles.previewActions}>
        <Button mode="outlined" onPress={() => setPhotos([])}>
          清空
        </Button>
        <Button mode="contained" onPress={handleConfirm}>
          确认使用
        </Button>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      onDismiss={onClose}
      title={title}
      size="fullscreen"
      style={styles.modal}
    >
      <View style={styles.container}>
        {photos.length === 0 || allowMultiple ? renderCameraView() : renderPhotoPreview()}
      </View>
    </Modal>
  );
};

// 照片上传组件
export interface PhotoUploaderProps {
  onUpload: (photos: string[]) => void;
  maxPhotos?: number;
  allowMultiple?: boolean;
  buttonText?: string;
  style?: ViewStyle;
}

export const PhotoUploader: React.FC<PhotoUploaderProps> = ({
  onUpload,
  maxPhotos = 5,
  allowMultiple = true,
  buttonText = '拍照上传',
  style,
}) => {
  const [captureVisible, setCaptureVisible] = useState(false);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);

  const handleCapture = (photoUri: string) => {
    const newPhotos = [...uploadedPhotos, photoUri];
    setUploadedPhotos(newPhotos);
    onUpload(newPhotos);
  };

  const handleRemovePhoto = (index: number) => {
    const newPhotos = uploadedPhotos.filter((_, i) => i !== index);
    setUploadedPhotos(newPhotos);
    onUpload(newPhotos);
  };

  return (
    <Card style={style}>
      <View style={styles.uploaderContainer}>
        <View style={styles.uploaderHeader}>
          <Text variant="titleMedium">照片上传</Text>
          <Chip icon="camera">
            {uploadedPhotos.length}/{maxPhotos}
          </Chip>
        </View>

        {uploadedPhotos.length > 0 && (
          <View style={styles.uploadedPhotos}>
            {uploadedPhotos.map((photo, index) => (
              <View key={index} style={styles.uploadedPhoto}>
                <View style={styles.photoThumbnail}>
                  <Text variant="bodySmall">图片{index + 1}</Text>
                </View>
                <IconButton
                  icon="close"
                  size={16}
                  onPress={() => handleRemovePhoto(index)}
                  style={styles.removeButton}
                />
              </View>
            ))}
          </View>
        )}

        <Button
          mode={uploadedPhotos.length === 0 ? 'contained' : 'outlined'}
          icon="camera-plus"
          onPress={() => setCaptureVisible(true)}
          disabled={uploadedPhotos.length >= maxPhotos}
        >
          {uploadedPhotos.length === 0 ? buttonText : '继续添加'}
        </Button>

        <PhotoCapture
          visible={captureVisible}
          onClose={() => setCaptureVisible(false)}
          onCapture={handleCapture}
          maxPhotos={maxPhotos}
          allowMultiple={allowMultiple}
        />
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  modal: {
    margin: 0,
  } as ViewStyle,
  
  container: {
    flex: 1,
    backgroundColor: '#000',
  } as ViewStyle,
  
  cameraContainer: {
    flex: 1,
  } as ViewStyle,
  
  cameraPreview: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#333',
  } as ViewStyle,
  
  cameraText: {
    color: '#fff',
    marginBottom: 8,
  },
  
  cameraHint: {
    color: '#999',
    textAlign: 'center',
  },
  
  captureControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  } as ViewStyle,
  
  galleryButton: {
    backgroundColor: '#666',
  } as ViewStyle,
  
  captureButton: {
    backgroundColor: '#2196F3',
  } as ViewStyle,
  
  settingsButton: {
    backgroundColor: '#666',
  } as ViewStyle,
  
  photoCounter: {
    position: 'absolute',
    top: 20,
    right: 20,
  } as ViewStyle,
  
  previewContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  } as ViewStyle,
  
  previewTitle: {
    marginBottom: 16,
    textAlign: 'center',
  },
  
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  } as ViewStyle,
  
  photoItem: {
    position: 'relative',
    width: 100,
    height: 100,
  } as ViewStyle,
  
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  } as ViewStyle,
  
  deleteButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#f44336',
    margin: 0,
  } as ViewStyle,
  
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 16,
  } as ViewStyle,
  
  // PhotoUploader样式
  uploaderContainer: {
    padding: 16,
  } as ViewStyle,
  
  uploaderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  } as ViewStyle,
  
  uploadedPhotos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  } as ViewStyle,
  
  uploadedPhoto: {
    position: 'relative',
    width: 60,
    height: 60,
  } as ViewStyle,
  
  photoThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  } as ViewStyle,
  
  removeButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#f44336',
    margin: 0,
    width: 20,
    height: 20,
  } as ViewStyle,
});