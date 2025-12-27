/**
 * Workshop Supervisor 人员管理
 * 包含: 搜索、筛选标签、人员列表（含临时工标识）
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon } from 'react-native-paper';
import { WSWorkersStackParamList } from '../../../types/navigation';

type NavigationProp = NativeStackNavigationProp<WSWorkersStackParamList, 'WSWorkers'>;

// 员工数据类型
interface Worker {
  id: number;
  name: string;
  employeeId: string;
  role: string;
  status: 'on_duty' | 'off_duty' | 'on_leave' | 'absent';
  todayHours: number;
  efficiency: number;
  isTemporary: boolean;
  currentTask?: string;
}

// 筛选标签
const FILTER_TABS = [
  { key: 'all', label: '全部', count: 10 },
  { key: 'on_duty', label: '在岗', count: 8 },
  { key: 'on_leave', label: '请假', count: 1 },
  { key: 'temporary', label: '临时工', count: 2 },
];

export function WSWorkersScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  // 模拟员工数据
  const [workers] = useState<Worker[]>([
    {
      id: 1,
      name: '王建国',
      employeeId: 'EMP-001',
      role: '切片操作员',
      status: 'on_duty',
      todayHours: 4.0,
      efficiency: 96,
      isTemporary: false,
      currentTask: 'PB-20251227-001 切片',
    },
    {
      id: 2,
      name: '李明辉',
      employeeId: 'EMP-002',
      role: '包装操作员',
      status: 'on_duty',
      todayHours: 3.5,
      efficiency: 92,
      isTemporary: false,
      currentTask: 'PB-20251227-001 包装',
    },
    {
      id: 3,
      name: '张伟',
      employeeId: 'TMP-003',
      role: '清洗操作员',
      status: 'on_duty',
      todayHours: 2.0,
      efficiency: 85,
      isTemporary: true,
    },
    {
      id: 4,
      name: '赵丽华',
      employeeId: 'EMP-004',
      role: '质检员',
      status: 'on_duty',
      todayHours: 3.0,
      efficiency: 98,
      isTemporary: false,
    },
    {
      id: 5,
      name: '陈志强',
      employeeId: 'EMP-005',
      role: '设备操作员',
      status: 'on_leave',
      todayHours: 0,
      efficiency: 90,
      isTemporary: false,
    },
    {
      id: 6,
      name: '周婷',
      employeeId: 'TMP-006',
      role: '清洗操作员',
      status: 'on_duty',
      todayHours: 2.5,
      efficiency: 82,
      isTemporary: true,
    },
  ]);

  // 筛选员工
  const filteredWorkers = workers.filter(worker => {
    if (activeFilter === 'temporary' && !worker.isTemporary) return false;
    if (activeFilter === 'on_duty' && worker.status !== 'on_duty') return false;
    if (activeFilter === 'on_leave' && worker.status !== 'on_leave') return false;
    if (searchQuery && !worker.name.includes(searchQuery) && !worker.employeeId.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  // 获取状态样式
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'on_duty':
        return { bg: '#52c41a', text: '在岗' };
      case 'off_duty':
        return { bg: '#8c8c8c', text: '离岗' };
      case 'on_leave':
        return { bg: '#faad14', text: '请假' };
      case 'absent':
        return { bg: '#ff4d4f', text: '缺勤' };
      default:
        return { bg: '#8c8c8c', text: '未知' };
    }
  };

  // 获取效率等级
  const getEfficiencyGrade = (efficiency: number) => {
    if (efficiency >= 95) return { grade: 'A', color: '#52c41a' };
    if (efficiency >= 85) return { grade: 'B', color: '#1890ff' };
    if (efficiency >= 75) return { grade: 'C', color: '#faad14' };
    return { grade: 'D', color: '#ff4d4f' };
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>人员管理</Text>
        <TouchableOpacity
          style={styles.clockBtn}
          onPress={() => navigation.navigate('ClockIn')}
        >
          <Icon source="clock-check-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* 搜索栏 */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Icon source="magnify" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="搜索姓名或工号..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* 筛选标签 */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {FILTER_TABS.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.filterTab, activeFilter === tab.key && styles.filterTabActive]}
              onPress={() => setActiveFilter(tab.key)}
            >
              <Text style={[styles.filterTabText, activeFilter === tab.key && styles.filterTabTextActive]}>
                {tab.label} ({tab.count})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 人员统计 */}
      <View style={styles.statsRow}>
        <View style={[styles.statItem, { backgroundColor: '#f6ffed' }]}>
          <Text style={[styles.statValue, { color: '#52c41a' }]}>8</Text>
          <Text style={styles.statLabel}>在岗</Text>
        </View>
        <View style={[styles.statItem, { backgroundColor: '#fff7e6' }]}>
          <Text style={[styles.statValue, { color: '#faad14' }]}>1</Text>
          <Text style={styles.statLabel}>请假</Text>
        </View>
        <View style={[styles.statItem, { backgroundColor: '#fff1f0' }]}>
          <Text style={[styles.statValue, { color: '#ff4d4f' }]}>1</Text>
          <Text style={styles.statLabel}>缺勤</Text>
        </View>
        <View style={[styles.statItem, { backgroundColor: '#e6f7ff' }]}>
          <Text style={[styles.statValue, { color: '#1890ff' }]}>2</Text>
          <Text style={styles.statLabel}>临时工</Text>
        </View>
      </View>

      {/* 人员列表 */}
      <ScrollView
        style={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#667eea']} />
        }
      >
        {filteredWorkers.map(worker => {
          const statusStyle = getStatusStyle(worker.status);
          const efficiencyGrade = getEfficiencyGrade(worker.efficiency);

          return (
            <TouchableOpacity
              key={worker.id}
              style={styles.workerCard}
              onPress={() => navigation.navigate('WorkerDetail', { workerId: worker.id })}
            >
              <View style={styles.workerAvatar}>
                <Text style={styles.workerAvatarText}>{worker.name.charAt(0)}</Text>
                <View style={[styles.statusDot, { backgroundColor: statusStyle.bg }]} />
              </View>

              <View style={styles.workerInfo}>
                <View style={styles.workerNameRow}>
                  <Text style={styles.workerName}>{worker.name}</Text>
                  {worker.isTemporary && (
                    <View style={styles.tempBadge}>
                      <Text style={styles.tempBadgeText}>临时</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.workerMeta}>
                  {worker.employeeId} | {worker.role}
                </Text>
                {worker.currentTask && (
                  <Text style={styles.workerTask}>当前: {worker.currentTask}</Text>
                )}
              </View>

              <View style={styles.workerRight}>
                <View style={styles.efficiencyBadge}>
                  <Text style={[styles.efficiencyText, { color: efficiencyGrade.color }]}>
                    {efficiencyGrade.grade}
                  </Text>
                </View>
                <Text style={styles.hoursText}>{worker.todayHours}h</Text>
              </View>
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#667eea',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  clockBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // 搜索栏
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
  },

  // 筛选标签
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
  },
  filterTabActive: {
    backgroundColor: '#667eea',
  },
  filterTabText: {
    fontSize: 14,
    color: '#666',
  },
  filterTabTextActive: {
    color: '#fff',
  },

  // 统计
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    marginBottom: 8,
    gap: 8,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },

  // 列表
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  workerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  workerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  workerAvatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
  },
  workerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  workerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  workerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  tempBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#e6f7ff',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#91d5ff',
  },
  tempBadgeText: {
    fontSize: 10,
    color: '#1890ff',
    fontWeight: '500',
  },
  workerMeta: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  workerTask: {
    fontSize: 12,
    color: '#667eea',
    marginTop: 4,
  },
  workerRight: {
    alignItems: 'center',
  },
  efficiencyBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f5ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  efficiencyText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  hoursText: {
    fontSize: 12,
    color: '#999',
  },
});

export default WSWorkersScreen;
