import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Camera from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { processingApiClient, WorkRecord } from '../../services/api/processingApiClient';
import { ProcessingUploadService, ProcessedImage } from '../../services/upload/processingUploadService';
import { useAuthStore } from '../../store/authStore';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: Date;
}

export const WorkRecordScreen: React.FC = () => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  
  // 表单状态
  const [recordType, setRecordType] = useState<WorkRecord['recordType']>('production');
  const [workDetails, setWorkDetails] = useState({
    workstation: '',
    process: '',
    parameters: '',
    notes: '',
  });
  const [photos, setPhotos] = useState<ProcessedImage[]>([]);

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      setLocationLoading(true);
      
      // 请求位置权限
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('权限不足', '需要位置权限来记录工作地点');
        return;
      }

      // 获取当前位置
      const locationData = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setLocation({
        latitude: locationData.coords.latitude,
        longitude: locationData.coords.longitude,
        accuracy: locationData.coords.accuracy,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('获取位置失败:', error);
      Alert.alert('错误', '无法获取当前位置');
    } finally {
      setLocationLoading(false);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const image = await ProcessingUploadService.captureAndProcessImage();
      if (image) {
        setPhotos(prev => [...prev, image]);
      }
    } catch (error) {
      console.error('拍照失败:', error);
      Alert.alert('错误', '拍照失败，请重试');
    }
  };

  const handleSelectPhotos = async () => {
    try {
      const images = await ProcessingUploadService.selectAndProcessImages(5 - photos.length);
      setPhotos(prev => [...prev, ...images]);
    } catch (error) {
      console.error('选择照片失败:', error);
      Alert.alert('错误', '选择照片失败，请重试');
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const validateForm = (): boolean => {
    if (!workDetails.workstation.trim()) {
      Alert.alert('验证失败', '请填写工作站');
      return false;
    }
    if (!workDetails.process.trim()) {
      Alert.alert('验证失败', '请填写工艺流程');
      return false;
    }
    if (!user?.id) {
      Alert.alert('错误', '用户信息不完整');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);

      // 准备工作详情数据
      const workDetailData = {
        workstation: workDetails.workstation,
        process: workDetails.process,
        parameters: workDetails.parameters ? JSON.parse(workDetails.parameters) : {},
        notes: workDetails.notes,
        location: location ? {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
        } : undefined,
      };

      // 获取factoryId - 兼容不同用户类型
      const factoryId = user.userType === 'factory' && 'factoryUser' in user 
        ? user.factoryUser?.factoryId || ''
        : '';

      // 创建工作记录
      const recordData = {
        employeeId: parseInt(user!.id, 10), // 确保是数字类型
        factoryId,
        recordType,
        workDetails: workDetailData,
        location: location ? {
          latitude: location.latitude,
          longitude: location.longitude,
        } : undefined,
        attachments: [], // 暂时为空，上传成功后更新
      };

      const response = await processingApiClient.submitWorkRecord(recordData);

      if (response.success) {
        const recordId = response.data.id;

        // 上传照片（如果有）
        if (photos.length > 0) {
          const uploadResult = await ProcessingUploadService.uploadProductionPhotos(
            photos,
            {
              recordId,
              workstation: workDetails.workstation,
              process: workDetails.process,
              employee: user!.username || 'unknown',
              location: location ? {
                latitude: location.latitude,
                longitude: location.longitude,
              } : undefined,
              description: workDetails.notes,
            }
          );

          if (!uploadResult.success) {
            console.warn('照片上传失败:', uploadResult.errors);
            Alert.alert('警告', '工作记录已保存，但照片上传失败');
          }
        }

        // 清理临时文件
        await ProcessingUploadService.cleanupTempFiles(photos);

        Alert.alert('成功', '工作记录已提交', [
          {
            text: '确定',
            onPress: () => {
              // 重置表单
              setWorkDetails({
                workstation: '',
                process: '',
                parameters: '',
                notes: '',
              });
              setPhotos([]);
              getCurrentLocation(); // 重新获取位置
            },
          },
        ]);
      } else {
        throw new Error(response.message || '提交失败');
      }
    } catch (error) {
      console.error('提交工作记录失败:', error);
      Alert.alert('错误', error instanceof Error ? error.message : '提交失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>工作记录</Text>
        <Text style={styles.subtitle}>记录生产工作详情</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 位置信息 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>位置信息</Text>
          <View style={styles.locationContainer}>
            {locationLoading ? (
              <View style={styles.locationLoading}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.locationLoadingText}>正在获取位置...</Text>
              </View>
            ) : location ? (
              <View style={styles.locationInfo}>
                <Text style={styles.locationText}>
                  经度: {location.longitude.toFixed(6)}
                </Text>
                <Text style={styles.locationText}>
                  纬度: {location.latitude.toFixed(6)}
                </Text>
                <Text style={styles.locationText}>
                  精度: {location.accuracy?.toFixed(0) || 'N/A'}m
                </Text>
                <TouchableOpacity
                  style={styles.refreshButton}
                  onPress={getCurrentLocation}
                  disabled={locationLoading}
                >
                  <Ionicons name="refresh" size={16} color="#007AFF" />
                  <Text style={styles.refreshButtonText}>刷新</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.getLocationButton}
                onPress={getCurrentLocation}
                disabled={locationLoading}
              >
                <Ionicons name="location" size={20} color="#007AFF" />
                <Text style={styles.getLocationButtonText}>获取位置</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 记录类型 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>记录类型</Text>
          <View style={styles.typeContainer}>
            {(['production', 'maintenance', 'quality_check'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typeButton,
                  recordType === type && styles.typeButtonActive
                ]}
                onPress={() => setRecordType(type)}
              >
                <Text style={[
                  styles.typeButtonText,
                  recordType === type && styles.typeButtonTextActive
                ]}>
                  {type === 'production' ? '生产记录' :
                   type === 'maintenance' ? '维护记录' : '质检记录'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 工作详情 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>工作详情</Text>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>工作站 *</Text>
            <TextInput
              style={styles.input}
              value={workDetails.workstation}
              onChangeText={(text) => setWorkDetails(prev => ({ ...prev, workstation: text }))}
              placeholder="请输入工作站名称"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>工艺流程 *</Text>
            <TextInput
              style={styles.input}
              value={workDetails.process}
              onChangeText={(text) => setWorkDetails(prev => ({ ...prev, process: text }))}
              placeholder="请输入工艺流程"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>工艺参数 (JSON格式)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={workDetails.parameters}
              onChangeText={(text) => setWorkDetails(prev => ({ ...prev, parameters: text }))}
              placeholder='例: {"temperature": 25, "humidity": 60}'
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>备注</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={workDetails.notes}
              onChangeText={(text) => setWorkDetails(prev => ({ ...prev, notes: text }))}
              placeholder="请输入备注信息"
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
            />
          </View>
        </View>

        {/* 照片上传 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>工作照片 ({photos.length}/5)</Text>
          <View style={styles.photoContainer}>
            <TouchableOpacity
              style={styles.photoButton}
              onPress={handleTakePhoto}
              disabled={photos.length >= 5}
            >
              <Ionicons name="camera" size={24} color="#007AFF" />
              <Text style={styles.photoButtonText}>拍照</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.photoButton}
              onPress={handleSelectPhotos}
              disabled={photos.length >= 5}
            >
              <Ionicons name="images" size={24} color="#007AFF" />
              <Text style={styles.photoButtonText}>选择照片</Text>
            </TouchableOpacity>
          </View>

          {photos.length > 0 && (
            <View style={styles.photoPreview}>
              {photos.map((photo, index) => (
                <View key={index} style={styles.photoItem}>
                  <Text style={styles.photoName}>{photo.name}</Text>
                  <Text style={styles.photoSize}>
                    {ProcessingUploadService.formatFileSize(photo.size)}
                  </Text>
                  <TouchableOpacity
                    style={styles.removePhotoButton}
                    onPress={() => removePhoto(index)}
                  >
                    <Ionicons name="close-circle" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* 提交按钮 */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>提交记录</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E5E9',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  locationContainer: {
    minHeight: 60,
  },
  locationLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  locationLoadingText: {
    marginLeft: 8,
    color: '#666666',
  },
  locationInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 12,
    color: '#666666',
    marginRight: 16,
    marginBottom: 4,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  refreshButtonText: {
    fontSize: 12,
    color: '#007AFF',
    marginLeft: 4,
  },
  getLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  getLocationButtonText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 8,
  },
  typeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E1E5E9',
  },
  typeButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  typeButtonText: {
    fontSize: 14,
    color: '#666666',
  },
  typeButtonTextActive: {
    color: '#FFFFFF',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E1E5E9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1A1A1A',
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  photoContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  photoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E1E5E9',
  },
  photoButtonText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 8,
  },
  photoPreview: {
    gap: 8,
  },
  photoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  photoName: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A1A',
  },
  photoSize: {
    fontSize: 12,
    color: '#666666',
    marginRight: 8,
  },
  removePhotoButton: {
    padding: 4,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  submitButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});