import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  Appbar,
  TextInput,
  Button,
  Chip,
  Divider,
  Surface,
  IconButton,
  Portal,
  Modal,
  RadioButton,
  ActivityIndicator,
  List,
} from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { ProcessingStackParamList } from '../../types/navigation';
import {
  qualityInspectionApiClient,
  InspectionResult,
  type SubmitInspectionRequest,
} from '../../services/api/qualityInspectionApiClient';
import { useAuthStore } from '../../store/authStore';
import { NotImplementedError } from '../../errors';

// Types
type CreateQualityRecordScreenNavigationProp = NativeStackNavigationProp<
  ProcessingStackParamList,
  'CreateQualityRecord'
>;
type CreateQualityRecordScreenRouteProp = RouteProp<
  ProcessingStackParamList,
  'CreateQualityRecord'
>;

/**
 * 质检记录创建页面
 * P1-002-1: 完整质检流程 - 创建质检记录
 *
 * 功能：
 * - 质检信息输入：批次ID、检验员、日期
 * - 样本数据：样本数量、合格数量、不合格数量
 * - 检验结果：PASS（合格）/CONDITIONAL（条件合格）/FAIL（不合格）
 * - 备注说明
 * - 提交到后端API
 */
export default function CreateQualityRecordScreen() {
  const navigation = useNavigation<CreateQualityRecordScreenNavigationProp>();
  const route = useRoute<CreateQualityRecordScreenRouteProp>();
  const { batchId } = route.params;

  // Get user context
  const { user } = useAuthStore();
  const factoryId = user?.factoryId || user?.factoryUser?.factoryId;
  const currentUserId = user?.id || user?.factoryUser?.userId;

  // Form state (matching backend QualityInspection entity)
  const [inspectionDate, setInspectionDate] = useState(
    new Date().toISOString().split('T')[0] // YYYY-MM-DD format
  );

  // Sample data (matching backend requirements)
  const [sampleSize, setSampleSize] = useState('100'); // Total samples
  const [passCount, setPassCount] = useState('95'); // Passed samples
  const [failCount, setFailCount] = useState('5'); // Failed samples

  // Inspection result (matching backend InspectionResult enum)
  const [result, setResult] = useState<InspectionResult>(InspectionResult.PASS);
  const [notes, setNotes] = useState('');

  // GPS location state
  const [gpsLocation, setGpsLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loadingGps, setLoadingGps] = useState(true);

  // Image picker state
  const [photos, setPhotos] = useState<string[]>([]); // Array of image URIs

  // Modal state
  const [resultModalVisible, setResultModalVisible] = useState(false);

  // UI state
  const [submitting, setSubmitting] = useState(false);

  // Load GPS location on mount
  useEffect(() => {
    loadGpsLocation();
  }, []);

  // Computed values
  const sampleSizeNum = parseInt(sampleSize, 10) || 0;
  const passCountNum = parseInt(passCount, 10) || 0;
  const failCountNum = parseInt(failCount, 10) || 0;

  // Calculate pass rate
  const passRate = sampleSizeNum > 0
    ? ((passCountNum / sampleSizeNum) * 100).toFixed(1)
    : '0.0';

  // Load GPS location
  const loadGpsLocation = async () => {
    try {
      setLoadingGps(true);
      console.log('📍 Requesting location permissions for quality inspection...');

      // 1. 请求前台位置权限
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        console.warn('❌ Location permission denied');
        Alert.alert(
          '位置权限被拒绝',
          '质检需要获取您的位置信息，建议允许位置权限以确保记录完整性。',
          [{ text: '确定' }]
        );
        // 权限被拒绝时设置为null（不强制要求GPS）
        setGpsLocation(null);
        setLoadingGps(false);
        return;
      }

      console.log('✅ Location permission granted, getting current location...');

      // 2. 获取当前位置
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High, // 高精度定位
      });

      const { latitude, longitude } = location.coords;
      console.log('✅ GPS location obtained:', { latitude, longitude });

      setGpsLocation({ latitude, longitude });
    } catch (error: any) {
      console.error('❌ Failed to get GPS location:', error);
      // 定位失败时设置为null（不强制要求GPS，但记录错误）
      setGpsLocation(null);
    } finally {
      setLoadingGps(false);
    }
  };

  // Image picker handlers
  const pickImage = async () => {
    try {
      // 请求相册权限
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('权限被拒绝', '需要相册权限才能上传图片');
        return;
      }

      // 打开图片选择器
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false, // 单张选择（可改为true支持多选）
        quality: 0.8, // 压缩质量
        allowsEditing: true, // 允许编辑
        aspect: [4, 3], // 裁剪比例
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newPhotoUri = result.assets[0].uri;
        console.log('✅ Image selected:', newPhotoUri);

        // 限制最多6张图片
        if (photos.length >= 6) {
          Alert.alert('提示', '最多只能上传6张图片');
          return;
        }

        setPhotos([...photos, newPhotoUri]);
      }
    } catch (error: any) {
      console.error('❌ Failed to pick image:', error);
      Alert.alert('选择图片失败', error.message || '无法选择图片，请重试');
    }
  };

  const takePhoto = async () => {
    try {
      // 请求相机权限
      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('权限被拒绝', '需要相机权限才能拍照');
        return;
      }

      // 打开相机
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8, // 压缩质量
        allowsEditing: true, // 允许编辑
        aspect: [4, 3], // 裁剪比例
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newPhotoUri = result.assets[0].uri;
        console.log('✅ Photo taken:', newPhotoUri);

        // 限制最多6张图片
        if (photos.length >= 6) {
          Alert.alert('提示', '最多只能上传6张图片');
          return;
        }

        setPhotos([...photos, newPhotoUri]);
      }
    } catch (error: any) {
      console.error('❌ Failed to take photo:', error);
      Alert.alert('拍照失败', error.message || '无法拍照，请重试');
    }
  };

  const removePhoto = (index: number) => {
    Alert.alert('删除图片', '确定要删除这张图片吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          const newPhotos = photos.filter((_, i) => i !== index);
          setPhotos(newPhotos);
        },
      },
    ]);
  };

  // Form validation
  const isFormValid = () => {
    if (!currentUserId) {
      Alert.alert('错误', '无法获取用户ID，请重新登录');
      return false;
    }
    if (sampleSizeNum <= 0) {
      Alert.alert('提示', '样本数量必须大于0');
      return false;
    }
    if (passCountNum + failCountNum !== sampleSizeNum) {
      Alert.alert('提示', '合格数量 + 不合格数量 必须等于样本数量');
      return false;
    }
    return true;
  };

  // Handlers
  const handleNumberInput = (
    value: string,
    setter: React.Dispatch<React.SetStateAction<string>>
  ) => {
    // Only allow numbers
    const numValue = value.replace(/[^0-9]/g, '');
    setter(numValue);
  };

  const handleSubmit = async () => {
    if (!isFormValid()) {
      return;
    }

    Alert.alert('提交质检记录', '确定要提交此质检记录吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '提交',
        onPress: async () => {
          setSubmitting(true);
          try {
            // Prepare notes with GPS location and photos (if available)
            let finalNotes = notes.trim();

            // Add GPS info
            if (gpsLocation) {
              const gpsInfo = `\n[GPS] 纬度: ${gpsLocation.latitude.toFixed(6)}, 经度: ${gpsLocation.longitude.toFixed(6)}`;
              finalNotes = finalNotes ? finalNotes + gpsInfo : gpsInfo.trim();
            }

            // Check for photo upload - feature not yet implemented
            if (photos.length > 0) {
              throw new NotImplementedError(
                '照片上传',
                'Phase 4',
                '照片上传功能尚未实现，请暂时不要添加照片。如需记录图片信息，请在备注中说明。'
              );
            }

            // Prepare inspection data (matching backend SubmitInspectionRequest)
            const inspectionData: SubmitInspectionRequest = {
              inspectorId: currentUserId!,
              inspectionDate, // YYYY-MM-DD
              sampleSize: sampleSizeNum,
              passCount: passCountNum,
              failCount: failCountNum,
              result,
              notes: finalNotes || undefined,
            };

            console.log('📤 Submitting quality inspection...', {
              batchId,
              inspectionData,
              factoryId,
              hasGps: !!gpsLocation,
            });

            // API integration - POST /quality/inspections?batchId={batchId}
            const response = await qualityInspectionApiClient.submitInspection(
              batchId,
              inspectionData,
              factoryId
            );

            console.log('✅ Quality inspection submitted successfully:', response);

            Alert.alert('成功', '质检记录已提交', [
              { text: '确定', onPress: () => navigation.goBack() },
            ]);
          } catch (error: any) {
            console.error('❌ Failed to submit quality inspection:', error);
            const errorMessage = error.response?.data?.message || error.message || '提交失败，请重试';
            Alert.alert('提交失败', errorMessage);
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  };

  const getResultLabel = (r: InspectionResult): string => {
    switch (r) {
      case InspectionResult.PASS:
        return '合格';
      case InspectionResult.CONDITIONAL:
        return '条件合格';
      case InspectionResult.FAIL:
        return '不合格';
      default:
        return '未知类型';
    }
  };

  const getResultColor = (r: InspectionResult): string => {
    switch (r) {
      case InspectionResult.PASS:
        return '#4CAF50';
      case InspectionResult.CONDITIONAL:
        return '#FF9800';
      case InspectionResult.FAIL:
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="创建质检记录" />
      </Appbar.Header>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Basic Information */}
        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            基本信息
          </Text>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>生产批次ID</Text>
            <Text style={styles.fieldValue}>{batchId}</Text>
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>检验员ID</Text>
            <Text style={styles.fieldValue}>{currentUserId || '未登录'}</Text>
          </View>

          <Divider style={styles.divider} />

          <TextInput
            label="检验日期 *"
            value={inspectionDate}
            onChangeText={setInspectionDate}
            mode="outlined"
            style={styles.input}
            placeholder="YYYY-MM-DD"
            keyboardType="default"
          />
        </Surface>

        {/* GPS Location */}
        <Surface style={styles.section} elevation={1}>
          <View style={styles.sectionHeader}>
            <List.Icon icon="map-marker" color="#2196F3" style={{ margin: 0 }} />
            <Text variant="titleMedium" style={styles.sectionTitle}>
              GPS定位
            </Text>
          </View>

          {loadingGps ? (
            <View style={styles.gpsLoading}>
              <ActivityIndicator size="small" />
              <Text style={styles.gpsLoadingText}>正在获取位置...</Text>
            </View>
          ) : gpsLocation ? (
            <>
              <View style={styles.gpsInfo}>
                <Text style={styles.gpsLabel}>纬度:</Text>
                <Text style={styles.gpsValue}>{gpsLocation.latitude.toFixed(6)}</Text>
              </View>
              <View style={styles.gpsInfo}>
                <Text style={styles.gpsLabel}>经度:</Text>
                <Text style={styles.gpsValue}>{gpsLocation.longitude.toFixed(6)}</Text>
              </View>
              <Chip
                mode="flat"
                compact
                icon="check-circle"
                style={styles.gpsChip}
                textStyle={{ color: '#4CAF50', fontSize: 11 }}
              >
                定位成功
              </Chip>
            </>
          ) : (
            <View style={styles.gpsError}>
              <Chip
                mode="flat"
                compact
                icon="alert"
                style={styles.gpsErrorChip}
                textStyle={{ color: '#FF9800', fontSize: 11 }}
              >
                GPS定位失败（非必填）
              </Chip>
              <Text style={styles.gpsErrorText}>
                质检记录建议包含GPS信息，可点击重试获取位置
              </Text>
              <Button
                mode="outlined"
                compact
                onPress={loadGpsLocation}
                style={styles.gpsRetryButton}
              >
                重新定位
              </Button>
            </View>
          )}
        </Surface>

        {/* Sample Data */}
        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            样本数据
          </Text>

          <TextInput
            label="样本数量 *"
            value={sampleSize}
            onChangeText={(value) => handleNumberInput(value, setSampleSize)}
            mode="outlined"
            keyboardType="number-pad"
            style={styles.input}
            placeholder="请输入样本数量"
            right={<TextInput.Affix text="个" />}
          />

          <TextInput
            label="合格数量 *"
            value={passCount}
            onChangeText={(value) => handleNumberInput(value, setPassCount)}
            mode="outlined"
            keyboardType="number-pad"
            style={styles.input}
            placeholder="请输入合格数量"
            right={<TextInput.Affix text="个" />}
          />

          <TextInput
            label="不合格数量 *"
            value={failCount}
            onChangeText={(value) => handleNumberInput(value, setFailCount)}
            mode="outlined"
            keyboardType="number-pad"
            style={styles.input}
            placeholder="请输入不合格数量"
            right={<TextInput.Affix text="个" />}
            error={passCountNum + failCountNum !== sampleSizeNum && sampleSizeNum > 0}
          />

          {sampleSizeNum > 0 && passCountNum + failCountNum !== sampleSizeNum && (
            <Text style={styles.validationHint}>
              ⚠️ 合格数 + 不合格数 必须等于样本数量
            </Text>
          )}

          <Divider style={styles.divider} />

          <View style={styles.passRateRow}>
            <Text variant="titleMedium">合格率</Text>
            <Text
              variant="headlineMedium"
              style={[
                styles.passRateValue,
                {
                  color: parseFloat(passRate) >= 95
                    ? '#4CAF50'
                    : parseFloat(passRate) >= 80
                    ? '#FF9800'
                    : '#F44336'
                },
              ]}
            >
              {passRate}%
            </Text>
          </View>
        </Surface>

        {/* Photos */}
        <Surface style={styles.section} elevation={1}>
          <View style={styles.sectionHeader}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              检验照片
            </Text>
            <Chip
              mode="flat"
              compact
              style={{ backgroundColor: '#E3F2FD' }}
              textStyle={{ color: '#1976D2', fontSize: 11 }}
            >
              {photos.length}/6
            </Chip>
          </View>

          {photos.length === 0 ? (
            <View style={styles.emptyPhotos}>
              <IconButton icon="camera-outline" size={48} iconColor="#666" />
              <Text style={styles.emptyPhotosText}>暂无照片</Text>
              <Text style={styles.emptyPhotosHint}>
                点击下方按钮添加检验照片（选填）
              </Text>
            </View>
          ) : (
            <View style={styles.photoGrid}>
              {photos.map((uri, index) => (
                <View key={index} style={styles.photoItem}>
                  <Image source={{ uri }} style={styles.photoImage} resizeMode="cover" />
                  <View style={styles.photoRemove}>
                    <IconButton
                      icon="close-circle"
                      size={24}
                      iconColor="#FFF"
                      style={styles.photoRemoveButton}
                      onPress={() => removePhoto(index)}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}

          <View style={styles.photoActions}>
            <Button
              mode="outlined"
              icon="camera"
              onPress={takePhoto}
              style={styles.photoActionButton}
              disabled={photos.length >= 6}
            >
              拍照
            </Button>
            <Button
              mode="outlined"
              icon="image"
              onPress={pickImage}
              style={styles.photoActionButton}
              disabled={photos.length >= 6}
            >
              相册
            </Button>
          </View>
        </Surface>

        {/* Result & Notes */}
        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            检验结果
          </Text>

          <TouchableOpacity
            style={styles.resultSelector}
            onPress={() => setResultModalVisible(true)}
          >
            <Text style={styles.resultLabel}>检验结果 *</Text>
            <View style={styles.resultValue}>
              <Chip
                mode="flat"
                style={[
                  styles.resultChip,
                  { backgroundColor: getResultColor(result) + '20' },
                ]}
                textStyle={[
                  styles.resultChipText,
                  { color: getResultColor(result) },
                ]}
              >
                {getResultLabel(result)}
              </Chip>
              <IconButton icon="chevron-down" size={20} />
            </View>
          </TouchableOpacity>

          <TextInput
            label="备注说明"
            value={notes}
            onChangeText={setNotes}
            mode="outlined"
            multiline
            numberOfLines={4}
            style={styles.notesInput}
            placeholder="请输入备注说明（选填）"
          />
        </Surface>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            mode="contained"
            onPress={handleSubmit}
            style={styles.submitButton}
            loading={submitting}
            disabled={submitting}
          >
            提交质检记录
          </Button>
        </View>
      </ScrollView>

      {/* Result Selection Modal */}
      <Portal>
        <Modal
          visible={resultModalVisible}
          onDismiss={() => setResultModalVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Text variant="titleLarge" style={styles.modalTitle}>
            选择检验结果
          </Text>

          <RadioButton.Group
            onValueChange={(value) => setResult(value as InspectionResult)}
            value={result}
          >
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                setResult(InspectionResult.PASS);
                setResultModalVisible(false);
              }}
            >
              <View style={styles.modalOptionContent}>
                <View>
                  <Text variant="titleMedium">合格 (PASS)</Text>
                  <Text variant="bodySmall" style={styles.modalOptionDesc}>
                    产品符合所有质量标准
                  </Text>
                </View>
                <RadioButton value={InspectionResult.PASS} />
              </View>
            </TouchableOpacity>

            <Divider />

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                setResult(InspectionResult.CONDITIONAL);
                setResultModalVisible(false);
              }}
            >
              <View style={styles.modalOptionContent}>
                <View>
                  <Text variant="titleMedium">条件合格 (CONDITIONAL)</Text>
                  <Text variant="bodySmall" style={styles.modalOptionDesc}>
                    基本符合要求，部分指标需要改进
                  </Text>
                </View>
                <RadioButton value={InspectionResult.CONDITIONAL} />
              </View>
            </TouchableOpacity>

            <Divider />

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                setResult(InspectionResult.FAIL);
                setResultModalVisible(false);
              }}
            >
              <View style={styles.modalOptionContent}>
                <View>
                  <Text variant="titleMedium">不合格 (FAIL)</Text>
                  <Text variant="bodySmall" style={styles.modalOptionDesc}>
                    不符合质量标准，需要返工或销毁
                  </Text>
                </View>
                <RadioButton value={InspectionResult.FAIL} />
              </View>
            </TouchableOpacity>
          </RadioButton.Group>

          <Button
            mode="text"
            onPress={() => setResultModalVisible(false)}
            style={styles.modalCancel}
          >
            取消
          </Button>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    marginBottom: 16,
    fontWeight: '600',
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  fieldLabel: {
    fontSize: 14,
    color: '#666',
  },
  fieldValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#212121',
  },
  typeChip: {
    backgroundColor: '#E3F2FD',
  },
  divider: {
    marginVertical: 16,
  },
  input: {
    marginBottom: 12,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateInput: {
    flex: 2,
  },
  timeInput: {
    flex: 1,
  },
  validationHint: {
    fontSize: 12,
    color: '#FF9800',
    marginTop: -8,
    marginBottom: 12,
  },
  passRateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  passRateValue: {
    fontWeight: '700',
  },
  emptyPhotos: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyPhotosText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  emptyPhotosHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  photoItem: {
    width: 100,
    height: 100,
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  photoRemove: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  photoRemoveButton: {
    margin: 0,
    backgroundColor: '#F44336',
  },
  photoActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  photoActionButton: {
    flex: 1,
  },
  resultSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 16,
  },
  resultLabel: {
    fontSize: 14,
    color: '#666',
  },
  resultValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultChip: {
    marginRight: -8,
  },
  resultChipText: {
    fontWeight: '600',
  },
  notesInput: {
    minHeight: 100,
  },
  actions: {
    marginTop: 8,
  },
  submitButton: {
    paddingVertical: 6,
  },
  modalContent: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    marginBottom: 16,
    fontWeight: '600',
  },
  modalOption: {
    paddingVertical: 12,
  },
  modalOptionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalOptionDesc: {
    color: '#666',
    marginTop: 4,
  },
  modalCancel: {
    marginTop: 8,
  },
  gpsLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  gpsLoadingText: {
    fontSize: 13,
    color: '#666',
  },
  gpsInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  gpsLabel: {
    fontSize: 13,
    color: '#666',
  },
  gpsValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#212121',
    fontVariant: ['tabular-nums'],
  },
  gpsChip: {
    alignSelf: 'flex-start',
    marginTop: 12,
    backgroundColor: '#E8F5E9',
  },
  gpsError: {
    alignItems: 'center',
    padding: 12,
  },
  gpsErrorChip: {
    backgroundColor: '#FFF3E0',
    marginBottom: 8,
  },
  gpsErrorText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
  },
  gpsRetryButton: {
    marginTop: 4,
  },
});
