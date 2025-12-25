import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import {
  Text,
  Appbar,
  Surface,
  Chip,
  Divider,
  ActivityIndicator,
  Button,
  DataTable,
  ProgressBar,
} from 'react-native-paper';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ProcessingStackParamList } from '../../types/navigation';
import { equipmentApiClient, type Equipment, type MaintenanceRecord as APIMaintenanceRecord } from '../../services/api/equipmentApiClient';
import { useAuthStore } from '../../store/authStore';
import { Alert } from 'react-native';
import { handleError, getErrorMsg } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建EquipmentDetail专用logger
const equipmentDetailLogger = logger.createContextLogger('EquipmentDetail');

// Types
type EquipmentDetailScreenNavigationProp = NativeStackNavigationProp<
  ProcessingStackParamList,
  'EquipmentDetail'
>;
type EquipmentDetailScreenRouteProp = RouteProp<
  ProcessingStackParamList,
  'EquipmentDetail'
>;

type EquipmentStatus = 'running' | 'idle' | 'maintenance' | 'offline';

interface EquipmentInfo {
  id: string;
  name: string;
  model: string;
  manufacturer: string;
  status: EquipmentStatus;
  location: string;
  installDate: string;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
}

interface RealtimeParameters {
  temperature?: number;
  pressure?: number;
  speed?: number;
  power?: number;
  humidity?: number;
  vibration?: number;
}

interface MaintenanceRecord {
  id: string;
  date: string;
  type: string;
  technician: string;
  description: string;
  cost: number;
}

/**
 * 设备详情页面
 * P1-005: 设备详情页
 *
 * 功能:
 * - 设备基本信息展示
 * - 实时参数监控
 * - 维护记录历史
 * - 运行状态统计
 * - 导航到告警列表
 */
export default function EquipmentDetailScreen() {
  const navigation = useNavigation<EquipmentDetailScreenNavigationProp>();
  const route = useRoute<EquipmentDetailScreenRouteProp>();
  const { equipmentId } = route.params;

  // Get user context
  const { user } = useAuthStore();
  const factoryId = user?.factoryId || user?.factoryUser?.factoryId;

  // Data state
  const [equipment, setEquipment] = useState<EquipmentInfo | null>(null);
  const [parameters, setParameters] = useState<RealtimeParameters>({});
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Statistics
  const [uptime, setUptime] = useState(0); // Percentage
  const [activeAlertsCount, setActiveAlertsCount] = useState(0);

  // Performance metrics
  const [oeeData, setOeeData] = useState<any>(null);
  const [depreciatedValue, setDepreciatedValue] = useState<number | null>(null);
  const [usageStats, setUsageStats] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      fetchEquipmentDetail();
    }, [equipmentId])
  );

  const fetchEquipmentDetail = async () => {
    setLoading(true);
    try {
      // API integration - GET /equipment/{equipmentId}
      equipmentDetailLogger.debug('获取设备详情', { factoryId, equipmentId });

      // Calculate date range for performance metrics (last 30 days)
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const [
        equipmentResponse,
        maintenanceHistoryResponse,
        oeeResponse,
        depreciatedValueResponse,
        usageStatsResponse,
        equipmentStatsResponse,
      ] = await Promise.all([
        equipmentApiClient.getEquipmentById(Number(equipmentId), factoryId),
        equipmentApiClient.getEquipmentMaintenanceHistory(Number(equipmentId), factoryId),
        // OEE Analysis
        equipmentApiClient.calculateOEE(Number(equipmentId), { startDate, endDate }, factoryId).catch(() => ({ data: null })),
        // Depreciated Value
        equipmentApiClient.calculateDepreciatedValue(Number(equipmentId), factoryId).catch(() => ({ data: null })),
        // Usage Statistics (efficiency report)
        equipmentApiClient.getEquipmentEfficiencyReport(Number(equipmentId), { startDate, endDate }, factoryId).catch(() => ({ data: null })),
        // Equipment Statistics
        equipmentApiClient.getEquipmentStatistics(Number(equipmentId), factoryId).catch(() => ({ data: null })),
      ]);

      equipmentDetailLogger.info('设备详情加载成功', {
        equipmentId,
        name: (equipmentResponse as any).data.name,
        status: (equipmentResponse as any).data.status,
      });

      const eq: Equipment = (equipmentResponse as any).data;

      // Map Equipment status to EquipmentStatus
      const mapStatus = (status: string): EquipmentStatus => {
        switch (status) {
          case 'active':
            return 'running';
          case 'inactive':
            return 'idle';
          case 'maintenance':
            return 'maintenance';
          case 'scrapped':
            return 'offline';
          default:
            return 'idle';
        }
      };

      // Transform Equipment to EquipmentInfo
      const equipmentInfo: EquipmentInfo = {
        id: String(eq.id),
        name: eq.name,
        model: eq.model || 'N/A',
        manufacturer: eq.manufacturer || 'Unknown',
        status: mapStatus(eq.status),
        location: eq.location || 'N/A',
        installDate: eq.purchaseDate || 'Unknown',
        lastMaintenanceDate: eq.lastMaintenanceDate,
        nextMaintenanceDate: eq.nextMaintenanceDate,
      };

      setEquipment(equipmentInfo);

      // ✅ Note: Real-time IoT parameters are not yet implemented
      // TODO: Integrate with IoT system in Phase 4
      // For now, set empty parameters to indicate feature is pending
      setParameters({});

      // Transform maintenance history
      const history: APIMaintenanceRecord[] = (maintenanceHistoryResponse as any).data || [];
      const records: MaintenanceRecord[] = history.map((record) => ({
        id: String(record.id),
        date: record.maintenanceDate,
        type: '定期保养', // Backend doesn't distinguish types
        technician: record.performedBy || 'Unknown',
        description: record.description || 'N/A',
        cost: record.cost || 0,
      }));

      setMaintenanceRecords(records);

      // Set performance metrics
      if ((oeeResponse as any).data) {
        setOeeData((oeeResponse as any).data);
        equipmentDetailLogger.info('OEE数据加载成功', {
          oee: ((oeeResponse as any).data.oee * 100).toFixed(1) + '%',
        });
      }

      if ((depreciatedValueResponse as any).data) {
        setDepreciatedValue((depreciatedValueResponse as any).data.depreciatedValue || (depreciatedValueResponse as any).data);
        equipmentDetailLogger.info('折旧价值加载成功', {
          value: (depreciatedValueResponse as any).data.depreciatedValue || (depreciatedValueResponse as any).data,
        });
      }

      if ((usageStatsResponse as any).data) {
        setUsageStats((usageStatsResponse as any).data);
        equipmentDetailLogger.info('使用统计加载成功', {
          utilizationRate: (usageStatsResponse as any).data.utilizationRate,
        });
      }

      // Calculate uptime from efficiency report or OEE data
      if ((usageStatsResponse as any).data?.utilizationRate !== undefined) {
        setUptime((usageStatsResponse as any).data.utilizationRate);
      } else if ((oeeResponse as any).data?.availability !== undefined) {
        setUptime((oeeResponse as any).data.availability * 100);
      } else {
        setUptime(eq.status === 'active' ? 95 : 0);
      }

      // Get active alerts count (fetch from alerts endpoint)
      try {
        const [maintenanceAlerts, warrantyAlerts] = await Promise.all([
          equipmentApiClient.getEquipmentNeedingMaintenance(factoryId),
          equipmentApiClient.getEquipmentWithExpiringWarranty(30, factoryId),
        ]);

        const totalAlerts =
          ((maintenanceAlerts as any).data || []).filter((e: Equipment) => String(e.id) === String(equipmentId)).length +
          ((warrantyAlerts as any).data || []).filter((e: Equipment) => String(e.id) === String(equipmentId)).length;

        setActiveAlertsCount(totalAlerts);
      } catch (alertError) {
        equipmentDetailLogger.warn('获取告警数量失败', alertError);
        setActiveAlertsCount(0);
      }

    } catch (error) {
      equipmentDetailLogger.error('加载设备详情失败', error, { equipmentId });

      // ✅ GOOD: 不返回假数据，使用统一错误处理
      handleError(error, {
        title: '加载失败',
        customMessage: '无法加载设备详情，请稍后重试',
      });

      // 设置为null，让UI显示错误状态
      setEquipment(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchEquipmentDetail();
    setRefreshing(false);
  };

  // Helper functions
  const getStatusLabel = (status: EquipmentStatus): string => {
    switch (status) {
      case 'running':
        return '运行中';
      case 'idle':
        return '空闲';
      case 'maintenance':
        return '维护中';
      case 'offline':
        return '离线';
    }
  };

  const getStatusColor = (status: EquipmentStatus): string => {
    switch (status) {
      case 'running':
        return '#4CAF50';
      case 'idle':
        return '#2196F3';
      case 'maintenance':
        return '#FF9800';
      case 'offline':
        return '#9E9E9E';
    }
  };

  // Loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <Appbar.Header elevated>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="设备详情" />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (!equipment) {
    return (
      <View style={styles.container}>
        <Appbar.Header elevated>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="设备详情" />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>未找到设备信息</Text>
          <Button mode="contained" onPress={fetchEquipmentDetail} style={{ marginTop: 16 }}>
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
        <Appbar.Content title={equipment.name} />
        <Appbar.Action
          icon="bell"
          onPress={() => navigation.navigate('EquipmentAlerts', { equipmentId: String(equipmentId) })}
        />
      </Appbar.Header>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Status Header */}
        <Surface style={styles.headerSection} elevation={1}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text variant="headlineSmall" style={styles.equipmentName}>
                {equipment.name}
              </Text>
              <Text variant="bodyMedium" style={styles.model}>
                {equipment.model}
              </Text>
            </View>
            <Chip
              mode="flat"
              style={[
                styles.statusChip,
                { backgroundColor: getStatusColor(equipment.status) + '20' },
              ]}
              textStyle={[
                styles.statusChipText,
                { color: getStatusColor(equipment.status) },
              ]}
            >
              {getStatusLabel(equipment.status)}
            </Chip>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{uptime}%</Text>
              <Text style={styles.statLabel}>运行率</Text>
            </View>
            <Divider style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{activeAlertsCount}</Text>
              <Text style={styles.statLabel}>活动告警</Text>
            </View>
            <Divider style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {maintenanceRecords.length}
              </Text>
              <Text style={styles.statLabel}>维护记录</Text>
            </View>
          </View>
        </Surface>

        {/* Basic Information */}
        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            基本信息
          </Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>设备编号</Text>
            <Text style={styles.infoValue}>{equipment.id}</Text>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>制造商</Text>
            <Text style={styles.infoValue}>{equipment.manufacturer}</Text>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>安装位置</Text>
            <Text style={styles.infoValue}>{equipment.location}</Text>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>安装日期</Text>
            <Text style={styles.infoValue}>{equipment.installDate}</Text>
          </View>

          {equipment.lastMaintenanceDate && (
            <>
              <Divider style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>上次维护</Text>
                <Text style={styles.infoValue}>
                  {equipment.lastMaintenanceDate}
                </Text>
              </View>
            </>
          )}

          {equipment.nextMaintenanceDate && (
            <>
              <Divider style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>下次维护</Text>
                <Text style={[styles.infoValue, styles.highlight]}>
                  {equipment.nextMaintenanceDate}
                </Text>
              </View>
            </>
          )}
        </Surface>

        {/* Realtime Parameters */}
        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            实时参数
          </Text>

          {parameters.temperature !== undefined && (
            <View style={styles.parameterItem}>
              <View style={styles.parameterHeader}>
                <Text style={styles.parameterLabel}>温度</Text>
                <Text style={styles.parameterValue}>
                  {parameters.temperature}°C
                </Text>
              </View>
              <ProgressBar
                progress={Math.abs(parameters.temperature) / 30}
                color="#2196F3"
                style={styles.progressBar}
              />
            </View>
          )}

          {parameters.pressure !== undefined && (
            <View style={styles.parameterItem}>
              <View style={styles.parameterHeader}>
                <Text style={styles.parameterLabel}>压力</Text>
                <Text style={styles.parameterValue}>
                  {parameters.pressure} bar
                </Text>
              </View>
              <ProgressBar
                progress={parameters.pressure / 5}
                color="#4CAF50"
                style={styles.progressBar}
              />
            </View>
          )}

          {parameters.speed !== undefined && (
            <View style={styles.parameterItem}>
              <View style={styles.parameterHeader}>
                <Text style={styles.parameterLabel}>转速</Text>
                <Text style={styles.parameterValue}>
                  {parameters.speed} rpm
                </Text>
              </View>
              <ProgressBar
                progress={parameters.speed / 2000}
                color="#FF9800"
                style={styles.progressBar}
              />
            </View>
          )}

          {parameters.power !== undefined && (
            <View style={styles.parameterItem}>
              <View style={styles.parameterHeader}>
                <Text style={styles.parameterLabel}>功率</Text>
                <Text style={styles.parameterValue}>
                  {parameters.power}%
                </Text>
              </View>
              <ProgressBar
                progress={parameters.power / 100}
                color="#9C27B0"
                style={styles.progressBar}
              />
            </View>
          )}
        </Surface>

        {/* Performance Analysis */}
        {(oeeData || depreciatedValue || usageStats) && (
          <Surface style={styles.section} elevation={1}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              性能分析
            </Text>

            {/* OEE Metrics */}
            {oeeData && (
              <>
                <View style={styles.oeeContainer}>
                  <Text style={styles.oeeLabel}>OEE (设备综合效率)</Text>
                  <Text style={styles.oeeValue}>
                    {(oeeData.oee * 100).toFixed(1)}%
                  </Text>
                </View>

                <View style={styles.oeeBreakdown}>
                  <View style={styles.oeeItem}>
                    <Text style={styles.oeeItemLabel}>可用率</Text>
                    <Text style={styles.oeeItemValue}>
                      {(oeeData.availability * 100).toFixed(1)}%
                    </Text>
                  </View>
                  <View style={styles.oeeItem}>
                    <Text style={styles.oeeItemLabel}>性能率</Text>
                    <Text style={styles.oeeItemValue}>
                      {(oeeData.performance * 100).toFixed(1)}%
                    </Text>
                  </View>
                  <View style={styles.oeeItem}>
                    <Text style={styles.oeeItemLabel}>质量率</Text>
                    <Text style={styles.oeeItemValue}>
                      {(oeeData.quality * 100).toFixed(1)}%
                    </Text>
                  </View>
                </View>

                <Divider style={styles.divider} />
              </>
            )}

            {/* Depreciated Value */}
            {depreciatedValue !== null && (
              <>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>当前折旧后价值</Text>
                  <Text style={[styles.infoValue, styles.valueHighlight]}>
                    ¥{depreciatedValue.toFixed(2)}
                  </Text>
                </View>

                <Divider style={styles.divider} />
              </>
            )}

            {/* Usage Statistics */}
            {usageStats && (
              <>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>总运行时间</Text>
                  <Text style={styles.infoValue}>
                    {usageStats.totalRuntime ? `${usageStats.totalRuntime}小时` : 'N/A'}
                  </Text>
                </View>

                <Divider style={styles.divider} />

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>停机时间</Text>
                  <Text style={styles.infoValue}>
                    {usageStats.downtime ? `${usageStats.downtime}小时` : 'N/A'}
                  </Text>
                </View>

                <Divider style={styles.divider} />

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>设备利用率</Text>
                  <Text style={[styles.infoValue, styles.valueHighlight]}>
                    {usageStats.utilizationRate ? `${usageStats.utilizationRate.toFixed(1)}%` : 'N/A'}
                  </Text>
                </View>

                {usageStats.mtbf && (
                  <>
                    <Divider style={styles.divider} />
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>平均故障间隔(MTBF)</Text>
                      <Text style={styles.infoValue}>
                        {usageStats.mtbf}小时
                      </Text>
                    </View>
                  </>
                )}

                {usageStats.mttr && (
                  <>
                    <Divider style={styles.divider} />
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>平均修复时间(MTTR)</Text>
                      <Text style={styles.infoValue}>
                        {usageStats.mttr}小时
                      </Text>
                    </View>
                  </>
                )}
              </>
            )}
          </Surface>
        )}

        {/* Maintenance Records */}
        <Surface style={styles.section} elevation={1}>
          <View style={styles.sectionHeader}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              维护记录
            </Text>
            <Chip mode="flat" style={styles.countChip}>
              {maintenanceRecords.length}
            </Chip>
          </View>

          {maintenanceRecords.length > 0 ? (
            <DataTable>
              <DataTable.Header>
                <DataTable.Title>日期</DataTable.Title>
                <DataTable.Title>类型</DataTable.Title>
                <DataTable.Title>技术员</DataTable.Title>
                <DataTable.Title numeric>费用</DataTable.Title>
              </DataTable.Header>

              {maintenanceRecords.slice(0, 5).map((record) => (
                <DataTable.Row key={record.id}>
                  <DataTable.Cell>{record.date}</DataTable.Cell>
                  <DataTable.Cell>{record.type}</DataTable.Cell>
                  <DataTable.Cell>{record.technician}</DataTable.Cell>
                  <DataTable.Cell numeric>¥{record.cost}</DataTable.Cell>
                </DataTable.Row>
              ))}
            </DataTable>
          ) : (
            <Text style={styles.emptyText}>暂无维护记录</Text>
          )}
        </Surface>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            mode="outlined"
            icon="bell"
            onPress={() => navigation.navigate('EquipmentAlerts', { equipmentId: String(equipmentId) })}
            style={styles.actionButton}
          >
            查看告警
          </Button>
          <Button
            mode="contained"
            icon="wrench"
            onPress={() => {}}
            style={styles.actionButton}
          >
            维护记录
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
  headerSection: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  equipmentName: {
    fontWeight: '700',
    color: '#212121',
  },
  model: {
    color: '#666',
    marginTop: 4,
  },
  statusChip: {},
  statusChipText: {
    fontWeight: '600',
    fontSize: 12,
  },
  statsRow: {
    flexDirection: 'row',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  statDivider: {
    width: 1,
    height: '100%',
  },
  section: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    marginBottom: 16,
    fontWeight: '600',
  },
  countChip: {
    backgroundColor: '#E3F2FD',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#212121',
  },
  highlight: {
    color: '#2196F3',
    fontWeight: '600',
  },
  divider: {
    marginVertical: 8,
  },
  parameterItem: {
    marginBottom: 16,
  },
  parameterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  parameterLabel: {
    fontSize: 14,
    color: '#666',
  },
  parameterValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: '#9E9E9E',
    paddingVertical: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
  },
  oeeContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  oeeLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  oeeValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  oeeBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  oeeItem: {
    alignItems: 'center',
  },
  oeeItemLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  oeeItemValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
  },
  valueHighlight: {
    color: '#2196F3',
    fontWeight: '600',
  },
});
