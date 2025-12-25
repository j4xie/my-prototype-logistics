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
import { handleError, getErrorMsg } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建CreateQualityRecord专用logger
const qualityRecordLogger = logger.createContextLogger('CreateQualityRecord');

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
  const factoryId = user?.factoryId;
  const currentUserId = user?.id;

  // Form state (matching backend QualityInspection entity)
  const [inspectionDate, setInspectionDate] = useState<string>(
    new Date().toISOString().split('T')[0]! // YYYY-MM-DD format
  );

  // Sample data (matching backend requirements)
  const [sampleSize, setSampleSize] = useState('100'); // Total samples
  const [passCount, setPassCount] = useState('95'); // Passed samples
  const [failCount, setFailCount] = useState('5'); // Failed samples

  // Inspection result (matching backend InspectionResult enum)
  const [result, setResult] = useState<InspectionResult>(InspectionResult.PASS);
  const [notes, setNotes] = useState('');

  // ========== 5星评分系统 (PRD要求) ==========
  const [freshnessScore, setFreshnessScore] = useState(5); // 新鲜度评分 (1-5)
  const [appearanceScore, setAppearanceScore] = useState(5); // 外观评分 (1-5)
  const [smellScore, setSmellScore] = useState(5); // 气味评分 (1-5)
  const [otherScore, setOtherScore] = useState(5); // 其他评分 (1-5)

  // 计算综合评分 (平均值)
  const compositeScore = ((freshnessScore + appearanceScore + smellScore + otherScore) / 4).toFixed(1);

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
      qualityRecordLogger.debug('请求位置权限');

      // 1. 请求前台位置权限
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        qualityRecordLogger.warn('位置权限被拒绝', { status });
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

      qualityRecordLogger.debug('位置权限已授予，获取当前位置');

      // 2. 获取当前位置
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High, // 高精度定位
      });

      const { latitude, longitude } = location.coords;
      qualityRecordLogger.info('GPS定位成功', { latitude, longitude });

      setGpsLocation({ latitude, longitude });
    } catch (error) {
      qualityRecordLogger.error('GPS定位失败', error);
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
        const asset = result.assets[0];
        if (!asset) return;
        const newPhotoUri = asset.uri;
        qualityRecordLogger.info('图片选择成功', { uri: newPhotoUri.substring(0, 50) + '...' });

        // 限制最多6张图片
        if (photos.length >= 6) {
          Alert.alert('提示', '最多只能上传6张图片');
          return;
        }

        setPhotos([...photos, newPhotoUri]);
      }
    } catch (error) {
      qualityRecordLogger.error('选择图片失败', error);
      Alert.alert('选择图片失败', (error as any).message || '无法选择图片，请重试');
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
        const asset = result.assets[0];
        if (!asset) return;
        const newPhotoUri = asset.uri;
        qualityRecordLogger.info('拍照成功', { uri: newPhotoUri.substring(0, 50) + '...' });

        // 限制最多6张图片
        if (photos.length >= 6) {
          Alert.alert('提示', '最多只能上传6张图片');
          return;
        }

        setPhotos([...photos, newPhotoUri]);
      }
    } catch (error) {
      qualityRecordLogger.error('拍照失败', error);
      Alert.alert('拍照失败', (error as any).message || '无法拍照，请重试');
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

            if (!currentUserId) {
              throw new Error('无法获取用户ID');
            }

            if (!factoryId) {
              throw new Error('无法获取工厂ID');
            }

            // Prepare inspection data (matching backend SubmitInspectionRequest)
            const inspectionData: SubmitInspectionRequest = {
              inspectorId: currentUserId,
              inspectionDate, // YYYY-MM-DD
              sampleSize: sampleSizeNum,
              passCount: passCountNum,
              failCount: failCountNum,
              result,
              notes: finalNotes || undefined,
            };

            qualityRecordLogger.info('提交质检记录', {
              batchId,
              inspectorId: currentUserId,
              sampleSize: sampleSizeNum,
              passCount: passCountNum,
              result,
              hasGps: !!gpsLocation,
            });

            // API integration - POST /quality/inspections?batchId={batchId}
            const response = await qualityInspectionApiClient.submitInspection(
              Number(batchId),
              inspectionData,
              factoryId
            );

            qualityRecordLogger.info('质检记录提交成功', { batchId, inspectionId: response.data?.id });

            Alert.alert('成功', '质检记录已提交', [
              { text: '确定', onPress: () => navigation.goBack() },
            ]);
          } catch (error) {
            qualityRecordLogger.error('提交质检记录失败', error, { batchId });
            const errorMessage = getErrorMsg(error) || '提交失败，请重试';
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

        {/* ========== 5星评分系统 (PRD要求) ========== */}
        <Surface style={styles.section} elevation={1}>
          <View style={styles.sectionHeader}>
            <List.Icon icon="star" color="#FF9800" style={{ margin: 0 }} />
            <Text variant="titleMedium" style={styles.sectionTitle}>
              质量评分
            </Text>
            <Chip
              mode="flat"
              compact
              icon="check-decagram"
              style={{ backgroundColor: '#FFF3E0' }}
              textStyle={{ color: '#FF9800', fontSize: 11, fontWeight: '600' }}
            >
              综合 {compositeScore} 分
            </Chip>
          </View>

          {/* 新鲜度评分 */}
          <View style={styles.ratingRow}>
            <Text style={styles.ratingLabel}>新鲜度</Text>
            <View style={styles.ratingStars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setFreshnessScore(star)}
                  style={styles.starButton}
                >
                  <IconButton
                    icon={star <= freshnessScore ? 'star' : 'star-outline'}
                    iconColor={star <= freshnessScore ? '#FF9800' : '#BDBDBD'}
                    size={32}
                    style={{ margin: 0 }}
                  />
                </TouchableOpacity>
              ))}
              <Text style={styles.ratingValue}>{freshnessScore}/5</Text>
            </View>
          </View>

          <Divider style={styles.ratingDivider} />

          {/* 外观评分 */}
          <View style={styles.ratingRow}>
            <Text style={styles.ratingLabel}>外观</Text>
            <View style={styles.ratingStars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setAppearanceScore(star)}
                  style={styles.starButton}
                >
                  <IconButton
                    icon={star <= appearanceScore ? 'star' : 'star-outline'}
                    iconColor={star <= appearanceScore ? '#FF9800' : '#BDBDBD'}
                    size={32}
                    style={{ margin: 0 }}
                  />
                </TouchableOpacity>
              ))}
              <Text style={styles.ratingValue}>{appearanceScore}/5</Text>
            </View>
          </View>

          <Divider style={styles.ratingDivider} />

          {/* 气味评分 */}
          <View style={styles.ratingRow}>
            <Text style={styles.ratingLabel}>气味</Text>
            <View style={styles.ratingStars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setSmellScore(star)}
                  style={styles.starButton}
                >
                  <IconButton
                    icon={star <= smellScore ? 'star' : 'star-outline'}
                    iconColor={star <= smellScore ? '#FF9800' : '#BDBDBD'}
                    size={32}
                    style={{ margin: 0 }}
                  />
                </TouchableOpacity>
              ))}
              <Text style={styles.ratingValue}>{smellScore}/5</Text>
            </View>
          </View>

          <Divider style={styles.ratingDivider} />

          {/* 其他评分 */}
          <View style={styles.ratingRow}>
            <Text style={styles.ratingLabel}>其他</Text>
            <View style={styles.ratingStars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setOtherScore(star)}
                  style={styles.starButton}
                >
                  <IconButton
                    icon={star <= otherScore ? 'star' : 'star-outline'}
                    iconColor={star <= otherScore ? '#FF9800' : '#BDBDBD'}
                    size={32}
                    style={{ margin: 0 }}
                  />
                </TouchableOpacity>
              ))}
              <Text style={styles.ratingValue}>{otherScore}/5</Text>
            </View>
          </View>

          {/* 综合评分展示 */}
          <Divider style={styles.divider} />
          <View style={styles.compositeScoreRow}>
            <View style={styles.compositeScoreLeft}>
              <IconButton icon="check-decagram" iconColor="#FF9800" size={28} style={{ margin: 0 }} />
              <Text variant="titleMedium" style={styles.compositeScoreLabel}>
                综合评分
              </Text>
            </View>
            <View style={styles.compositeScoreRight}>
              <Text
                variant="headlineMedium"
                style={[
                  styles.compositeScoreValue,
                  {
                    color:
                      parseFloat(compositeScore) >= 4.5
                        ? '#4CAF50'
                        : parseFloat(compositeScore) >= 3.5
                        ? '#FF9800'
                        : '#F44336',
                  },
                ]}
              >
                {compositeScore}
              </Text>
              <Text style={styles.compositeScoreMax}>/5.0</Text>
            </View>
          </View>

          {/* 评分说明 */}
          <View style={styles.ratingHint}>
            <IconButton icon="information" size={16} iconColor="#757575" style={{ margin: 0, marginRight: 4 }} />
            <Text variant="bodySmall" style={styles.ratingHintText}>
              综合评分 = (新鲜度 + 外观 + 气味 + 其他) ÷ 4
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
  // ========== 5星评分系统样式 ==========
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  ratingLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  ratingStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  starButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  ratingValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9800',
    marginLeft: 8,
    minWidth: 30,
    textAlign: 'right',
  },
  ratingDivider: {
    marginVertical: 16,
    backgroundColor: '#E0E0E0',
  },
  compositeScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    marginTop: 8,
  },
  compositeScoreLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compositeScoreRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  compositeScoreLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212121',
  },
  compositeScoreValue: {
    fontSize: 28,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  compositeScoreMax: {
    fontSize: 14,
    color: '#999',
    marginLeft: 2,
  },
  ratingHint: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 6,
    marginTop: 12,
  },
  ratingHintText: {
    fontSize: 12,
    color: '#1976D2',
    flex: 1,
    marginLeft: 8,
  },
});
