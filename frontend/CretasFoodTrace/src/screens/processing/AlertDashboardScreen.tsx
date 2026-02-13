import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
  ActivityIndicator, SafeAreaView, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import { apiClient } from '../../services/api/apiClient';

interface AlertSummary {
  activeCount: number;
  criticalCount: number;
  warningCount: number;
  resolvedToday: number;
}

interface ProductionAlert {
  id: number;
  alertType: string;
  level: string;
  status: string;
  metricName: string;
  currentValue: number | null;
  baselineValue: number | null;
  deviationPercent: number | null;
  description: string;
  productName: string | null;
  createdAt: string;
}

const AlertDashboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const factoryId = user?.factoryId || user?.factoryUser?.factoryId;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<AlertSummary>({ activeCount: 0, criticalCount: 0, warningCount: 0, resolvedToday: 0 });
  const [alerts, setAlerts] = useState<ProductionAlert[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const loadData = useCallback(async (refresh = false) => {
    try {
      if (refresh) setPage(0);
      const currentPage = refresh ? 0 : page;

      const [summaryRes, alertsRes]: [any, any] = await Promise.all([
        apiClient.get(`/api/mobile/${factoryId}/alerts/summary`),
        apiClient.get(`/api/mobile/${factoryId}/alerts`, {
          params: { page: currentPage, size: 20 },
        }),
      ]);

      if (summaryRes?.success) setSummary(summaryRes.data);
      if (alertsRes?.success) {
        const content = alertsRes.data?.content || [];
        setAlerts(refresh ? content : [...alerts, ...content]);
        setHasMore(content.length === 20);
      }
    } catch (error) {
      console.error('Load alerts failed:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [factoryId, page, alerts]);

  useEffect(() => { loadData(true); }, [factoryId]);

  const handleRefresh = () => { setRefreshing(true); loadData(true); };
  const handleLoadMore = () => { if (hasMore && !loading) { setPage(p => p + 1); loadData(); } };

  const acknowledgeAlert = async (alertId: number) => {
    try {
      const userId = useAuthStore.getState().getUserId();
      await apiClient.put(`/api/mobile/${factoryId}/alerts/${alertId}/acknowledge`, null, {
        params: { userId },
      });
      Alert.alert('已确认', '告警已标记为已确认');
      loadData(true);
    } catch { Alert.alert('操作失败'); }
  };

  const getLevelColor = (level: string) => {
    if (level === 'CRITICAL') return '#EF4444';
    if (level === 'WARNING') return '#F59E0B';
    return '#3B82F6';
  };

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = { ACTIVE: '待处理', ACKNOWLEDGED: '已确认', RESOLVED: '已解决', VERIFIED: '已验证' };
    return map[status] || status;
  };

  const renderSummaryCards = () => (
    <View style={styles.summaryRow}>
      <View style={[styles.summaryCard, { backgroundColor: '#FEE2E2' }]}>
        <Text style={[styles.summaryCount, { color: '#DC2626' }]}>{summary.criticalCount}</Text>
        <Text style={styles.summaryLabel}>严重</Text>
      </View>
      <View style={[styles.summaryCard, { backgroundColor: '#FEF3C7' }]}>
        <Text style={[styles.summaryCount, { color: '#D97706' }]}>{summary.warningCount}</Text>
        <Text style={styles.summaryLabel}>警告</Text>
      </View>
      <View style={[styles.summaryCard, { backgroundColor: '#DBEAFE' }]}>
        <Text style={[styles.summaryCount, { color: '#2563EB' }]}>{summary.activeCount}</Text>
        <Text style={styles.summaryLabel}>待处理</Text>
      </View>
      <View style={[styles.summaryCard, { backgroundColor: '#D1FAE5' }]}>
        <Text style={[styles.summaryCount, { color: '#059669' }]}>{summary.resolvedToday}</Text>
        <Text style={styles.summaryLabel}>今日解决</Text>
      </View>
    </View>
  );

  const renderAlert = ({ item }: { item: ProductionAlert }) => (
    <TouchableOpacity
      style={styles.alertCard}
      onPress={() => navigation.navigate('AlertDetail', { alertId: item.id })}
    >
      <View style={styles.alertHeader}>
        <View style={[styles.levelBadge, { backgroundColor: getLevelColor(item.level) }]}>
          <Text style={styles.levelText}>{item.level}</Text>
        </View>
        <Text style={styles.alertType}>{item.alertType}</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
        </View>
      </View>
      <Text style={styles.alertDesc} numberOfLines={2}>{item.description}</Text>
      <View style={styles.alertMeta}>
        <Text style={styles.metaText}>{item.metricName}</Text>
        {item.currentValue != null && (
          <Text style={[styles.metaText, { color: '#EF4444' }]}>
            当前: {item.currentValue.toFixed(1)}
          </Text>
        )}
        <Text style={styles.metaTime}>{item.createdAt?.substring(0, 16)}</Text>
      </View>
      {item.status === 'ACTIVE' && (
        <TouchableOpacity style={styles.ackButton} onPress={() => acknowledgeAlert(item.id)}>
          <Text style={styles.ackButtonText}>确认</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#4F46E5" /></View>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={alerts}
        keyExtractor={item => item.id.toString()}
        renderItem={renderAlert}
        ListHeaderComponent={renderSummaryCards}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}><Text style={styles.emptyText}>暂无告警</Text></View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F5F5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  summaryCard: { flex: 1, borderRadius: 10, padding: 12, alignItems: 'center' },
  summaryCount: { fontSize: 24, fontWeight: '700' },
  summaryLabel: { fontSize: 12, color: '#666', marginTop: 2 },
  alertCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  alertHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  levelBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginRight: 8 },
  levelText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  alertType: { fontSize: 14, fontWeight: '600', color: '#333', flex: 1 },
  statusBadge: { backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  statusText: { fontSize: 12, color: '#666' },
  alertDesc: { fontSize: 14, color: '#555', lineHeight: 20, marginBottom: 8 },
  alertMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metaText: { fontSize: 12, color: '#888' },
  metaTime: { fontSize: 12, color: '#aaa' },
  ackButton: { marginTop: 10, backgroundColor: '#F59E0B', paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  ackButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, color: '#999' },
});

export default AlertDashboardScreen;
