/**
 * 人员管理列表屏幕
 *
 * 功能：
 * - 人员统计（总人数、工作中、空闲、请假）
 * - 合同到期提醒
 * - 多维度筛选（车间、类型、状态）
 * - 工号/姓名搜索
 * - 任务组分组展示
 * - 员工卡片（技能等级、效率、合同到期提醒）
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { DISPATCHER_THEME, HireType } from '../../../types/dispatcher';

// Local types for this screen
interface PersonnelSkill {
  name: string;
  level: number;
  isPrimary?: boolean;
}

interface Personnel {
  id: string;
  name: string;
  employeeCode: string;
  position: string;
  workshopId: string;
  workshopName: string;
  status: 'working' | 'idle' | 'leave';
  hireType: HireType;
  skills: PersonnelSkill[];
  efficiency: number;
  weeklyHours?: number;
  maxWeeklyHours?: number;
  taskGroupId?: string;
  contractEndDate?: string;
  daysUntilExpiry?: number;
  // Additional optional properties for different hire types
  overtimeAvailable?: number;
  dispatchCompany?: string;
  leaveReason?: string;
  returnDate?: string;
}

interface DisplayTaskGroup {
  id: string;
  name: string;
  workerCount: number;
  status: 'running' | 'idle' | 'paused' | 'completed';
  progress?: number;
}

// Mock data
const mockStats = {
  total: 30,
  tempWorkers: 5,
  working: 24,
  workingTemp: 4,
  idle: 4,
  leave: 2,
  expiringContracts: 3,
};

const mockTaskGroups: DisplayTaskGroup[] = [
  { id: 'PB001', name: 'PB20241227001', workerCount: 6, status: 'running', progress: 75 },
  { id: 'PB002', name: 'PB20241227002', workerCount: 2, status: 'running', progress: 30 },
  { id: 'idle', name: '空闲人员', workerCount: 2, status: 'idle' },
];

const mockPersonnel: Personnel[] = [
  {
    id: '1',
    name: '张三丰',
    employeeCode: '001',
    position: '切片组长',
    workshopId: 'W1',
    workshopName: '切片车间',
    status: 'working',
    hireType: 'full_time',
    skills: [
      { name: '切片', level: 5, isPrimary: true },
      { name: '质检', level: 3 },
    ],
    efficiency: 98,
    weeklyHours: 38,
    maxWeeklyHours: 40,
    taskGroupId: 'PB001',
  },
  {
    id: '2',
    name: '李四海',
    employeeCode: '002',
    position: '切片工',
    workshopId: 'W1',
    workshopName: '切片车间',
    status: 'working',
    hireType: 'full_time',
    skills: [
      { name: '切片', level: 4, isPrimary: true },
    ],
    efficiency: 92,
    taskGroupId: 'PB001',
  },
  {
    id: '3',
    name: '刘临时',
    employeeCode: '088',
    position: '切片工',
    workshopId: 'W1',
    workshopName: '切片车间',
    status: 'working',
    hireType: 'temporary',
    skills: [
      { name: '切片', level: 2 },
    ],
    efficiency: 78,
    weeklyHours: 24,
    contractEndDate: '2025-01-15',
    daysUntilExpiry: 18,
    taskGroupId: 'PB001',
  },
  {
    id: '4',
    name: '王五行',
    employeeCode: '003',
    position: '切片工',
    workshopId: 'W1',
    workshopName: '切片车间',
    status: 'idle',
    hireType: 'full_time',
    skills: [
      { name: '切片', level: 3, isPrimary: true },
      { name: '包装', level: 2 },
    ],
    efficiency: 95,
    weeklyHours: 32,
    maxWeeklyHours: 40,
    overtimeAvailable: 8,
    taskGroupId: 'idle',
  },
  {
    id: '5',
    name: '赵六顺',
    employeeCode: '010',
    position: '包装组长',
    workshopId: 'W2',
    workshopName: '包装车间',
    status: 'working',
    hireType: 'full_time',
    skills: [
      { name: '包装', level: 5, isPrimary: true },
      { name: '质检', level: 3 },
    ],
    efficiency: 96,
    taskGroupId: 'PB004',
  },
  {
    id: '6',
    name: '吴派遣',
    employeeCode: '089',
    position: '包装工',
    workshopId: 'W2',
    workshopName: '包装车间',
    status: 'working',
    hireType: 'dispatch',
    dispatchCompany: '鑫达人力',
    skills: [
      { name: '包装', level: 3 },
    ],
    efficiency: 82,
    taskGroupId: 'PB004',
  },
  {
    id: '7',
    name: '刘八方',
    employeeCode: '020',
    position: '冷冻工',
    workshopId: 'W3',
    workshopName: '冷冻车间',
    status: 'leave',
    hireType: 'full_time',
    leaveReason: '病假',
    returnDate: '明天',
    skills: [
      { name: '冷冻', level: 3 },
    ],
    efficiency: 85,
  },
];

const workshopOptions = ['全部车间', '切片车间', '包装车间', '冷冻车间'];
const typeOptions = ['全部类型', '正式工', '临时工', '派遣工', '实习生'];
const statusOptions = ['全部状态', '工作中', '空闲', '请假'];

export default function PersonnelListScreen() {
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [stats] = useState(mockStats);
  const [personnel] = useState<Personnel[]>(mockPersonnel);

  // Filters
  const [selectedWorkshop, setSelectedWorkshop] = useState('全部车间');
  const [selectedType, setSelectedType] = useState('全部类型');
  const [selectedStatus, setSelectedStatus] = useState('全部状态');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Load personnel data from API
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'working':
        return { bg: '#e6f7ff', text: '#1890ff', label: '工作中' };
      case 'idle':
        return { bg: '#f6ffed', text: '#52c41a', label: '空闲' };
      case 'leave':
        return { bg: '#fff1f0', text: '#ff4d4f', label: '请假' };
      default:
        return { bg: '#f5f5f5', text: '#999', label: status };
    }
  };

  const getHireTypeBadge = (hireType: HireType) => {
    switch (hireType) {
      case 'temporary':
        return { bg: '#fff3e0', text: '#e65100', border: '#ffcc80', label: '临时' };
      case 'dispatch':
        return { bg: '#e3f2fd', text: '#1565c0', border: '#90caf9', label: '派遣' };
      case 'intern':
        return { bg: '#f3e5f5', text: '#7b1fa2', border: '#ce93d8', label: '实习' };
      default:
        return null;
    }
  };

  // Group personnel by workshop and task group
  const workshops = ['切片车间', '包装车间', '冷冻车间'];

  const renderPersonnelCard = (person: Personnel) => {
    const statusStyle = getStatusStyle(person.status);
    const hireTypeBadge = getHireTypeBadge(person.hireType);
    const isTemp = person.hireType === 'temporary';

    return (
      <TouchableOpacity
        key={person.id}
        style={[styles.personnelCard, isTemp && styles.tempWorkerCard]}
        onPress={() => navigation.navigate('PersonnelDetail', { personnelId: person.id })}
      >
        <View style={styles.personnelHeader}>
          <View style={[
            styles.avatar,
            isTemp && { backgroundColor: '#ff9800' },
            person.hireType === 'dispatch' && { backgroundColor: '#2196f3' },
          ]}>
            <Text style={styles.avatarText}>{person.name.charAt(0)}</Text>
          </View>
          <View style={styles.personnelInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.personnelName}>{person.name}</Text>
              <Text style={styles.employeeCode}>({person.employeeCode})</Text>
              {hireTypeBadge && (
                <View style={[styles.hireTypeBadge, {
                  backgroundColor: hireTypeBadge.bg,
                  borderColor: hireTypeBadge.border,
                }]}>
                  <Text style={[styles.hireTypeBadgeText, { color: hireTypeBadge.text }]}>
                    {hireTypeBadge.label}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.personnelPosition}>{person.position}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusText, { color: statusStyle.text }]}>{statusStyle.label}</Text>
          </View>
        </View>

        {/* Skills */}
        <View style={styles.skillsRow}>
          {person.skills.map((skill, index) => (
            <View key={index} style={[styles.skillBadge, skill.isPrimary && styles.skillBadgePrimary]}>
              <Text style={styles.skillName}>{skill.name}</Text>
              <Text style={styles.skillLevel}>
                {skill.isPrimary && '★'}Lv.{skill.level}
              </Text>
            </View>
          ))}
        </View>

        {/* Leave reason */}
        {person.status === 'leave' && person.leaveReason && (
          <Text style={styles.leaveReason}>
            请假原因: {person.leaveReason} | 预计返岗: {person.returnDate}
          </Text>
        )}

        {/* Contract warning for temp workers */}
        {person.contractEndDate && person.daysUntilExpiry !== undefined && (
          <View style={styles.contractWarning}>
            <MaterialCommunityIcons name="alert" size={12} color="#f57c00" />
            <Text style={styles.contractWarningText}>
              合同到期: {person.contractEndDate} (剩余{person.daysUntilExpiry}天)
            </Text>
          </View>
        )}

        {/* Meta info */}
        <View style={styles.metaRow}>
          {person.hireType === 'full_time' && (
            <Text style={styles.metaItem}>类型: 正式工</Text>
          )}
          {person.hireType === 'dispatch' && person.dispatchCompany && (
            <Text style={styles.metaItem}>派遣公司: {person.dispatchCompany}</Text>
          )}
          <Text style={styles.metaItem}>
            效率: <Text style={[styles.efficiency, person.efficiency < 80 && styles.efficiencyLow]}>
              {person.efficiency}%
            </Text>
          </Text>
          {person.weeklyHours !== undefined && (
            <Text style={styles.metaItem}>
              本周工时: {person.weeklyHours}h{person.maxWeeklyHours ? `/${person.maxWeeklyHours}h` : ''}
            </Text>
          )}
          {person.overtimeAvailable !== undefined && person.overtimeAvailable > 0 && (
            <Text style={[styles.metaItem, { color: '#4caf50' }]}>
              可加班: {person.overtimeAvailable}h
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>人员管理</Text>
        <TouchableOpacity onPress={() => navigation.navigate('PersonnelTransfer')}>
          <Text style={styles.transferButton}>调动</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats Summary */}
        <View style={styles.statsSummary}>
          <View style={styles.statsItem}>
            <Text style={styles.statsValue}>{stats.total}</Text>
            <Text style={styles.statsLabel}>总人数</Text>
            <Text style={styles.statsSub}>临时{stats.tempWorkers}</Text>
          </View>
          <View style={styles.statsItem}>
            <Text style={[styles.statsValue, { color: '#1890ff' }]}>{stats.working}</Text>
            <Text style={styles.statsLabel}>工作中</Text>
            <Text style={styles.statsSub}>临时{stats.workingTemp}</Text>
          </View>
          <View style={styles.statsItem}>
            <Text style={[styles.statsValue, { color: '#52c41a' }]}>{stats.idle}</Text>
            <Text style={styles.statsLabel}>空闲</Text>
          </View>
          <View style={styles.statsItem}>
            <Text style={[styles.statsValue, { color: '#fa8c16' }]}>{stats.leave}</Text>
            <Text style={styles.statsLabel}>请假</Text>
          </View>
        </View>

        {/* Contract Expiry Alert */}
        {stats.expiringContracts > 0 && (
          <TouchableOpacity
            style={styles.contractAlert}
            onPress={() => navigation.navigate('ContractExpiring')}
          >
            <View style={styles.contractAlertInfo}>
              <View style={styles.contractAlertIcon}>
                <MaterialCommunityIcons name="alert" size={16} color="#fff" />
              </View>
              <Text style={styles.contractAlertText}>
                <Text style={styles.contractAlertCount}>{stats.expiringContracts}名</Text> 临时工合同即将到期
              </Text>
            </View>
            <Text style={styles.contractAlertAction}>查看 &gt;</Text>
          </TouchableOpacity>
        )}

        {/* Filters */}
        <View style={styles.filterRow}>
          <TouchableOpacity style={styles.filterSelect}>
            <Text style={styles.filterSelectText}>{selectedWorkshop}</Text>
            <MaterialCommunityIcons name="chevron-down" size={16} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterSelect}>
            <Text style={styles.filterSelectText}>{selectedType}</Text>
            <MaterialCommunityIcons name="chevron-down" size={16} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterSelect}>
            <Text style={styles.filterSelectText}>{selectedStatus}</Text>
            <MaterialCommunityIcons name="chevron-down" size={16} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={18} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="输入工号(如001)或姓名搜索..."
            placeholderTextColor="#999"
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>

        {/* Personnel by Workshop */}
        {/* Cutting Workshop */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>切片车间 (10人 | 任务组: 2)</Text>
        </View>

        {/* Task Group PB001 */}
        <View style={styles.taskGroup}>
          <View style={styles.taskGroupHeader}>
            <Text style={styles.taskGroupTitle}>任务组 PB20241227001 (6人)</Text>
            <View style={styles.taskGroupStatus}>
              <Text style={styles.taskGroupStatusText}>运行中 75%</Text>
            </View>
          </View>
        </View>

        {personnel.filter(p => p.taskGroupId === 'PB001').map(renderPersonnelCard)}

        <Text style={styles.moreText}>+3 更多成员...</Text>

        {/* Task Group PB002 */}
        <View style={styles.taskGroup}>
          <View style={styles.taskGroupHeader}>
            <Text style={styles.taskGroupTitle}>任务组 PB20241227002 (2人)</Text>
            <View style={styles.taskGroupStatus}>
              <Text style={styles.taskGroupStatusText}>运行中 30%</Text>
            </View>
          </View>
        </View>

        {/* Idle Personnel */}
        <View style={styles.taskGroup}>
          <View style={styles.taskGroupHeader}>
            <Text style={styles.taskGroupTitle}>空闲人员 (2人)</Text>
            <View style={[styles.taskGroupStatus, styles.taskGroupStatusIdle]}>
              <Text style={[styles.taskGroupStatusText, { color: '#757575' }]}>可调动</Text>
            </View>
          </View>
        </View>

        {personnel.filter(p => p.taskGroupId === 'idle').map(renderPersonnelCard)}

        {/* Packaging Workshop */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>包装车间 (8人 | 任务组: 1)</Text>
        </View>

        <View style={styles.taskGroup}>
          <View style={styles.taskGroupHeader}>
            <Text style={styles.taskGroupTitle}>任务组 PB20241227004 (6人)</Text>
            <View style={styles.taskGroupStatus}>
              <Text style={styles.taskGroupStatusText}>运行中 45%</Text>
            </View>
          </View>
        </View>

        {personnel.filter(p => p.workshopName === '包装车间').map(renderPersonnelCard)}

        <Text style={styles.moreText}>+5 更多...</Text>

        {/* Freezing Workshop */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>冷冻车间 (6人 | 任务组: 1)</Text>
        </View>

        {personnel.filter(p => p.workshopName === '冷冻车间').map(renderPersonnelCard)}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  transferButton: {
    fontSize: 14,
    color: DISPATCHER_THEME.secondary,
  },
  content: {
    flex: 1,
  },
  statsSummary: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    margin: 16,
    marginBottom: 0,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statsItem: {
    flex: 1,
    alignItems: 'center',
  },
  statsValue: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
  },
  statsLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statsSub: {
    fontSize: 11,
    color: '#ff9800',
    marginTop: 2,
  },
  contractAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff3e0',
    borderRadius: 12,
    padding: 12,
    margin: 16,
    marginTop: 12,
  },
  contractAlertInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contractAlertIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f57c00',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contractAlertText: {
    fontSize: 13,
    color: '#e65100',
  },
  contractAlertCount: {
    fontWeight: '600',
  },
  contractAlertAction: {
    fontSize: 12,
    color: '#e65100',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  filterSelect: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterSelectText: {
    fontSize: 12,
    color: '#666',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  taskGroup: {
    backgroundColor: '#fafafa',
    borderRadius: 8,
    padding: 8,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  taskGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskGroupTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
  },
  taskGroupStatus: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  taskGroupStatusIdle: {
    backgroundColor: '#f5f5f5',
  },
  taskGroupStatusText: {
    fontSize: 11,
    color: '#1976d2',
  },
  personnelCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  tempWorkerCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#ff9800',
  },
  personnelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DISPATCHER_THEME.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  personnelInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  personnelName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  employeeCode: {
    fontSize: 12,
    color: '#666',
  },
  hireTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    marginLeft: 4,
  },
  hireTypeBadgeText: {
    fontSize: 11,
  },
  personnelPosition: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    marginBottom: 6,
  },
  skillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
  },
  skillBadgePrimary: {
    backgroundColor: '#e8f5e9',
  },
  skillName: {
    fontSize: 11,
    color: '#666',
  },
  skillLevel: {
    fontSize: 11,
    color: '#ff9800',
    fontWeight: '600',
  },
  leaveReason: {
    fontSize: 12,
    color: '#ff5722',
    marginTop: 6,
  },
  contractWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff8e1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 6,
    gap: 4,
  },
  contractWarningText: {
    fontSize: 11,
    color: '#f57c00',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    borderStyle: 'dashed',
  },
  metaItem: {
    fontSize: 11,
    color: '#757575',
  },
  efficiency: {
    color: '#4caf50',
    fontWeight: '600',
  },
  efficiencyLow: {
    color: '#ff5722',
  },
  moreText: {
    textAlign: 'center',
    fontSize: 13,
    color: '#999',
    paddingVertical: 8,
  },
});
