import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, Alert, RefreshControl } from 'react-native';
import { Text, Appbar, Card, Chip, Button, ActivityIndicator, SegmentedButtons } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FAManagementStackParamList } from '../../../types/navigation';
import { workReportingApiClient } from '../../../services/api/workReportingApiClient';
import type { WorkReportResponse } from '../../../types/workReporting';
import { formatNumberWithCommas, formatDate } from '../../../utils/formatters';

type Nav = NativeStackNavigationProp<FAManagementStackParamList>;

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  SUBMITTED: { label: '待审批', color: '#e6a23c' },
  APPROVED: { label: '已批准', color: '#67c23a' },
  REJECTED: { label: '已拒绝', color: '#f56c6c' },
  DRAFT: { label: '草稿', color: '#909399' },
};

type FilterValue = 'ALL' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

const FILTER_TABS: { value: FilterValue; label: string }[] = [
  { value: 'ALL', label: '全部' },
  { value: 'SUBMITTED', label: '待审批' },
  { value: 'APPROVED', label: '已批准' },
  { value: 'REJECTED', label: '已拒绝' },
];

export default function WorkReportApprovalScreen() {
  const navigation = useNavigation<Nav>();
  const [reports, setReports] = useState<WorkReportResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterValue>('SUBMITTED');

  const loadReports = useCallback(async () => {
    try {
      const res = await workReportingApiClient.getReports({
        type: 'PROGRESS',
        page: 1,
        size: 50,
      });
      if (res.success && res.data) {
        const items = res.data.content || [];
        setReports(filter === 'ALL' ? items : items.filter(r => r.status === filter));
      }
    } catch {
      Alert.alert('错误', '加载报工列表失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => { setLoading(true); loadReports(); }, [loadReports]);

  const onRefresh = () => { setRefreshing(true); loadReports(); };

  const handleApprove = (reportId: number) => {
    Alert.alert('确认审批', '确定批准该报工记录？', [
      { text: '取消', style: 'cancel' },
      {
        text: '批准', onPress: async () => {
          try {
            const res = await workReportingApiClient.approveReport(reportId, true);
            if (res.success) {
              Alert.alert('成功', '已批准');
              loadReports();
            }
          } catch { Alert.alert('错误', '审批失败'); }
        },
      },
    ]);
  };

  const handleReject = (reportId: number) => {
    Alert.alert('确认拒绝', '确定拒绝该报工记录？', [
      { text: '取消', style: 'cancel' },
      {
        text: '拒绝', style: 'destructive', onPress: async () => {
          try {
            const res = await workReportingApiClient.approveReport(reportId, false);
            if (res.success) {
              Alert.alert('成功', '已拒绝');
              loadReports();
            }
          } catch { Alert.alert('错误', '操作失败'); }
        },
      },
    ]);
  };

  const renderReport = ({ item }: { item: WorkReportResponse }) => {
    const status = STATUS_MAP[item.status || ''] || { label: item.status || '-', color: '#909399' };
    return (
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <Text variant="titleMedium" style={styles.reporterName}>
              {item.reporterName || `工人#${item.workerId}`}
            </Text>
            <Chip
              style={[styles.chip, { backgroundColor: status.color + '20' }]}
              textStyle={{ color: status.color, fontSize: 12 }}
            >
              {status.label}
            </Chip>
          </View>

          {item.productName ? (
            <View style={styles.cardRow}>
              <Text style={styles.label}>产品</Text>
              <Text style={styles.value}>{item.productName}</Text>
            </View>
          ) : null}

          {item.processCategory ? (
            <View style={styles.cardRow}>
              <Text style={styles.label}>工序</Text>
              <Text style={styles.value}>{item.processCategory}</Text>
            </View>
          ) : null}

          <View style={styles.cardRow}>
            <Text style={styles.label}>产量</Text>
            <Text style={[styles.value, styles.outputQty]}>
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

          <View style={styles.cardRow}>
            <Text style={styles.label}>日期</Text>
            <Text style={styles.value}>{item.reportDate || '-'}</Text>
          </View>

          {item.status === 'SUBMITTED' && (
            <View style={styles.actions}>
              <Button
                mode="contained"
                compact
                onPress={() => handleApprove(item.id)}
                style={styles.actionBtn}
                buttonColor="#67c23a"
              >
                批准
              </Button>
              <Button
                mode="outlined"
                compact
                textColor="#f56c6c"
                onPress={() => handleReject(item.id)}
                style={styles.actionBtn}
              >
                拒绝
              </Button>
            </View>
          )}
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="生产报工审批" />
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
  reporterName: { fontWeight: '600', color: '#333', flex: 1 },
  chip: { height: 28 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  label: { color: '#999', fontSize: 13 },
  value: { color: '#333', fontSize: 13 },
  outputQty: { fontWeight: '600', color: '#1890ff' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, gap: 8 },
  actionBtn: { borderRadius: 8 },
});
