/**
 * SampleRequestListScreen — S-RD-1 / N48 研发样品列表 (Sprint 2 / Track F).
 *
 * 列表展示 ProductSample (Sprint 1 已 ship entity), 含 status filter chip + 紧急色卡.
 * 长按 / tap row 跳 SampleRequestDetailScreen (含 approve/reject).
 *
 * 注: navigator 路由整合 (加到哪个 StackNavigator) 由 organizer 拍板, 留 follow-up PR.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { sampleApiClient, type ProductSample, type SampleStatus } from '../../services/api/sampleApiClient';

type RDStackParamList = {
  SampleRequestList: undefined;
  SampleRequestDetail: { sampleId: string };
};

type Nav = NativeStackNavigationProp<RDStackParamList, 'SampleRequestList'>;

const STATUS_FILTERS: Array<{ key: SampleStatus | 'ALL'; label: string }> = [
  { key: 'ALL', label: '全部' },
  { key: 'DRAFT', label: '草稿' },
  { key: 'IN_PROGRESS', label: '进行中' },
  { key: 'SUBMITTED', label: '待审' },
  { key: 'APPROVED', label: '已通过' },
  { key: 'REJECTED', label: '已驳回' },
];

const STATUS_COLORS: Record<SampleStatus, { bg: string; fg: string }> = {
  DRAFT:       { bg: '#E5E7EB', fg: '#374151' },
  IN_PROGRESS: { bg: '#FEF3C7', fg: '#92400E' },
  TESTING:     { bg: '#DBEAFE', fg: '#1E40AF' },
  SUBMITTED:   { bg: '#FED7AA', fg: '#9A3412' },
  APPROVED:    { bg: '#D1FAE5', fg: '#065F46' },
  REJECTED:    { bg: '#FEE2E2', fg: '#991B1B' },
};

const STATUS_LABEL: Record<SampleStatus, string> = {
  DRAFT: '草稿',
  IN_PROGRESS: '进行中',
  TESTING: '测试中',
  SUBMITTED: '待审核',
  APPROVED: '已通过',
  REJECTED: '已驳回',
};

export const SampleRequestListScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const [statusFilter, setStatusFilter] = useState<SampleStatus | 'ALL'>('ALL');
  const [samples, setSamples] = useState<ProductSample[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await sampleApiClient.listSamples({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        page: 0,
        size: 50,
      });
      setSamples(page.content ?? []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '加载失败';
      setError(msg);
      setSamples([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const renderItem = useCallback(
    ({ item }: { item: ProductSample }) => {
      const statusStyle = STATUS_COLORS[item.status] ?? STATUS_COLORS.DRAFT;
      return (
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('SampleRequestDetail', { sampleId: item.id })}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.code}>{item.sampleCode}</Text>
            <View style={[styles.statusChip, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.statusText, { color: statusStyle.fg }]}>
                {STATUS_LABEL[item.status] ?? item.status}
              </Text>
            </View>
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          {item.customerName ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              客户: {item.customerName}
            </Text>
          ) : null}
          {item.mainMaterial ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              主原料: {item.mainMaterial}
            </Text>
          ) : null}
        </TouchableOpacity>
      );
    },
    [navigation],
  );

  const headerFilter = useMemo(
    () => (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {STATUS_FILTERS.map(f => {
          const active = statusFilter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setStatusFilter(f.key)}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    ),
    [statusFilter],
  );

  if (loading && !refreshing && samples.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {headerFilter}
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={load}>
            <Text style={styles.retryText}>重试</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <FlatList
        data={samples}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {statusFilter === 'ALL' ? '暂无样品' : `暂无 ${STATUS_FILTERS.find(s => s.key === statusFilter)?.label} 样品`}
              </Text>
            </View>
          ) : null
        }
        contentContainerStyle={samples.length === 0 ? styles.emptyContainer : undefined}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filterRow: { paddingHorizontal: 12, paddingVertical: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 8,
  },
  filterChipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  filterText: { fontSize: 14, color: '#374151' },
  filterTextActive: { color: '#fff', fontWeight: '600' },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginVertical: 6,
    padding: 14,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  code: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  statusChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  statusText: { fontSize: 12, fontWeight: '600' },
  name: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  empty: { paddingTop: 60, alignItems: 'center' },
  emptyText: { color: '#9CA3AF', fontSize: 14 },
  emptyContainer: { flexGrow: 1 },
  errorBox: { backgroundColor: '#FEE2E2', padding: 10, marginHorizontal: 12, marginVertical: 6, borderRadius: 8 },
  errorText: { color: '#991B1B', fontSize: 13 },
  retryText: { color: '#2563EB', fontSize: 13, marginTop: 4, fontWeight: '600' },
});

export default SampleRequestListScreen;
