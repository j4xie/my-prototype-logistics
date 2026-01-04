/**
 * 车间状态详情屏幕
 *
 * 功能:
 * - 车间筛选 (全部/切片/包装/冷冻/仓储)
 * - 车间卡片详情 (状态/负责人/任务/进度)
 * - 当前任务组显示
 * - 人员在岗网格 (含临时工标记)
 * - 设备状态列表
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { isAxiosError } from 'axios';
import { schedulingApiClient } from '../../../services/api/schedulingApiClient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

// 调度员主题色
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

// 类型定义
interface TaskGroup {
  id: string;
  name: string;
  workerCount: number;
  progress: number;
  isActive: boolean;
}

interface Worker {
  id: string;
  name: string;
  avatar: string;
  employeeCode: string;
  isTemporary?: boolean;
}

interface Equipment {
  id: string;
  name: string;
  status: 'running' | 'idle' | 'maintenance';
}

interface Workshop {
  id: string;
  name: string;
  type: 'slicing' | 'packaging' | 'freezing' | 'storage';
  status: 'running' | 'idle' | 'maintenance';
  supervisor: string;
  tasks: {
    completed: number;
    inProgress: number;
    pending: number;
  };
  progress: number;
  taskGroups: TaskGroup[];
  workers: Worker[];
  capacity: number;
  temporaryCount: number;
  equipment: Equipment[];
  warningMessage?: string;
  themeColors: [string, string];
}

type FilterType = 'all' | 'slicing' | 'packaging' | 'freezing' | 'storage';

/**
 * TODO: P2 Mock数据替换
 *
 * 建议使用的API:
 * - schedulingApiClient.getProductionLines() - 获取产线列表
 * - schedulingApiClient.getDashboard() - 获取调度仪表盘数据
 * - schedulingApiClient.getWorkerAssignments() - 获取工人分配
 * - equipmentApiClient.getEquipments() - 获取设备列表
 *
 * 数据转换建议:
 * - 将产线数据按车间(workshop)分组
 * - 从 getDashboard 获取任务进度统计
 * - 从 getWorkerAssignments 获取人员信息
 */

export default function WorkshopStatusScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation('dispatcher');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  // 加载车间状态数据
  const loadData = useCallback(async () => {
    try {
      // 获取产线列表并按车间分组
      const linesResponse = await schedulingApiClient.getProductionLines();
      if (linesResponse.success && linesResponse.data) {
        const lines = linesResponse.data;

        // 按车间分组产线
        const workshopMap = new Map<string, Workshop>();

        lines.forEach((line: any) => {
          const workshopId = line.workshopId || 'default';
          const workshopName = line.workshopName || '未分配车间';

          if (!workshopMap.has(workshopId)) {
            // 根据车间名称判断类型
            let workshopType: Workshop['type'] = 'storage';
            if (workshopName.includes('切片')) workshopType = 'slicing';
            else if (workshopName.includes('包装')) workshopType = 'packaging';
            else if (workshopName.includes('冷冻') || workshopName.includes('速冻')) workshopType = 'freezing';

            workshopMap.set(workshopId, {
              id: workshopId,
              name: workshopName,
              type: workshopType,
              status: 'idle',
              supervisor: '-',
              tasks: { completed: 0, inProgress: 0, pending: 0 },
              progress: 0,
              taskGroups: [],
              workers: [],
              capacity: 0,
              temporaryCount: 0,
              equipment: [],
              themeColors: workshopType === 'slicing' ? [DISPATCHER_THEME.primary, DISPATCHER_THEME.accent] :
                          workshopType === 'packaging' ? [DISPATCHER_THEME.success, '#95de64'] :
                          workshopType === 'freezing' ? [DISPATCHER_THEME.info, '#69c0ff'] :
                          ['#666', '#999'],
            });
          }

          const workshop = workshopMap.get(workshopId)!;
          // 更新车间状态（如果有运行中的产线，车间状态为running）
          if (line.status === 'active' || line.status === 'running') {
            workshop.status = 'running';
          } else if (line.status === 'maintenance' && workshop.status !== 'running') {
            workshop.status = 'maintenance';
          }
          workshop.capacity += line.capacity || 4;

          // 添加设备信息
          workshop.equipment.push({
            id: line.id || String(workshop.equipment.length + 1),
            name: line.name || `产线${workshop.equipment.length + 1}`,
            status: line.status === 'active' ? 'running' : line.status === 'maintenance' ? 'maintenance' : 'idle',
          });
        });

        setWorkshops(Array.from(workshopMap.values()));
      }
    } catch (error) {
      console.error('加载车间状态失败:', error);
      if (isAxiosError(error)) {
        if (error.response?.status === 401) {
          Alert.alert('登录已过期', '请重新登录');
        } else {
          Alert.alert('加载失败', error.response?.data?.message || '网络错误');
        }
      }
    }
  }, []);

  // 初始加载
  useEffect(() => {
    const initLoad = async () => {
      setLoading(true);
      await loadData();
      setLoading(false);
    };
    initLoad();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleGoBack = () => {
    navigation.goBack();
  };

  const filteredWorkshops = useMemo(() => {
    if (activeFilter === 'all') return workshops;
    return workshops.filter(w => w.type === activeFilter);
  }, [workshops, activeFilter]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return DISPATCHER_THEME.success;
      case 'idle': return '#999';
      case 'maintenance': return DISPATCHER_THEME.warning;
      default: return '#999';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'running': return t('workshop.status.statusLabels.running');
      case 'idle': return t('workshop.status.statusLabels.idle');
      case 'maintenance': return t('workshop.status.statusLabels.maintenance');
      default: return status;
    }
  };

  const renderFilters = () => {
    const filters: { key: FilterType; label: string }[] = [
      { key: 'all', label: t('workshop.status.filters.all') },
      { key: 'slicing', label: t('workshop.status.filters.slicing') },
      { key: 'packaging', label: t('workshop.status.filters.packaging') },
      { key: 'freezing', label: t('workshop.status.filters.freezing') },
      { key: 'storage', label: t('workshop.status.filters.storage') },
    ];

    return (
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {filters.map(filter => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterChip,
                activeFilter === filter.key && styles.filterChipActive,
              ]}
              onPress={() => setActiveFilter(filter.key)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeFilter === filter.key && styles.filterChipTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderTaskGroup = (group: TaskGroup) => (
    <View
      key={group.id}
      style={[
        styles.taskGroupCard,
        group.isActive ? styles.taskGroupActive : styles.taskGroupInactive,
      ]}
    >
      <View style={styles.taskGroupHeader}>
        <Text
          style={[
            styles.taskGroupName,
            { color: group.isActive ? DISPATCHER_THEME.info : '#666' },
          ]}
        >
          {group.name}
        </Text>
        <Text
          style={[
            styles.taskGroupProgress,
            { color: group.progress >= 60 ? DISPATCHER_THEME.success : DISPATCHER_THEME.info },
          ]}
        >
          {group.progress}%
        </Text>
      </View>
      <View style={styles.taskGroupBottom}>
        <Text style={styles.taskGroupWorkers}>{group.workerCount}人</Text>
        <View style={styles.progressBarSmall}>
          <View
            style={[
              styles.progressBarFillSmall,
              {
                width: `${group.progress}%`,
                backgroundColor: group.progress >= 60
                  ? DISPATCHER_THEME.success
                  : DISPATCHER_THEME.info,
              },
            ]}
          />
        </View>
      </View>
    </View>
  );

  const renderWorkerAvatar = (worker: Worker, themeColors: [string, string]) => (
    <View
      key={worker.id}
      style={[
        styles.workerAvatarContainer,
        worker.isTemporary && styles.workerAvatarTemporary,
      ]}
    >
      <LinearGradient
        colors={worker.isTemporary ? [DISPATCHER_THEME.warning, '#ffc069'] : themeColors}
        style={styles.workerAvatar}
      >
        <Text style={styles.workerAvatarText}>{worker.avatar}</Text>
      </LinearGradient>
      <Text style={styles.workerName}>{worker.name}</Text>
      <Text
        style={[
          styles.workerCode,
          worker.isTemporary && { color: DISPATCHER_THEME.warning },
        ]}
      >
        ({worker.employeeCode}){worker.isTemporary ? '*' : ''}
      </Text>
    </View>
  );

  const renderEmptySlot = (index: number) => (
    <View key={`empty-${index}`} style={styles.emptySlotContainer}>
      <View style={styles.emptySlotAvatar}>
        <Text style={styles.emptySlotIcon}>+</Text>
      </View>
      <Text style={styles.emptySlotText}>{t('workshop.status.emptySlot')}</Text>
      <Text style={styles.emptySlotCode}>--</Text>
    </View>
  );

  const renderEquipmentItem = (equipment: Equipment) => (
    <View key={equipment.id} style={styles.equipmentItem}>
      <View
        style={[
          styles.equipmentIndicator,
          { backgroundColor: getStatusColor(equipment.status) },
        ]}
      />
      <Text style={styles.equipmentName}>{equipment.name}</Text>
      <Text style={[styles.equipmentStatus, { color: getStatusColor(equipment.status) }]}>
        {getStatusText(equipment.status)}
      </Text>
    </View>
  );

  const renderWorkshopCard = (workshop: Workshop) => {
    const isRunning = workshop.status === 'running';
    const emptySlots = workshop.capacity - workshop.workers.length;
    const isUnderstaffed = emptySlots > 2;

    return (
      <View key={workshop.id} style={styles.workshopCard}>
        {/* 头部 */}
        <View style={styles.workshopHeader}>
          <View style={styles.workshopTitleRow}>
            <View
              style={[
                styles.statusIndicator,
                { backgroundColor: getStatusColor(workshop.status) },
              ]}
            />
            <Text style={styles.workshopName}>{workshop.name}</Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(workshop.status) + '20' },
            ]}
          >
            <Text style={[styles.statusBadgeText, { color: getStatusColor(workshop.status) }]}>
              {getStatusText(workshop.status)}
            </Text>
          </View>
        </View>

        {/* 负责人 */}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t('workshop.status.sections.supervisor')}</Text>
          <Text style={styles.infoValue}>{workshop.supervisor}</Text>
        </View>

        {/* 今日任务 */}
        {isRunning && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('workshop.status.sections.todayTasks')}</Text>
            <View style={styles.taskStats}>
              <Text style={styles.taskStatItem}>
                <Text style={{ color: DISPATCHER_THEME.success, fontWeight: '500' }}>
                  {workshop.tasks.completed}
                </Text>{' '}
                {t('workshop.status.taskStatus.completed')}
              </Text>
              <Text style={styles.taskStatItem}>
                <Text style={{ color: DISPATCHER_THEME.info, fontWeight: '500' }}>
                  {workshop.tasks.inProgress}
                </Text>{' '}
                {t('workshop.status.taskStatus.inProgress')}
              </Text>
              <Text style={styles.taskStatItem}>
                <Text style={{ color: '#999', fontWeight: '500' }}>
                  {workshop.tasks.pending}
                </Text>{' '}
                {t('workshop.status.taskStatus.pending')}
              </Text>
            </View>
          </View>
        )}

        {/* 任务进度 */}
        <View style={styles.section}>
          <View style={styles.progressHeader}>
            <Text style={styles.sectionLabel}>{t('workshop.status.sections.taskProgress')}</Text>
            <Text
              style={[
                styles.progressValue,
                {
                  color: workshop.progress > 0
                    ? workshop.progress >= 60
                      ? DISPATCHER_THEME.success
                      : DISPATCHER_THEME.primary
                    : '#999',
                },
              ]}
            >
              {workshop.progress}%
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${workshop.progress}%`,
                  backgroundColor:
                    workshop.progress >= 60
                      ? DISPATCHER_THEME.success
                      : workshop.progress > 0
                      ? DISPATCHER_THEME.primary
                      : '#e8e8e8',
                },
              ]}
            />
          </View>
        </View>

        {/* 当前任务组 */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('workshop.status.sections.currentTaskGroups')}</Text>
          {workshop.taskGroups.length > 0 ? (
            <View style={styles.taskGroupList}>
              {workshop.taskGroups.map(renderTaskGroup)}
            </View>
          ) : (
            <View style={styles.emptyTaskGroup}>
              <Text style={styles.emptyTaskText}>{t('workshop.status.noTasks')}</Text>
            </View>
          )}
        </View>

        {/* 人员在岗 */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            {t('workshop.status.sections.personnelOnDuty')} ({workshop.workers.length}人 / {t('workshop.status.personnel.capacity')}{workshop.capacity}人)
            {workshop.temporaryCount > 0 && (
              <Text style={{ color: DISPATCHER_THEME.warning, fontSize: 11 }}>
                {' '}{t('workshop.status.personnel.temporaryWorkers', { count: workshop.temporaryCount })}
              </Text>
            )}
            {isUnderstaffed && (
              <Text style={{ color: DISPATCHER_THEME.danger, fontSize: 11 }}> {t('workshop.status.personnel.understaffed')}</Text>
            )}
          </Text>
          <View style={styles.workersGrid}>
            {workshop.workers.map(worker =>
              renderWorkerAvatar(worker, workshop.themeColors)
            )}
            {Array.from({ length: Math.min(emptySlots, 4) }).map((_, i) =>
              renderEmptySlot(i)
            )}
          </View>
          {workshop.temporaryCount > 0 && (
            <Text style={styles.tempNote}>{t('workshop.status.personnel.temporaryMark')}</Text>
          )}
        </View>

        {/* 设备状态 */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('workshop.status.sections.equipmentStatus')}</Text>
          <View style={styles.equipmentList}>
            {workshop.equipment.map(renderEquipmentItem)}
          </View>
        </View>

        {/* 警告信息 */}
        {workshop.warningMessage && (
          <View style={styles.warningBox}>
            <Ionicons name="warning-outline" size={16} color={DISPATCHER_THEME.warning} />
            <Text style={styles.warningText}>{workshop.warningMessage}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 头部 */}
      <LinearGradient
        colors={[DISPATCHER_THEME.primary, DISPATCHER_THEME.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('workshop.status.title')}</Text>
        <View style={styles.placeholder} />
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* 筛选器 */}
        {renderFilters()}

        {/* 车间列表 */}
        <View style={styles.workshopList}>
          {filteredWorkshops.map(renderWorkshopCard)}
        </View>
      </ScrollView>
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
    paddingVertical: 16,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  placeholder: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  filterContainer: {
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterChipActive: {
    backgroundColor: DISPATCHER_THEME.primary,
    borderColor: DISPATCHER_THEME.primary,
  },
  filterChipText: {
    fontSize: 13,
    color: '#666',
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  workshopList: {
    gap: 16,
  },
  workshopCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  workshopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  workshopTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  workshopName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 13,
    color: '#999',
  },
  infoValue: {
    fontSize: 13,
    color: '#333',
  },
  section: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
    marginTop: 12,
  },
  sectionLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  taskStats: {
    flexDirection: 'row',
    gap: 16,
  },
  taskStatItem: {
    fontSize: 13,
    color: '#666',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  taskGroupList: {
    gap: 8,
  },
  taskGroupCard: {
    borderRadius: 6,
    padding: 10,
  },
  taskGroupActive: {
    backgroundColor: '#f0f7ff',
  },
  taskGroupInactive: {
    backgroundColor: '#f6f6f6',
  },
  taskGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  taskGroupName: {
    fontSize: 13,
    fontWeight: '500',
  },
  taskGroupProgress: {
    fontSize: 12,
  },
  taskGroupBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  taskGroupWorkers: {
    fontSize: 12,
    color: '#666',
  },
  progressBarSmall: {
    flex: 1,
    height: 4,
    backgroundColor: '#e8e8e8',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFillSmall: {
    height: '100%',
    borderRadius: 2,
  },
  emptyTaskGroup: {
    backgroundColor: '#f6f6f6',
    borderRadius: 6,
    padding: 16,
    alignItems: 'center',
  },
  emptyTaskText: {
    fontSize: 13,
    color: '#999',
  },
  workersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  workerAvatarContainer: {
    width: '23%',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    padding: 6,
  },
  workerAvatarTemporary: {
    backgroundColor: '#fffbe6',
    borderWidth: 1,
    borderColor: '#ffe58f',
  },
  workerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  workerAvatarText: {
    fontSize: 12,
    color: '#fff',
  },
  workerName: {
    fontSize: 11,
    fontWeight: '500',
    color: '#333',
  },
  workerCode: {
    fontSize: 10,
    color: '#999',
  },
  emptySlotContainer: {
    width: '23%',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderStyle: 'dashed',
  },
  emptySlotAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptySlotIcon: {
    fontSize: 14,
    color: '#bfbfbf',
  },
  emptySlotText: {
    fontSize: 11,
    color: '#bfbfbf',
  },
  emptySlotCode: {
    fontSize: 10,
    color: '#bfbfbf',
  },
  tempNote: {
    fontSize: 10,
    color: '#999',
    marginTop: 6,
  },
  equipmentList: {
    gap: 6,
  },
  equipmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  equipmentIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  equipmentName: {
    fontSize: 13,
    color: '#333',
    flex: 1,
  },
  equipmentStatus: {
    fontSize: 12,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#fffbe6',
    borderRadius: 6,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#ffe58f',
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: DISPATCHER_THEME.warning,
    lineHeight: 18,
  },
});
