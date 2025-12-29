/**
 * 批次人员分配屏幕
 *
 * 功能:
 * - 批次基本信息展示
 * - 已分配员工列表
 * - 可用员工列表 (分组显示: 本车间/机动/可调动)
 * - 员工搜索 (工号/姓名)
 * - 多选分配功能
 * - 临时工特殊标记
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
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

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
interface BatchInfo {
  id: string;
  batchNumber: string;
  product: string;
  quantity: string;
  workshop: string;
  suggestedWorkers: string;
  estimatedHours: number;
  status: 'pending' | 'in_progress';
}

interface Worker {
  id: string;
  name: string;
  avatar: string;
  employeeCode: string;
  status: 'idle' | 'working' | 'available';
  efficiency: number;
  skill: string;
  skillLevel: number;
  weeklyHours: number;
  maxWeeklyHours: number;
  workshop?: string;
  currentTask?: string;
  isTemporary?: boolean;
  contractDaysLeft?: number;
  group: 'workshop_idle' | 'workshop_working' | 'mobile' | 'transferable';
}

// Mock 数据
const mockBatchInfo: BatchInfo = {
  id: '1',
  batchNumber: 'PB20241227002',
  product: '冷冻大虾仁',
  quantity: '200kg',
  workshop: '冷冻车间',
  suggestedWorkers: '4-6',
  estimatedHours: 6,
  status: 'pending',
};

const mockWorkers: Worker[] = [
  // 本车间空闲
  {
    id: '1',
    name: '王五行',
    avatar: '王',
    employeeCode: '003',
    status: 'idle',
    efficiency: 95,
    skill: '冷冻',
    skillLevel: 4,
    weeklyHours: 32,
    maxWeeklyHours: 40,
    group: 'workshop_idle',
  },
  {
    id: '2',
    name: '周大力',
    avatar: '周',
    employeeCode: '020',
    status: 'idle',
    efficiency: 92,
    skill: '冷冻',
    skillLevel: 3,
    weeklyHours: 28,
    maxWeeklyHours: 40,
    group: 'workshop_idle',
  },
  // 本车间工作中
  {
    id: '3',
    name: '吴小二',
    avatar: '吴',
    employeeCode: '021',
    status: 'working',
    efficiency: 85,
    skill: '冷冻',
    skillLevel: 2,
    weeklyHours: 36,
    maxWeeklyHours: 40,
    currentTask: 'PB20241227001',
    group: 'workshop_working',
  },
  {
    id: '4',
    name: '郑新手',
    avatar: '郑',
    employeeCode: '022',
    status: 'idle',
    efficiency: 78,
    skill: '通用',
    skillLevel: 1,
    weeklyHours: 20,
    maxWeeklyHours: 40,
    group: 'workshop_idle',
  },
  // 机动人员
  {
    id: '5',
    name: '钱多多',
    avatar: '钱',
    employeeCode: '050',
    status: 'idle',
    efficiency: 88,
    skill: '机动',
    skillLevel: 3,
    weeklyHours: 25,
    maxWeeklyHours: 40,
    group: 'mobile',
  },
  {
    id: '6',
    name: '孙小明',
    avatar: '孙',
    employeeCode: '051',
    status: 'idle',
    efficiency: 85,
    skill: '机动',
    skillLevel: 2,
    weeklyHours: 30,
    maxWeeklyHours: 40,
    group: 'mobile',
  },
  {
    id: '7',
    name: '赵六顺',
    avatar: '赵',
    employeeCode: '004',
    status: 'idle',
    efficiency: 90,
    skill: '机动',
    skillLevel: 4,
    weeklyHours: 22,
    maxWeeklyHours: 40,
    group: 'mobile',
  },
  {
    id: '8',
    name: '陈临时',
    avatar: '陈',
    employeeCode: '088',
    status: 'idle',
    efficiency: 80,
    skill: '机动',
    skillLevel: 2,
    weeklyHours: 35,
    maxWeeklyHours: 40,
    isTemporary: true,
    contractDaysLeft: 18,
    group: 'mobile',
  },
  // 可调动员工
  {
    id: '9',
    name: '张三丰',
    avatar: '张',
    employeeCode: '001',
    status: 'available',
    efficiency: 95,
    skill: '切片',
    skillLevel: 5,
    weeklyHours: 38,
    maxWeeklyHours: 40,
    workshop: '切片车间',
    group: 'transferable',
  },
  {
    id: '10',
    name: '李四海',
    avatar: '李',
    employeeCode: '002',
    status: 'available',
    efficiency: 91,
    skill: '包装',
    skillLevel: 4,
    weeklyHours: 35,
    maxWeeklyHours: 40,
    workshop: '包装车间',
    group: 'transferable',
  },
];

export default function BatchWorkersScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const [batchInfo] = useState<BatchInfo>(mockBatchInfo);
  const [workers] = useState<Worker[]>(mockWorkers);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>(['1', '2', '4', '5']);
  const [searchText, setSearchText] = useState('');
  const [showMoreTransferable, setShowMoreTransferable] = useState(false);

  const handleGoBack = () => {
    navigation.goBack();
  };

  const toggleWorkerSelection = (workerId: string, worker: Worker) => {
    if (worker.status === 'working') {
      Alert.alert('无法选择', '该员工正在执行其他任务');
      return;
    }

    setSelectedWorkerIds(prev => {
      if (prev.includes(workerId)) {
        return prev.filter(id => id !== workerId);
      } else {
        return [...prev, workerId];
      }
    });
  };

  const handleSelectAll = () => {
    const selectableIds = workers
      .filter(w => w.status !== 'working')
      .map(w => w.id);
    setSelectedWorkerIds(selectableIds);
  };

  const handleClearSelection = () => {
    setSelectedWorkerIds([]);
  };

  const handleConfirm = () => {
    const selectedCount = selectedWorkerIds.length;
    const parts = batchInfo.suggestedWorkers.split('-').map(Number);
    const min = parts[0] ?? 0;

    if (selectedCount < min) {
      Alert.alert(
        '人数不足',
        `AI建议至少 ${min} 人，当前只选择了 ${selectedCount} 人`,
        [
          { text: '继续选择', style: 'cancel' },
          { text: '强制确认', onPress: () => confirmAssignment() },
        ]
      );
    } else {
      confirmAssignment();
    }
  };

  const confirmAssignment = () => {
    Alert.alert(
      '分配成功',
      `已为批次 ${batchInfo.batchNumber} 分配 ${selectedWorkerIds.length} 名员工`,
      [{ text: '确定', onPress: () => navigation.goBack() }]
    );
  };

  // 过滤员工
  const filteredWorkers = useMemo(() => {
    if (!searchText.trim()) return workers;
    const search = searchText.toLowerCase().trim();
    return workers.filter(
      w =>
        w.name.toLowerCase().includes(search) ||
        w.employeeCode.toLowerCase().includes(search)
    );
  }, [workers, searchText]);

  // 分组员工
  const groupedWorkers = useMemo(() => {
    const groups = {
      workshop_idle: [] as Worker[],
      workshop_working: [] as Worker[],
      mobile: [] as Worker[],
      transferable: [] as Worker[],
    };

    filteredWorkers.forEach(worker => {
      const groupKey = worker.group as keyof typeof groups;
      if (groups[groupKey]) {
        groups[groupKey].push(worker);
      }
    });

    return groups;
  }, [filteredWorkers]);

  // 临时工数量
  const temporaryCount = useMemo(() => {
    return groupedWorkers.mobile.filter(w => w.isTemporary).length;
  }, [groupedWorkers]);

  const getMatchStatus = () => {
    const count = selectedWorkerIds.length;
    const parts = batchInfo.suggestedWorkers.split('-').map(Number);
    const min = parts[0] ?? 0;
    const max = parts[1] ?? min;

    if (count >= min && count <= max) {
      return { text: '人数匹配', color: DISPATCHER_THEME.success };
    } else if (count < min) {
      return { text: '人数不足', color: DISPATCHER_THEME.danger };
    } else {
      return { text: '人数超额', color: DISPATCHER_THEME.warning };
    }
  };

  const renderWorkerItem = (worker: Worker) => {
    const isSelected = selectedWorkerIds.includes(worker.id);
    const isWorking = worker.status === 'working';
    const isTemporary = worker.isTemporary;

    return (
      <TouchableOpacity
        key={worker.id}
        style={[
          styles.workerItem,
          isSelected && styles.workerItemSelected,
          isWorking && styles.workerItemDisabled,
          isTemporary && styles.workerItemTemporary,
        ]}
        onPress={() => toggleWorkerSelection(worker.id, worker)}
        disabled={isWorking}
      >
        {/* 复选框 */}
        <View
          style={[
            styles.checkbox,
            isSelected && styles.checkboxSelected,
            isWorking && styles.checkboxDisabled,
          ]}
        >
          {isSelected && (
            <Ionicons name="checkmark" size={14} color="#fff" />
          )}
        </View>

        {/* 头像 */}
        <View
          style={[
            styles.avatar,
            isTemporary && styles.avatarTemporary,
            worker.group === 'mobile' && !isTemporary && styles.avatarMobile,
          ]}
        >
          <Text style={styles.avatarText}>{worker.avatar}</Text>
        </View>

        {/* 员工信息 */}
        <View style={styles.workerInfo}>
          <View style={styles.workerNameRow}>
            <Text style={[styles.workerName, isWorking && styles.textDisabled]}>
              {worker.name}
            </Text>
            <Text style={[styles.workerCode, isTemporary && { color: DISPATCHER_THEME.warning }]}>
              ({worker.employeeCode}){isTemporary ? '*' : ''}
            </Text>
            {isTemporary && (
              <View style={styles.tempBadge}>
                <Text style={styles.tempBadgeText}>临时</Text>
              </View>
            )}
          </View>
          <View style={styles.workerStatusRow}>
            {isWorking ? (
              <>
                <Text style={[styles.statusText, { color: DISPATCHER_THEME.info }]}>工作中</Text>
                <Text style={styles.taskText}>{worker.currentTask}</Text>
              </>
            ) : worker.group === 'transferable' ? (
              <>
                <Text style={[styles.statusText, { color: '#999' }]}>{worker.workshop}</Text>
                <Text style={[styles.statusText, { color: DISPATCHER_THEME.success }]}>可调动</Text>
              </>
            ) : (
              <>
                <Text style={[styles.statusText, { color: DISPATCHER_THEME.success }]}>空闲</Text>
                {isTemporary ? (
                  <Text style={[styles.statusText, { color: DISPATCHER_THEME.warning }]}>
                    合同剩余{worker.contractDaysLeft}天
                  </Text>
                ) : (
                  <Text style={styles.efficiencyText}>效率 {worker.efficiency}%</Text>
                )}
              </>
            )}
          </View>
        </View>

        {/* 技能和工时 */}
        <View style={styles.workerMeta}>
          <View
            style={[
              styles.skillBadge,
              worker.group === 'mobile' && styles.skillBadgeMobile,
              isWorking && styles.skillBadgeDisabled,
            ]}
          >
            <Text
              style={[
                styles.skillText,
                worker.group === 'mobile' && styles.skillTextMobile,
                isWorking && styles.skillTextDisabled,
              ]}
            >
              {worker.skill}{' '}
              {worker.skillLevel >= 3 && '★'}Lv.{worker.skillLevel}
            </Text>
          </View>
          {isWorking ? (
            <Text style={styles.unavailableText}>不可用</Text>
          ) : worker.group !== 'transferable' ? (
            <Text style={styles.hoursText}>
              周工时: {worker.weeklyHours}/{worker.maxWeeklyHours}h
            </Text>
          ) : (
            <Text style={styles.hoursText}>效率 {worker.efficiency}%</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const matchStatus = getMatchStatus();

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
        <Text style={styles.headerTitle}>人员分配</Text>
        <TouchableOpacity onPress={handleConfirm}>
          <Text style={styles.confirmText}>确认</Text>
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 批次信息 */}
        <View style={styles.batchCard}>
          <View style={styles.batchHeader}>
            <Text style={styles.batchNumber}>{batchInfo.batchNumber}</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>
                {batchInfo.status === 'pending' ? '待分配' : '进行中'}
              </Text>
            </View>
          </View>

          <View style={styles.batchDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>产品</Text>
              <Text style={styles.detailValue}>{batchInfo.product}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>数量</Text>
              <Text style={styles.detailValue}>{batchInfo.quantity}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>车间</Text>
              <Text style={styles.detailValue}>{batchInfo.workshop}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>建议人数</Text>
              <Text style={[styles.detailValue, { color: DISPATCHER_THEME.primary }]}>
                {batchInfo.suggestedWorkers}人
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>工时预估</Text>
              <Text style={styles.detailValue}>{batchInfo.estimatedHours}小时</Text>
            </View>
          </View>
        </View>

        {/* 已分配员工 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            已分配员工 ({selectedWorkerIds.length}人)
          </Text>
          {selectedWorkerIds.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptyText}>暂无已分配员工</Text>
            </View>
          ) : (
            <View style={styles.selectedAvatars}>
              {selectedWorkerIds.slice(0, 6).map(id => {
                const worker = workers.find(w => w.id === id);
                if (!worker) return null;
                return (
                  <View key={id} style={styles.selectedAvatar}>
                    <Text style={styles.selectedAvatarText}>{worker.avatar}</Text>
                  </View>
                );
              })}
              {selectedWorkerIds.length > 6 && (
                <View style={[styles.selectedAvatar, styles.moreAvatar]}>
                  <Text style={styles.moreAvatarText}>+{selectedWorkerIds.length - 6}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* 可用员工列表 */}
        <View style={[styles.section, { marginBottom: 100 }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>可用员工 ({workers.length}人)</Text>
            <View style={styles.sectionActions}>
              <TouchableOpacity onPress={handleSelectAll}>
                <Text style={styles.actionText}>全选</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleClearSelection}>
                <Text style={[styles.actionText, { color: '#999' }]}>清空</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 搜索栏 */}
          <View style={styles.searchContainer}>
            <View style={styles.searchInputWrapper}>
              <Ionicons name="search" size={16} color="#999" />
              <TextInput
                style={styles.searchInput}
                placeholder="搜索工号或姓名..."
                placeholderTextColor="#999"
                value={searchText}
                onChangeText={setSearchText}
              />
            </View>
            <Text style={styles.searchHint}>输入工号 (如001) 或姓名快速定位</Text>
          </View>

          {/* 已选/建议人数提示 */}
          <View style={styles.selectionTip}>
            <Text style={styles.selectionTipText}>
              已选: <Text style={{ fontWeight: '600' }}>{selectedWorkerIds.length}人</Text> / AI建议: {batchInfo.suggestedWorkers}人
            </Text>
            <Text style={[styles.matchStatusText, { color: matchStatus.color }]}>
              {matchStatus.text}
            </Text>
          </View>

          {/* 本车间空闲 */}
          {groupedWorkers.workshop_idle.length > 0 && (
            <>
              <Text style={styles.groupLabel}>
                本车间空闲 ({groupedWorkers.workshop_idle.length}人)
              </Text>
              {groupedWorkers.workshop_idle.map(renderWorkerItem)}
            </>
          )}

          {/* 本车间工作中 */}
          {groupedWorkers.workshop_working.length > 0 && (
            <>
              <Text style={styles.groupLabel}>
                本车间工作中 ({groupedWorkers.workshop_working.length}人)
              </Text>
              {groupedWorkers.workshop_working.map(renderWorkerItem)}
            </>
          )}

          {/* 机动人员 */}
          {groupedWorkers.mobile.length > 0 && (
            <>
              <Text style={styles.groupLabel}>
                机动人员 ({groupedWorkers.mobile.length}人){' '}
                {temporaryCount > 0 && (
                  <Text style={{ color: DISPATCHER_THEME.warning, fontSize: 11 }}>
                    含临时工{temporaryCount}人
                  </Text>
                )}
              </Text>
              {groupedWorkers.mobile.map(renderWorkerItem)}
            </>
          )}

          {/* 可调动员工 */}
          {groupedWorkers.transferable.length > 0 && (
            <>
              <Text style={styles.groupLabel}>
                可调动员工 ({groupedWorkers.transferable.length}人)
              </Text>
              {(showMoreTransferable
                ? groupedWorkers.transferable
                : groupedWorkers.transferable.slice(0, 2)
              ).map(renderWorkerItem)}
              {groupedWorkers.transferable.length > 2 && !showMoreTransferable && (
                <TouchableOpacity
                  style={styles.showMoreButton}
                  onPress={() => setShowMoreTransferable(true)}
                >
                  <Text style={styles.showMoreText}>
                    +{groupedWorkers.transferable.length - 2} 更多员工...
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* 底部操作栏 */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.cancelButton} onPress={handleGoBack}>
          <Text style={styles.cancelButtonText}>取消</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
          <LinearGradient
            colors={[DISPATCHER_THEME.secondary, DISPATCHER_THEME.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.confirmButtonGradient}
          >
            <Text style={styles.confirmButtonText}>
              确认分配 (已选{selectedWorkerIds.length}人)
            </Text>
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
  confirmText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  batchCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  batchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  batchNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: DISPATCHER_THEME.warning + '20',
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 12,
    color: DISPATCHER_THEME.warning,
    fontWeight: '500',
  },
  batchDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 13,
    color: '#999',
  },
  detailValue: {
    fontSize: 13,
    color: '#333',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  sectionActions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionText: {
    fontSize: 12,
    color: DISPATCHER_THEME.primary,
  },
  emptySection: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
  selectedAvatars: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DISPATCHER_THEME.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedAvatarText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  moreAvatar: {
    backgroundColor: '#f0f0f0',
  },
  moreAvatarText: {
    fontSize: 12,
    color: '#666',
  },
  searchContainer: {
    marginBottom: 12,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  searchHint: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    paddingLeft: 4,
  },
  selectionTip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0f7ff',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  selectionTipText: {
    fontSize: 13,
    color: DISPATCHER_THEME.info,
  },
  matchStatusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  groupLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
    marginTop: 12,
    paddingLeft: 4,
  },
  workerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  workerItemSelected: {
    borderColor: DISPATCHER_THEME.primary,
    backgroundColor: DISPATCHER_THEME.primary + '08',
  },
  workerItemDisabled: {
    opacity: 0.6,
  },
  workerItemTemporary: {
    backgroundColor: '#fffbe6',
    borderColor: '#ffe58f',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#d9d9d9',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: DISPATCHER_THEME.primary,
    borderColor: DISPATCHER_THEME.primary,
  },
  checkboxDisabled: {
    borderColor: '#d9d9d9',
    backgroundColor: '#f5f5f5',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: DISPATCHER_THEME.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarMobile: {
    backgroundColor: '#ffc53d',
  },
  avatarTemporary: {
    backgroundColor: DISPATCHER_THEME.warning,
  },
  avatarText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  workerInfo: {
    flex: 1,
    minWidth: 120,
  },
  workerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  workerName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  workerCode: {
    fontSize: 11,
    color: '#999',
  },
  tempBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    backgroundColor: DISPATCHER_THEME.warning,
    borderRadius: 2,
  },
  tempBadgeText: {
    fontSize: 10,
    color: '#fff',
  },
  workerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  statusText: {
    fontSize: 12,
  },
  taskText: {
    fontSize: 11,
    color: '#999',
  },
  efficiencyText: {
    fontSize: 11,
    color: '#999',
  },
  workerMeta: {
    alignItems: 'flex-end',
    gap: 2,
  },
  skillBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: DISPATCHER_THEME.primary + '15',
    borderRadius: 4,
  },
  skillBadgeMobile: {
    backgroundColor: '#fff7e6',
  },
  skillBadgeDisabled: {
    backgroundColor: '#f5f5f5',
  },
  skillText: {
    fontSize: 11,
    color: DISPATCHER_THEME.primary,
  },
  skillTextMobile: {
    color: DISPATCHER_THEME.warning,
  },
  skillTextDisabled: {
    color: '#999',
  },
  hoursText: {
    fontSize: 10,
    color: '#999',
  },
  unavailableText: {
    fontSize: 10,
    color: DISPATCHER_THEME.danger,
  },
  textDisabled: {
    color: '#999',
  },
  showMoreButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  showMoreText: {
    fontSize: 13,
    color: DISPATCHER_THEME.primary,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#666',
  },
  confirmButton: {
    flex: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  confirmButtonGradient: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
