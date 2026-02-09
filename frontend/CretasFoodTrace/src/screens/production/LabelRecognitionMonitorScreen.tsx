/**
 * LabelRecognitionMonitorScreen - 标签自动识别监控界面
 *
 * 功能：
 * - 实时显示识别配置和状态
 * - WebSocket 接收实时识别结果
 * - 手动触发识别
 * - 配置管理（添加/编辑/删除）
 * - 今日统计数据展示
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import {
  Text,
  Button,
  TextInput,
  Switch,
  Portal,
  Modal,
  Divider,
  Chip,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FAManagementStackParamList } from '../../types/navigation';

// API and WebSocket
import {
  LabelRecognitionConfig,
  LabelRecognitionRecord,
  LabelRecognitionStatistics,
  CreateConfigRequest,
  getConfigs,
  createConfig,
  updateConfig,
  deleteConfig,
  toggleConfig,
  triggerRecognition,
  getRecords,
  getStatistics,
  getStatusName,
  getStatusColor,
  getTriggerTypeName,
  formatConfidence,
  formatProcessingTime,
} from '../../services/api/labelRecognitionApiClient';
import { getIsapiDevices, IsapiDevice } from '../../services/api/isapiApiClient';
import { webSocketService, WebSocketMessage } from '../../services/WebSocketService';
import { useAuthStore } from '../../store/authStore';
import { theme } from '../../theme';

// ========== 类型定义 ==========

type NavigationProp = NativeStackNavigationProp<FAManagementStackParamList>;

// ========== 常量 ==========

const MAX_RECENT_RECORDS = 10;

// ========== 组件 ==========

export function LabelRecognitionMonitorScreen() {
  const navigation = useNavigation<NavigationProp>();
  const factoryId = useAuthStore((state) => state.getFactoryId());

  // 数据状态
  const [configs, setConfigs] = useState<LabelRecognitionConfig[]>([]);
  const [recentRecords, setRecentRecords] = useState<LabelRecognitionRecord[]>([]);
  const [statistics, setStatistics] = useState<LabelRecognitionStatistics | null>(null);
  const [availableCameras, setAvailableCameras] = useState<IsapiDevice[]>([]);

  // UI 状态
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [triggeringId, setTriggeringId] = useState<number | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<LabelRecognitionConfig | null>(null);

  // 配置表单状态
  const [formDeviceId, setFormDeviceId] = useState('');
  const [formConfigName, setFormConfigName] = useState('');
  const [formTriggerOnVmd, setFormTriggerOnVmd] = useState(true);
  const [formTriggerOnFieldDetection, setFormTriggerOnFieldDetection] = useState(false);
  const [formCooldownSeconds, setFormCooldownSeconds] = useState('3');
  const [formMinConfidence, setFormMinConfidence] = useState('0.7');
  const [formDefaultBatchId, setFormDefaultBatchId] = useState('');
  const [formSaving, setFormSaving] = useState(false);

  // WebSocket 连接状态
  const wsListenerRef = useRef<(() => void) | null>(null);

  // ========== 数据加载 ==========

  const loadData = useCallback(async () => {
    try {
      const [configsData, recordsData, statsData, camerasData] = await Promise.all([
        getConfigs(),
        getRecords(1, MAX_RECENT_RECORDS),
        getStatistics(),
        getIsapiDevices({ page: 1, size: 100 }),
      ]);

      setConfigs(configsData);
      setRecentRecords(recordsData.content);
      setStatistics(statsData);
      setAvailableCameras(camerasData.content.filter((d) => d.status === 'ONLINE'));
    } catch (error) {
      console.error('加载数据失败:', error);
      Alert.alert('加载失败', '无法获取识别配置数据');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // ========== WebSocket 监听 ==========

  useEffect(() => {
    // 连接 WebSocket
    const setupWebSocket = async () => {
      if (!factoryId) return;

      try {
        await webSocketService.connect();
        webSocketService.subscribeToFactory(factoryId);

        // 监听标签识别结果
        wsListenerRef.current = webSocketService.on('equipmentUpdate', (data: unknown) => {
          const message = data as WebSocketMessage & { subType?: string };
          if (message.type === 'label_recognition' || message.subType === 'label_recognition') {
            const record = message.data as LabelRecognitionRecord;
            if (record) {
              // 添加到最近记录列表头部
              setRecentRecords((prev) => {
                const newRecords = [record, ...prev].slice(0, MAX_RECENT_RECORDS);
                return newRecords;
              });

              // 更新统计数据
              setStatistics((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  todayTotal: prev.todayTotal + 1,
                  todaySuccess: record.status === 'SUCCESS' ? prev.todaySuccess + 1 : prev.todaySuccess,
                  todayFailed: record.status !== 'SUCCESS' ? prev.todayFailed + 1 : prev.todayFailed,
                  successRate: (prev.todaySuccess + (record.status === 'SUCCESS' ? 1 : 0)) / (prev.todayTotal + 1),
                };
              });
            }
          }
        });
      } catch (error) {
        console.error('WebSocket 连接失败:', error);
      }
    };

    setupWebSocket();

    return () => {
      if (wsListenerRef.current) {
        wsListenerRef.current();
        wsListenerRef.current = null;
      }
    };
  }, [factoryId]);

  // 初始加载
  useEffect(() => {
    loadData();
  }, [loadData]);

  // ========== 操作处理 ==========

  const handleToggleConfig = async (config: LabelRecognitionConfig) => {
    try {
      const updated = await toggleConfig(config.id);
      setConfigs((prev) =>
        prev.map((c) => (c.id === config.id ? updated : c))
      );
    } catch (error) {
      console.error('切换配置状态失败:', error);
      Alert.alert('操作失败', '无法切换配置状态');
    }
  };

  const handleTriggerRecognition = async (configId: number) => {
    setTriggeringId(configId);
    try {
      const record = await triggerRecognition(configId);
      // 添加到最近记录
      setRecentRecords((prev) => [record, ...prev].slice(0, MAX_RECENT_RECORDS));

      const statusText = getStatusName(record.status);
      Alert.alert('识别完成', `状态: ${statusText}\n批次号: ${record.recognizedBatchNumber || '未识别'}`);
    } catch (error) {
      console.error('触发识别失败:', error);
      Alert.alert('识别失败', '请检查摄像头连接状态');
    } finally {
      setTriggeringId(null);
    }
  };

  const handleDeleteConfig = (config: LabelRecognitionConfig) => {
    Alert.alert(
      '删除配置',
      `确定要删除 "${config.configName}" 吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteConfig(config.id);
              setConfigs((prev) => prev.filter((c) => c.id !== config.id));
            } catch (error) {
              console.error('删除配置失败:', error);
              Alert.alert('删除失败', '无法删除配置');
            }
          },
        },
      ]
    );
  };

  // ========== 配置表单 ==========

  const openAddConfigModal = () => {
    setEditingConfig(null);
    setFormDeviceId('');
    setFormConfigName('');
    setFormTriggerOnVmd(true);
    setFormTriggerOnFieldDetection(false);
    setFormCooldownSeconds('3');
    setFormMinConfidence('0.7');
    setFormDefaultBatchId('');
    setShowConfigModal(true);
  };

  const openEditConfigModal = (config: LabelRecognitionConfig) => {
    setEditingConfig(config);
    setFormDeviceId(config.deviceId);
    setFormConfigName(config.configName);
    setFormTriggerOnVmd(config.triggerOnVmd);
    setFormTriggerOnFieldDetection(config.triggerOnFieldDetection);
    setFormCooldownSeconds(String(config.cooldownSeconds));
    setFormMinConfidence(String(config.minConfidence));
    setFormDefaultBatchId(config.defaultBatchId || '');
    setShowConfigModal(true);
  };

  const handleSaveConfig = async () => {
    if (!formConfigName.trim()) {
      Alert.alert('提示', '请输入配置名称');
      return;
    }
    if (!formDeviceId && !editingConfig) {
      Alert.alert('提示', '请选择摄像头');
      return;
    }

    setFormSaving(true);
    try {
      if (editingConfig) {
        // 更新配置
        const updated = await updateConfig(editingConfig.id, {
          configName: formConfigName.trim(),
          triggerOnVmd: formTriggerOnVmd,
          triggerOnFieldDetection: formTriggerOnFieldDetection,
          cooldownSeconds: parseInt(formCooldownSeconds, 10) || 3,
          minConfidence: parseFloat(formMinConfidence) || 0.7,
          defaultBatchId: formDefaultBatchId.trim() || undefined,
        });
        setConfigs((prev) =>
          prev.map((c) => (c.id === editingConfig.id ? updated : c))
        );
      } else {
        // 创建新配置
        const newConfig: CreateConfigRequest = {
          deviceId: formDeviceId,
          configName: formConfigName.trim(),
          triggerOnVmd: formTriggerOnVmd,
          triggerOnFieldDetection: formTriggerOnFieldDetection,
          cooldownSeconds: parseInt(formCooldownSeconds, 10) || 3,
          minConfidence: parseFloat(formMinConfidence) || 0.7,
          defaultBatchId: formDefaultBatchId.trim() || undefined,
        };
        const created = await createConfig(newConfig);
        setConfigs((prev) => [...prev, created]);
      }

      setShowConfigModal(false);
    } catch (error) {
      console.error('保存配置失败:', error);
      Alert.alert('保存失败', '无法保存配置');
    } finally {
      setFormSaving(false);
    }
  };

  // ========== 渲染组件 ==========

  const renderStatistics = () => {
    if (!statistics) return null;

    return (
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{statistics.todayTotal}</Text>
          <Text style={styles.statLabel}>今日识别</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: theme.colors.success }]}>
            {Math.round(statistics.successRate * 100)}%
          </Text>
          <Text style={styles.statLabel}>成功率</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: theme.colors.error }]}>
            {statistics.todayFailed}
          </Text>
          <Text style={styles.statLabel}>异常</Text>
        </View>
      </View>
    );
  };

  const renderConfigItem = (config: LabelRecognitionConfig) => {
    const isTriggering = triggeringId === config.id;

    return (
      <View key={config.id} style={styles.configCard}>
        <View style={styles.configHeader}>
          <View style={styles.configTitleRow}>
            <MaterialCommunityIcons
              name="camera"
              size={20}
              color={config.enabled ? theme.colors.primary : '#9CA3AF'}
            />
            <Text style={styles.configName}>{config.configName}</Text>
            <Chip
              mode="flat"
              style={[
                styles.statusChip,
                { backgroundColor: config.enabled ? '#F6FFED' : '#f5f5f5' },
              ]}
              textStyle={{
                fontSize: 11,
                color: config.enabled ? '#52c41a' : '#9CA3AF',
              }}
            >
              {config.enabled ? '运行中' : '已停用'}
            </Chip>
          </View>
          <Switch
            value={config.enabled}
            onValueChange={() => handleToggleConfig(config)}
            color={theme.colors.primary}
          />
        </View>

        <View style={styles.configInfo}>
          <Text style={styles.configInfoText}>
            触发: {config.triggerOnVmd ? 'VMD' : ''}{config.triggerOnVmd && config.triggerOnFieldDetection ? '/' : ''}{config.triggerOnFieldDetection ? '区域检测' : ''}
            {!config.triggerOnVmd && !config.triggerOnFieldDetection ? '手动' : ''}
          </Text>
          {config.defaultBatchId && (
            <Text style={styles.configInfoText}>
              批次: {config.defaultBatchId.slice(0, 12)}...
            </Text>
          )}
          {config.lastTriggerTime && (
            <Text style={styles.configInfoText}>
              上次: {new Date(config.lastTriggerTime).toLocaleTimeString('zh-CN')}
            </Text>
          )}
        </View>

        <Divider style={styles.divider} />

        <View style={styles.configActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleTriggerRecognition(config.id)}
            disabled={isTriggering || !config.enabled}
          >
            {isTriggering ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <MaterialCommunityIcons
                name="play-circle"
                size={20}
                color={config.enabled ? theme.colors.primary : '#D1D5DB'}
              />
            )}
            <Text
              style={[
                styles.actionBtnText,
                !config.enabled && { color: '#D1D5DB' },
              ]}
            >
              手动触发
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => openEditConfigModal(config)}
          >
            <MaterialCommunityIcons name="cog" size={20} color="#6B7280" />
            <Text style={styles.actionBtnText}>配置</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleDeleteConfig(config)}
          >
            <MaterialCommunityIcons name="delete" size={20} color="#ff4d4f" />
            <Text style={[styles.actionBtnText, { color: '#ff4d4f' }]}>删除</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderRecordItem = ({ item }: { item: LabelRecognitionRecord }) => {
    const time = new Date(item.recognitionTime).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    return (
      <View style={styles.recordItem}>
        <View style={[styles.recordDot, { backgroundColor: getStatusColor(item.status) }]} />
        <View style={styles.recordContent}>
          <View style={styles.recordMain}>
            <Text style={styles.recordTime}>{time}</Text>
            <Chip
              mode="flat"
              style={[
                styles.recordStatusChip,
                { backgroundColor: `${getStatusColor(item.status)}15` },
              ]}
              textStyle={{ fontSize: 10, color: getStatusColor(item.status) }}
            >
              {getStatusName(item.status)}
            </Chip>
          </View>
          <Text style={styles.recordDetail} numberOfLines={1}>
            {item.recognizedBatchNumber
              ? `批次: ${item.recognizedBatchNumber}`
              : item.errorMessage || getTriggerTypeName(item.triggerType)}
            {item.confidence !== undefined && ` | ${formatConfidence(item.confidence)}`}
          </Text>
        </View>
        <MaterialCommunityIcons
          name={item.status === 'SUCCESS' ? 'check-circle' : 'alert-circle'}
          size={20}
          color={getStatusColor(item.status)}
        />
      </View>
    );
  };

  const renderConfigModal = () => (
    <Portal>
      <Modal
        visible={showConfigModal}
        onDismiss={() => setShowConfigModal(false)}
        contentContainerStyle={styles.modal}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.modalTitle}>
            {editingConfig ? '编辑配置' : '添加识别配置'}
          </Text>

          {/* 配置名称 */}
          <Text style={styles.inputLabel}>配置名称 *</Text>
          <TextInput
            style={styles.input}
            mode="outlined"
            placeholder="例如: 包装线1号"
            value={formConfigName}
            onChangeText={setFormConfigName}
            outlineColor={theme.colors.border}
            activeOutlineColor={theme.colors.primary}
          />

          {/* 摄像头选择（仅新建时） */}
          {!editingConfig && (
            <>
              <Text style={styles.inputLabel}>选择摄像头 *</Text>
              {availableCameras.length === 0 ? (
                <View style={styles.emptyBox}>
                  <MaterialCommunityIcons name="camera-off" size={24} color="#9CA3AF" />
                  <Text style={styles.emptyText}>暂无可用摄像头</Text>
                </View>
              ) : (
                <View style={styles.cameraList}>
                  {availableCameras.map((camera) => (
                    <TouchableOpacity
                      key={camera.id}
                      style={[
                        styles.cameraItem,
                        formDeviceId === camera.id && styles.cameraItemSelected,
                      ]}
                      onPress={() => setFormDeviceId(camera.id)}
                    >
                      <MaterialCommunityIcons
                        name="video"
                        size={20}
                        color={formDeviceId === camera.id ? theme.colors.primary : '#6B7280'}
                      />
                      <Text
                        style={[
                          styles.cameraName,
                          formDeviceId === camera.id && styles.cameraNameSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {camera.deviceName}
                      </Text>
                      {formDeviceId === camera.id && (
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={18}
                          color={theme.colors.primary}
                        />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}

          {/* 触发方式 */}
          <Text style={styles.inputLabel}>触发方式</Text>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>移动侦测 (VMD)</Text>
            <Switch
              value={formTriggerOnVmd}
              onValueChange={setFormTriggerOnVmd}
              color={theme.colors.primary}
            />
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>区域入侵检测</Text>
            <Switch
              value={formTriggerOnFieldDetection}
              onValueChange={setFormTriggerOnFieldDetection}
              color={theme.colors.primary}
            />
          </View>

          {/* 冷却时间 */}
          <Text style={styles.inputLabel}>冷却时间（秒）</Text>
          <TextInput
            style={styles.input}
            mode="outlined"
            placeholder="3"
            value={formCooldownSeconds}
            onChangeText={setFormCooldownSeconds}
            keyboardType="number-pad"
            outlineColor={theme.colors.border}
            activeOutlineColor={theme.colors.primary}
          />

          {/* 最低置信度 */}
          <Text style={styles.inputLabel}>最低置信度阈值</Text>
          <TextInput
            style={styles.input}
            mode="outlined"
            placeholder="0.7"
            value={formMinConfidence}
            onChangeText={setFormMinConfidence}
            keyboardType="decimal-pad"
            outlineColor={theme.colors.border}
            activeOutlineColor={theme.colors.primary}
          />

          {/* 默认批次 */}
          <Text style={styles.inputLabel}>默认关联批次（选填）</Text>
          <TextInput
            style={styles.input}
            mode="outlined"
            placeholder="输入或扫描批次号"
            value={formDefaultBatchId}
            onChangeText={setFormDefaultBatchId}
            outlineColor={theme.colors.border}
            activeOutlineColor={theme.colors.primary}
          />

          {/* 按钮 */}
          <View style={styles.modalButtons}>
            <Button
              mode="outlined"
              onPress={() => setShowConfigModal(false)}
              style={styles.modalBtn}
              labelStyle={{ color: '#666' }}
            >
              取消
            </Button>
            <Button
              mode="contained"
              onPress={handleSaveConfig}
              style={styles.modalBtn}
              labelStyle={{ color: '#fff' }}
              loading={formSaving}
              disabled={formSaving}
            >
              {editingConfig ? '保存' : '添加'}
            </Button>
          </View>
        </ScrollView>
      </Modal>
    </Portal>
  );

  // ========== 主渲染 ==========

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top']}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>加载中...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>标签自动识别监控</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={openAddConfigModal}>
          <MaterialCommunityIcons name="plus" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
          />
        }
      >
        {/* 统计数据 */}
        {renderStatistics()}

        {/* 识别配置 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>识别配置</Text>
          {configs.length === 0 ? (
            <View style={styles.emptySection}>
              <MaterialCommunityIcons name="camera-off-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>暂无识别配置</Text>
              <Button mode="text" onPress={openAddConfigModal}>
                添加配置
              </Button>
            </View>
          ) : (
            configs.map(renderConfigItem)
          )}
        </View>

        {/* 实时识别结果 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>实时识别结果</Text>
          {recentRecords.length === 0 ? (
            <View style={styles.emptySection}>
              <MaterialCommunityIcons name="text-box-check-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>暂无识别记录</Text>
            </View>
          ) : (
            <FlatList
              data={recentRecords}
              renderItem={renderRecordItem}
              keyExtractor={(item) => String(item.id)}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={styles.recordSeparator} />}
            />
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* 添加配置按钮 */}
      <TouchableOpacity style={styles.fab} onPress={openAddConfigModal}>
        <MaterialCommunityIcons name="plus" size={28} color="#fff" />
      </TouchableOpacity>

      {/* 配置Modal */}
      {renderConfigModal()}
    </SafeAreaView>
  );
}

// ========== 样式 ==========

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    color: '#6B7280',
  },

  // Header
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
  addButton: {
    padding: 4,
  },

  content: {
    flex: 1,
  },

  // Stats
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },

  // Section
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
  emptySection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    marginTop: 8,
    color: '#9CA3AF',
    fontSize: 14,
  },

  // Config Card
  configCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  configHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  configTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  configName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  statusChip: {
    height: 24,
  },
  configInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  configInfoText: {
    fontSize: 12,
    color: '#6B7280',
  },
  divider: {
    marginVertical: 12,
  },
  configActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 8,
  },
  actionBtnText: {
    fontSize: 13,
    color: '#6B7280',
  },

  // Record Item
  recordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  recordDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  recordContent: {
    flex: 1,
  },
  recordMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordTime: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  recordStatusChip: {
    height: 20,
  },
  recordDetail: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  recordSeparator: {
    height: 1,
    backgroundColor: '#f0f0f0',
  },

  // FAB
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },

  // Modal
  modal: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#fff',
  },
  emptyBox: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
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
    gap: 8,
  },
  cameraItemSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: '#E6F7FF',
  },
  cameraName: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  cameraNameSelected: {
    color: theme.colors.primary,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  switchLabel: {
    fontSize: 14,
    color: '#333',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalBtn: {
    flex: 1,
    borderRadius: 8,
  },
});

export default LabelRecognitionMonitorScreen;
