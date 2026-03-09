import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, Alert, RefreshControl } from 'react-native';
import { Text, Appbar, Card, Chip, ActivityIndicator, SegmentedButtons } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { workReportingApiClient } from '../../services/api/workReportingApiClient';
import type { WorkReportResponse } from '../../types/workReporting';
import { formatNumberWithCommas } from '../../utils/formatters';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  SUBMITTED: { label: '待审批', color: '#e6a23c' },
  APPROVED: { label: '已批准', color: '#67c23a' },
  REJECTED: { label: '已拒绝', color: '#f56c6c' },
  DRAFT: { label: '草稿', color: '#909399' },
};

const TYPE_MAP: Record<string, { label: string; color: string }> = {
  PROGRESS: { label: '进度', color: '#1890ff' },
  HOURS: { label: '工时', color: '#7c3aed' },
};

type FilterValue = 'ALL' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

const FILTER_TABS: { value: FilterValue; label: string }[] = [
  { value: 'ALL', label: '全部' },
  { value: 'SUBMITTED', label: '待审批' },
  { value: 'APPROVED', label: '已批准' },
  { value: 'REJECTED', label: '已拒绝' },
];

export default function MyWorkReportsScreen() {
  const navigation = useNavigation();
  const [allReports, setAllReports] = useState<WorkReportResponse[]>([]);
  const [reports, setReports] = useState<WorkReportResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterValue>('ALL');

  const loadReports = useCallback(async () => {
    try {
      const res = await workReportingApiClient.getReports({
        page: 1,
        size: 50,
      });
      if (res.success && res.data) {
        setAllReports(res.data.content || []);
      }
    } catch {
      Alert.alert('错误', '加载报工列表失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadReports();
  }, [loadReports]);

  useEffect(() => {
    if (filter === 'ALL') {
      setReports(allReports);
    } else {
      setReports(allReports.filter(r => r.status === filter));
    }
  }, [allReports, filter]);

  const onRefresh = () => { setRefreshing(true); loadReports(); };

  const renderReport = ({ item }: { item: WorkReportResponse }) => {
    const status = STATUS_MAP[item.status || ''] || { label: item.status || '-', color: '#909399' };
    const typeInfo = TYPE_MAP[item.reportType] || { label: item.reportType || '-', color: '#909399' };

    return (
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Text variant="titleMedium" style={styles.dateText}>
                {item.reportDate || '-'}
              </Text>
              <Chip
                style={[styles.typeChip, { backgroundColor: typeInfo.color + '15' }]}
                textStyle={{ color: typeInfo.color, fontSize: 11 }}
                compact
              >
                {typeInfo.label}
              </Chip>
            </View>
            <Chip
              style={[styles.chip, { backgroundColor: status.color + '20' }]}
              textStyle={{ color: status.color, fontSize: 12 }}
            >
              {status.label}
            </Chip>
          </View>

          {item.processCategory ? (
            <View style={styles.cardRow}>
              <Text style={styles.label}>工序</Text>
              <Text style={styles.value}>{item.processCategory}</Text>
            </View>
          ) : null}

          {item.productName ? (
            <View style={styles.cardRow}>
              <Text style={styles.label}>产品</Text>
              <Text style={styles.value}>{item.productName}</Text>
            </View>
          ) : null}

          {item.reportType === 'HOURS' ? (
            <>
              {item.totalWorkMinutes != null && (
                <View style={styles.cardRow}>
                  <Text style={styles.label}>总工时</Text>
                  <Text style={[styles.value, styles.highlight]}>
                    {Math.round(item.totalWorkMinutes / 60 * 10) / 10}小时
                  </Text>
                </View>
              )}
              {item.totalWorkers != null && (
                <View style={styles.cardRow}>
                  <Text style={styles.label}>工人数</Text>
                  <Text style={styles.value}>{item.totalWorkers}人</Text>
                </View>
              )}
            </>
          ) : (
            <>
              <View style={styles.cardRow}>
                <Text style={styles.label}>产量</Text>
                <Text style={[styles.value, styles.highlight]}>
                  {formatNumberWithCommas(item.outputQuantity || 0)}
                </Text>
              </View>
              {item.goodQuantity != null && (
                <View style={styles.cardRow}>
                  <Text style={styles.label}>良品</Text>
                  <Text style={styles.value}>{formatNumberWithCommas(item.goodQuantity)}</Text>
                </View>
              )}
              {item.defectQuantity != null && Number(item.defectQuantity) > 0 && (
                <View style={styles.cardRow}>
                  <Text style={styles.label}>不良品</Text>
                  <Text style={[styles.value, { color: '#f56c6c' }]}>
                    {formatNumberWithCommas(item.defectQuantity)}
                  </Text>
                </View>
              )}
            </>
          )}

          {item.status === 'REJECTED' && item.rejectionReason ? (
            <View style={styles.rejectionRow}>
              <Text style={styles.rejectionLabel}>拒绝原因</Text>
              <Text style={styles.rejectionText}>{item.rejectionReason}</Text>
            </View>
          ) : null}
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction testID="header-back-btn" onPress={() => navigation.goBack()} />
        <Appbar.Content title="我的报工" />
        <Appbar.Action icon="refresh" onPress={onRefresh} />
      </Appbar.Header>

      <View style={styles.filterRow}>
        <SegmentedButtons
          value={filter}
          onValueChange={(v) => setFilter(v as FilterValue)}
          buttons={FILTER_TABS}
          style={styles.segmented}
        />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" />
      ) : (
        <FlatList
          data={reports}
          keyExtractor={item => String(item.id)}
          renderItem={renderReport}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text style={styles.empty}>暂无报工记录</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  filterRow: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#fff' },
  segmented: { marginBottom: 4 },
  loader: { flex: 1, justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 32 },
  empty: { textAlign: 'center', color: '#999', marginTop: 40, fontSize: 14 },
  card: { marginBottom: 12, borderRadius: 12, backgroundColor: '#fff', elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 },
  dateText: { fontWeight: '600', color: '#333' },
  typeChip: { height: 24 },
  chip: { height: 28 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  label: { color: '#999', fontSize: 13 },
  value: { color: '#333', fontSize: 13 },
  highlight: { fontWeight: '600', color: '#1890ff' },
  rejectionRow: { backgroundColor: '#fef0f0', borderRadius: 8, padding: 8, marginTop: 8 },
  rejectionLabel: { color: '#f56c6c', fontSize: 12, fontWeight: '600', marginBottom: 2 },
  rejectionText: { color: '#c45656', fontSize: 13, lineHeight: 18 },
});
