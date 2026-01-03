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

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
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

// Mock 数据
const mockWorkshops: Workshop[] = [
  {
    id: '1',
    name: '切片车间',
    type: 'slicing',
    status: 'running',
    supervisor: '张主任',
    tasks: { completed: 2, inProgress: 3, pending: 1 },
    progress: 75,
    taskGroups: [
      { id: '1', name: 'PB20241227001 带鱼段切片', workerCount: 6, progress: 75, isActive: true },
      { id: '2', name: 'PB20241227002 虾仁分拣', workerCount: 2, progress: 30, isActive: false },
    ],
    workers: [
      { id: '1', name: '三丰', avatar: '张', employeeCode: '001' },
      { id: '2', name: '四海', avatar: '李', employeeCode: '002' },
      { id: '3', name: '五行', avatar: '王', employeeCode: '003' },
      { id: '4', name: '六顺', avatar: '赵', employeeCode: '004' },
      { id: '5', name: '七星', avatar: '陈', employeeCode: '005' },
      { id: '6', name: '八方', avatar: '孙', employeeCode: '006' },
      { id: '7', name: '临一', avatar: '刘', employeeCode: '088', isTemporary: true },
      { id: '8', name: '临二', avatar: '周', employeeCode: '089', isTemporary: true },
    ],
    capacity: 10,
    temporaryCount: 2,
    equipment: [
      { id: '1', name: '切片机A', status: 'running' },
      { id: '2', name: '切片机B', status: 'running' },
      { id: '3', name: '清洗线', status: 'idle' },
    ],
    themeColors: [DISPATCHER_THEME.primary, DISPATCHER_THEME.accent],
  },
  {
    id: '2',
    name: '包装车间',
    type: 'packaging',
    status: 'running',
    supervisor: '李主任',
    tasks: { completed: 1, inProgress: 2, pending: 0 },
    progress: 60,
    taskGroups: [
      { id: '3', name: 'PB20241227003 虾仁包装', workerCount: 6, progress: 60, isActive: true },
    ],
    workers: [
      { id: '9', name: '九华', avatar: '马', employeeCode: '010' },
      { id: '10', name: '十全', avatar: '钱', employeeCode: '011' },
      { id: '11', name: '百川', avatar: '吴', employeeCode: '012' },
      { id: '12', name: '千里', avatar: '郑', employeeCode: '013' },
      { id: '13', name: '万年', avatar: '冯', employeeCode: '014' },
      { id: '14', name: '临三', avatar: '胡', employeeCode: '090', isTemporary: true },
    ],
    capacity: 8,
    temporaryCount: 1,
    equipment: [
      { id: '4', name: '封口机A', status: 'running' },
      { id: '5', name: '封口机B', status: 'running' },
    ],
    themeColors: [DISPATCHER_THEME.success, '#95de64'],
  },
  {
    id: '3',
    name: '冷冻车间',
    type: 'freezing',
    status: 'idle',
    supervisor: '王主任',
    tasks: { completed: 0, inProgress: 0, pending: 0 },
    progress: 0,
    taskGroups: [],
    workers: [
      { id: '15', name: '大山', avatar: '卫', employeeCode: '020' },
      { id: '16', name: '小河', avatar: '褚', employeeCode: '021' },
    ],
    capacity: 6,
    temporaryCount: 0,
    equipment: [
      { id: '6', name: '速冻机A', status: 'idle' },
      { id: '7', name: '速冻机B', status: 'maintenance' },
    ],
    warningMessage: '人员不足，建议调入4人以满足下一任务需求',
    themeColors: [DISPATCHER_THEME.info, '#69c0ff'],
  },
];

export default function WorkshopStatusScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation('dispatcher');
  const [refreshing, setRefreshing] = useState(false);
  const [workshops] = useState<Workshop[]>(mockWorkshops);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // TODO: 调用 API 刷新数据
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

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
