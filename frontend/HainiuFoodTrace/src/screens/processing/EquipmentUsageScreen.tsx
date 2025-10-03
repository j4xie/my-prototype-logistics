import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BigButton } from '../../components/processing';
import { processingApiClient } from '../../services/api/processingApiClient';
import { formatCurrency, formatDuration, calculateWorkMinutes } from '../../types/costAccounting';

interface Equipment {
  id: string;
  name: string;
  equipmentType: string;
  status: 'active' | 'inactive' | 'maintenance';
  hourlyOperationCost?: number;
}

interface ActiveUsage {
  id: string;
  equipmentId: string;
  batchId: string;
  startTime: string;
  currentMinutes: number;
  estimatedCost: number;
}

interface EquipmentUsageScreenProps {
  navigation: any;
}

/**
 * 设备使用界面
 * 工作流程3: 设备使用记录和成本追踪
 */
export const EquipmentUsageScreen: React.FC<EquipmentUsageScreenProps> = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [activeUsages, setActiveUsages] = useState<Map<string, ActiveUsage>>(new Map());
  const [selectedBatchId, setSelectedBatchId] = useState('');

  useEffect(() => {
    loadEquipmentData();

    // 每秒更新活动设备的使用时长和成本
    const interval = setInterval(() => {
      updateActiveUsages();
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const loadEquipmentData = async () => {
    try {
      setLoading(true);

      // 加载设备列表
      const equipmentResponse = await processingApiClient.getEquipmentMonitoring({
        department: 'processing',
      });

      if (equipmentResponse.success) {
        const equipment = equipmentResponse.data.equipment.map((item: any) => ({
          id: item.equipment.id,
          name: item.equipment.equipmentName,
          equipmentType: item.equipment.equipmentType || '加工设备',
          status: item.equipment.status,
          hourlyOperationCost: item.equipment.hourlyOperationCost,
        }));
        setEquipmentList(equipment);
      }

      // 加载活动的设备使用记录
      const usageResponse = await processingApiClient.getEquipmentUsageRecords({
        activeOnly: true,
      });

      if (usageResponse.success) {
        const usages = new Map();
        usageResponse.data.usageRecords.forEach((usage: any) => {
          usages.set(usage.equipmentId, {
            id: usage.id,
            equipmentId: usage.equipmentId,
            batchId: usage.batchId,
            startTime: usage.startTime,
            currentMinutes: calculateWorkMinutes(usage.startTime),
            estimatedCost: 0,
          });
        });
        setActiveUsages(usages);
      }
    } catch (error: any) {
      console.error('加载设备数据失败:', error);
      Alert.alert('错误', '加载设备数据失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const updateActiveUsages = () => {
    setActiveUsages(prev => {
      const updated = new Map(prev);
      updated.forEach((usage, equipmentId) => {
        const minutes = calculateWorkMinutes(usage.startTime);
        const equipment = equipmentList.find(e => e.id === equipmentId);
        const cost = equipment?.hourlyOperationCost
          ? (equipment.hourlyOperationCost / 60) * minutes
          : 0;

        updated.set(equipmentId, {
          ...usage,
          currentMinutes: minutes,
          estimatedCost: cost,
        });
      });
      return updated;
    });
  };

  const handleStartUsage = async (equipment: Equipment) => {
    if (!selectedBatchId) {
      Alert.alert('提示', '请先选择批次');
      navigation.navigate('BatchList', {
        onSelect: (batchId: string) => {
          setSelectedBatchId(batchId);
          startEquipmentUsage(equipment, batchId);
        },
      });
      return;
    }

    startEquipmentUsage(equipment, selectedBatchId);
  };

  const startEquipmentUsage = async (equipment: Equipment, batchId: string) => {
    try {
      setLoading(true);
      const response = await processingApiClient.startEquipmentUsage({
        batchId,
        equipmentId: equipment.id,
        notes: `开始使用${equipment.name}`,
      });

      if (response.success) {
        Alert.alert('成功', `${equipment.name} 开始使用`);
        loadEquipmentData();
      } else {
        Alert.alert('失败', response.message || '开始使用失败');
      }
    } catch (error: any) {
      console.error('开始使用设备失败:', error);
      Alert.alert('错误', error.message || '网络错误');
    } finally {
      setLoading(false);
    }
  };

  const handleEndUsage = async (equipment: Equipment) => {
    const usage = activeUsages.get(equipment.id);
    if (!usage) {
      Alert.alert('错误', '未找到活动的使用记录');
      return;
    }

    Alert.alert(
      '确认结束使用',
      `设备: ${equipment.name}\n` +
      `使用时长: ${formatDuration(usage.currentMinutes)}\n` +
      `预估成本: ${formatCurrency(usage.estimatedCost)}\n\n` +
      `确认要结束使用吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认',
          onPress: async () => {
            try {
              setLoading(true);
              const response = await processingApiClient.endEquipmentUsage({
                usageId: usage.id,
                notes: `结束使用${equipment.name}`,
              });

              if (response.success) {
                Alert.alert(
                  '使用结束',
                  `使用时长: ${formatDuration(response.data.usageDuration)}\n` +
                  `设备成本: ${formatCurrency(response.data.equipmentCost)}`
                );
                loadEquipmentData();
              } else {
                Alert.alert('失败', response.message || '结束使用失败');
              }
            } catch (error: any) {
              console.error('结束使用设备失败:', error);
              Alert.alert('错误', error.message || '网络错误');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleRecordMaintenance = (equipment: Equipment) => {
    navigation.navigate('EquipmentMaintenance', {
      equipmentId: equipment.id,
      equipmentName: equipment.name,
    });
  };

  const renderEquipmentCard = (equipment: Equipment) => {
    const isActive = activeUsages.has(equipment.id);
    const usage = activeUsages.get(equipment.id);

    const getStatusColor = () => {
      if (isActive) return '#EF4444'; // 使用中 - 红色
      if (equipment.status === 'maintenance') return '#F59E0B'; // 维护中 - 黄色
      if (equipment.status === 'inactive') return '#6B7280'; // 离线 - 灰色
      return '#10B981'; // 空闲 - 绿色
    };

    const getStatusText = () => {
      if (isActive) return '使用中';
      if (equipment.status === 'maintenance') return '维护中';
      if (equipment.status === 'inactive') return '离线';
      return '空闲';
    };

    const statusColor = getStatusColor();

    return (
      <View key={equipment.id} style={styles.equipmentCard}>
        {/* 设备信息 */}
        <View style={styles.equipmentHeader}>
          <View style={[styles.equipmentIcon, { backgroundColor: statusColor + '20' }]}>
            <Ionicons
              name={isActive ? 'cog' : 'cog-outline'}
              size={32}
              color={statusColor}
            />
          </View>
          <View style={styles.equipmentInfo}>
            <Text style={styles.equipmentName}>{equipment.name}</Text>
            <Text style={styles.equipmentType}>{equipment.equipmentType}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {getStatusText()}
            </Text>
          </View>
        </View>

        {/* 使用信息(如果正在使用) */}
        {isActive && usage && (
          <View style={styles.usageInfo}>
            <View style={styles.usageRow}>
              <Ionicons name="time" size={20} color="#6B7280" />
              <Text style={styles.usageText}>{formatDuration(usage.currentMinutes)}</Text>
            </View>
            <View style={styles.usageRow}>
              <Ionicons name="cash" size={20} color="#6B7280" />
              <Text style={styles.usageText}>{formatCurrency(usage.estimatedCost)}</Text>
            </View>
          </View>
        )}

        {/* 操作按钮 */}
        <View style={styles.equipmentActions}>
          {!isActive ? (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonPrimary]}
                onPress={() => handleStartUsage(equipment)}
                disabled={equipment.status !== 'active'}
              >
                <Ionicons name="play" size={20} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>开始使用</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonSecondary]}
                onPress={() => handleRecordMaintenance(equipment)}
              >
                <Ionicons name="build" size={20} color="#F59E0B" />
                <Text style={[styles.actionButtonText, { color: '#F59E0B' }]}>维修记录</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonDanger]}
              onPress={() => handleEndUsage(equipment)}
            >
              <Ionicons name="stop" size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>结束使用</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (loading && equipmentList.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>加载设备列表...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>设备使用管理</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true);
            loadEquipmentData();
          }} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* 统计卡片 */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{equipmentList.length}</Text>
            <Text style={styles.statLabel}>总设备</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{activeUsages.size}</Text>
            <Text style={styles.statLabel}>使用中</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {equipmentList.filter(e => e.status === 'active' && !activeUsages.has(e.id)).length}
            </Text>
            <Text style={styles.statLabel}>空闲</Text>
          </View>
        </View>

        {/* 设备列表 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>设备列表</Text>
          {equipmentList.map(renderEquipmentCard)}
        </View>

        {equipmentList.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="construct-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyStateText}>暂无设备数据</Text>
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3B82F6',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  equipmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  equipmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  equipmentIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  equipmentInfo: {
    flex: 1,
  },
  equipmentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  equipmentType: {
    fontSize: 14,
    color: '#6B7280',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  usageInfo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  usageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  usageText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  equipmentActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  actionButtonPrimary: {
    backgroundColor: '#10B981',
  },
  actionButtonDanger: {
    backgroundColor: '#EF4444',
  },
  actionButtonSecondary: {
    backgroundColor: '#FEF3C7',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 16,
  },
});
