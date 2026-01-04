/**
 * 资源总览屏幕
 *
 * 功能：
 * - 车间级资源利用率监控
 * - 人员配置与可用性
 * - 设备状态实时显示
 * - 产能瓶颈分析
 * - 资源预警提示
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { schedulingApiClient } from '../../../services/api/schedulingApiClient';
import { equipmentApiClient } from '../../../services/api/equipmentApiClient';

const { width } = Dimensions.get('window');

// 主题色
const DISPATCHER_THEME = {
  primary: '#722ed1',
  secondary: '#a18cd1',
  accent: '#fbc2eb',
  gradientStart: '#722ed1',
  gradientEnd: '#a18cd1',
};

// 资源类型
interface Workshop {
  id: string;
  name: string;
  productionLines: ProductionLineResource[];
  totalWorkers: number;
  availableWorkers: number;
  utilization: number;
}

interface ProductionLineResource {
  id: string;
  name: string;
  status: 'running' | 'idle' | 'maintenance' | 'error';
  currentTask?: string;
  progress?: number;
  capacity: number;
  currentOutput: number;
  workers: number;
  maxWorkers: number;
}

interface Equipment {
  id: string;
  name: string;
  type: string;
  status: 'normal' | 'warning' | 'error' | 'offline';
  workshopId: string;
  workshopName: string;
  lastMaintenance?: string;
  nextMaintenance?: string;
  runtime: number;
  alerts?: string[];
}

interface ResourceAlert {
  id: string;
  type: 'capacity' | 'worker' | 'equipment' | 'material';
  level: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  resourceId: string;
  resourceName: string;
  timestamp: string;
}

/**
 * TODO: P2 Mock数据替换
 *
 * 已使用的API:
 * - schedulingApiClient.getProductionLines() - 获取产线列表
 * - schedulingApiClient.getUnresolvedAlerts() - 获取未解决告警
 * - equipmentApiClient.getEquipments() - 获取设备列表
 *
 * 数据转换说明:
 * - Workshop 从产线数据按车间分组生成
 * - Equipment 从设备API直接获取
 * - ResourceAlert 从调度告警和设备告警合并
 */

export default function ResourceOverviewScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation('dispatcher');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [alerts, setAlerts] = useState<ResourceAlert[]>([]);
  const [selectedTab, setSelectedTab] = useState<'workshop' | 'equipment' | 'alert'>('workshop');

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // 并行获取多个数据源
      const linesPromise = schedulingApiClient.getProductionLines().catch(() => ({ success: false, data: [] as any[] }));
      const alertsPromise = schedulingApiClient.getUnresolvedAlerts().catch(() => ({ success: false, data: [] as any[] }));
      const equipmentsPromise = equipmentApiClient.getEquipments().catch(() => ({ success: false, data: { content: [] as any[] } }));

      const [linesResponse, alertsResponse, equipmentsResponseRaw] = await Promise.all([
        linesPromise,
        alertsPromise,
        equipmentsPromise,
      ]);
      const equipmentsResponse = equipmentsResponseRaw as { success: boolean; data: { content: any[] } | null };

      // 处理产线数据 -> Workshop
      if (linesResponse.success && linesResponse.data) {
        const workshopMap = new Map<string, Workshop>();
        const lines = linesResponse.data;

        lines.forEach((line: any) => {
          const workshopId = line.workshopId || 'default';
          const workshopName = line.workshopName || '未分配车间';

          if (!workshopMap.has(workshopId)) {
            workshopMap.set(workshopId, {
              id: workshopId,
              name: workshopName,
              productionLines: [],
              totalWorkers: 0,
              availableWorkers: 0,
              utilization: 0,
            });
          }

          const workshop = workshopMap.get(workshopId)!;
          const lineStatus = line.status === 'active' ? 'running' : line.status === 'maintenance' ? 'maintenance' : 'idle';

          workshop.productionLines.push({
            id: line.id || String(workshop.productionLines.length + 1),
            name: line.name || `产线${workshop.productionLines.length + 1}`,
            status: lineStatus,
            currentTask: line.currentTask,
            progress: line.progress || 0,
            capacity: line.capacity || 100,
            currentOutput: line.currentOutput || 0,
            workers: line.currentWorkers || 0,
            maxWorkers: line.maxWorkers || 4,
          });

          workshop.totalWorkers += line.maxWorkers || 4;
          workshop.availableWorkers += (line.maxWorkers || 4) - (line.currentWorkers || 0);
        });

        // 计算利用率
        workshopMap.forEach(workshop => {
          const runningLines = workshop.productionLines.filter(l => l.status === 'running').length;
          workshop.utilization = Math.round((runningLines / Math.max(workshop.productionLines.length, 1)) * 100);
        });

        setWorkshops(Array.from(workshopMap.values()));
      }

      // 处理设备数据
      if (equipmentsResponse.success && equipmentsResponse.data?.content) {
        const equipmentList = equipmentsResponse.data.content;
        const transformedEquipments: Equipment[] = equipmentList.map((eq: any) => ({
          id: String(eq.id),
          name: eq.name || eq.equipmentName || '-',
          type: eq.type || '通用设备',
          status: eq.status === 'active' ? 'normal' : eq.status === 'fault' ? 'error' : eq.status === 'maintenance' ? 'warning' : 'offline',
          workshopId: eq.workshopId || '',
          workshopName: eq.workshopName || eq.location || '-',
          lastMaintenance: eq.lastMaintenanceDate,
          nextMaintenance: eq.nextMaintenanceDate,
          runtime: eq.totalRunningHours || 0,
          alerts: eq.status === 'fault' ? ['设备故障'] : eq.status === 'maintenance' ? ['维护中'] : undefined,
        }));
        setEquipments(transformedEquipments);
      }

      // 处理告警数据
      if (alertsResponse.success && alertsResponse.data) {
        const alertsList = alertsResponse.data;
        const transformedAlerts: ResourceAlert[] = alertsList.map((alert: any) => ({
          id: String(alert.id),
          type: alert.alertType?.includes('equipment') ? 'equipment' : alert.alertType?.includes('worker') ? 'worker' : 'capacity',
          level: alert.severity === 'CRITICAL' ? 'critical' : alert.severity === 'WARNING' ? 'warning' : 'info',
          title: alert.title || alert.alertType || '系统告警',
          message: alert.message || alert.description || '-',
          resourceId: String(alert.resourceId || alert.scheduleId || ''),
          resourceName: alert.resourceName || alert.scheduleName || '-',
          timestamp: alert.createdAt || alert.triggeredAt || new Date().toISOString(),
        }));
        setAlerts(transformedAlerts);
      }

    } catch (error) {
      console.error('加载资源数据失败:', error);
      if (isAxiosError(error)) {
        if (error.response?.status === 401) {
          Alert.alert('登录已过期', '请重新登录');
        } else {
          Alert.alert('加载失败', error.response?.data?.message || '网络错误');
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // 下拉刷新
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 获取产线状态信息
  const getLineStatusInfo = (status: string) => {
    switch (status) {
      case 'running':
        return { label: '运行中', color: '#52c41a', bgColor: '#f6ffed', icon: 'play-circle' };
      case 'idle':
        return { label: '空闲', color: '#8c8c8c', bgColor: '#f5f5f5', icon: 'pause-circle' };
      case 'maintenance':
        return { label: '维护中', color: '#fa8c16', bgColor: '#fff7e6', icon: 'wrench' };
      case 'error':
        return { label: '故障', color: '#ff4d4f', bgColor: '#fff1f0', icon: 'alert-circle' };
      default:
        return { label: '未知', color: '#666', bgColor: '#f5f5f5', icon: 'help-circle' };
    }
  };

  // 获取设备状态信息
  const getEquipmentStatusInfo = (status: string) => {
    switch (status) {
      case 'normal':
        return { label: '正常', color: '#52c41a', bgColor: '#f6ffed' };
      case 'warning':
        return { label: '注意', color: '#fa8c16', bgColor: '#fff7e6' };
      case 'error':
        return { label: '故障', color: '#ff4d4f', bgColor: '#fff1f0' };
      case 'offline':
        return { label: '离线', color: '#8c8c8c', bgColor: '#f5f5f5' };
      default:
        return { label: '未知', color: '#666', bgColor: '#f5f5f5' };
    }
  };

  // 获取预警级别信息
  const getAlertLevelInfo = (level: string) => {
    switch (level) {
      case 'critical':
        return { label: '紧急', color: '#ff4d4f', bgColor: '#fff1f0', icon: 'alert-octagon' };
      case 'warning':
        return { label: '警告', color: '#fa8c16', bgColor: '#fff7e6', icon: 'alert' };
      case 'info':
        return { label: '提示', color: '#1890ff', bgColor: '#e6f7ff', icon: 'information' };
      default:
        return { label: '未知', color: '#666', bgColor: '#f5f5f5', icon: 'help-circle' };
    }
  };

  // 获取预警类型信息
  const getAlertTypeInfo = (type: string) => {
    switch (type) {
      case 'capacity':
        return { label: '产能', icon: 'chart-line' };
      case 'worker':
        return { label: '人员', icon: 'account-group' };
      case 'equipment':
        return { label: '设备', icon: 'cog' };
      case 'material':
        return { label: '物料', icon: 'package-variant' };
      default:
        return { label: '其他', icon: 'dots-horizontal' };
    }
  };

  // 计算总体统计
  const stats = {
    totalLines: workshops.reduce((sum, w) => sum + w.productionLines.length, 0),
    runningLines: workshops.reduce(
      (sum, w) => sum + w.productionLines.filter(l => l.status === 'running').length,
      0
    ),
    totalWorkers: workshops.reduce((sum, w) => sum + w.totalWorkers, 0),
    availableWorkers: workshops.reduce((sum, w) => sum + w.availableWorkers, 0),
    normalEquipments: equipments.filter(e => e.status === 'normal').length,
    alertEquipments: equipments.filter(e => e.status === 'warning' || e.status === 'error').length,
    criticalAlerts: alerts.filter(a => a.level === 'critical').length,
    avgUtilization: Math.round(
      workshops.reduce((sum, w) => sum + w.utilization, 0) / workshops.length
    ),
  };

  // 渲染车间卡片
  const renderWorkshopCard = (workshop: Workshop) => {
    const utilizationColor =
      workshop.utilization >= 80 ? '#ff4d4f' :
      workshop.utilization >= 60 ? '#fa8c16' :
      workshop.utilization >= 40 ? '#52c41a' : '#8c8c8c';

    return (
      <View key={workshop.id} style={styles.workshopCard}>
        {/* 车间头部 */}
        <View style={styles.workshopHeader}>
          <View style={styles.workshopInfo}>
            <Text style={styles.workshopName}>{workshop.name}</Text>
            <Text style={styles.workshopMeta}>
              {workshop.productionLines.length} 条产线
            </Text>
          </View>
          <View style={styles.utilizationContainer}>
            <Text style={[styles.utilizationValue, { color: utilizationColor }]}>
              {workshop.utilization}%
            </Text>
            <Text style={styles.utilizationLabel}>利用率</Text>
          </View>
        </View>

        {/* 产线列表 */}
        <View style={styles.productionLines}>
          {workshop.productionLines.map((line) => {
            const statusInfo = getLineStatusInfo(line.status);
            return (
              <View key={line.id} style={styles.lineItem}>
                <View style={styles.lineHeader}>
                  <View style={styles.lineNameContainer}>
                    <MaterialCommunityIcons
                      name={statusInfo.icon as any}
                      size={16}
                      color={statusInfo.color}
                    />
                    <Text style={styles.lineName}>{line.name}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusInfo.bgColor }]}>
                      <Text style={[styles.statusText, { color: statusInfo.color }]}>
                        {statusInfo.label}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.lineWorkers}>
                    <MaterialCommunityIcons name="account" size={14} color="#999" />
                    {' '}{line.workers}/{line.maxWorkers}
                  </Text>
                </View>

                {line.status === 'running' && line.currentTask && (
                  <View style={styles.lineTask}>
                    <Text style={styles.taskName}>{line.currentTask}</Text>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${line.progress ?? 0}%`, backgroundColor: DISPATCHER_THEME.primary },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>{line.progress ?? 0}%</Text>
                  </View>
                )}

                <View style={styles.lineCapacity}>
                  <Text style={styles.capacityText}>
                    产能: {line.currentOutput}/{line.capacity} kg/h
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* 人员信息 */}
        <View style={styles.workerInfo}>
          <MaterialCommunityIcons name="account-group" size={18} color="#666" />
          <Text style={styles.workerText}>
            人员: {workshop.totalWorkers - workshop.availableWorkers}/{workshop.totalWorkers}
            <Text style={styles.workerAvailable}> (可用 {workshop.availableWorkers})</Text>
          </Text>
        </View>
      </View>
    );
  };

  // 渲染设备卡片
  const renderEquipmentCard = (equipment: Equipment) => {
    const statusInfo = getEquipmentStatusInfo(equipment.status);

    return (
      <View key={equipment.id} style={styles.equipmentCard}>
        <View style={styles.equipmentHeader}>
          <View style={styles.equipmentInfo}>
            <Text style={styles.equipmentName}>{equipment.name}</Text>
            <Text style={styles.equipmentType}>{equipment.type}</Text>
            <Text style={styles.equipmentWorkshop}>{equipment.workshopName}</Text>
          </View>
          <View style={[styles.equipmentStatusBadge, { backgroundColor: statusInfo.bgColor }]}>
            <Text style={[styles.equipmentStatusText, { color: statusInfo.color }]}>
              {statusInfo.label}
            </Text>
          </View>
        </View>

        <View style={styles.equipmentDetails}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>运行时长</Text>
            <Text style={styles.detailValue}>{equipment.runtime} 小时</Text>
          </View>
          {equipment.lastMaintenance && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>上次保养</Text>
              <Text style={styles.detailValue}>{equipment.lastMaintenance}</Text>
            </View>
          )}
          {equipment.nextMaintenance && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>下次保养</Text>
              <Text style={styles.detailValue}>{equipment.nextMaintenance}</Text>
            </View>
          )}
        </View>

        {equipment.alerts && equipment.alerts.length > 0 && (
          <View style={styles.equipmentAlerts}>
            {equipment.alerts.map((alert, index) => (
              <View key={index} style={styles.alertTag}>
                <MaterialCommunityIcons name="alert" size={12} color="#fa8c16" />
                <Text style={styles.alertTagText}>{alert}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  // 渲染预警卡片
  const renderAlertCard = (alert: ResourceAlert) => {
    const levelInfo = getAlertLevelInfo(alert.level);
    const typeInfo = getAlertTypeInfo(alert.type);

    return (
      <View key={alert.id} style={[styles.alertCard, { borderLeftColor: levelInfo.color }]}>
        <View style={styles.alertHeader}>
          <View style={styles.alertTitleContainer}>
            <MaterialCommunityIcons
              name={levelInfo.icon as any}
              size={20}
              color={levelInfo.color}
            />
            <Text style={styles.alertTitle}>{alert.title}</Text>
          </View>
          <View style={[styles.levelBadge, { backgroundColor: levelInfo.bgColor }]}>
            <Text style={[styles.levelText, { color: levelInfo.color }]}>{levelInfo.label}</Text>
          </View>
        </View>

        <Text style={styles.alertMessage}>{alert.message}</Text>

        <View style={styles.alertFooter}>
          <View style={styles.alertResource}>
            <MaterialCommunityIcons name={typeInfo.icon as any} size={14} color="#999" />
            <Text style={styles.resourceText}>{alert.resourceName}</Text>
          </View>
          <Text style={styles.alertTime}>{alert.timestamp}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* 头部 */}
      <LinearGradient
        colors={[DISPATCHER_THEME.gradientStart, DISPATCHER_THEME.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>资源总览</Text>
            <Text style={styles.headerSubtitle}>实时监控车间资源状态</Text>
          </View>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={loadData}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <MaterialCommunityIcons name="refresh" size={24} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* 统计概览 */}
      <View style={styles.statsContainer}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <View style={styles.statIconContainer}>
              <MaterialCommunityIcons name="factory" size={20} color={DISPATCHER_THEME.primary} />
            </View>
            <View>
              <Text style={styles.statValue}>{stats.runningLines}/{stats.totalLines}</Text>
              <Text style={styles.statLabel}>运行产线</Text>
            </View>
          </View>
          <View style={styles.statItem}>
            <View style={styles.statIconContainer}>
              <MaterialCommunityIcons name="account-group" size={20} color="#1890ff" />
            </View>
            <View>
              <Text style={styles.statValue}>{stats.totalWorkers - stats.availableWorkers}/{stats.totalWorkers}</Text>
              <Text style={styles.statLabel}>在岗人员</Text>
            </View>
          </View>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <View style={styles.statIconContainer}>
              <MaterialCommunityIcons name="cog" size={20} color="#52c41a" />
            </View>
            <View>
              <Text style={styles.statValue}>
                {stats.normalEquipments}
                {stats.alertEquipments > 0 && (
                  <Text style={{ color: '#fa8c16' }}> / {stats.alertEquipments}</Text>
                )}
              </Text>
              <Text style={styles.statLabel}>正常/异常设备</Text>
            </View>
          </View>
          <View style={styles.statItem}>
            <View style={styles.statIconContainer}>
              <MaterialCommunityIcons name="gauge" size={20} color="#fa8c16" />
            </View>
            <View>
              <Text style={styles.statValue}>{stats.avgUtilization}%</Text>
              <Text style={styles.statLabel}>平均利用率</Text>
            </View>
          </View>
        </View>

        {/* 紧急预警提示 */}
        {stats.criticalAlerts > 0 && (
          <TouchableOpacity
            style={styles.criticalBanner}
            onPress={() => setSelectedTab('alert')}
          >
            <MaterialCommunityIcons name="alert-octagon" size={20} color="#ff4d4f" />
            <Text style={styles.criticalText}>
              {stats.criticalAlerts} 个紧急预警需要处理
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#ff4d4f" />
          </TouchableOpacity>
        )}
      </View>

      {/* 标签切换 */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'workshop' && styles.tabActive]}
          onPress={() => setSelectedTab('workshop')}
        >
          <MaterialCommunityIcons
            name="factory"
            size={18}
            color={selectedTab === 'workshop' ? DISPATCHER_THEME.primary : '#666'}
          />
          <Text style={[styles.tabText, selectedTab === 'workshop' && styles.tabTextActive]}>
            车间
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'equipment' && styles.tabActive]}
          onPress={() => setSelectedTab('equipment')}
        >
          <MaterialCommunityIcons
            name="cog"
            size={18}
            color={selectedTab === 'equipment' ? DISPATCHER_THEME.primary : '#666'}
          />
          <Text style={[styles.tabText, selectedTab === 'equipment' && styles.tabTextActive]}>
            设备
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'alert' && styles.tabActive]}
          onPress={() => setSelectedTab('alert')}
        >
          <MaterialCommunityIcons
            name="bell"
            size={18}
            color={selectedTab === 'alert' ? DISPATCHER_THEME.primary : '#666'}
          />
          <Text style={[styles.tabText, selectedTab === 'alert' && styles.tabTextActive]}>
            预警
          </Text>
          {alerts.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{alerts.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* 内容区 */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={DISPATCHER_THEME.primary} />
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        ) : selectedTab === 'workshop' ? (
          workshops.map(workshop => renderWorkshopCard(workshop))
        ) : selectedTab === 'equipment' ? (
          equipments.map(equipment => renderEquipmentCard(equipment))
        ) : (
          alerts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="check-circle" size={64} color="#52c41a" />
              <Text style={styles.emptyText}>暂无预警</Text>
              <Text style={styles.emptySubtext}>所有资源运行正常</Text>
            </View>
          ) : (
            alerts.map(alert => renderAlertCard(alert))
          )
        )}
      </ScrollView>

      {/* 实时数据标识 */}
      <View style={styles.realtimeBadge}>
        <View style={styles.realtimeDot} />
        <Text style={styles.realtimeText}>实时数据</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: -10,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  criticalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff1f0',
    padding: 12,
    borderRadius: 8,
    marginTop: 4,
    gap: 8,
  },
  criticalText: {
    flex: 1,
    fontSize: 14,
    color: '#ff4d4f',
    fontWeight: '500',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  tabActive: {
    backgroundColor: `${DISPATCHER_THEME.primary}15`,
  },
  tabText: {
    fontSize: 14,
    color: '#666',
  },
  tabTextActive: {
    color: DISPATCHER_THEME.primary,
    fontWeight: '500',
  },
  badge: {
    backgroundColor: '#ff4d4f',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 4,
  },
  badgeText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 80,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#52c41a',
    fontWeight: '500',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
  },
  // Workshop styles
  workshopCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  workshopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  workshopInfo: {
    flex: 1,
  },
  workshopName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  workshopMeta: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  utilizationContainer: {
    alignItems: 'center',
  },
  utilizationValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  utilizationLabel: {
    fontSize: 12,
    color: '#999',
  },
  productionLines: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
    paddingTop: 12,
    gap: 12,
  },
  lineItem: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
  },
  lineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lineNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lineName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  lineWorkers: {
    fontSize: 12,
    color: '#999',
  },
  lineTask: {
    marginTop: 10,
  },
  taskName: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#eee',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    textAlign: 'right',
  },
  lineCapacity: {
    marginTop: 8,
  },
  capacityText: {
    fontSize: 12,
    color: '#999',
  },
  workerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
    paddingTop: 12,
    marginTop: 12,
    gap: 8,
  },
  workerText: {
    fontSize: 14,
    color: '#333',
  },
  workerAvailable: {
    color: '#52c41a',
  },
  // Equipment styles
  equipmentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  equipmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  equipmentInfo: {
    flex: 1,
  },
  equipmentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  equipmentType: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  equipmentWorkshop: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  equipmentStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  equipmentStatusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  equipmentDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 16,
  },
  detailItem: {
    minWidth: '30%',
  },
  detailLabel: {
    fontSize: 12,
    color: '#999',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    marginTop: 2,
  },
  equipmentAlerts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  alertTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7e6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
  },
  alertTagText: {
    fontSize: 12,
    color: '#fa8c16',
  },
  // Alert styles
  alertCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  levelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  levelText: {
    fontSize: 12,
    fontWeight: '500',
  },
  alertMessage: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
    lineHeight: 20,
  },
  alertFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  alertResource: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  resourceText: {
    fontSize: 12,
    color: '#999',
  },
  alertTime: {
    fontSize: 12,
    color: '#999',
  },
  // Realtime badge
  realtimeBadge: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    gap: 6,
  },
  realtimeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#52c41a',
  },
  realtimeText: {
    fontSize: 12,
    color: '#666',
  },
});
