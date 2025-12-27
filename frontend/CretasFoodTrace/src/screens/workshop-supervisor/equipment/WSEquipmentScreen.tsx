/**
 * Workshop Supervisor 设备管理
 * 包含: 搜索、统计、设备列表（按状态分组）
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
import { WSEquipmentStackParamList } from '../../../types/navigation';

type NavigationProp = NativeStackNavigationProp<WSEquipmentStackParamList, 'WSEquipment'>;

// 设备数据类型
interface Equipment {
  id: number;
  name: string;
  equipmentId: string;
  type: string;
  status: 'running' | 'idle' | 'maintenance' | 'offline';
  location: string;
  oee?: number;
  currentTask?: string;
  alertCount?: number;
}

export function WSEquipmentScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // 模拟设备数据
  const [equipments] = useState<Equipment[]>([
    {
      id: 1,
      name: '切片机A',
      equipmentId: 'EQ-001',
      type: '切片设备',
      status: 'running',
      location: 'A区-1号线',
      oee: 92,
      currentTask: 'PB-20251227-001',
    },
    {
      id: 2,
      name: '解冻设备B',
      equipmentId: 'EQ-002',
      type: '解冻设备',
      status: 'running',
      location: 'A区-2号线',
      oee: 88,
      currentTask: 'PB-20251227-002',
    },
    {
      id: 3,
      name: '清洗线C',
      equipmentId: 'EQ-003',
      type: '清洗设备',
      status: 'running',
      location: 'A区-3号线',
      oee: 95,
      currentTask: 'PB-20251227-003',
    },
    {
      id: 4,
      name: '包装机D',
      equipmentId: 'EQ-004',
      type: '包装设备',
      status: 'idle',
      location: 'B区-1号线',
    },
    {
      id: 5,
      name: '冷冻设备E',
      equipmentId: 'EQ-005',
      type: '冷冻设备',
      status: 'maintenance',
      location: 'B区-2号线',
      alertCount: 2,
    },
  ]);

  // 按状态分组
  const needAttention = equipments.filter(e => e.status === 'maintenance' || (e.alertCount && e.alertCount > 0));
  const running = equipments.filter(e => e.status === 'running');
  const idle = equipments.filter(e => e.status === 'idle');

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  // 获取状态样式
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'running':
        return { bg: '#52c41a', text: '运行中', icon: 'play-circle' };
      case 'idle':
        return { bg: '#1890ff', text: '空闲', icon: 'pause-circle' };
      case 'maintenance':
        return { bg: '#faad14', text: '维护中', icon: 'wrench' };
      case 'offline':
        return { bg: '#8c8c8c', text: '离线', icon: 'power-off' };
      default:
        return { bg: '#8c8c8c', text: '未知', icon: 'help-circle' };
    }
  };

  // 渲染设备卡片
  const renderEquipmentCard = (equipment: Equipment) => {
    const statusStyle = getStatusStyle(equipment.status);
    const hasAlert = equipment.alertCount && equipment.alertCount > 0;

    return (
      <TouchableOpacity
        key={equipment.id}
        style={[styles.equipmentCard, hasAlert ? styles.alertCard : undefined]}
        onPress={() => navigation.navigate('EquipmentDetail', { equipmentId: equipment.id })}
      >
        <View style={[styles.equipmentAvatar, { backgroundColor: statusStyle.bg }]}>
          <Icon source={statusStyle.icon} size={24} color="#fff" />
        </View>

        <View style={styles.equipmentInfo}>
          <View style={styles.equipmentNameRow}>
            <Text style={styles.equipmentName}>{equipment.name}</Text>
            {hasAlert && (
              <View style={styles.alertBadge}>
                <Icon source="alert" size={12} color="#fff" />
                <Text style={styles.alertBadgeText}>{equipment.alertCount}</Text>
              </View>
            )}
          </View>
          <Text style={styles.equipmentMeta}>
            {equipment.equipmentId} | {equipment.location}
          </Text>
          {equipment.currentTask && (
            <Text style={styles.equipmentTask}>当前: {equipment.currentTask}</Text>
          )}
        </View>

        <View style={styles.equipmentRight}>
          {equipment.oee !== undefined && (
            <View style={styles.oeeBadge}>
              <Text style={styles.oeeValue}>{equipment.oee}%</Text>
              <Text style={styles.oeeLabel}>OEE</Text>
            </View>
          )}
          <View style={[styles.statusBadge, { backgroundColor: `${statusStyle.bg}20` }]}>
            <Text style={[styles.statusText, { color: statusStyle.bg }]}>{statusStyle.text}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>设备管理</Text>
      </View>

      {/* 搜索栏 */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Icon source="magnify" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="搜索设备名称或编号..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* 设备统计 */}
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: '#f6ffed' }]}>
          <Icon source="play-circle" size={20} color="#52c41a" />
          <Text style={[styles.statValue, { color: '#52c41a' }]}>{running.length}</Text>
          <Text style={styles.statLabel}>运行中</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#e6f7ff' }]}>
          <Icon source="pause-circle" size={20} color="#1890ff" />
          <Text style={[styles.statValue, { color: '#1890ff' }]}>{idle.length}</Text>
          <Text style={styles.statLabel}>空闲</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#fff7e6' }]}>
          <Icon source="wrench" size={20} color="#faad14" />
          <Text style={[styles.statValue, { color: '#faad14' }]}>{needAttention.length}</Text>
          <Text style={styles.statLabel}>需维护</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#f5f5f5' }]}>
          <Icon source="cog" size={20} color="#666" />
          <Text style={[styles.statValue, { color: '#666' }]}>{equipments.length}</Text>
          <Text style={styles.statLabel}>总计</Text>
        </View>
      </View>

      {/* 设备列表 */}
      <ScrollView
        style={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#667eea']} />
        }
      >
        {/* 需要关注 */}
        {needAttention.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon source="alert-circle" size={18} color="#ff4d4f" />
              <Text style={styles.sectionTitle}>需要关注</Text>
            </View>
            {needAttention.map(renderEquipmentCard)}
          </View>
        )}

        {/* 运行中 */}
        {running.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon source="play-circle" size={18} color="#52c41a" />
              <Text style={styles.sectionTitle}>运行中</Text>
            </View>
            {running.map(renderEquipmentCard)}
          </View>
        )}

        {/* 空闲 */}
        {idle.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon source="pause-circle" size={18} color="#1890ff" />
              <Text style={styles.sectionTitle}>空闲</Text>
            </View>
            {idle.map(renderEquipmentCard)}
          </View>
        )}

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
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#667eea',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
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

  // 统计
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    gap: 8,
    marginBottom: 8,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },

  // 列表
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginLeft: 6,
  },

  // 设备卡片
  equipmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  alertCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#ff4d4f',
  },
  equipmentAvatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  equipmentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  equipmentNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  equipmentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#ff4d4f',
    borderRadius: 10,
  },
  alertBadgeText: {
    fontSize: 10,
    color: '#fff',
    marginLeft: 2,
    fontWeight: 'bold',
  },
  equipmentMeta: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  equipmentTask: {
    fontSize: 12,
    color: '#667eea',
    marginTop: 4,
  },
  equipmentRight: {
    alignItems: 'flex-end',
  },
  oeeBadge: {
    alignItems: 'center',
    marginBottom: 4,
  },
  oeeValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#52c41a',
  },
  oeeLabel: {
    fontSize: 10,
    color: '#999',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
});

export default WSEquipmentScreen;
