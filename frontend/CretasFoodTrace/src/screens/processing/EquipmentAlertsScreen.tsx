import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  Appbar,
  Chip,
  Surface,
  Searchbar,
  SegmentedButtons,
  ActivityIndicator,
  IconButton,
  Badge,
} from 'react-native-paper';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ProcessingStackParamList } from '../../types/navigation';
import { equipmentApiClient, type Equipment } from '../../services/api/equipmentApiClient';
import { useAuthStore } from '../../store/authStore';
import { Alert } from 'react-native';

// Types
type EquipmentAlertsScreenNavigationProp = NativeStackNavigationProp<
  ProcessingStackParamList,
  'EquipmentAlerts'
>;
type EquipmentAlertsScreenRouteProp = RouteProp<
  ProcessingStackParamList,
  'EquipmentAlerts'
>;

type AlertLevel = 'critical' | 'warning' | 'info';
type AlertStatus = 'active' | 'acknowledged' | 'resolved';

interface EquipmentAlert {
  id: string;
  equipmentId: string;
  equipmentName: string;
  alertType: string;
  level: AlertLevel;
  status: AlertStatus;
  message: string;
  details?: string;
  triggeredAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
}

/**
 * 设备告警系统页面
 * P1-004: 设备告警系统
 *
 * 功能:
 * - 告警列表展示（critical/warning/info）
 * - 告警状态管理（active/acknowledged/resolved）
 * - 告警确认和处理
 * - 搜索和筛选
 * - 导航到设备详情
 */
export default function EquipmentAlertsScreen() {
  const navigation = useNavigation<EquipmentAlertsScreenNavigationProp>();
  const route = useRoute<EquipmentAlertsScreenRouteProp>();
  const { equipmentId } = route.params || {};

  // Get user context
  const { user } = useAuthStore();
  const factoryId = user?.factoryId || user?.factoryUser?.factoryId;

  // Data state
  const [alerts, setAlerts] = useState<EquipmentAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<AlertLevel | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<AlertStatus | 'all'>('active');

  useFocusEffect(
    useCallback(() => {
      fetchAlerts();
    }, [equipmentId, levelFilter, statusFilter])
  );

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      // API integration - GET /equipment/alerts (with pagination and filtering)
      console.log('🔍 Fetching equipment alerts...', { factoryId, statusFilter });

      const response = await equipmentApiClient.getEquipmentAlerts(
        {
          status: statusFilter !== 'all' ? statusFilter.toUpperCase() : undefined,
          page: 1,
          size: 100,
        },
        factoryId
      );

      console.log('✅ Equipment alerts loaded:', response.data.totalElements, 'alerts');

      // Transform API response to local format
      const transformedAlerts: EquipmentAlert[] = response.data.content.map((alert) => ({
        id: String(alert.id),
        equipmentId: String(alert.equipmentId),
        equipmentName: alert.equipmentName,
        alertType: alert.alertType,
        level: alert.level.toLowerCase() as AlertLevel,
        status: alert.status.toLowerCase() as AlertStatus,
        message: alert.message,
        details: alert.details,
        triggeredAt: new Date(alert.triggeredAt),
        acknowledgedAt: alert.acknowledgedAt ? new Date(alert.acknowledgedAt) : undefined,
        acknowledgedBy: alert.acknowledgedBy,
        resolvedAt: alert.resolvedAt ? new Date(alert.resolvedAt) : undefined,
        resolvedBy: alert.resolvedBy,
      }));

      // Filter by equipmentId if provided
      let filteredAlerts = equipmentId
        ? transformedAlerts.filter((a) => a.equipmentId === equipmentId)
        : transformedAlerts;

      // Filter by level
      if (levelFilter !== 'all') {
        filteredAlerts = filteredAlerts.filter((a) => a.level === levelFilter);
      }

      setAlerts(filteredAlerts);

    } catch (error: any) {
      console.error('❌ Failed to fetch equipment alerts:', error);
      Alert.alert('加载失败', error.response?.data?.message || '无法加载设备告警，请稍后重试');
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAlerts();
    setRefreshing(false);
  };

  const handleAlertPress = (alert: EquipmentAlert) => {
    navigation.navigate('EquipmentDetail', { equipmentId: alert.equipmentId });
  };

  const handleAcknowledge = async (alertId: string) => {
    try {
      console.log('🔔 Acknowledging alert:', alertId);

      const response = await equipmentApiClient.acknowledgeAlert(alertId, undefined, factoryId);

      if (response.success) {
        Alert.alert('成功', '告警已确认');
        // Refresh alerts list
        await fetchAlerts();
      }
    } catch (error: any) {
      console.error('❌ Failed to acknowledge alert:', error);
      const errorMessage = error.response?.data?.message || '确认告警失败，请稍后重试';
      Alert.alert('操作失败', errorMessage);
    }
  };

  const handleResolve = async (alertId: string) => {
    Alert.alert(
      '解决告警',
      '请输入解决方案备注（可选）',
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '确定',
          onPress: async () => {
            try {
              console.log('✅ Resolving alert:', alertId);

              const response = await equipmentApiClient.resolveAlert(
                alertId,
                undefined,
                factoryId
              );

              if (response.success) {
                Alert.alert('成功', '告警已解决');
                // Refresh alerts list
                await fetchAlerts();
              }
            } catch (error: any) {
              console.error('❌ Failed to resolve alert:', error);
              const errorMessage = error.response?.data?.message || '解决告警失败，请稍后重试';
              Alert.alert('操作失败', errorMessage);
            }
          },
        },
      ]
    );
  };

  // Helper functions
  const getLevelLabel = (level: AlertLevel): string => {
    switch (level) {
      case 'critical':
        return '严重';
      case 'warning':
        return '警告';
      case 'info':
        return '提示';
    }
  };

  const getLevelColor = (level: AlertLevel): string => {
    switch (level) {
      case 'critical':
        return '#F44336';
      case 'warning':
        return '#FF9800';
      case 'info':
        return '#2196F3';
    }
  };

  const getLevelIcon = (level: AlertLevel): string => {
    switch (level) {
      case 'critical':
        return 'alert-circle';
      case 'warning':
        return 'alert';
      case 'info':
        return 'information';
    }
  };

  const getStatusLabel = (status: AlertStatus): string => {
    switch (status) {
      case 'active':
        return '活动';
      case 'acknowledged':
        return '已确认';
      case 'resolved':
        return '已解决';
    }
  };

  const getStatusColor = (status: AlertStatus): string => {
    switch (status) {
      case 'active':
        return '#F44336';
      case 'acknowledged':
        return '#FF9800';
      case 'resolved':
        return '#4CAF50';
    }
  };

  // Statistics
  const criticalCount = alerts.filter(
    (a) => a.level === 'critical' && a.status === 'active'
  ).length;
  const warningCount = alerts.filter(
    (a) => a.level === 'warning' && a.status === 'active'
  ).length;
  const activeCount = alerts.filter((a) => a.status === 'active').length;

  // Filter data based on search query
  const filteredAlerts = alerts.filter(
    (item) =>
      item.equipmentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.alertType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.message.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Render item
  const renderItem = ({ item }: { item: EquipmentAlert }) => (
    <TouchableOpacity onPress={() => handleAlertPress(item)}>
      <Surface style={styles.card} elevation={1}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <IconButton
              icon={getLevelIcon(item.level)}
              size={24}
              iconColor={getLevelColor(item.level)}
              style={styles.levelIcon}
            />
            <View style={styles.headerInfo}>
              <Text variant="titleMedium" style={styles.equipmentName}>
                {item.equipmentName}
              </Text>
              <Text variant="bodySmall" style={styles.alertType}>
                {item.alertType}
              </Text>
            </View>
          </View>
          <View style={styles.cardHeaderRight}>
            <Chip
              mode="flat"
              style={[
                styles.levelChip,
                { backgroundColor: getLevelColor(item.level) + '20' },
              ]}
              textStyle={[
                styles.levelChipText,
                { color: getLevelColor(item.level) },
              ]}
            >
              {getLevelLabel(item.level)}
            </Chip>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.message}>{item.message}</Text>
          {item.details && (
            <Text style={styles.details}>{item.details}</Text>
          )}

          <View style={styles.metaRow}>
            <Chip
              mode="flat"
              style={[
                styles.statusChip,
                { backgroundColor: getStatusColor(item.status) + '20' },
              ]}
              textStyle={[
                styles.statusChipText,
                { color: getStatusColor(item.status) },
              ]}
            >
              {getStatusLabel(item.status)}
            </Chip>
            <Text style={styles.timestamp}>
              {item.triggeredAt.toLocaleString('zh-CN', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>

          {item.acknowledgedBy && (
            <Text style={styles.acknowledgedInfo}>
              已确认 · {item.acknowledgedBy} ·{' '}
              {item.acknowledgedAt?.toLocaleString('zh-CN', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          )}

          {item.status === 'active' && (
            <View style={styles.actions}>
              <IconButton
                icon="check"
                size={20}
                mode="contained"
                containerColor="#FF9800"
                iconColor="#FFF"
                onPress={() => handleAcknowledge(item.id)}
              />
              <IconButton
                icon="check-all"
                size={20}
                mode="contained"
                containerColor="#4CAF50"
                iconColor="#FFF"
                onPress={() => handleResolve(item.id)}
              />
            </View>
          )}

          {item.status === 'acknowledged' && (
            <View style={styles.actions}>
              <IconButton
                icon="check-all"
                size={20}
                mode="contained"
                containerColor="#4CAF50"
                iconColor="#FFF"
                onPress={() => handleResolve(item.id)}
              />
            </View>
          )}
        </View>
      </Surface>
    </TouchableOpacity>
  );

  // Empty state
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <IconButton icon="bell-off-outline" size={64} iconColor="#BDBDBD" />
      <Text variant="bodyLarge" style={styles.emptyText}>
        暂无告警
      </Text>
      <Text variant="bodySmall" style={styles.emptyHint}>
        设备运行正常
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="设备告警" />
        {activeCount > 0 && (
          <Badge size={24} style={styles.badge}>
            {activeCount}
          </Badge>
        )}
      </Appbar.Header>

      {/* Statistics Bar */}
      <Surface style={styles.statsBar} elevation={1}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{criticalCount}</Text>
          <Text style={[styles.statLabel, { color: '#F44336' }]}>严重</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{warningCount}</Text>
          <Text style={[styles.statLabel, { color: '#FF9800' }]}>警告</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{activeCount}</Text>
          <Text style={styles.statLabel}>活动中</Text>
        </View>
      </Surface>

      <Searchbar
        placeholder="搜索设备、告警类型..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchbar}
      />

      <SegmentedButtons
        value={statusFilter}
        onValueChange={(value) => setStatusFilter(value as AlertStatus | 'all')}
        buttons={[
          { value: 'active', label: '活动' },
          { value: 'acknowledged', label: '已确认' },
          { value: 'resolved', label: '已解决' },
          { value: 'all', label: '全部' },
        ]}
        style={styles.segmentedButtons}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredAlerts}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={renderEmpty}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 16,
    backgroundColor: '#F44336',
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
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
    backgroundColor: '#E0E0E0',
  },
  searchbar: {
    margin: 16,
    marginBottom: 8,
  },
  segmentedButtons: {
    marginHorizontal: 16,
    marginBottom: 12,
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
  listContent: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  cardHeaderRight: {},
  levelIcon: {
    margin: 0,
    marginRight: 8,
  },
  headerInfo: {
    flex: 1,
  },
  equipmentName: {
    fontWeight: '600',
    color: '#212121',
  },
  alertType: {
    color: '#666',
    marginTop: 2,
  },
  levelChip: {
    alignSelf: 'flex-start',
  },
  levelChipText: {
    fontWeight: '600',
    fontSize: 11,
  },
  cardBody: {
    gap: 8,
  },
  message: {
    fontSize: 14,
    fontWeight: '500',
    color: '#212121',
    lineHeight: 20,
  },
  details: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  statusChip: {},
  statusChipText: {
    fontWeight: '600',
    fontSize: 11,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
  },
  acknowledgedInfo: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    color: '#9E9E9E',
    marginBottom: 8,
    marginTop: 16,
  },
  emptyHint: {
    color: '#BDBDBD',
  },
});
