import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
} from 'react-native';
import {
  Text,
  Appbar,
  Surface,
  Chip,
  Card,
  Divider,
  ActivityIndicator,
  Button,
  ProgressBar,
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ProcessingStackParamList } from '../../types/navigation';
import { equipmentApiClient, type EquipmentStatistics } from '../../services/api/equipmentApiClient';
import { useAuthStore } from '../../store/authStore';
import { Alert } from 'react-native';
import { handleError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建EquipmentMonitoring专用logger
const equipmentMonitoringLogger = logger.createContextLogger('EquipmentMonitoring');

const screenWidth = Dimensions.get('window').width;

// Types
type EquipmentMonitoringScreenNavigationProp = NativeStackNavigationProp<
  ProcessingStackParamList,
  'EquipmentMonitoring'
>;

/**
 * 设备监控中心页面
 * P1-006: 设备监控中心
 *
 * 功能:
 * - 设备总体统计信息
 * - 设备状态分布
 * - 设备价值统计
 * - 维护提醒概览
 * - 快速导航到告警和详情
 */
export default function EquipmentMonitoringScreen() {
  const navigation = useNavigation<EquipmentMonitoringScreenNavigationProp>();

  // Get user context
  const { user } = useAuthStore();
  const factoryId = user?.factoryId || user?.factoryUser?.factoryId;

  // Data state
  const [statistics, setStatistics] = useState<EquipmentStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchStatistics();
    }, [])
  );

  const fetchStatistics = async () => {
    setLoading(true);
    try {
      // API integration - GET /equipment/overall-statistics
      equipmentMonitoringLogger.debug('获取设备统计数据', { factoryId });

      const response = await equipmentApiClient.getOverallStatistics(factoryId);

      equipmentMonitoringLogger.info('设备统计数据加载成功', {
        factoryId,
        totalCount: response.data.totalCount,
        activeCount: response.data.activeCount,
        maintenanceCount: response.data.maintenanceCount,
      });

      setStatistics(response.data);

    } catch (error) {
      equipmentMonitoringLogger.error('获取设备统计失败', error as Error, {
        factoryId,
      });

      const errorMessage = error.response?.data?.message || error.message || '无法加载设备统计，请稍后重试';
      Alert.alert('加载失败', errorMessage);

      // 不降级到mock数据，设置为null触发错误UI
      setStatistics(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchStatistics();
    setRefreshing(false);
  };

  // Helper functions
  const formatCurrency = (value: number): string => {
    return `¥${(value / 10000).toFixed(1)}万`;
  };

  const getStatusPercentage = (count: number, total: number): number => {
    return total > 0 ? (count / total) * 100 : 0;
  };

  // Loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <Appbar.Header elevated>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="设备监控" />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (!statistics) {
    return (
      <View style={styles.container}>
        <Appbar.Header elevated>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="设备监控" />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>未找到统计数据</Text>
          <Button mode="contained" onPress={fetchStatistics} style={{ marginTop: 16 }}>
            重试
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="设备监控" />
        <Appbar.Action
          icon="cog"
          onPress={() => navigation.navigate('EquipmentManagement', {})}
        />
        <Appbar.Action
          icon="bell"
          onPress={() => navigation.navigate('EquipmentAlerts', {})}
        />
      </Appbar.Header>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Overall Statistics */}
        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            设备总览
          </Text>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{statistics.totalCount}</Text>
              <Text style={styles.statLabel}>设备总数</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: '#4CAF50' }]}>
                {statistics.activeCount}
              </Text>
              <Text style={styles.statLabel}>运行中</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: '#FF9800' }]}>
                {statistics.maintenanceCount}
              </Text>
              <Text style={styles.statLabel}>维护中</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: '#9E9E9E' }]}>
                {statistics.inactiveCount}
              </Text>
              <Text style={styles.statLabel}>停用</Text>
            </View>
          </View>
        </Surface>

        {/* Status Distribution */}
        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            状态分布
          </Text>

          <View style={styles.statusItem}>
            <View style={styles.statusHeader}>
              <View style={styles.statusLeft}>
                <View style={[styles.statusDot, { backgroundColor: '#4CAF50' }]} />
                <Text style={styles.statusLabel}>运行中</Text>
              </View>
              <Text style={styles.statusValue}>
                {getStatusPercentage(statistics.activeCount, statistics.totalCount).toFixed(1)}%
              </Text>
            </View>
            <ProgressBar
              progress={statistics.activeCount / statistics.totalCount}
              color="#4CAF50"
              style={styles.progressBar}
            />
          </View>

          <View style={styles.statusItem}>
            <View style={styles.statusHeader}>
              <View style={styles.statusLeft}>
                <View style={[styles.statusDot, { backgroundColor: '#FF9800' }]} />
                <Text style={styles.statusLabel}>维护中</Text>
              </View>
              <Text style={styles.statusValue}>
                {getStatusPercentage(statistics.maintenanceCount, statistics.totalCount).toFixed(1)}%
              </Text>
            </View>
            <ProgressBar
              progress={statistics.maintenanceCount / statistics.totalCount}
              color="#FF9800"
              style={styles.progressBar}
            />
          </View>

          <View style={styles.statusItem}>
            <View style={styles.statusHeader}>
              <View style={styles.statusLeft}>
                <View style={[styles.statusDot, { backgroundColor: '#9E9E9E' }]} />
                <Text style={styles.statusLabel}>停用/报废</Text>
              </View>
              <Text style={styles.statusValue}>
                {getStatusPercentage(
                  statistics.inactiveCount + statistics.scrappedCount,
                  statistics.totalCount
                ).toFixed(1)}%
              </Text>
            </View>
            <ProgressBar
              progress={(statistics.inactiveCount + statistics.scrappedCount) / statistics.totalCount}
              color="#9E9E9E"
              style={styles.progressBar}
            />
          </View>
        </Surface>

        {/* Asset Value */}
        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            资产价值
          </Text>

          <View style={styles.valueRow}>
            <View style={styles.valueItem}>
              <Text style={styles.valueLabel}>原始总值</Text>
              <Text style={styles.valueAmount}>
                {formatCurrency(statistics.totalValue)}
              </Text>
            </View>
            <Divider style={styles.valueDivider} />
            <View style={styles.valueItem}>
              <Text style={styles.valueLabel}>折旧后价值</Text>
              <Text style={[styles.valueAmount, { color: '#2196F3' }]}>
                {formatCurrency(statistics.depreciatedValue)}
              </Text>
            </View>
          </View>

          <View style={styles.depreciationInfo}>
            <Text style={styles.depreciationLabel}>资产保值率</Text>
            <Text style={styles.depreciationValue}>
              {((statistics.depreciatedValue / statistics.totalValue) * 100).toFixed(1)}%
            </Text>
          </View>
        </Surface>

        {/* Alerts & Reminders */}
        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            提醒事项
          </Text>

          <Card style={styles.alertCard} mode="contained">
            <Card.Content>
              <View style={styles.alertRow}>
                <View style={styles.alertLeft}>
                  <Chip
                    mode="flat"
                    style={styles.alertChip}
                    textStyle={{ color: '#F44336' }}
                  >
                    {statistics.maintenanceDueCount}
                  </Chip>
                  <Text style={styles.alertText}>设备需要维护</Text>
                </View>
                <Button
                  mode="text"
                  onPress={() => navigation.navigate('EquipmentAlerts', {})}
                >
                  查看
                </Button>
              </View>
            </Card.Content>
          </Card>

          <Card style={styles.alertCard} mode="contained">
            <Card.Content>
              <View style={styles.alertRow}>
                <View style={styles.alertLeft}>
                  <Chip
                    mode="flat"
                    style={styles.alertChip}
                    textStyle={{ color: '#FF9800' }}
                  >
                    {statistics.warrantyExpiringCount}
                  </Chip>
                  <Text style={styles.alertText}>保修即将到期</Text>
                </View>
                <Button
                  mode="text"
                  onPress={() => navigation.navigate('EquipmentAlerts', {})}
                >
                  查看
                </Button>
              </View>
            </Card.Content>
          </Card>
        </Surface>

        {/* Quick Actions */}
        <View style={styles.actions}>
          <Button
            mode="contained"
            icon="wrench"
            onPress={() => navigation.navigate('EquipmentManagement', {})}
            style={styles.actionButton}
          >
            设备管理
          </Button>
          <Button
            mode="contained"
            icon="bell-alert"
            onPress={() => navigation.navigate('EquipmentAlerts', {})}
            style={styles.actionButton}
          >
            设备告警
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
  },
  errorText: {
    color: '#F44336',
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    marginBottom: 16,
    fontWeight: '600',
    color: '#212121',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  statCard: {
    width: (screenWidth - 32 - 24) / 2,
    margin: 6,
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#666',
  },
  statusItem: {
    marginBottom: 20,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  valueRow: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  valueItem: {
    flex: 1,
    alignItems: 'center',
  },
  valueDivider: {
    width: 1,
  },
  valueLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  valueAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212121',
  },
  depreciationInfo: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  depreciationLabel: {
    fontSize: 14,
    color: '#666',
  },
  depreciationValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4CAF50',
  },
  alertCard: {
    marginBottom: 12,
    backgroundColor: '#FFF9E6',
  },
  alertRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  alertChip: {
    backgroundColor: '#FFF',
    marginRight: 12,
  },
  alertText: {
    fontSize: 14,
    color: '#212121',
    flex: 1,
  },
  actions: {
    marginTop: 8,
  },
  actionButton: {
    marginBottom: 8,
  },
});
