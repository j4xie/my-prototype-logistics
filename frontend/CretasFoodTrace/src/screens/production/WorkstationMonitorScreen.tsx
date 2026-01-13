/**
 * WorkstationMonitorScreen - 工位监控界面
 *
 * 功能：
 * - 工位初始化：选择摄像头、电子秤、生产批次
 * - 实时监控：显示摄像头画面（定时刷新）
 * - 计数显示：当前计数、累计重量、最近识别状态
 * - 操作按钮：手动计数、验证标签、暂停/恢复、结束会话
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {
  Text,
  Button,
  TextInput,
  IconButton,
  Chip,
  Divider,
  Portal,
  Modal,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

// Hooks and API
import {
  useWorkstationCounting,
  WorkstationState,
} from '../../hooks/useWorkstationCounting';
import {
  capturePicture,
  getIsapiDevices,
  IsapiDevice,
} from '../../services/api/isapiApiClient';
import { WorkstationConfig } from '../../services/api/workstationApiClient';
import { theme } from '../../theme';

// ========== 类型定义 ==========

type WorkstationMonitorParams = {
  workstationId?: string;
  config?: WorkstationConfig;
};

// 由于导航类型可能未定义，我们使用通用类型
type NavigationProp = NativeStackNavigationProp<Record<string, WorkstationMonitorParams>>;
type RouteType = RouteProp<Record<string, WorkstationMonitorParams>, string>;

// ========== 常量 ==========

const STATUS_COLORS: Record<WorkstationState, { bg: string; text: string; label: string }> = {
  idle: { bg: '#f5f5f5', text: '#9CA3AF', label: '未初始化' },
  initializing: { bg: '#E6F7FF', text: '#1890FF', label: '初始化中' },
  monitoring: { bg: '#F6FFED', text: '#52c41a', label: '监控中' },
  paused: { bg: '#FFF7E6', text: '#fa8c16', label: '已暂停' },
  stopped: { bg: '#f5f5f5', text: '#9CA3AF', label: '已停止' },
  error: { bg: '#FFF1F0', text: '#ff4d4f', label: '错误' },
};

// ========== 组件 ==========

export function WorkstationMonitorScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { workstationId: routeWorkstationId, config: routeConfig } = route.params || {};

  // 工位计数Hook
  const workstation = useWorkstationCounting({
    frameInterval: 3000,
    autoMonitorAfterInit: false,
  });

  // 本地状态
  const [showInitForm, setShowInitForm] = useState(!routeWorkstationId);
  const [cameraPreviewUrl, setCameraPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<string>('--:--:--');
  const [showLabelModal, setShowLabelModal] = useState(false);

  // 初始化表单状态
  const [formWorkstationName, setFormWorkstationName] = useState('');
  const [formBatchId, setFormBatchId] = useState('');
  const [selectedCamera, setSelectedCamera] = useState<IsapiDevice | null>(null);
  const [availableCameras, setAvailableCameras] = useState<IsapiDevice[]>([]);
  const [loadingCameras, setLoadingCameras] = useState(false);

  // 定时器ref
  const previewTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ========== 加载摄像头列表 ==========

  const loadCameras = useCallback(async () => {
    setLoadingCameras(true);
    try {
      const response = await getIsapiDevices({ page: 0, size: 100 });
      const devices = response.content || [];
      // 只显示在线设备
      const onlineDevices = devices.filter((d) => d.status === 'ONLINE');
      setAvailableCameras(onlineDevices);
      if (onlineDevices.length > 0 && !selectedCamera) {
        const firstDevice = onlineDevices[0];
        if (firstDevice) {
          setSelectedCamera(firstDevice);
        }
      }
    } catch (error) {
      console.error('加载摄像头列表失败:', error);
    } finally {
      setLoadingCameras(false);
    }
  }, [selectedCamera]);

  // ========== 刷新摄像头预览 ==========

  const refreshCameraPreview = useCallback(async () => {
    if (!selectedCamera || !workstation.isInitialized) {
      return;
    }

    setPreviewLoading(true);
    try {
      const capture = await capturePicture(selectedCamera.id, 1);
      if (capture.success && capture.pictureBase64) {
        setCameraPreviewUrl(`data:image/jpeg;base64,${capture.pictureBase64}`);
        const now = new Date();
        setLastRefreshTime(
          `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
        );
      }
    } catch (error) {
      console.error('刷新预览失败:', error);
    } finally {
      setPreviewLoading(false);
    }
  }, [selectedCamera, workstation.isInitialized]);

  // ========== 初始化工位 ==========

  const handleInitialize = async () => {
    if (!formWorkstationName.trim()) {
      Alert.alert('提示', '请输入工位名称');
      return;
    }

    const config: WorkstationConfig = {
      workstationName: formWorkstationName.trim(),
      productionBatchId: formBatchId.trim() || undefined,
      cameraId: selectedCamera?.id,
      cameraChannelId: 1,
    };

    const result = await workstation.initialize(config);
    if (result?.success) {
      setShowInitForm(false);
      // 开始预览
      refreshCameraPreview();
    } else {
      Alert.alert('初始化失败', workstation.error || '请重试');
    }
  };

  // ========== 开始/暂停/恢复监控 ==========

  const handleToggleMonitoring = () => {
    if (workstation.isMonitoring) {
      workstation.pauseMonitoring();
    } else if (workstation.isPaused) {
      workstation.resumeMonitoring();
    } else {
      workstation.startMonitoring();
    }
  };

  // ========== 结束会话 ==========

  const handleStopSession = () => {
    Alert.alert(
      '结束会话',
      `确定要结束当前工位会话吗？\n\n已计数: ${workstation.count}\n累计重量: ${workstation.totalWeight.toFixed(1)} kg`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定结束',
          style: 'destructive',
          onPress: async () => {
            const result = await workstation.stop();
            if (result) {
              Alert.alert(
                '会话已结束',
                `最终计数: ${result.finalCount}\n最终重量: ${result.finalWeight.toFixed(1)} kg`,
                [{ text: '确定', onPress: () => navigation.goBack() }]
              );
            }
          },
        },
      ]
    );
  };

  // ========== 手动计数 ==========

  const handleManualCount = async () => {
    const result = await workstation.manualCount();
    if (result?.counted) {
      // 成功计数
    }
  };

  // ========== 验证标签 ==========

  const handleVerifyLabel = async () => {
    if (!selectedCamera) {
      Alert.alert('提示', '请先选择摄像头');
      return;
    }

    setShowLabelModal(true);
    try {
      const capture = await capturePicture(selectedCamera.id, 1);
      if (capture.success && capture.pictureBase64) {
        const result = await workstation.verifyLabel(capture.pictureBase64);
        setShowLabelModal(false);
        if (result) {
          const statusText = result.verified ? '验证通过' : '验证失败';
          const qualityText = result.printQuality || '未知';
          Alert.alert(
            `标签${statusText}`,
            `打印质量: ${qualityText}\n${result.message || ''}`
          );
        }
      } else {
        setShowLabelModal(false);
        Alert.alert('抓拍失败', '无法获取标签图像');
      }
    } catch (error) {
      setShowLabelModal(false);
      Alert.alert('验证失败', '请重试');
    }
  };

  // ========== Effects ==========

  // 加载摄像头
  useEffect(() => {
    if (showInitForm) {
      loadCameras();
    }
  }, [showInitForm, loadCameras]);

  // 自动刷新预览
  useEffect(() => {
    if (workstation.isMonitoring && selectedCamera) {
      // 开始定时刷新预览
      previewTimerRef.current = setInterval(refreshCameraPreview, 3000);
    } else {
      // 停止定时刷新
      if (previewTimerRef.current) {
        clearInterval(previewTimerRef.current);
        previewTimerRef.current = null;
      }
    }

    return () => {
      if (previewTimerRef.current) {
        clearInterval(previewTimerRef.current);
      }
    };
  }, [workstation.isMonitoring, selectedCamera, refreshCameraPreview]);

  // 路由配置初始化
  useEffect(() => {
    if (routeConfig && !workstation.isInitialized) {
      workstation.initialize(routeConfig);
    }
  }, [routeConfig, workstation.isInitialized]);

  // ========== 渲染状态指示器 ==========

  const renderStatusIndicator = () => {
    const statusInfo = STATUS_COLORS[workstation.state];
    return (
      <View style={[styles.statusIndicator, { backgroundColor: statusInfo.bg }]}>
        <View style={[styles.statusDot, { backgroundColor: statusInfo.text }]} />
        <Text style={[styles.statusLabel, { color: statusInfo.text }]}>
          {statusInfo.label}
        </Text>
      </View>
    );
  };

  // ========== 渲染初始化表单 ==========

  const renderInitForm = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>工位初始化</Text>

        {/* 工位名称 */}
        <Text style={styles.inputLabel}>工位名称 *</Text>
        <TextInput
          style={styles.input}
          mode="outlined"
          placeholder="例如：切割工位-01"
          value={formWorkstationName}
          onChangeText={setFormWorkstationName}
          outlineColor={theme.colors.border}
          activeOutlineColor={theme.colors.primary}
        />

        {/* 生产批次 */}
        <Text style={styles.inputLabel}>生产批次（选填）</Text>
        <TextInput
          style={styles.input}
          mode="outlined"
          placeholder="扫描或输入批次号"
          value={formBatchId}
          onChangeText={setFormBatchId}
          outlineColor={theme.colors.border}
          activeOutlineColor={theme.colors.primary}
          right={<TextInput.Icon icon="barcode-scan" />}
        />

        {/* 摄像头选择 */}
        <Text style={styles.inputLabel}>选择摄像头</Text>
        {loadingCameras ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.loadingText}>加载摄像头列表...</Text>
          </View>
        ) : availableCameras.length === 0 ? (
          <View style={styles.emptyBox}>
            <MaterialCommunityIcons name="camera-off" size={32} color="#9CA3AF" />
            <Text style={styles.emptyText}>暂无可用摄像头</Text>
            <Button mode="text" onPress={loadCameras}>
              刷新
            </Button>
          </View>
        ) : (
          <View style={styles.cameraList}>
            {availableCameras.map((camera) => (
              <TouchableOpacity
                key={camera.id}
                style={[
                  styles.cameraItem,
                  selectedCamera?.id === camera.id && styles.cameraItemSelected,
                ]}
                onPress={() => setSelectedCamera(camera)}
              >
                <MaterialCommunityIcons
                  name="video"
                  size={24}
                  color={
                    selectedCamera?.id === camera.id
                      ? theme.colors.primary
                      : '#6B7280'
                  }
                />
                <View style={styles.cameraInfo}>
                  <Text
                    style={[
                      styles.cameraName,
                      selectedCamera?.id === camera.id && styles.cameraNameSelected,
                    ]}
                  >
                    {camera.deviceName}
                  </Text>
                  <Text style={styles.cameraIp}>
                    {camera.ipAddress}:{camera.port}
                  </Text>
                </View>
                {selectedCamera?.id === camera.id && (
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={20}
                    color={theme.colors.primary}
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* 初始化按钮 */}
      <View style={styles.actionButtons}>
        <Button
          mode="outlined"
          onPress={() => navigation.goBack()}
          style={styles.actionBtnSecondary}
          labelStyle={{ color: '#666' }}
        >
          取消
        </Button>
        <Button
          mode="contained"
          onPress={handleInitialize}
          style={styles.actionBtnPrimary}
          labelStyle={{ color: '#fff' }}
          loading={workstation.loading}
          disabled={!formWorkstationName.trim() || workstation.loading}
        >
          开始监控
        </Button>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );

  // ========== 渲染监控界面 ==========

  const renderMonitorView = () => (
    <ScrollView
      style={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={false}
          onRefresh={refreshCameraPreview}
          colors={[theme.colors.primary]}
        />
      }
    >
      {/* 工位信息 */}
      <View style={styles.section}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>工位:</Text>
          <Text style={styles.infoValue}>
            {workstation.config?.workstationName || '--'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>批次:</Text>
          <Text style={styles.infoValue}>
            {workstation.config?.productionBatchId || '未关联'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>状态:</Text>
          {renderStatusIndicator()}
        </View>
      </View>

      {/* 摄像头预览 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>摄像头画面</Text>
        <View style={styles.previewContainer}>
          {cameraPreviewUrl ? (
            <Image
              source={{ uri: cameraPreviewUrl }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.previewPlaceholder}>
              <MaterialCommunityIcons name="camera" size={48} color="#D1D5DB" />
              <Text style={styles.previewPlaceholderText}>
                {previewLoading ? '加载中...' : '暂无画面'}
              </Text>
            </View>
          )}
          {previewLoading && (
            <View style={styles.previewLoading}>
              <ActivityIndicator size="small" color="#fff" />
            </View>
          )}
        </View>
        <Text style={styles.previewTime}>最后刷新: {lastRefreshTime}</Text>
      </View>

      {/* 计数统计 */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{workstation.count}</Text>
          <Text style={styles.statLabel}>已计数</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{workstation.totalWeight.toFixed(1)}</Text>
          <Text style={styles.statLabel}>累计重量(kg)</Text>
        </View>
      </View>

      {/* 最近识别结果 */}
      {workstation.lastResult && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>最近识别</Text>
          <View style={styles.resultCard}>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>时间:</Text>
              <Text style={styles.resultValue}>
                {workstation.frameStats.lastFrameTime
                  ? new Date(workstation.frameStats.lastFrameTime).toLocaleTimeString('zh-CN')
                  : '--'}
              </Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>结果:</Text>
              <Chip
                mode="flat"
                style={{
                  backgroundColor: workstation.lastResult.counted
                    ? '#F6FFED'
                    : '#FFF7E6',
                }}
                textStyle={{
                  color: workstation.lastResult.counted ? '#52c41a' : '#fa8c16',
                  fontSize: 12,
                }}
              >
                {workstation.lastResult.counted ? '完成' : '未识别'}
                {workstation.lastResult.confidence
                  ? ` (${Math.round(workstation.lastResult.confidence * 100)}%)`
                  : ''}
              </Chip>
            </View>
            {workstation.lastResult.gestureType && (
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>手势:</Text>
                <Text style={styles.resultValue}>
                  {workstation.lastResult.gestureType}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* 帧处理统计 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>处理统计</Text>
        <View style={styles.frameStats}>
          <View style={styles.frameStat}>
            <Text style={styles.frameStatValue}>{workstation.frameStats.totalFrames}</Text>
            <Text style={styles.frameStatLabel}>总帧数</Text>
          </View>
          <View style={styles.frameStat}>
            <Text style={[styles.frameStatValue, { color: '#52c41a' }]}>
              {workstation.frameStats.successFrames}
            </Text>
            <Text style={styles.frameStatLabel}>成功</Text>
          </View>
          <View style={styles.frameStat}>
            <Text style={[styles.frameStatValue, { color: '#ff4d4f' }]}>
              {workstation.frameStats.failedFrames}
            </Text>
            <Text style={styles.frameStatLabel}>失败</Text>
          </View>
        </View>
      </View>

      {/* 操作按钮 */}
      <View style={styles.section}>
        <View style={styles.operationRow}>
          <Button
            mode="contained"
            onPress={handleManualCount}
            style={styles.operationBtn}
            icon="plus"
            loading={workstation.loading}
            disabled={!workstation.isInitialized || workstation.state === 'stopped'}
          >
            手动+1
          </Button>
          <Button
            mode="outlined"
            onPress={handleVerifyLabel}
            style={styles.operationBtn}
            icon="tag-check"
            disabled={!workstation.isInitialized || workstation.state === 'stopped'}
          >
            验证标签
          </Button>
        </View>
        <View style={styles.operationRow}>
          <Button
            mode={workstation.isMonitoring ? 'contained' : 'outlined'}
            onPress={handleToggleMonitoring}
            style={styles.operationBtn}
            icon={workstation.isMonitoring ? 'pause' : 'play'}
            buttonColor={workstation.isMonitoring ? '#fa8c16' : undefined}
            disabled={!workstation.isInitialized || workstation.state === 'stopped'}
          >
            {workstation.isMonitoring ? '暂停监控' : '开始监控'}
          </Button>
          <Button
            mode="outlined"
            onPress={handleStopSession}
            style={[styles.operationBtn, { borderColor: '#ff4d4f' }]}
            textColor="#ff4d4f"
            icon="stop"
            disabled={!workstation.isInitialized || workstation.state === 'stopped'}
          >
            结束会话
          </Button>
        </View>
      </View>

      {/* 错误提示 */}
      {workstation.error && (
        <View style={styles.errorBox}>
          <MaterialCommunityIcons name="alert-circle" size={20} color="#ff4d4f" />
          <Text style={styles.errorText}>{workstation.error}</Text>
          <TouchableOpacity onPress={workstation.clearError}>
            <MaterialCommunityIcons name="close" size={20} color="#999" />
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );

  // ========== 主渲染 ==========

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>工位监控</Text>
          <Text style={styles.headerSubtitle}>
            {showInitForm ? '初始化配置' : workstation.config?.workstationName || ''}
          </Text>
        </View>
        {!showInitForm && (
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => setShowInitForm(true)}
          >
            <MaterialCommunityIcons name="cog" size={22} color="#fff" />
          </TouchableOpacity>
        )}
        {showInitForm && <View style={styles.headerRight} />}
      </View>

      {/* 内容区域 */}
      {showInitForm ? renderInitForm() : renderMonitorView()}

      {/* 标签验证Modal */}
      <Portal>
        <Modal
          visible={showLabelModal}
          onDismiss={() => setShowLabelModal(false)}
          contentContainerStyle={styles.modal}
        >
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.modalText}>正在验证标签...</Text>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
}

// ========== 样式 ==========

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  settingsButton: {
    padding: 4,
  },
  headerRight: {
    width: 30,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 12,
  },

  // 表单样式
  inputLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#fff',
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  loadingText: {
    marginLeft: 12,
    color: '#6B7280',
  },
  emptyBox: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  emptyText: {
    marginTop: 8,
    color: '#9CA3AF',
  },
  cameraList: {
    gap: 8,
  },
  cameraItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cameraItemSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: '#E6F7FF',
  },
  cameraInfo: {
    flex: 1,
    marginLeft: 12,
  },
  cameraName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  cameraNameSelected: {
    color: theme.colors.primary,
  },
  cameraIp: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 24,
    gap: 12,
  },
  actionBtnSecondary: {
    flex: 1,
    borderRadius: 8,
    borderColor: '#ddd',
  },
  actionBtnPrimary: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
  },

  // 监控界面样式
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    width: 60,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '500',
  },

  // 预览区域
  previewContainer: {
    aspectRatio: 16 / 9,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewPlaceholder: {
    alignItems: 'center',
  },
  previewPlaceholderText: {
    color: '#6B7280',
    marginTop: 8,
  },
  previewLoading: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    padding: 4,
  },
  previewTime: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
  },

  // 统计卡片
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },

  // 识别结果
  resultCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  resultLabel: {
    fontSize: 13,
    color: '#6B7280',
    width: 60,
  },
  resultValue: {
    fontSize: 13,
    color: '#333',
    flex: 1,
  },

  // 帧统计
  frameStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  frameStat: {
    alignItems: 'center',
  },
  frameStatValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  frameStatLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },

  // 操作按钮
  operationRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  operationBtn: {
    flex: 1,
    borderRadius: 8,
  },

  // 错误提示
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1F0',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#ff4d4f',
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#ff4d4f',
    marginLeft: 8,
  },

  // Modal
  modal: {
    backgroundColor: '#fff',
    padding: 32,
    margin: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalText: {
    marginTop: 16,
    fontSize: 14,
    color: '#666',
  },
});

export default WorkstationMonitorScreen;
