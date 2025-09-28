import React, { useState, useEffect } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { processingApiClient, ProcessingBatch, QualityInspection, Equipment } from '../../services/api/processingApiClient';
import { ProcessingService } from '../../services/processing/processingService';
import { useAuthStore } from '../../store/authStore';
import { usePermissionStore } from '../../store/permissionStore';
import { NetworkManager } from '../../services/networkManager';

interface DashboardStats {
  activeBatches: number;
  completedToday: number;
  totalOutput: number;
  efficiency: number;
  passRate: number;
  avgScore: number;
  inspectionsToday: number;
  totalEquipment: number;
  activeEquipment: number;
  alertsCount: number;
  totalAlerts: number;
  criticalAlerts: number;
  unresolvedAlerts: number;
}

export const ProcessingDashboardScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const { hasPermission } = usePermissionStore();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    activeBatches: 0,
    completedToday: 0,
    totalOutput: 0,
    efficiency: 0,
    passRate: 0,
    avgScore: 0,
    inspectionsToday: 0,
    totalEquipment: 0,
    activeEquipment: 0,
    alertsCount: 0,
    totalAlerts: 0,
    criticalAlerts: 0,
    unresolvedAlerts: 0,
  });
  const [recentBatches, setRecentBatches] = useState<ProcessingBatch[]>([]);
  const [equipmentStatus, setEquipmentStatus] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 检查网络连接
      const isConnected = await NetworkManager.isConnected();
      if (!isConnected) {
        throw new Error('网络连接不可用，请检查网络设置');
      }

      // 并行加载仪表板数据
      const [
        dashboardOverviewResult,
        batchesResult,
        equipmentResult
      ] = await Promise.allSettled([
        // 获取仪表板概览
        ProcessingService.getDashboardOverview(),
        // 获取最近的生产批次
        ProcessingService.getProductionBatches({ limit: 5 }),
        // 获取设备监控状态
        ProcessingService.getEquipmentMonitoring()
      ]);

      // 处理仪表板概览数据
      if (dashboardOverviewResult.status === 'fulfilled' && dashboardOverviewResult.value.success) {
        const overview = dashboardOverviewResult.value.data;
        setStats(prev => ({
          ...prev,
          activeBatches: overview.production.activeBatches,
          completedToday: overview.production.completedToday,
          totalOutput: overview.production.totalOutput,
          efficiency: overview.production.efficiency,
          passRate: overview.quality.passRate,
          avgScore: overview.quality.avgScore,
          inspectionsToday: overview.quality.inspectionsToday,
          totalEquipment: overview.equipment.totalEquipment,
          activeEquipment: overview.equipment.activeEquipment,
          alertsCount: overview.equipment.alertsCount,
          totalAlerts: overview.alerts.total,
          criticalAlerts: overview.alerts.critical,
          unresolvedAlerts: overview.alerts.unresolved,
        }));
      } else {
        console.warn('获取仪表板概览失败:', dashboardOverviewResult);
      }

      // 处理批次数据
      if (batchesResult.status === 'fulfilled' && batchesResult.value.success) {
        const batches = batchesResult.value.data.batches || [];
        setRecentBatches(batches);
      } else {
        console.warn('获取批次数据失败:', batchesResult);
      }

      // 处理设备数据
      if (equipmentResult.status === 'fulfilled' && equipmentResult.value.success) {
        const equipment = equipmentResult.value.data.equipment || [];
        setEquipmentStatus(equipment);
      } else {
        console.warn('获取设备数据失败:', equipmentResult);
      }

      console.log('仪表板数据加载完成');

    } catch (error) {
      console.error('加载仪表板数据失败:', error);
      setError(error.message || '加载数据失败');
      Alert.alert('错误', error.message || '加载数据失败，请重试');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const navigateToWorkRecord = () => {
    navigation.navigate('WorkRecord' as never);
  };

  const navigateToRecordsList = () => {
    // 导航到记录列表页面（待实现）
    Alert.alert('提示', '记录列表功能正在开发中');
  };

  const navigateToEquipment = () => {
    // 导航到设备管理页面（待实现）
    Alert.alert('提示', '设备管理功能正在开发中');
  };

  const getRecordTypeLabel = (type: WorkRecord['recordType']): string => {
    switch (type) {
      case 'production': return '生产记录';
      case 'maintenance': return '维护记录';
      case 'quality_check': return '质检记录';
      default: return '未知类型';
    }
  };

  const getRecordTypeColor = (type: WorkRecord['recordType']): string => {
    switch (type) {
      case 'production': return '#34C759';
      case 'maintenance': return '#FF9500';
      case 'quality_check': return '#007AFF';
      default: return '#666666';
    }
  };

  const formatTimestamp = (timestamp: Date): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>加工仪表板</Text>
        <Text style={styles.subtitle}>实时监控生产状态</Text>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#007AFF"
          />
        }
      >
        {/* 统计卡片 */}
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.todayRecords}</Text>
              <Text style={styles.statLabel}>今日记录</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.activeEquipment}</Text>
              <Text style={styles.statLabel}>运行设备</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.completedTasks}</Text>
              <Text style={styles.statLabel}>完成任务</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.pendingTasks}</Text>
              <Text style={styles.statLabel}>待处理</Text>
            </View>
          </View>
        </View>

        {/* 快速操作 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>快速操作</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={navigateToWorkRecord}
            >
              <View style={styles.actionIcon}>
                <Ionicons name="add-circle" size={24} color="#007AFF" />
              </View>
              <Text style={styles.actionText}>新建记录</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={navigateToRecordsList}
            >
              <View style={styles.actionIcon}>
                <Ionicons name="list" size={24} color="#34C759" />
              </View>
              <Text style={styles.actionText}>查看记录</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={navigateToEquipment}
            >
              <View style={styles.actionIcon}>
                <Ionicons name="settings" size={24} color="#FF9500" />
              </View>
              <Text style={styles.actionText}>设备管理</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 最近记录 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>最近记录</Text>
            <TouchableOpacity onPress={navigateToRecordsList}>
              <Text style={styles.sectionLink}>查看全部</Text>
            </TouchableOpacity>
          </View>
          
          {recentRecords.length > 0 ? (
            <View style={styles.recordsList}>
              {recentRecords.map((record) => (
                <View key={record.id} style={styles.recordItem}>
                  <View style={styles.recordHeader}>
                    <View style={[
                      styles.recordTypeBadge,
                      { backgroundColor: getRecordTypeColor(record.recordType) + '20' }
                    ]}>
                      <Text style={[
                        styles.recordTypeText,
                        { color: getRecordTypeColor(record.recordType) }
                      ]}>
                        {getRecordTypeLabel(record.recordType)}
                      </Text>
                    </View>
                    <Text style={styles.recordTime}>
                      {formatTimestamp(record.timestamp)}
                    </Text>
                  </View>
                  <Text style={styles.recordDetails} numberOfLines={2}>
                    {JSON.stringify(record.workDetails)}
                  </Text>
                  {record.location && (
                    <View style={styles.locationInfo}>
                      <Ionicons name="location" size={12} color="#666666" />
                      <Text style={styles.locationText}>
                        {record.location.latitude.toFixed(4)}, {record.location.longitude.toFixed(4)}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={48} color="#CCCCCC" />
              <Text style={styles.emptyStateText}>暂无工作记录</Text>
              <TouchableOpacity
                style={styles.emptyStateButton}
                onPress={navigateToWorkRecord}
              >
                <Text style={styles.emptyStateButtonText}>创建第一条记录</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 设备状态 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>设备状态</Text>
          {equipmentStatus.length > 0 ? (
            <View style={styles.equipmentList}>
              {equipmentStatus.slice(0, 5).map((equipment) => (
                <View key={equipment.id} style={styles.equipmentItem}>
                  <View style={styles.equipmentInfo}>
                    <Text style={styles.equipmentName}>{equipment.name}</Text>
                    <Text style={styles.equipmentType}>{equipment.type} - {equipment.model}</Text>
                  </View>
                  <View style={[
                    styles.statusIndicator,
                    {
                      backgroundColor: equipment.status === 'active' ? '#34C759' :
                                     equipment.status === 'maintenance' ? '#FF9500' : '#FF3B30'
                    }
                  ]}>
                    <Text style={styles.statusText}>
                      {equipment.status === 'active' ? '运行' :
                       equipment.status === 'maintenance' ? '维护' : '离线'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="build-outline" size={48} color="#CCCCCC" />
              <Text style={styles.emptyStateText}>暂无设备信息</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E5E9',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statsContainer: {
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666666',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
    color: '#1A1A1A',
  },
  sectionLink: {
    fontSize: 14,
    color: '#007AFF',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
  },
  actionButton: {
    alignItems: 'center',
    flex: 1,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 12,
    color: '#1A1A1A',
    textAlign: 'center',
  },
  recordsList: {
    gap: 12,
  },
  recordItem: {
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recordTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  recordTypeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  recordTime: {
    fontSize: 12,
    color: '#666666',
  },
  recordDetails: {
    fontSize: 14,
    color: '#1A1A1A',
    marginBottom: 4,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 12,
    color: '#666666',
    marginLeft: 4,
  },
  equipmentList: {
    gap: 12,
  },
  equipmentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  equipmentInfo: {
    flex: 1,
  },
  equipmentName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  equipmentType: {
    fontSize: 12,
    color: '#666666',
  },
  statusIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666666',
    marginTop: 12,
    marginBottom: 16,
  },
  emptyStateButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#007AFF',
    borderRadius: 16,
  },
  emptyStateButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
});