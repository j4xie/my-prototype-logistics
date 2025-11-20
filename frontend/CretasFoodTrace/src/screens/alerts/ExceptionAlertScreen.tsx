import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import {
  Text,
  Appbar,
  Card,
  Chip,
  SegmentedButtons,
  List,
  Badge,
  ActivityIndicator,
  Searchbar,
  FAB,
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { alertApiClient, AlertDTO } from '../../services/api/alertApiClient';
import { useAuthStore } from '../../store/authStore';
import { getFactoryId } from '../../types/auth';

type AlertType =
  | 'material_expiry'    // 原料到期
  | 'cost_overrun'       // 成本超支
  | 'conversion_abnormal' // 转换率异常
  | 'equipment_fault'    // 设备故障
  | 'employee_late';     // 员工迟到

type AlertLevel = 'critical' | 'warning' | 'info';
type AlertStatus = 'active' | 'resolved';

interface ExceptionAlert {
  id: string;
  type: AlertType;
  level: AlertLevel;
  status: AlertStatus;
  title: string;
  message: string;
  details: string;
  triggeredAt: Date;
  resolvedAt?: Date;
  relatedId?: string; // 关联的批次ID、设备ID等
}

/**
 * 异常预警系统页面
 * 功能：
 * - 5种预警类型管理
 * - 预警级别分类（critical/warning/info）
 * - 预警状态管理（active/resolved）
 * - 搜索和筛选
 * - 预警处理流程
 */
export default function ExceptionAlertScreen() {
  const navigation = useNavigation();
  const user = useAuthStore((state) => state.user);
  const factoryId = getFactoryId(user);
  const userId = user?.id;

  // 数据状态
  const [alerts, setAlerts] = useState<ExceptionAlert[]>([]);
  const [filteredAlerts, setFilteredAlerts] = useState<ExceptionAlert[]>([]);

  // UI状态
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<AlertStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<AlertType | 'all'>('all');

  /**
   * 预警类型配置
   */
  const alertTypeConfig = {
    material_expiry: {
      label: '原料到期',
      icon: 'clock-alert-outline',
      color: '#FF9800',
    },
    cost_overrun: {
      label: '成本超支',
      icon: 'currency-cny',
      color: '#F44336',
    },
    conversion_abnormal: {
      label: '转换率异常',
      icon: 'chart-line-variant',
      color: '#FF9800',
    },
    equipment_fault: {
      label: '设备故障',
      icon: 'cog-off-outline',
      color: '#F44336',
    },
    employee_late: {
      label: '员工迟到',
      icon: 'account-clock',
      color: '#2196F3',
    },
  };

  /**
   * 预警级别配置
   */
  const alertLevelConfig = {
    critical: { label: '严重', color: '#F44336', bgColor: '#FFEBEE' },
    warning: { label: '警告', color: '#FF9800', bgColor: '#FFF3E0' },
    info: { label: '提示', color: '#2196F3', bgColor: '#E3F2FD' },
  };

  /**
   * 映射后端告警类型到前端类型
   */
  const mapAlertTypeFromBackend = (backendType: string): AlertType => {
    // 根据后端告警类型映射到前端类型
    if (backendType.includes('material') || backendType.includes('expiry')) return 'material_expiry';
    if (backendType.includes('cost')) return 'cost_overrun';
    if (backendType.includes('conversion')) return 'conversion_abnormal';
    if (backendType.includes('equipment')) return 'equipment_fault';
    if (backendType.includes('employee') || backendType.includes('late')) return 'employee_late';
    return 'equipment_fault'; // 默认类型
  };

  /**
   * 映射后端severity到前端level
   */
  const mapSeverityToLevel = (severity: string): AlertLevel => {
    if (severity === 'critical') return 'critical';
    if (severity === 'warning') return 'warning';
    return 'info';
  };

  /**
   * 映射后端status到前端status
   */
  const mapStatusFromBackend = (status: string): AlertStatus => {
    if (status === 'resolved') return 'resolved';
    return 'active';
  };

  /**
   * 加载预警数据
   */
  const loadAlerts = async () => {
    setLoading(true);
    try {
      if (!factoryId) {
        console.warn('⚠️ 工厂ID不存在，无法加载告警数据');
        Alert.alert('错误', '无法获取工厂信息，请重新登录');
        return;
      }

      console.log('📡 调用后端API - 获取设备告警列表');
      const response = await alertApiClient.getEquipmentAlerts({
        factoryId,
        page: 0,
        size: 100,
      });

      if (response.success && response.data?.content) {
        console.log(`✅ 加载成功: ${response.data.content.length} 个告警`);

        // 将后端AlertDTO映射到前端ExceptionAlert
        const mappedAlerts: ExceptionAlert[] = response.data.content.map((dto: AlertDTO) => ({
          id: dto.id,
          type: mapAlertTypeFromBackend(dto.alertType),
          level: mapSeverityToLevel(dto.severity),
          status: mapStatusFromBackend(dto.status),
          title: dto.title,
          message: dto.description,
          details: dto.resolutionNotes || dto.description,
          triggeredAt: new Date(dto.createdAt),
          resolvedAt: dto.resolvedAt ? new Date(dto.resolvedAt) : undefined,
          relatedId: dto.sourceId,
        }));

        setAlerts(mappedAlerts);
        applyFilters(mappedAlerts, statusFilter, typeFilter, searchQuery);
      } else {
        console.warn('⚠️ API返回数据为空');
        setAlerts([]);
        setFilteredAlerts([]);
      }
    } catch (error: unknown) {
      console.error('❌ 加载告警列表失败:', error);
      const errorMessage = error instanceof Error ? error.message : '加载告警列表失败';
      Alert.alert('错误', errorMessage);
      setAlerts([]);
      setFilteredAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadAlerts();
    }, [])
  );

  /**
   * 刷新数据
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAlerts();
    setRefreshing(false);
  };

  /**
   * 应用筛选
   */
  const applyFilters = (
    data: ExceptionAlert[],
    status: AlertStatus | 'all',
    type: AlertType | 'all',
    search: string
  ) => {
    let filtered = [...data];

    // 状态筛选
    if (status !== 'all') {
      filtered = filtered.filter(alert => alert.status === status);
    }

    // 类型筛选
    if (type !== 'all') {
      filtered = filtered.filter(alert => alert.type === type);
    }

    // 搜索筛选
    if (search.trim()) {
      filtered = filtered.filter(
        alert =>
          alert.title.toLowerCase().includes(search.toLowerCase()) ||
          alert.message.toLowerCase().includes(search.toLowerCase())
      );
    }

    setFilteredAlerts(filtered);
  };

  /**
   * 状态筛选变更
   */
  const handleStatusFilterChange = (value: string) => {
    const newStatus = value as AlertStatus | 'all';
    setStatusFilter(newStatus);
    applyFilters(alerts, newStatus, typeFilter, searchQuery);
  };

  /**
   * 搜索
   */
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    applyFilters(alerts, statusFilter, typeFilter, query);
  };

  /**
   * 解决预警
   */
  const handleResolveAlert = async (alertId: string) => {
    try {
      if (!factoryId || !userId) {
        Alert.alert('错误', '无法获取用户信息，请重新登录');
        return;
      }

      console.log(`📡 调用后端API - 解决告警 ${alertId}`);
      const response = await alertApiClient.resolveAlert({
        factoryId,
        alertId,
        resolvedBy: userId,
        resolutionNotes: '已处理',
      });

      if (response.success) {
        console.log('✅ 告警解决成功');

        // 更新本地状态
        const updatedAlerts = alerts.map(alert =>
          alert.id === alertId
            ? { ...alert, status: 'resolved' as AlertStatus, resolvedAt: new Date() }
            : alert
        );

        setAlerts(updatedAlerts);
        applyFilters(updatedAlerts, statusFilter, typeFilter, searchQuery);
        Alert.alert('成功', '告警已成功解决');
      } else {
        Alert.alert('错误', response.message || '解决告警失败');
      }
    } catch (error: unknown) {
      console.error('❌ 解决告警失败:', error);
      const errorMessage = error instanceof Error ? error.message : '解决告警失败';
      Alert.alert('错误', errorMessage);
    }
  };

  /**
   * 获取统计数据
   */
  const getStats = () => {
    const activeAlerts = alerts.filter(a => a.status === 'active');
    const criticalAlerts = activeAlerts.filter(a => a.level === 'critical');
    const warningAlerts = activeAlerts.filter(a => a.level === 'warning');

    return {
      total: alerts.length,
      active: activeAlerts.length,
      critical: criticalAlerts.length,
      warning: warningAlerts.length,
    };
  };

  const stats = getStats();

  /**
   * 获取时间显示
   */
  const getTimeDisplay = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes}分钟前`;
    } else if (diffHours < 24) {
      return `${diffHours}小时前`;
    } else {
      return `${diffDays}天前`;
    }
  };

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="异常预警" />
        <Appbar.Action icon="bell-outline" />
      </Appbar.Header>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* 统计卡片 */}
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text variant="headlineMedium" style={styles.statValue}>
                  {stats.active}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  活跃预警
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text
                  variant="headlineMedium"
                  style={[styles.statValue, { color: '#F44336' }]}
                >
                  {stats.critical}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  严重
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text
                  variant="headlineMedium"
                  style={[styles.statValue, { color: '#FF9800' }]}
                >
                  {stats.warning}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  警告
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text variant="headlineMedium" style={styles.statValue}>
                  {stats.total}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  总计
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* 状态筛选 */}
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            <SegmentedButtons
              value={statusFilter}
              onValueChange={handleStatusFilterChange}
              buttons={[
                {
                  value: 'all',
                  label: '全部',
                  icon: 'filter-variant',
                },
                {
                  value: 'active',
                  label: '活跃',
                  icon: 'alert-circle',
                },
                {
                  value: 'resolved',
                  label: '已解决',
                  icon: 'check-circle',
                },
              ]}
            />
          </Card.Content>
        </Card>

        {/* 搜索栏 */}
        <Searchbar
          placeholder="搜索预警..."
          value={searchQuery}
          onChangeText={handleSearch}
          style={styles.searchbar}
        />

        {/* 预警列表 */}
        <Card style={styles.card} mode="elevated">
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" />
            </View>
          ) : filteredAlerts.length === 0 ? (
            <Card.Content>
              <Text variant="bodyMedium" style={styles.emptyText}>
                暂无预警
              </Text>
            </Card.Content>
          ) : (
            filteredAlerts.map((alert) => {
              const typeConfig = alertTypeConfig[alert.type];
              const levelConfig = alertLevelConfig[alert.level];

              return (
                <List.Item
                  key={alert.id}
                  title={alert.title}
                  description={alert.message}
                  left={(props) => (
                    <List.Icon {...props} icon={typeConfig.icon} color={typeConfig.color} />
                  )}
                  right={(props) => (
                    <View style={styles.alertRight}>
                      <Chip
                        mode="flat"
                        compact
                        style={{ backgroundColor: levelConfig.bgColor }}
                        textStyle={{ color: levelConfig.color, fontSize: 11 }}
                      >
                        {levelConfig.label}
                      </Chip>
                      {alert.status === 'active' && (
                        <Badge
                          size={8}
                          style={{ backgroundColor: '#F44336', marginTop: 4 }}
                        />
                      )}
                    </View>
                  )}
                  style={[
                    styles.alertItem,
                    alert.status === 'resolved' && styles.alertItemResolved,
                  ]}
                  onPress={() => {
                    // TODO: 导航到详情页或相关页面
                    if (alert.type === 'material_expiry') {
                      // navigation.navigate('MaterialBatchManagement');
                    } else if (alert.type === 'equipment_fault') {
                      // navigation.navigate('EquipmentDetail', { equipmentId: alert.relatedId });
                    }
                  }}
                  onLongPress={() => {
                    if (alert.status === 'active') {
                      handleResolveAlert(alert.id);
                    }
                  }}
                />
              );
            })
          )}
        </Card>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* 浮动操作按钮 */}
      <FAB
        icon="refresh"
        style={styles.fab}
        onPress={handleRefresh}
        label="刷新"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
  },
  card: {
    margin: 16,
    marginBottom: 0,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statLabel: {
    color: '#666',
    marginTop: 4,
  },
  searchbar: {
    margin: 16,
    marginBottom: 0,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    padding: 20,
  },
  alertItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  alertItemResolved: {
    opacity: 0.6,
  },
  alertRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  bottomPadding: {
    height: 100,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});
