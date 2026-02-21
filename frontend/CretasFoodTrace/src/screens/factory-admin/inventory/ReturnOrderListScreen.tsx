import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, Alert, RefreshControl } from 'react-native';
import { Text, Appbar, Card, Chip, Button, ActivityIndicator, SegmentedButtons } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FAManagementStackParamList } from '../../../types/navigation';
import { returnOrderApiClient, ReturnOrder, ReturnType } from '../../../services/api/returnOrderApiClient';
import { formatNumberWithCommas } from '../../../utils/formatters';

type Nav = NativeStackNavigationProp<FAManagementStackParamList>;

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: '#909399' },
  SUBMITTED: { label: '已提交', color: '#e6a23c' },
  APPROVED: { label: '已审批', color: '#409eff' },
  REJECTED: { label: '已驳回', color: '#f56c6c' },
  PROCESSING: { label: '处理中', color: '#e6a23c' },
  COMPLETED: { label: '已完成', color: '#67c23a' },
};

const TYPE_TABS = [
  { value: 'PURCHASE_RETURN' as ReturnType, label: '采购退货' },
  { value: 'SALES_RETURN' as ReturnType, label: '销售退货' },
];

export default function ReturnOrderListScreen() {
  const navigation = useNavigation<Nav>();
  const [orders, setOrders] = useState<ReturnOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [returnType, setReturnType] = useState<ReturnType>('PURCHASE_RETURN');

  const loadOrders = useCallback(async () => {
    try {
      const res = await returnOrderApiClient.getReturnOrders({
        returnType,
        page: 1,
        size: 50,
      });
      if (res.success && res.data) {
        setOrders(res.data.content || []);
      }
    } catch {
      Alert.alert('错误', '加载退货单失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [returnType]);

  useEffect(() => { setLoading(true); loadOrders(); }, [loadOrders]);

  const onRefresh = () => { setRefreshing(true); loadOrders(); };

  const handleAction = async (id: string, action: string) => {
    try {
      let res;
      switch (action) {
        case 'submit': res = await returnOrderApiClient.submitReturnOrder(id); break;
        case 'approve': res = await returnOrderApiClient.approveReturnOrder(id); break;
        case 'reject': res = await returnOrderApiClient.rejectReturnOrder(id); break;
        case 'complete': res = await returnOrderApiClient.completeReturnOrder(id); break;
      }
      if (res?.success) {
        Alert.alert('成功', '操作成功');
        loadOrders();
      }
    } catch { Alert.alert('错误', '操作失败'); }
  };

  const renderOrder = ({ item }: { item: ReturnOrder }) => {
    const status = STATUS_MAP[item.status] || { label: item.status, color: '#909399' };
    return (
      <Card style={styles.card} onPress={() => navigation.navigate('ReturnOrderDetail', { returnId: item.id })}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <Text variant="titleMedium" style={styles.orderNumber}>{item.returnNumber}</Text>
            <Chip style={[styles.chip, { backgroundColor: status.color + '20' }]} textStyle={{ color: status.color, fontSize: 12 }}>{status.label}</Chip>
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.label}>交易对手</Text>
            <Text style={styles.value}>{item.counterpartyId}</Text>
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.label}>金额</Text>
            <Text style={[styles.value, styles.amount]}>¥{formatNumberWithCommas(item.totalAmount)}</Text>
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.label}>退货日期</Text>
            <Text style={styles.value}>{item.returnDate}</Text>
          </View>
          {item.reason ? (
            <View style={styles.cardRow}>
              <Text style={styles.label}>原因</Text>
              <Text style={styles.value} numberOfLines={1}>{item.reason}</Text>
            </View>
          ) : null}
          {item.status === 'DRAFT' && (
            <View style={styles.actions}>
              <Button mode="contained" compact onPress={() => handleAction(item.id, 'submit')} style={styles.actionBtn}>提交</Button>
            </View>
          )}
          {item.status === 'SUBMITTED' && (
            <View style={styles.actions}>
              <Button mode="contained" compact onPress={() => handleAction(item.id, 'approve')} style={styles.actionBtn}>审批</Button>
              <Button mode="outlined" compact textColor="#f56c6c" onPress={() => handleAction(item.id, 'reject')} style={styles.actionBtn}>驳回</Button>
            </View>
          )}
          {item.status === 'APPROVED' && (
            <View style={styles.actions}>
              <Button mode="contained" compact onPress={() => handleAction(item.id, 'complete')} style={styles.actionBtn}>完成</Button>
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
        <Appbar.Content title="退货管理" />
        <Appbar.Action icon="refresh" onPress={onRefresh} />
      </Appbar.Header>

      <View style={styles.filterRow}>
        <SegmentedButtons
          value={returnType}
          onValueChange={(v) => setReturnType(v as ReturnType)}
          buttons={TYPE_TABS}
          style={styles.segmented}
        />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={item => item.id}
          renderItem={renderOrder}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text style={styles.empty}>暂无退货单</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  filterRow: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff' },
  segmented: {},
  loader: { flex: 1, justifyContent: 'center' },
  list: { padding: 12, paddingBottom: 80 },
  card: { marginBottom: 10, borderRadius: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderNumber: { fontWeight: '700' },
  chip: { height: 26 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  label: { color: '#909399', fontSize: 13 },
  value: { fontSize: 13, color: '#333', flex: 1, textAlign: 'right' },
  amount: { fontWeight: '600', color: '#e6a23c' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  actionBtn: { flex: 1 },
  empty: { textAlign: 'center', marginTop: 60, color: '#999' },
});
