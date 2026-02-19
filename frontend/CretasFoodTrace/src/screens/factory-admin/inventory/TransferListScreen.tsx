import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, Alert, RefreshControl } from 'react-native';
import { Text, Appbar, Card, Chip, Button, ActivityIndicator, SegmentedButtons } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FAManagementStackParamList } from '../../../types/navigation';
import { transferApiClient, InternalTransfer } from '../../../services/api/transferApiClient';
import { useAuthStore } from '../../../store/authStore';
import { formatNumberWithCommas } from '../../../utils/formatters';

type Nav = NativeStackNavigationProp<FAManagementStackParamList>;

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: '#909399' },
  REQUESTED: { label: '已申请', color: '#e6a23c' },
  APPROVED: { label: '已批准', color: '#409eff' },
  REJECTED: { label: '已驳回', color: '#f56c6c' },
  SHIPPED: { label: '已发运', color: '#e6a23c' },
  RECEIVED: { label: '已签收', color: '#409eff' },
  CONFIRMED: { label: '已确认', color: '#67c23a' },
  CANCELLED: { label: '已取消', color: '#909399' },
};

const TYPE_MAP: Record<string, string> = {
  HQ_TO_BRANCH: '总部→分部',
  BRANCH_TO_BRANCH: '分部→分部',
  BRANCH_TO_HQ: '分部→总部',
};

export default function TransferListScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuthStore();
  const factoryId = user?.factoryId || user?.factoryUser?.factoryId || '';
  const [transfers, setTransfers] = useState<InternalTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  const loadData = useCallback(async () => {
    try {
      const params: any = { page: 1, size: 50 };
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await transferApiClient.getTransfers(params);
      if (res.success && res.data) {
        setTransfers(res.data.content || []);
      }
    } catch { Alert.alert('错误', '加载调拨单失败'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [statusFilter]);

  useEffect(() => { loadData(); }, [loadData]);
  const onRefresh = () => { setRefreshing(true); loadData(); };

  const renderTransfer = ({ item }: { item: InternalTransfer }) => {
    const status = STATUS_MAP[item.status] || { label: item.status, color: '#909399' };
    const isOutbound = item.sourceFactoryId === factoryId;

    return (
      <Card style={styles.card} onPress={() => navigation.navigate('TransferDetail', { transferId: item.id })}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text variant="titleMedium" style={styles.transferNum}>{item.transferNumber}</Text>
              <Chip style={{ backgroundColor: isOutbound ? '#e6a23c20' : '#409eff20', height: 22 }}
                textStyle={{ color: isOutbound ? '#e6a23c' : '#409eff', fontSize: 10 }}>
                {isOutbound ? '调出' : '调入'}
              </Chip>
            </View>
            <Chip style={{ backgroundColor: status.color + '20' }} textStyle={{ color: status.color, fontSize: 12 }}>{status.label}</Chip>
          </View>

          <View style={styles.cardRow}>
            <Text style={styles.label}>类型</Text>
            <Text style={styles.value}>{TYPE_MAP[item.transferType] || item.transferType}</Text>
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.label}>调出方</Text>
            <Text style={styles.value}>{item.sourceFactory?.name || item.sourceFactoryId}</Text>
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.label}>调入方</Text>
            <Text style={styles.value}>{item.targetFactory?.name || item.targetFactoryId}</Text>
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.label}>金额</Text>
            <Text style={[styles.value, styles.amount]}>¥{formatNumberWithCommas(item.totalAmount)}</Text>
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.label}>日期</Text>
            <Text style={styles.value}>{item.transferDate}</Text>
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="调拨管理" />
        <Appbar.Action icon="refresh" onPress={onRefresh} />
      </Appbar.Header>

      <View style={styles.filterRow}>
        <SegmentedButtons
          value={statusFilter}
          onValueChange={setStatusFilter}
          buttons={[
            { value: 'all', label: '全部' },
            { value: 'REQUESTED', label: '申请中' },
            { value: 'SHIPPED', label: '运输中' },
            { value: 'CONFIRMED', label: '已完成' },
          ]}
        />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" />
      ) : (
        <FlatList
          data={transfers}
          keyExtractor={item => item.id}
          renderItem={renderTransfer}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text style={styles.empty}>暂无调拨单</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  filterRow: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff' },
  loader: { flex: 1, justifyContent: 'center' },
  list: { padding: 12, paddingBottom: 80 },
  card: { marginBottom: 10, borderRadius: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  transferNum: { fontWeight: '700' },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  label: { color: '#909399', fontSize: 13 },
  value: { fontSize: 13, color: '#333' },
  amount: { fontWeight: '600', color: '#409eff' },
  empty: { textAlign: 'center', marginTop: 60, color: '#999' },
});
