/**
 * 人员调动页面
 *
 * 功能:
 * - 选择源车间和目标车间
 * - 选择调动时间范围
 * - 选择要调动的员工
 * - 填写调动原因
 * - 预览调动影响
 * - 提交调动申请
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { schedulingApiClient } from '../../../services/api/schedulingApiClient';

// 主题色
const DISPATCHER_THEME = {
  primary: '#722ed1',
  secondary: '#a18cd1',
  accent: '#fbc2eb',
  success: '#52c41a',
  warning: '#fa8c16',
  danger: '#ff4d4f',
  info: '#1890ff',
  background: '#f5f5f5',
  cardBackground: '#ffffff',
};

// 车间类型
interface Workshop {
  id: string;
  name: string;
  type: string;
  currentWorkers: number;
  maxCapacity: number;
  capacityPercent: number;
}

// 可调动员工
interface TransferableWorker {
  id: string;
  name: string;
  avatar: string;
  employeeCode: string;
  status: 'idle' | 'working';
  currentTask?: string;
  skill: string;
  efficiency: number;
  isTemporary?: boolean;
}

// 调动影响预览
interface TransferImpact {
  sourceWorkshop: {
    name: string;
    beforeWorkers: number;
    afterWorkers: number;
    beforeCapacity: number;
    afterCapacity: number;
  };
  targetWorkshop: {
    name: string;
    beforeWorkers: number;
    afterWorkers: number;
    beforeCapacity: number;
    afterCapacity: number;
  };
  warnings: string[];
}

/**
 * Transform API workshop data to local Workshop interface
 */
const transformWorkshop = (apiWorkshop: any): Workshop => ({
  id: apiWorkshop.id || apiWorkshop.workshopId || '',
  name: apiWorkshop.name || apiWorkshop.workshopName || '',
  type: apiWorkshop.type || apiWorkshop.workshopType || 'general',
  currentWorkers: apiWorkshop.currentWorkers || apiWorkshop.workerCount || 0,
  maxCapacity: apiWorkshop.maxCapacity || apiWorkshop.capacity || 10,
  capacityPercent: apiWorkshop.capacityPercent ||
    Math.round(((apiWorkshop.currentWorkers || 0) / (apiWorkshop.maxCapacity || 10)) * 100),
});

/**
 * Transform API worker data to local TransferableWorker interface
 */
const transformWorker = (apiWorker: any): TransferableWorker => ({
  id: apiWorker.id || apiWorker.workerId || apiWorker.userId || '',
  name: apiWorker.name || apiWorker.workerName || apiWorker.realName || '',
  avatar: (apiWorker.name || apiWorker.realName || '员').charAt(0),
  employeeCode: apiWorker.employeeCode || apiWorker.code || apiWorker.employeeId || '',
  status: (apiWorker.status || 'idle').toLowerCase() === 'working' ||
    (apiWorker.status || '').toLowerCase() === 'busy' ? 'working' : 'idle',
  currentTask: apiWorker.currentTask || apiWorker.currentBatchNumber || undefined,
  skill: apiWorker.skill || apiWorker.skillName || apiWorker.primarySkill || '',
  efficiency: apiWorker.efficiency || apiWorker.efficiencyRate || 85,
  isTemporary: apiWorker.isTemporary || apiWorker.employeeType === 'temporary' || false,
});

const transferReasonKeys = [
  'urgentStaffing',
  'skillMatching',
  'crossWorkshopSupport',
  'regularRotation',
  'trainingLearning',
  'other',
];

export default function PersonnelTransferScreen() {
  const { t } = useTranslation('dispatcher');
  const navigation = useNavigation();

  // Loading and data states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [workers, setWorkers] = useState<TransferableWorker[]>([]);

  // 表单状态
  const [sourceWorkshop, setSourceWorkshop] = useState<Workshop | null>(null);
  const [targetWorkshop, setTargetWorkshop] = useState<Workshop | null>(null);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('18:00');
  const [selectedWorkers, setSelectedWorkers] = useState<Set<string>>(new Set());
  const [transferReasonKey, setTransferReasonKey] = useState('');
  const [customReason, setCustomReason] = useState('');

  // 下拉选择状态
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const [showTargetDropdown, setShowTargetDropdown] = useState(false);
  const [showReasonDropdown, setShowReasonDropdown] = useState(false);

  /**
   * Load workshops and available workers from API
   */
  const loadData = useCallback(async () => {
    try {
      // Load workshops
      const workshopResponse = await schedulingApiClient.getWorkshopList();
      if (workshopResponse.success && workshopResponse.data) {
        // Type assertion to handle both array and object response formats
        const responseData = workshopResponse.data as unknown;
        let workshopList: unknown[];
        if (Array.isArray(responseData)) {
          workshopList = responseData;
        } else {
          const wrappedData = responseData as Record<string, unknown>;
          workshopList = (wrappedData.workshops || wrappedData.content || []) as unknown[];
        }
        setWorkshops(workshopList.map(transformWorkshop));
      }

      // Load available workers
      const workersResponse = await schedulingApiClient.getAvailableWorkers();
      if (workersResponse.success && workersResponse.data) {
        // Type assertion to handle both array and object response formats
        const responseData = workersResponse.data as unknown;
        let workerList: unknown[];
        if (Array.isArray(responseData)) {
          workerList = responseData;
        } else {
          const wrappedData = responseData as Record<string, unknown>;
          workerList = (wrappedData.workers || wrappedData.content || []) as unknown[];
        }
        setWorkers(workerList.map(transformWorker));
      }
    } catch (error) {
      if (isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 401) {
          Alert.alert(t('common.error'), t('common.sessionExpired'));
          navigation.goBack();
          return;
        }
        console.error('Failed to load transfer data:', error.response?.data?.message || error.message);
      } else {
        console.error('Unexpected error loading transfer data:', error);
      }
    } finally {
      setLoading(false);
    }
  }, [navigation, t]);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 下拉刷新
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // 切换员工选择
  const toggleWorkerSelection = (workerId: string) => {
    const newSelection = new Set(selectedWorkers);
    if (newSelection.has(workerId)) {
      newSelection.delete(workerId);
    } else {
      newSelection.add(workerId);
    }
    setSelectedWorkers(newSelection);
  };

  // 计算调动影响
  const calculateImpact = (): TransferImpact | null => {
    if (!sourceWorkshop || !targetWorkshop || selectedWorkers.size === 0) {
      return null;
    }

    const transferCount = selectedWorkers.size;

    const sourceAfterWorkers = sourceWorkshop.currentWorkers - transferCount;
    const targetAfterWorkers = targetWorkshop.currentWorkers + transferCount;

    const sourceAfterCapacity = Math.round((sourceAfterWorkers / sourceWorkshop.maxCapacity) * 100);
    const targetAfterCapacity = Math.round((targetAfterWorkers / targetWorkshop.maxCapacity) * 100);

    const warnings: string[] = [];
    if (sourceAfterCapacity < 50) {
      warnings.push(t('personnelTransferScreen.warnings.lowUtilization', { workshop: sourceWorkshop.name }));
    }
    if (targetAfterCapacity > 90) {
      warnings.push(t('personnelTransferScreen.warnings.nearCapacity', { workshop: targetWorkshop.name }));
    }

    return {
      sourceWorkshop: {
        name: sourceWorkshop.name,
        beforeWorkers: sourceWorkshop.currentWorkers,
        afterWorkers: sourceAfterWorkers,
        beforeCapacity: sourceWorkshop.capacityPercent,
        afterCapacity: sourceAfterCapacity,
      },
      targetWorkshop: {
        name: targetWorkshop.name,
        beforeWorkers: targetWorkshop.currentWorkers,
        afterWorkers: targetAfterWorkers,
        beforeCapacity: targetWorkshop.capacityPercent,
        afterCapacity: targetAfterCapacity,
      },
      warnings,
    };
  };

  // 提交调动申请
  const handleSubmitTransfer = () => {
    if (!sourceWorkshop) {
      Alert.alert(t('common.info'), t('personnelTransferScreen.validation.selectSourceWorkshop'));
      return;
    }
    if (!targetWorkshop) {
      Alert.alert(t('common.info'), t('personnelTransferScreen.validation.selectTargetWorkshop'));
      return;
    }
    if (sourceWorkshop.id === targetWorkshop.id) {
      Alert.alert(t('common.info'), t('personnelTransferScreen.validation.sameWorkshop'));
      return;
    }
    if (selectedWorkers.size === 0) {
      Alert.alert(t('common.info'), t('personnelTransferScreen.validation.selectWorkers'));
      return;
    }
    if (!transferReasonKey) {
      Alert.alert(t('common.info'), t('personnelTransferScreen.validation.selectReason'));
      return;
    }
    if (transferReasonKey === 'other' && !customReason.trim()) {
      Alert.alert(t('common.info'), t('personnelTransferScreen.validation.enterCustomReason'));
      return;
    }

    Alert.alert(
      t('personnelTransferScreen.confirmTransfer'),
      t('personnelTransferScreen.confirmTransferMessage', {
        count: selectedWorkers.size,
        source: sourceWorkshop.name,
        target: targetWorkshop.name
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          onPress: () => {
            Alert.alert(t('common.success'), t('personnelTransferScreen.submitSuccess'));
            navigation.goBack();
          },
        },
      ]
    );
  };

  const impact = calculateImpact();

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <LinearGradient
          colors={[DISPATCHER_THEME.primary, DISPATCHER_THEME.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.header}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('personnelTransferScreen.title')}</Text>
          <View style={styles.headerRight} />
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={DISPATCHER_THEME.primary} />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // 渲染下拉选项
  const renderWorkshopDropdown = (
    workshops: Workshop[],
    onSelect: (workshop: Workshop) => void,
    onClose: () => void,
    excludeId?: string
  ) => (
    <View style={styles.dropdown}>
      {workshops.filter(w => w.id !== excludeId).map((workshop) => (
        <TouchableOpacity
          key={workshop.id}
          style={styles.dropdownItem}
          onPress={() => {
            onSelect(workshop);
            onClose();
          }}
        >
          <Text style={styles.dropdownItemText}>{workshop.name}</Text>
          <Text style={styles.dropdownItemSubtext}>
            {workshop.currentWorkers}/{workshop.maxCapacity}人 · {workshop.capacityPercent}%
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 顶部渐变标题栏 */}
      <LinearGradient
        colors={[DISPATCHER_THEME.primary, DISPATCHER_THEME.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('personnelTransferScreen.title')}</Text>
        <View style={styles.headerRight} />
      </LinearGradient>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[DISPATCHER_THEME.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* 调动配置区 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('personnelTransferScreen.transferConfig')}</Text>

          {/* 源车间选择 */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>{t('personnelTransferScreen.sourceWorkshop')} *</Text>
            <TouchableOpacity
              style={styles.selectInput}
              onPress={() => {
                setShowSourceDropdown(!showSourceDropdown);
                setShowTargetDropdown(false);
                setShowReasonDropdown(false);
              }}
            >
              <Text style={[
                styles.selectInputText,
                !sourceWorkshop && styles.selectPlaceholder
              ]}>
                {sourceWorkshop ? sourceWorkshop.name : t('personnelTransferScreen.selectSourceWorkshop')}
              </Text>
              <Ionicons
                name={showSourceDropdown ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#999"
              />
            </TouchableOpacity>
            {showSourceDropdown && renderWorkshopDropdown(
              workshops,
              setSourceWorkshop,
              () => setShowSourceDropdown(false),
              targetWorkshop?.id
            )}
          </View>

          {/* 目标车间选择 */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>{t('personnelTransferScreen.targetWorkshop')} *</Text>
            <TouchableOpacity
              style={styles.selectInput}
              onPress={() => {
                setShowTargetDropdown(!showTargetDropdown);
                setShowSourceDropdown(false);
                setShowReasonDropdown(false);
              }}
            >
              <Text style={[
                styles.selectInputText,
                !targetWorkshop && styles.selectPlaceholder
              ]}>
                {targetWorkshop ? targetWorkshop.name : t('personnelTransferScreen.selectTargetWorkshop')}
              </Text>
              <Ionicons
                name={showTargetDropdown ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#999"
              />
            </TouchableOpacity>
            {showTargetDropdown && renderWorkshopDropdown(
              workshops,
              setTargetWorkshop,
              () => setShowTargetDropdown(false),
              sourceWorkshop?.id
            )}
          </View>

          {/* 时间范围 */}
          <View style={styles.timeRow}>
            <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.formLabel}>{t('personnelTransferScreen.startTime')}</Text>
              <View style={styles.timeInput}>
                <Ionicons name="time-outline" size={18} color="#999" />
                <TextInput
                  style={styles.timeInputText}
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="08:00"
                />
              </View>
            </View>
            <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.formLabel}>{t('personnelTransferScreen.endTime')}</Text>
              <View style={styles.timeInput}>
                <Ionicons name="time-outline" size={18} color="#999" />
                <TextInput
                  style={styles.timeInputText}
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder="18:00"
                />
              </View>
            </View>
          </View>
        </View>

        {/* 员工选择区 */}
        {sourceWorkshop && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('personnelTransferScreen.selectWorkers')}</Text>
              <Text style={styles.selectionCount}>
                {t('personnelTransferScreen.selectedCount', { count: selectedWorkers.size })}
              </Text>
            </View>

            {workers.map((worker) => (
              <TouchableOpacity
                key={worker.id}
                style={[
                  styles.workerCard,
                  selectedWorkers.has(worker.id) && styles.workerCardSelected,
                  worker.isTemporary && styles.workerCardTemporary,
                ]}
                onPress={() => toggleWorkerSelection(worker.id)}
              >
                <View style={styles.checkboxContainer}>
                  <View style={[
                    styles.checkbox,
                    selectedWorkers.has(worker.id) && styles.checkboxChecked
                  ]}>
                    {selectedWorkers.has(worker.id) && (
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    )}
                  </View>
                </View>

                <LinearGradient
                  colors={worker.isTemporary
                    ? ['#fa8c16', '#ffc53d']
                    : [DISPATCHER_THEME.primary, DISPATCHER_THEME.secondary]}
                  style={styles.workerAvatar}
                >
                  <Text style={styles.workerAvatarText}>{worker.avatar}</Text>
                </LinearGradient>

                <View style={styles.workerInfo}>
                  <View style={styles.workerNameRow}>
                    <Text style={styles.workerName}>{worker.name}</Text>
                    <Text style={styles.workerCode}>({worker.employeeCode})</Text>
                    {worker.isTemporary && (
                      <View style={styles.tempBadge}>
                        <Text style={styles.tempBadgeText}>{t('personnelTransferScreen.temporary')}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.workerMeta}>
                    <Text style={styles.workerSkill}>{worker.skill}</Text>
                    <Text style={styles.workerEfficiency}>{t('personnelTransferScreen.efficiency')} {worker.efficiency}%</Text>
                  </View>
                  {worker.status === 'working' && worker.currentTask && (
                    <Text style={styles.workerTask}>
                      {t('personnelTransferScreen.currentTask')}: {worker.currentTask}
                    </Text>
                  )}
                </View>

                <View style={[
                  styles.workerStatus,
                  worker.status === 'idle' ? styles.statusIdle : styles.statusWorking
                ]}>
                  <Text style={[
                    styles.workerStatusText,
                    worker.status === 'idle' ? styles.statusIdleText : styles.statusWorkingText
                  ]}>
                    {worker.status === 'idle' ? t('personnelTransferScreen.status.idle') : t('personnelTransferScreen.status.working')}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* 调动原因 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('personnelTransferScreen.transferReason')} *</Text>

          <TouchableOpacity
            style={styles.selectInput}
            onPress={() => {
              setShowReasonDropdown(!showReasonDropdown);
              setShowSourceDropdown(false);
              setShowTargetDropdown(false);
            }}
          >
            <Text style={[
              styles.selectInputText,
              !transferReasonKey && styles.selectPlaceholder
            ]}>
              {transferReasonKey ? t(`personnelTransferScreen.reasons.${transferReasonKey}`) : t('personnelTransferScreen.selectReason')}
            </Text>
            <Ionicons
              name={showReasonDropdown ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#999"
            />
          </TouchableOpacity>

          {showReasonDropdown && (
            <View style={styles.dropdown}>
              {transferReasonKeys.map((reasonKey) => (
                <TouchableOpacity
                  key={reasonKey}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setTransferReasonKey(reasonKey);
                    setShowReasonDropdown(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{t(`personnelTransferScreen.reasons.${reasonKey}`)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {transferReasonKey === 'other' && (
            <TextInput
              style={styles.customReasonInput}
              placeholder={t('personnelTransferScreen.customReasonPlaceholder')}
              value={customReason}
              onChangeText={setCustomReason}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          )}
        </View>

        {/* 影响预览 */}
        {impact && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('personnelTransferScreen.impactPreview')}</Text>

            <View style={styles.impactRow}>
              {/* 源车间影响 */}
              <View style={[styles.impactCard, styles.impactSource]}>
                <Text style={styles.impactCardTitle}>
                  <Ionicons name="arrow-up-circle" size={16} color="#ff4d4f" /> {t('personnelTransferScreen.impact.source')}
                </Text>
                <Text style={styles.impactWorkshopName}>
                  {impact.sourceWorkshop.name}
                </Text>
                <View style={styles.impactMetric}>
                  <Text style={styles.impactLabel}>{t('personnelTransferScreen.impact.personnel')}</Text>
                  <Text style={styles.impactValue}>
                    {impact.sourceWorkshop.beforeWorkers} → {impact.sourceWorkshop.afterWorkers}
                  </Text>
                </View>
                <View style={styles.impactMetric}>
                  <Text style={styles.impactLabel}>{t('personnelTransferScreen.impact.utilization')}</Text>
                  <Text style={[
                    styles.impactValue,
                    impact.sourceWorkshop.afterCapacity < 50 && styles.impactWarning
                  ]}>
                    {impact.sourceWorkshop.beforeCapacity}% → {impact.sourceWorkshop.afterCapacity}%
                  </Text>
                </View>
              </View>

              {/* 箭头 */}
              <View style={styles.impactArrow}>
                <Ionicons name="arrow-forward" size={24} color={DISPATCHER_THEME.primary} />
              </View>

              {/* 目标车间影响 */}
              <View style={[styles.impactCard, styles.impactTarget]}>
                <Text style={styles.impactCardTitle}>
                  <Ionicons name="arrow-down-circle" size={16} color="#52c41a" /> {t('personnelTransferScreen.impact.target')}
                </Text>
                <Text style={styles.impactWorkshopName}>
                  {impact.targetWorkshop.name}
                </Text>
                <View style={styles.impactMetric}>
                  <Text style={styles.impactLabel}>{t('personnelTransferScreen.impact.personnel')}</Text>
                  <Text style={styles.impactValue}>
                    {impact.targetWorkshop.beforeWorkers} → {impact.targetWorkshop.afterWorkers}
                  </Text>
                </View>
                <View style={styles.impactMetric}>
                  <Text style={styles.impactLabel}>{t('personnelTransferScreen.impact.utilization')}</Text>
                  <Text style={[
                    styles.impactValue,
                    impact.targetWorkshop.afterCapacity > 90 && styles.impactWarning
                  ]}>
                    {impact.targetWorkshop.beforeCapacity}% → {impact.targetWorkshop.afterCapacity}%
                  </Text>
                </View>
              </View>
            </View>

            {/* 警告信息 */}
            {impact.warnings.length > 0 && (
              <View style={styles.warningsContainer}>
                {impact.warnings.map((warning, index) => (
                  <View key={index} style={styles.warningItem}>
                    <Ionicons name="warning" size={16} color="#fa8c16" />
                    <Text style={styles.warningText}>{warning}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* 底部间距 */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 底部提交按钮 */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!sourceWorkshop || !targetWorkshop || selectedWorkers.size === 0) &&
              styles.submitButtonDisabled
          ]}
          onPress={handleSubmitTransfer}
        >
          <LinearGradient
            colors={[DISPATCHER_THEME.primary, DISPATCHER_THEME.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.submitButtonGradient}
          >
            <Ionicons name="swap-horizontal" size={20} color="#fff" />
            <Text style={styles.submitButtonText}>{t('personnelTransferScreen.submitTransfer')}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DISPATCHER_THEME.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerRight: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  selectionCount: {
    fontSize: 14,
    color: DISPATCHER_THEME.primary,
    fontWeight: '500',
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  selectInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  selectInputText: {
    fontSize: 15,
    color: '#333',
  },
  selectPlaceholder: {
    color: '#999',
  },
  dropdown: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 100,
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#333',
  },
  dropdownItemSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  timeRow: {
    flexDirection: 'row',
  },
  timeInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  timeInputText: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    marginLeft: 8,
  },
  workerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  workerCardSelected: {
    borderColor: DISPATCHER_THEME.primary,
    backgroundColor: `${DISPATCHER_THEME.primary}08`,
  },
  workerCardTemporary: {
    backgroundColor: '#fffbe6',
  },
  checkboxContainer: {
    marginRight: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#d9d9d9',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    backgroundColor: DISPATCHER_THEME.primary,
    borderColor: DISPATCHER_THEME.primary,
  },
  workerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  workerAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  workerInfo: {
    flex: 1,
  },
  workerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  workerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  workerCode: {
    fontSize: 13,
    color: '#999',
    marginLeft: 4,
  },
  tempBadge: {
    backgroundColor: '#fa8c16',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  tempBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '500',
  },
  workerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  workerSkill: {
    fontSize: 12,
    color: '#666',
  },
  workerEfficiency: {
    fontSize: 12,
    color: '#52c41a',
    marginLeft: 12,
  },
  workerTask: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  workerStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusIdle: {
    backgroundColor: '#e6f7ff',
  },
  statusWorking: {
    backgroundColor: '#fff7e6',
  },
  workerStatusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusIdleText: {
    color: '#1890ff',
  },
  statusWorkingText: {
    color: '#fa8c16',
  },
  customReasonInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    marginTop: 12,
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  impactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  impactCard: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
  },
  impactSource: {
    backgroundColor: '#fff2f0',
    borderWidth: 1,
    borderColor: '#ffccc7',
  },
  impactTarget: {
    backgroundColor: '#f6ffed',
    borderWidth: 1,
    borderColor: '#b7eb8f',
  },
  impactArrow: {
    paddingHorizontal: 8,
  },
  impactCardTitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  impactWorkshopName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  impactMetric: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  impactLabel: {
    fontSize: 12,
    color: '#999',
  },
  impactValue: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
  },
  impactWarning: {
    color: '#fa8c16',
  },
  warningsContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fffbe6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffe58f',
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 12,
    color: '#fa8c16',
    marginLeft: 8,
    flex: 1,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 28,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    marginRight: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
  },
  submitButton: {
    flex: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
});
