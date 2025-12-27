/**
 * 仓储工作台首页
 * 功能: 出入库任务概览、今日统计、库存预警、温控监控
 * 参照: /docs/prd/prototype/warehouse/index.html
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import {
  Text,
  Card,
  Surface,
  IconButton,
  Chip,
  SegmentedButtons,
  ActivityIndicator,
  useTheme,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WHHomeStackParamList } from '../../../types/navigation';
import { useAuthStore } from '../../../store/authStore';

// 主题色
const THEME_COLOR = '#4CAF50';

// 类型定义
interface OutboundTask {
  id: string;
  orderId: string;
  customer: string;
  product: string;
  quantity: number;
  unit: string;
  status: 'waiting' | 'packing' | 'packed' | 'shipped';
  dispatchTime: string;
  urgent: boolean;
}

interface InboundTask {
  id: string;
  batchId: string;
  supplier: string;
  material: string;
  quantity: number;
  unit: string;
  status: 'pending' | 'arrived' | 'inspecting' | 'completed';
  arrivalTime: string;
}

interface AlertItem {
  id: string;
  materialName: string;
  materialType: string;
  currentStock: number;
  safetyStock: number;
  unit: string;
  isExpiring: boolean;
}

interface TempZone {
  id: string;
  name: string;
  currentTemp: number;
  unit: string;
  status: 'normal' | 'warning' | 'error';
}

type NavigationProp = NativeStackNavigationProp<WHHomeStackParamList>;

export default function WHHomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();
  const { user } = useAuthStore();

  // 状态
  const [activeTab, setActiveTab] = useState<'outbound' | 'inbound'>('outbound');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 数据
  const [outboundTasks, setOutboundTasks] = useState<OutboundTask[]>([]);
  const [inboundTasks, setInboundTasks] = useState<InboundTask[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [tempZones, setTempZones] = useState<TempZone[]>([]);
  const [stats, setStats] = useState({
    todayInbound: 0,
    todayOutbound: 0,
    pendingOutbound: 0,
    alertCount: 0,
  });

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      // TODO: 替换为实际API调用
      // 模拟数据
      setOutboundTasks([
        {
          id: '1',
          orderId: 'SH-20251226-001',
          customer: '鲜食超市',
          product: '带鱼片',
          quantity: 80,
          unit: 'kg',
          status: 'waiting',
          dispatchTime: '14:00 前发出',
          urgent: true,
        },
        {
          id: '2',
          orderId: 'SH-20251226-002',
          customer: '海鲜批发市场',
          product: '鲈鱼片',
          quantity: 150,
          unit: 'kg',
          status: 'packing',
          dispatchTime: '16:00 前发出',
          urgent: false,
        },
        {
          id: '3',
          orderId: 'SH-20251226-003',
          customer: '城市生鲜店',
          product: '虾仁 + 墨鱼',
          quantity: 200,
          unit: 'kg',
          status: 'waiting',
          dispatchTime: '18:00 前发出',
          urgent: false,
        },
      ]);

      setInboundTasks([
        {
          id: '1',
          batchId: 'RK-20251227-001',
          supplier: '舟山渔业合作社',
          material: '带鱼',
          quantity: 300,
          unit: 'kg',
          status: 'pending',
          arrivalTime: '预计到货 10:30',
        },
        {
          id: '2',
          batchId: 'RK-20251227-002',
          supplier: '阳澄湖蟹业',
          material: '蟹类',
          quantity: 150,
          unit: 'kg',
          status: 'pending',
          arrivalTime: '预计到货 14:00',
        },
        {
          id: '3',
          batchId: 'RK-20251227-003',
          supplier: '海洋水产',
          material: '虾仁',
          quantity: 200,
          unit: 'kg',
          status: 'arrived',
          arrivalTime: '已到货 09:15',
        },
      ]);

      setAlerts([
        {
          id: '1',
          materialName: '带鱼 (鲜品)',
          materialType: 'fresh',
          currentStock: 85,
          safetyStock: 200,
          unit: 'kg',
          isExpiring: true,
        },
        {
          id: '2',
          materialName: '虾仁 (冻品)',
          materialType: 'frozen',
          currentStock: 120,
          safetyStock: 150,
          unit: 'kg',
          isExpiring: false,
        },
      ]);

      setTempZones([
        {
          id: '1',
          name: '冷藏区 A区',
          currentTemp: 2.5,
          unit: '°C',
          status: 'normal',
        },
        {
          id: '2',
          name: '冷冻区 B区',
          currentTemp: -18,
          unit: '°C',
          status: 'normal',
        },
      ]);

      setStats({
        todayInbound: 856,
        todayOutbound: 1240,
        pendingOutbound: 8,
        alertCount: 3,
      });

    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // 渲染状态标签
  const renderStatusBadge = (status: string, type: 'outbound' | 'inbound') => {
    let label = '';
    let color = '';

    if (type === 'outbound') {
      switch (status) {
        case 'waiting':
          label = '待打包';
          color = '#FF9800';
          break;
        case 'packing':
          label = '打包中';
          color = '#2196F3';
          break;
        case 'packed':
          label = '已打包';
          color = '#4CAF50';
          break;
        case 'shipped':
          label = '已发货';
          color = '#9E9E9E';
          break;
      }
    } else {
      switch (status) {
        case 'pending':
          label = '待入库';
          color = '#FF9800';
          break;
        case 'arrived':
          label = '已到货';
          color = '#2196F3';
          break;
        case 'inspecting':
          label = '质检中';
          color = '#9C27B0';
          break;
        case 'completed':
          label = '已入库';
          color = '#4CAF50';
          break;
      }
    }

    return (
      <Chip
        mode="flat"
        style={{ backgroundColor: color + '20' }}
        textStyle={{ color, fontSize: 12 }}
        compact
      >
        {label}
      </Chip>
    );
  };

  // 渲染出货任务卡片
  const renderOutboundCard = (task: OutboundTask) => (
    <TouchableOpacity
      key={task.id}
      onPress={() => navigation.navigate('OutboundDetail', { orderId: task.id })}
    >
      <Card style={[styles.taskCard, task.urgent && styles.urgentCard]}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <Text variant="titleSmall" style={styles.orderId}>
              {task.orderId}
            </Text>
            {renderStatusBadge(task.status, 'outbound')}
          </View>

          <View style={styles.cardInfo}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>客户</Text>
              <Text style={styles.infoValue}>{task.customer}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>产品</Text>
              <Text style={styles.infoValue}>{task.product}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>数量</Text>
              <Text style={styles.infoValue}>
                {task.quantity} {task.unit}
              </Text>
            </View>
          </View>

          <View style={styles.cardFooter}>
            <Text
              style={[
                styles.dispatchTime,
                task.urgent && styles.urgentText,
              ]}
            >
              {task.urgent && '[急] '}
              {task.dispatchTime}
            </Text>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={(e) => {
                e.stopPropagation();
                // 跳转到打包页面
              }}
            >
              <Text style={styles.actionText}>
                {task.status === 'packing' ? '完成打包' : '开始打包'}
              </Text>
            </TouchableOpacity>
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  // 渲染入库任务卡片
  const renderInboundCard = (task: InboundTask) => (
    <TouchableOpacity
      key={task.id}
      onPress={() => navigation.navigate('InboundDetail', { batchId: task.id })}
    >
      <Card style={styles.taskCard}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <Text variant="titleSmall" style={styles.orderId}>
              {task.batchId}
            </Text>
            {renderStatusBadge(task.status, 'inbound')}
          </View>

          <View style={styles.cardInfo}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>供应商</Text>
              <Text style={styles.infoValue}>{task.supplier}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>货品</Text>
              <Text style={styles.infoValue}>{task.material}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>预计数量</Text>
              <Text style={styles.infoValue}>
                {task.quantity} {task.unit}
              </Text>
            </View>
          </View>

          <View style={styles.cardFooter}>
            <Text
              style={[
                styles.dispatchTime,
                task.status === 'arrived' && styles.successText,
              ]}
            >
              {task.arrivalTime}
            </Text>
            <TouchableOpacity style={styles.actionBtn}>
              <Text style={styles.actionText}>
                {task.status === 'arrived' ? '完成入库' : '确认入库'}
              </Text>
            </TouchableOpacity>
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME_COLOR} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <Surface style={styles.header}>
        <View style={styles.headerContent}>
          <Text variant="headlineSmall" style={styles.headerTitle}>
            仓储工作台
          </Text>
          <Text variant="bodySmall" style={styles.headerSubtitle}>
            今日入库 {inboundTasks.length} 单 | 待出货 {stats.pendingOutbound} 单
          </Text>
        </View>
        <IconButton
          icon="bell-outline"
          size={24}
          onPress={() => {}}
        />
      </Surface>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[THEME_COLOR]}
          />
        }
      >
        {/* 任务Tab切换 */}
        <View style={styles.tabContainer}>
          <SegmentedButtons
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as 'outbound' | 'inbound')}
            buttons={[
              {
                value: 'outbound',
                label: `出货任务 (${outboundTasks.length})`,
              },
              {
                value: 'inbound',
                label: `入库任务 (${inboundTasks.length})`,
              },
            ]}
            style={styles.segmentedButtons}
          />
        </View>

        {/* 任务列表 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              {activeTab === 'outbound'
                ? '今日出货 - 按发出时间排序'
                : '今日入库 - 调度安排'}
            </Text>
            <TouchableOpacity>
              <Text style={styles.sectionMore}>查看全部 &gt;</Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'outbound'
            ? outboundTasks.map(renderOutboundCard)
            : inboundTasks.map(renderInboundCard)}
        </View>

        {/* 今日统计 */}
        <View style={styles.statsGrid}>
          <Surface style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#E3F2FD' }]}>
              <Text style={{ fontSize: 20 }}>📦</Text>
            </View>
            <Text style={styles.statTitle}>今日入库</Text>
            <Text style={styles.statValue}>{stats.todayInbound}</Text>
            <Text style={styles.statUnit}>kg</Text>
          </Surface>

          <Surface style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#E8F5E9' }]}>
              <Text style={{ fontSize: 20 }}>🚚</Text>
            </View>
            <Text style={styles.statTitle}>今日出库</Text>
            <Text style={styles.statValue}>{stats.todayOutbound.toLocaleString()}</Text>
            <Text style={styles.statUnit}>kg</Text>
          </Surface>

          <Surface style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#FFF3E0' }]}>
              <Text style={{ fontSize: 20 }}>⏳</Text>
            </View>
            <Text style={styles.statTitle}>待出货</Text>
            <Text style={styles.statValue}>{stats.pendingOutbound}</Text>
            <Text style={styles.statUnit}>单</Text>
          </Surface>

          <Surface style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#FFEBEE' }]}>
              <Text style={{ fontSize: 20 }}>⚠️</Text>
            </View>
            <Text style={styles.statTitle}>库存预警</Text>
            <Text style={styles.statValue}>{stats.alertCount}</Text>
            <Text style={styles.statUnit}>项</Text>
          </Surface>
        </View>

        {/* 库存预警 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              库存预警
            </Text>
            <TouchableOpacity>
              <Text style={styles.sectionMore}>查看全部 &gt;</Text>
            </TouchableOpacity>
          </View>

          {alerts.map((alert) => (
            <TouchableOpacity
              key={alert.id}
              onPress={() => navigation.navigate('AlertHandle', { alertId: alert.id })}
            >
              <Surface style={styles.alertCard}>
                <View
                  style={[
                    styles.alertIcon,
                    {
                      backgroundColor: alert.isExpiring ? '#FFEBEE' : '#FFF3E0',
                    },
                  ]}
                >
                  <Text style={{ fontSize: 16 }}>
                    {alert.isExpiring ? '🔴' : '🟡'}
                  </Text>
                </View>
                <View style={styles.alertContent}>
                  <Text style={styles.alertName}>{alert.materialName}</Text>
                  <Text style={styles.alertDetail}>
                    安全库存: {alert.safetyStock}
                    {alert.unit}
                    {alert.isExpiring && ' | 即将过期'}
                  </Text>
                </View>
                <Text style={styles.alertValue}>
                  {alert.currentStock}
                  {alert.unit}
                </Text>
              </Surface>
            </TouchableOpacity>
          ))}
        </View>

        {/* 温控监控 */}
        <TouchableOpacity
          onPress={() => navigation.navigate('TempMonitor')}
        >
          <Surface style={styles.tempMonitorCard}>
            <View style={styles.tempMonitorHeader}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                温控监控
              </Text>
              <View style={styles.tempStatus}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>在线</Text>
              </View>
            </View>

            <View style={styles.tempZones}>
              {tempZones.map((zone) => (
                <Surface key={zone.id} style={styles.tempZoneCard}>
                  <View style={styles.tempZoneHeader}>
                    <Text style={styles.tempZoneName}>{zone.name}</Text>
                    <Chip
                      mode="flat"
                      style={{
                        backgroundColor:
                          zone.status === 'normal'
                            ? '#E8F5E9'
                            : zone.status === 'warning'
                            ? '#FFF3E0'
                            : '#FFEBEE',
                      }}
                      textStyle={{
                        color:
                          zone.status === 'normal'
                            ? '#4CAF50'
                            : zone.status === 'warning'
                            ? '#FF9800'
                            : '#F44336',
                        fontSize: 11,
                      }}
                      compact
                    >
                      {zone.status === 'normal' ? '正常' : zone.status === 'warning' ? '警告' : '异常'}
                    </Chip>
                  </View>
                  <View style={styles.tempValue}>
                    <Text style={styles.tempNumber}>{zone.currentTemp}</Text>
                    <Text style={styles.tempUnit}>{zone.unit}</Text>
                  </View>
                </Surface>
              ))}
            </View>
          </Surface>
        </TouchableOpacity>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: THEME_COLOR,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    color: '#fff',
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  tabContainer: {
    marginBottom: 16,
  },
  segmentedButtons: {
    backgroundColor: '#fff',
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontWeight: '600',
    color: '#333',
  },
  sectionMore: {
    color: THEME_COLOR,
    fontSize: 14,
  },
  taskCard: {
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  urgentCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderId: {
    fontWeight: '600',
    color: '#333',
  },
  cardInfo: {
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  infoLabel: {
    width: 60,
    color: '#999',
    fontSize: 13,
  },
  infoValue: {
    flex: 1,
    color: '#333',
    fontSize: 13,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  dispatchTime: {
    color: '#666',
    fontSize: 13,
  },
  urgentText: {
    color: '#F44336',
    fontWeight: '600',
  },
  successText: {
    color: '#4CAF50',
  },
  actionBtn: {
    backgroundColor: THEME_COLOR,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
    gap: 12,
  },
  statCard: {
    width: '47%',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statTitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statUnit: {
    fontSize: 12,
    color: '#999',
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  alertIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  alertContent: {
    flex: 1,
  },
  alertName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  alertDetail: {
    fontSize: 12,
    color: '#999',
  },
  alertValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F44336',
  },
  tempMonitorCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    marginBottom: 20,
  },
  tempMonitorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  tempStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 6,
  },
  statusText: {
    fontSize: 13,
    color: '#4CAF50',
  },
  tempZones: {
    flexDirection: 'row',
    gap: 12,
  },
  tempZoneCard: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#f9f9f9',
  },
  tempZoneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tempZoneName: {
    fontSize: 12,
    color: '#666',
  },
  tempValue: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  tempNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  tempUnit: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    marginLeft: 2,
  },
});
