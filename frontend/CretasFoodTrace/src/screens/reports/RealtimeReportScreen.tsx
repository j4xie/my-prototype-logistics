import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { Text, Appbar, Surface, Divider, ActivityIndicator, Card } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import { processingApiClient } from '../../services/api/processingApiClient';
import { equipmentApiClient } from '../../services/api/equipmentApiClient';
import { getFactoryId } from '../../types/auth';
import { handleError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建RealtimeReport专用logger
const realtimeReportLogger = logger.createContextLogger('RealtimeReport');

export default function RealtimeReportScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [realtimeData, setRealtimeData] = useState<any>(null);

  const loadRealtimeData = async () => {
    setLoading(true);
    try {
      const factoryId = getFactoryId(user);
      if (!factoryId) {
        Alert.alert('错误', '无法获取工厂信息');
        return;
      }

      realtimeReportLogger.debug('加载实时报表数据', { factoryId });

      // 并行加载多个实时数据
      const [batchesResponse, equipmentResponse] = await Promise.all([
        processingApiClient.getBatches({ page: 0, size: 5, status: 'in_progress' }, factoryId)
          .catch(() => ({ success: false, data: null })),
        equipmentApiClient.getStatistics(factoryId)
          .catch(() => ({ success: false, data: null })),
      ]);

      const activeBatches = batchesResponse.success && batchesResponse.data
        ? (batchesResponse.data.content ?? batchesResponse.data ?? []).length
        : 0;

      const activeEquipment = equipmentResponse.success && equipmentResponse.data
        ? equipmentResponse.data.activeCount || 0
        : 0;

      setRealtimeData({
        activeBatches,
        activeEquipment,
        timestamp: new Date(),
      });

      realtimeReportLogger.info('实时报表数据加载成功', {
        activeBatches,
        activeEquipment,
        factoryId,
      });
    } catch (error) {
      realtimeReportLogger.error('加载实时报表失败', error as Error, {
        factoryId: getFactoryId(user),
      });
      handleError(error, {
        showAlert: false,
        logError: true,
      });
      setRealtimeData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadRealtimeData();
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadRealtimeData();
      // 每30秒自动刷新
      const interval = setInterval(loadRealtimeData, 30000);
      return () => clearInterval(interval);
    }, [])
  );

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="实时监控" />
        <Appbar.Action icon="refresh" onPress={loadRealtimeData} />
      </Appbar.Header>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <Surface style={styles.timestampCard} elevation={1}>
          <Text variant="bodySmall" style={styles.timestampLabel}>最后更新时间</Text>
          <Text variant="bodyMedium" style={styles.timestampValue}>
            {realtimeData?.timestamp
              ? realtimeData.timestamp.toLocaleTimeString('zh-CN')
              : '--:--:--'}
          </Text>
        </Surface>

        <Surface style={styles.statsCard} elevation={1}>
          <Text variant="titleMedium" style={styles.title}>实时状态</Text>
          <Divider style={styles.divider} />

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" />
              <Text style={styles.loadingText}>加载中...</Text>
            </View>
          ) : realtimeData ? (
            <View style={styles.statsGrid}>
              <Card style={styles.statCard}>
                <Card.Content style={styles.statContent}>
                  <Text style={styles.statValue}>{realtimeData.activeBatches}</Text>
                  <Text style={styles.statLabel}>进行中批次</Text>
                </Card.Content>
              </Card>
              <Card style={styles.statCard}>
                <Card.Content style={styles.statContent}>
                  <Text style={[styles.statValue, { color: '#4CAF50' }]}>
                    {realtimeData.activeEquipment}
                  </Text>
                  <Text style={styles.statLabel}>运行中设备</Text>
                </Card.Content>
              </Card>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>暂无实时数据</Text>
            </View>
          )}
        </Surface>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { flex: 1 },
  timestampCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 12,
    margin: 16,
    marginBottom: 8,
    alignItems: 'center',
  },
  timestampLabel: { color: '#1976D2', marginBottom: 4 },
  timestampValue: { color: '#1565C0', fontWeight: '600' },
  statsCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, margin: 16, marginBottom: 8 },
  title: { fontWeight: '600', color: '#212121' },
  divider: { marginVertical: 12 },
  loadingContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20 },
  loadingText: { marginLeft: 12, color: '#999' },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  statCard: { flex: 1, marginHorizontal: 4 },
  statContent: { alignItems: 'center', paddingVertical: 20 },
  statValue: { fontSize: 36, fontWeight: '700', color: '#2196F3', marginBottom: 8 },
  statLabel: { fontSize: 13, color: '#666', textAlign: 'center' },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#999' },
});
