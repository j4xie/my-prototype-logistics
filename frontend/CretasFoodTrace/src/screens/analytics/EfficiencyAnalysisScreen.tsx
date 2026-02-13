import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Dimensions } from 'react-native';
import {
  Text,
  Appbar,
  Card,
  Surface,
  SegmentedButtons,
  ActivityIndicator,
  Divider,
  ProgressBar,
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import { getEfficiencyDashboard, type KPIItem, type EfficiencyDashboard } from '../../services/api/productionAnalyticsApiClient';
import { getFactoryId } from '../../types/auth';
import { formatNumberWithCommas } from '../../utils/formatters';

const SCREEN_WIDTH = Dimensions.get('window').width;

type DateRangeKey = 'today' | '7d' | '30d';

function getDateRange(key: DateRangeKey): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  if (key === '7d') start.setDate(end.getDate() - 6);
  else if (key === '30d') start.setDate(end.getDate() - 29);
  const fmt = (d: Date) => d.toISOString().split('T')[0] ?? '';
  return { startDate: fmt(start), endDate: fmt(end) };
}

const GRADIENT_COLORS: Record<string, { bg: string; text: string }> = {
  purple: { bg: '#7C3AED', text: '#fff' },
  pink: { bg: '#EC4899', text: '#fff' },
  blue: { bg: '#3B82F6', text: '#fff' },
  green: { bg: '#10B981', text: '#fff' },
};

export default function EfficiencyAnalysisScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rangeKey, setRangeKey] = useState<DateRangeKey>('7d');
  const [dashboard, setDashboard] = useState<EfficiencyDashboard | null>(null);

  const loadData = useCallback(async (range?: DateRangeKey) => {
    const factoryId = getFactoryId(user);
    if (!factoryId) return;

    try {
      const params = getDateRange(range || rangeKey);
      const res = await getEfficiencyDashboard(params, factoryId);
      if (res.success && res.data) {
        setDashboard(res.data);
      }
    } catch (e) {
      console.warn('加载人效分析失败', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, rangeKey]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    loadData();
  }, []));

  const handleRangeChange = (key: string) => {
    setRangeKey(key as DateRangeKey);
    setLoading(true);
    loadData(key as DateRangeKey);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const formatValue = (kpi: KPIItem) => {
    if (kpi.value >= 10000) return `${(kpi.value / 10000).toFixed(1)}万`;
    if (Number.isInteger(kpi.value)) return kpi.value.toString();
    return kpi.value.toFixed(1);
  };

  const changeArrow = (kpi: KPIItem) => {
    if (kpi.changeType === 'up') return '↑';
    if (kpi.changeType === 'down') return '↓';
    return '—';
  };

  const changeColor = (kpi: KPIItem) => {
    if (kpi.changeType === 'up') return kpi.key === 'defect_rate' ? '#EF4444' : '#10B981';
    if (kpi.changeType === 'down') return kpi.key === 'defect_rate' ? '#10B981' : '#EF4444';
    return '#9CA3AF';
  };

  const getRankColor = (rank: number) => {
    if (rank <= 3) return '#10B981';
    if (rank <= 10) return '#F59E0B';
    return '#6B7280';
  };

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="人效分析" />
        <Appbar.Action icon="refresh" onPress={handleRefresh} />
      </Appbar.Header>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* 时间范围选择 */}
        <Surface style={styles.rangeCard} elevation={1}>
          <SegmentedButtons
            value={rangeKey}
            onValueChange={handleRangeChange}
            buttons={[
              { value: 'today', label: '今日' },
              { value: '7d', label: '近7日' },
              { value: '30d', label: '近30日' },
            ]}
          />
        </Surface>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        ) : dashboard?.kpis?.length ? (
          <>
            {/* KPI 卡片 */}
            <View style={styles.kpiGrid}>
              {dashboard.kpis.map((kpi) => {
                const colors = GRADIENT_COLORS[kpi.gradient] || GRADIENT_COLORS.purple;
                return (
                  <Surface key={kpi.key} style={[styles.kpiCard, { backgroundColor: colors.bg }]} elevation={2}>
                    <Text style={[styles.kpiLabel, { color: colors.text }]}>{kpi.label}</Text>
                    <Text style={[styles.kpiValue, { color: colors.text }]}>
                      {formatValue(kpi)}
                      {kpi.unit ? <Text style={styles.kpiUnit}> {kpi.unit}</Text> : null}
                    </Text>
                    <Text style={[styles.kpiChange, { color: changeColor(kpi) }]}>
                      {changeArrow(kpi)} {Math.abs(kpi.change).toFixed(1)}%
                    </Text>
                  </Surface>
                );
              })}
            </View>

            {/* 员工人效排名 */}
            <Card style={styles.card} mode="elevated">
              <Card.Title title="员工人效排名" titleVariant="titleMedium" />
              <Card.Content>
                {dashboard.workerRanking.length > 0 ? (
                  dashboard.workerRanking.slice(0, 15).map((d, i) => {
                    const efficiency = Number(d.efficiency) || 0;
                    const maxEff = Math.max(...dashboard.workerRanking.map(r => Number(r.efficiency) || 0), 1);
                    const yieldRate = Number(d.yield_rate) || 0;
                    return (
                      <View key={i}>
                        <View style={styles.rankRow}>
                          <View style={[styles.rankBadge, { backgroundColor: getRankColor(i + 1) }]}>
                            <Text style={styles.rankBadgeText}>{i + 1}</Text>
                          </View>
                          <View style={styles.rankInfo}>
                            <Text style={styles.rankName} numberOfLines={1}>{String(d.worker_name || '未知')}</Text>
                            <View style={styles.rankBarContainer}>
                              <View style={[styles.rankBar, { width: `${(efficiency / maxEff) * 100}%` }]} />
                            </View>
                          </View>
                          <View style={styles.rankValues}>
                            <Text style={styles.rankEfficiency}>{efficiency} /h</Text>
                            <Text style={[styles.rankYield, { color: yieldRate >= 95 ? '#10B981' : '#F59E0B' }]}>
                              良率 {yieldRate}%
                            </Text>
                          </View>
                        </View>
                        {i < Math.min(dashboard.workerRanking.length, 15) - 1 && <Divider style={{ marginVertical: 2 }} />}
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.noDataText}>暂无排名数据</Text>
                )}
              </Card.Content>
            </Card>

            {/* 人效趋势 */}
            <Card style={styles.card} mode="elevated">
              <Card.Title title="日人效趋势" titleVariant="titleMedium" />
              <Card.Content>
                {dashboard.dailyTrend.length > 0 ? (
                  dashboard.dailyTrend.map((d, i) => {
                    const efficiency = Number(d.efficiency) || 0;
                    const maxEff = Math.max(...dashboard.dailyTrend.map(r => Number(r.efficiency) || 0), 1);
                    return (
                      <View key={i} style={styles.trendRow}>
                        <Text style={styles.trendDate}>{String(d.date).slice(5)}</Text>
                        <View style={styles.trendBarContainer}>
                          <View style={[styles.trendBar, { width: `${(efficiency / maxEff) * 100}%` }]} />
                        </View>
                        <Text style={styles.trendValue}>{efficiency}</Text>
                        <Text style={styles.trendUnit}>/h</Text>
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.noDataText}>暂无趋势数据</Text>
                )}
              </Card.Content>
            </Card>

            {/* 产品工时分布 */}
            <Card style={styles.card} mode="elevated">
              <Card.Title title="产品工时分布" titleVariant="titleMedium" />
              <Card.Content>
                {dashboard.hoursByProduct.length > 0 ? (
                  dashboard.hoursByProduct.map((d, i) => {
                    const minutes = Number(d.total_minutes) || 0;
                    const hours = (minutes / 60).toFixed(1);
                    const maxMin = Math.max(...dashboard.hoursByProduct.map(r => Number(r.total_minutes) || 0), 1);
                    return (
                      <View key={i}>
                        <View style={styles.hoursRow}>
                          <Text style={styles.hoursProduct} numberOfLines={1}>{String(d.product_name)}</Text>
                          <Text style={styles.hoursValue}>{hours}h</Text>
                        </View>
                        <ProgressBar
                          progress={minutes / maxMin}
                          color={PROCESS_COLORS[i % PROCESS_COLORS.length]}
                          style={styles.hoursBar}
                        />
                        {i < dashboard.hoursByProduct.length - 1 && <Divider style={{ marginTop: 6 }} />}
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.noDataText}>暂无工时数据</Text>
                )}
              </Card.Content>
            </Card>
          </>
        ) : (
          <Surface style={styles.emptyContainer} elevation={1}>
            <Text style={styles.emptyText}>暂无人效数据</Text>
            <Text style={styles.emptySubtext}>请先提交生产报工和工时记录</Text>
          </Surface>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const PROCESS_COLORS = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4'];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { flex: 1 },
  rangeCard: { margin: 16, marginBottom: 8, padding: 12, borderRadius: 12, backgroundColor: '#fff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  loadingText: { marginTop: 12, color: '#666' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8 },
  kpiCard: { width: (SCREEN_WIDTH - 40) / 2, borderRadius: 12, padding: 16, marginBottom: 4 },
  kpiLabel: { fontSize: 12, opacity: 0.85 },
  kpiValue: { fontSize: 26, fontWeight: '700', marginTop: 4 },
  kpiUnit: { fontSize: 13, fontWeight: '400' },
  kpiChange: { fontSize: 11, marginTop: 6, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, alignSelf: 'flex-start' },
  card: { margin: 16, marginTop: 8, marginBottom: 0 },
  rankRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  rankBadge: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  rankBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  rankInfo: { flex: 1 },
  rankName: { fontSize: 14, fontWeight: '500', marginBottom: 4 },
  rankBarContainer: { height: 8, backgroundColor: '#f0f0f0', borderRadius: 4, overflow: 'hidden' },
  rankBar: { height: '100%', borderRadius: 4, backgroundColor: '#667eea' },
  rankValues: { alignItems: 'flex-end', marginLeft: 10 },
  rankEfficiency: { fontSize: 15, fontWeight: '700', color: '#333' },
  rankYield: { fontSize: 11, marginTop: 2 },
  trendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  trendDate: { width: 45, fontSize: 12, color: '#666' },
  trendBarContainer: { flex: 1, height: 16, backgroundColor: '#f0f0f0', borderRadius: 8, marginHorizontal: 8, overflow: 'hidden' },
  trendBar: { height: '100%', borderRadius: 8, backgroundColor: '#667eea' },
  trendValue: { width: 35, fontSize: 13, textAlign: 'right', fontWeight: '600' },
  trendUnit: { width: 18, fontSize: 11, color: '#999' },
  hoursRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  hoursProduct: { flex: 1, fontSize: 14 },
  hoursValue: { fontSize: 14, fontWeight: '600', color: '#333' },
  hoursBar: { height: 6, borderRadius: 3, marginTop: 4 },
  emptyContainer: { margin: 16, padding: 40, borderRadius: 12, alignItems: 'center', backgroundColor: '#fff' },
  emptyText: { fontSize: 16, color: '#333', fontWeight: '600' },
  emptySubtext: { fontSize: 13, color: '#999', marginTop: 8 },
  noDataText: { color: '#999', textAlign: 'center', paddingVertical: 16 },
});
