/**
 * LabelScanScreen - 标签扫描识别页面
 *
 * 功能：
 * - 拍照识别标签（支持闪光灯）
 * - 从相册选择标签图片
 * - 调用API验证标签信息（OCR识别）
 * - 显示识别结果：批次号、打印质量、置信度、批次匹配
 * - 支持重拍和确认使用结果
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import {
  verifyLabel,
  LabelVerifyResult,
  getPrintQualityName,
  getPrintQualityColor,
} from '../../services/api/workstationApiClient';

// ========== 类型定义 ==========

type LabelScanParams = {
  workstationId: string;
  batchNumber?: string; // 期望的批次号（用于匹配验证）
  onResult?: (result: LabelVerifyResult) => void;
};

// 通用的路由参数列表类型
type RootStackParamList = {
  LabelScan: LabelScanParams;
  [key: string]: object | undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'LabelScan'>;
type RouteProps = RouteProp<RootStackParamList, 'LabelScan'>;

// ========== 颜色常量 ==========

const COLORS = {
  primary: '#3182ce',
  success: '#48bb78',
  warning: '#ed8936',
  error: '#e53e3e',
  background: '#f5f7fa',
  text: '#2d3748',
  textSecondary: '#718096',
  white: '#ffffff',
  overlay: 'rgba(0, 0, 0, 0.6)',
  cardBg: '#ffffff',
  border: '#e2e8f0',
};

// ========== 组件 ==========

export default function LabelScanScreen() {
  const { t } = useTranslation('common');
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();

  const { workstationId, batchNumber: expectedBatchNumber, onResult } = route.params;

  // 相机权限
  const [permission, requestPermission] = useCameraPermissions();
  const [flashMode, setFlashMode] = useState(false);

  // 状态管理
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [verifyResult, setVerifyResult] = useState<LabelVerifyResult | null>(null);

  const cameraRef = useRef<CameraView>(null);

  // 拍照
  const handleTakePhoto = useCallback(async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: true,
        });

        if (photo?.uri && photo?.base64) {
          setCapturedImage(photo.uri);
          setVerifyResult(null);
          await processLabelImage(photo.base64);
        }
      } catch (error) {
        console.error('拍照失败:', error);
        Alert.alert(
          t('error.general', { defaultValue: '操作失败' }),
          t('camera.captureFailed', { defaultValue: '拍照失败，请重试', ns: 'quality' })
        );
      }
    }
  }, [t]);

  // 从相册选择
  const handleSelectFromGallery = useCallback(async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          t('error.general', { defaultValue: '权限不足' }),
          '需要相册权限才能选择图片'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets?.length > 0 && result.assets[0]?.base64) {
        setCapturedImage(result.assets[0].uri);
        setVerifyResult(null);
        await processLabelImage(result.assets[0].base64);
      }
    } catch (error) {
      console.error('选择图片失败:', error);
      Alert.alert(
        t('error.general', { defaultValue: '操作失败' }),
        '选择图片失败，请重试'
      );
    }
  }, [t]);

  // 处理标签图片（调用API验证）
  const processLabelImage = useCallback(async (imageBase64: string) => {
    try {
      setIsProcessing(true);

      const result = await verifyLabel(workstationId, imageBase64);

      // API返回结构已包含在ApiResponse.data中
      if (result && typeof result === 'object') {
        setVerifyResult(result);

        if (!result.success || !result.verified) {
          // 识别失败或验证未通过，显示消息
          Alert.alert(
            '识别结果',
            result.message || '标签验证未通过'
          );
        }
      } else {
        Alert.alert('识别失败', '无法解析识别结果');
      }
    } catch (error) {
      console.error('标签验证失败:', error);
      Alert.alert(
        '识别失败',
        '网络请求失败，请检查网络连接后重试'
      );
    } finally {
      setIsProcessing(false);
    }
  }, [workstationId]);

  // 重拍
  const handleRetake = useCallback(() => {
    setCapturedImage(null);
    setVerifyResult(null);
  }, []);

  // 确认使用结果
  const handleConfirmResult = useCallback(() => {
    if (verifyResult && onResult) {
      onResult(verifyResult);
    }
    navigation.goBack();
  }, [verifyResult, onResult, navigation]);

  // 切换闪光灯
  const toggleFlash = useCallback(() => {
    setFlashMode(prev => !prev);
  }, []);

  // 权限加载中
  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  // 权限未授权
  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera-outline" size={64} color={COLORS.textSecondary} />
        <Text style={styles.permissionTitle}>需要相机权限</Text>
        <Text style={styles.permissionText}>请授权相机权限以扫描标签</Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>授权相机</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 已拍摄图片 - 显示预览和结果
  if (capturedImage) {
    return (
      <View style={styles.container}>
        {/* 顶部栏 */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>标签扫描</Text>
          <View style={styles.headerBtn} />
        </View>

        <ScrollView style={styles.resultScrollView} contentContainerStyle={styles.resultScrollContent}>
          {/* 图片预览 */}
          <View style={styles.previewContainer}>
            <Image source={{ uri: capturedImage }} style={styles.previewImage} resizeMode="contain" />
            {isProcessing && (
              <View style={styles.processingOverlay}>
                <ActivityIndicator size="large" color={COLORS.white} />
                <Text style={styles.processingText}>正在识别标签...</Text>
              </View>
            )}
          </View>

          {/* 识别结果 */}
          {verifyResult && !isProcessing && (
            <View style={styles.resultCard}>
              <Text style={styles.resultTitle}>识别结果</Text>

              {/* 批次号 */}
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>批次号</Text>
                <Text style={styles.resultValue}>
                  {verifyResult.recognizedBatchNumber || '未识别'}
                </Text>
              </View>

              {/* 打印质量 */}
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>打印质量</Text>
                <View style={styles.resultValueRow}>
                  <View
                    style={[
                      styles.qualityBadge,
                      { backgroundColor: getPrintQualityColor(verifyResult.printQuality) + '20' }
                    ]}
                  >
                    <Text
                      style={[
                        styles.qualityBadgeText,
                        { color: getPrintQualityColor(verifyResult.printQuality) }
                      ]}
                    >
                      {getPrintQualityName(verifyResult.printQuality)}
                    </Text>
                  </View>
                  {verifyResult.printQuality === 'GOOD' && (
                    <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                  )}
                </View>
              </View>

              {/* 置信度 */}
              {verifyResult.confidence !== undefined && (
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>置信度</Text>
                  <Text style={styles.resultValue}>
                    {Math.round(verifyResult.confidence * 100)}%
                  </Text>
                </View>
              )}

              {/* 质量分数 */}
              {verifyResult.qualityScore !== undefined && (
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>质量分数</Text>
                  <Text style={styles.resultValue}>
                    {verifyResult.qualityScore}
                  </Text>
                </View>
              )}

              {/* 批次匹配 */}
              {expectedBatchNumber && (
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>批次匹配</Text>
                  <View style={styles.resultValueRow}>
                    {verifyResult.batchMatch ? (
                      <>
                        <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                        <Text style={[styles.matchText, { color: COLORS.success }]}>匹配</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="close-circle" size={20} color={COLORS.error} />
                        <Text style={[styles.matchText, { color: COLORS.error }]}>不匹配</Text>
                      </>
                    )}
                  </View>
                </View>
              )}

              {/* 可读性 */}
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>可读性</Text>
                <View style={styles.resultValueRow}>
                  {verifyResult.readable ? (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                      <Text style={[styles.matchText, { color: COLORS.success }]}>可读</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="close-circle" size={20} color={COLORS.error} />
                      <Text style={[styles.matchText, { color: COLORS.error }]}>不可读</Text>
                    </>
                  )}
                </View>
              </View>

              {/* 质量问题列表 */}
              {verifyResult.qualityIssues && verifyResult.qualityIssues.length > 0 && (
                <View style={styles.issuesContainer}>
                  <Text style={styles.issuesTitle}>质量问题</Text>
                  {verifyResult.qualityIssues.map((issue, index) => (
                    <View key={index} style={styles.issueItem}>
                      <Ionicons name="warning" size={16} color={COLORS.warning} />
                      <Text style={styles.issueText}>{issue}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* 验证消息 */}
              {verifyResult.message && (
                <View style={styles.messageContainer}>
                  <Text style={styles.messageText}>{verifyResult.message}</Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* 底部操作按钮 */}
        <View style={[styles.bottomActions, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity
            style={styles.retakeBtn}
            onPress={handleRetake}
            disabled={isProcessing}
          >
            <Ionicons name="camera-reverse" size={20} color={COLORS.primary} />
            <Text style={styles.retakeBtnText}>重拍</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.confirmBtn,
              (!verifyResult || isProcessing) && styles.confirmBtnDisabled
            ]}
            onPress={handleConfirmResult}
            disabled={!verifyResult || isProcessing}
          >
            <Ionicons name="checkmark" size={20} color={COLORS.white} />
            <Text style={styles.confirmBtnText}>确认使用结果</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // 相机视图
  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        enableTorch={flashMode}
      >
        {/* 顶部控制栏 */}
        <View style={[styles.cameraTopBar, { paddingTop: insets.top }]}>
          <TouchableOpacity style={styles.cameraTopBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={28} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.cameraTitle}>标签扫描</Text>
          <TouchableOpacity style={styles.cameraTopBtn} onPress={toggleFlash}>
            <Ionicons
              name={flashMode ? 'flash' : 'flash-off'}
              size={24}
              color={COLORS.white}
            />
          </TouchableOpacity>
        </View>

        {/* 期望批次号提示 */}
        {expectedBatchNumber && (
          <View style={styles.batchHint}>
            <Text style={styles.batchHintText}>期望批次: {expectedBatchNumber}</Text>
          </View>
        )}

        {/* 扫描框指引 */}
        <View style={styles.scanGuide}>
          <View style={styles.scanFrame}>
            <View style={styles.guideCorner} />
            <View style={[styles.guideCorner, styles.guideCornerTR]} />
            <View style={[styles.guideCorner, styles.guideCornerBL]} />
            <View style={[styles.guideCorner, styles.guideCornerBR]} />
          </View>
          <Text style={styles.scanHintText}>将标签放入框内</Text>
        </View>

        {/* 底部控制栏 */}
        <View style={[styles.cameraBottomBar, { paddingBottom: insets.bottom + 20 }]}>
          {/* 从相册选择 */}
          <TouchableOpacity style={styles.galleryBtn} onPress={handleSelectFromGallery}>
            <Ionicons name="images" size={28} color={COLORS.white} />
            <Text style={styles.galleryBtnText}>相册</Text>
          </TouchableOpacity>

          {/* 拍照按钮 */}
          <TouchableOpacity style={styles.captureBtn} onPress={handleTakePhoto}>
            <View style={styles.captureBtnInner} />
          </TouchableOpacity>

          {/* 占位 */}
          <View style={styles.galleryBtn} />
        </View>
      </CameraView>
    </View>
  );
}

// ========== 样式 ==========

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
  },

  // 权限页面
  permissionContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
  },
  permissionBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  permissionBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },

  // 相机
  camera: {
    flex: 1,
  },
  cameraTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: COLORS.overlay,
  },
  cameraTopBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraTitle: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '600',
  },

  // 批次提示
  batchHint: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 12,
  },
  batchHintText: {
    color: COLORS.white,
    fontSize: 14,
  },

  // 扫描框
  scanGuide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 280,
    height: 180,
    position: 'relative',
  },
  guideCorner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: COLORS.white,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    top: 0,
    left: 0,
  },
  guideCornerTR: {
    left: undefined,
    right: 0,
    borderLeftWidth: 0,
    borderRightWidth: 3,
  },
  guideCornerBL: {
    top: undefined,
    bottom: 0,
    borderTopWidth: 0,
    borderBottomWidth: 3,
  },
  guideCornerBR: {
    top: undefined,
    left: undefined,
    bottom: 0,
    right: 0,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  scanHintText: {
    color: COLORS.white,
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },

  // 底部控制栏
  cameraBottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 24,
    backgroundColor: COLORS.overlay,
  },
  galleryBtn: {
    width: 60,
    alignItems: 'center',
  },
  galleryBtnText: {
    color: COLORS.white,
    fontSize: 12,
    marginTop: 4,
  },
  captureBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureBtnInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.white,
  },

  // 结果页面头部
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
  },

  // 结果滚动视图
  resultScrollView: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  resultScrollContent: {
    paddingBottom: 24,
  },

  // 预览容器
  previewContainer: {
    backgroundColor: '#000',
    aspectRatio: 16 / 10,
    width: '100%',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    color: COLORS.white,
    fontSize: 16,
    marginTop: 12,
  },

  // 结果卡片
  resultCard: {
    backgroundColor: COLORS.cardBg,
    margin: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  resultLabel: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  resultValue: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.text,
  },
  resultValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qualityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  qualityBadgeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  matchText: {
    fontSize: 15,
    fontWeight: '500',
  },

  // 质量问题
  issuesContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#fff8e6',
    borderRadius: 8,
  },
  issuesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.warning,
    marginBottom: 8,
  },
  issueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  issueText: {
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
  },

  // 消息容器
  messageContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f0f4f8',
    borderRadius: 8,
  },
  messageText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  // 底部操作
  bottomActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
    backgroundColor: COLORS.cardBg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  retakeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
    gap: 8,
  },
  retakeBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },
  confirmBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    gap: 8,
  },
  confirmBtnDisabled: {
    backgroundColor: '#a0aec0',
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
});
