import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { Text, Appbar, Card, Chip, DataTable, ActivityIndicator } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import { equipmentApiClient } from '../../services/api/equipmentApiClient';
import { getFactoryId } from '../../types/auth';
import { handleError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建AnomalyReport专用logger
const anomalyReportLogger = logger.createContextLogger('AnomalyReport');

export default function AnomalyReportScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);

  const loadAnomalies = async () => {
    setLoading(true);
    try {
      const factoryId = getFactoryId(user);
      if (!factoryId) {
        Alert.alert('错误', '无法获取工厂信息');
        return;
      }

      // 尝试加载设备告警（作为异常的一种）
      try {
        // TODO: equipmentApiClient.getAlerts not implemented yet
        // const alertsResponse = await equipmentApiClient.getAlerts(factoryId);
        // if (alertsResponse.success && alertsResponse.data) {
        //   const alertData = Array.isArray(alertsResponse.data)
        //     ? alertsResponse.data
        //     : alertsResponse.data.content || [];
        //   setAlerts(alertData.slice(0, 10));
        // }
        setAlerts([]);
      } catch (error) {
        anomalyReportLogger.warn('告警数据加载失败', {
          factoryId,
          error: (error as Error).message,
        });
        setAlerts([]);
      }
    } catch (error) {
      anomalyReportLogger.error('加载异常数据失败', error as Error, {
        factoryId: getFactoryId(user),
      });
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAnomalies();
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadAnomalies();
    }, [])
  );

  const getSeverityChip = (severity: string) => {
    const map: Record<string, { label: string; color: string; bgColor: string }> = {
      HIGH: { label: '高', color: '#F44336', bgColor: '#FFEBEE' },
      MEDIUM: { label: '中', color: '#FF9800', bgColor: '#FFF3E0' },
      LOW: { label: '低', color: '#4CAF50', bgColor: '#E8F5E9' },
    };
    const config = map[severity] ?? map.MEDIUM;
    return (
      <Chip mode="flat" compact style={{ backgroundColor: config?.bgColor ?? '#FFF3E0' }}
        textStyle={{ color: config?.color ?? '#FF9800', fontSize: 12 }}>
        {config?.label ?? '中'}
      </Chip>
    );
  };

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="异常报表" />
        <Appbar.Action icon="refresh" onPress={loadAnomalies} />
      </Appbar.Header>
      <ScrollView style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
        <Card style={styles.card}>
          <Card.Title title="设备告警" titleVariant="titleMedium" />
          <DataTable>
            <DataTable.Header>
              <DataTable.Title>设备</DataTable.Title>
              <DataTable.Title>类型</DataTable.Title>
              <DataTable.Title>严重度</DataTable.Title>
            </DataTable.Header>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" />
              </View>
            ) : alerts.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text variant="bodyMedium" style={styles.emptyText}>暂无告警记录</Text>
              </View>
            ) : (
              alerts.map((alert, index) => (
                <DataTable.Row key={alert.id || index}>
                  <DataTable.Cell>
                    <Text variant="bodySmall">{alert.equipmentName || `设备${alert.equipmentId}`}</Text>
                  </DataTable.Cell>
                  <DataTable.Cell>
                    <Text variant="bodySmall">{alert.alertType || alert.type || '-'}</Text>
                  </DataTable.Cell>
                  <DataTable.Cell>{getSeverityChip(alert.severity || 'MEDIUM')}</DataTable.Cell>
                </DataTable.Row>
              ))
            )}
          </DataTable>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { flex: 1 },
  card: { margin: 16 },
  loadingContainer: { padding: 40, alignItems: 'center' },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#999' },
});
