import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, Alert, RefreshControl } from 'react-native';
import { Text, Appbar, Card, Chip, Button, ActivityIndicator, SegmentedButtons } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FAManagementStackParamList } from '../../../types/navigation';
import { salesApiClient, SalesOrder } from '../../../services/api/salesApiClient';
import { formatNumberWithCommas } from '../../../utils/formatters';

type Nav = NativeStackNavigationProp<FAManagementStackParamList>;

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: '#909399' },
  CONFIRMED: { label: '已确认', color: '#409eff' },
  DELIVERING: { label: '发货中', color: '#e6a23c' },
  DELIVERED: { label: '已交付', color: '#67c23a' },
  CANCELLED: { label: '已取消', color: '#909399' },
};

export default function SalesOrderListScreen() {
  const navigation = useNavigation<Nav>();
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  const loadOrders = useCallback(async () => {
    try {
      const params: any = { page: 1, size: 50 };
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await salesApiClient.getOrders(params);
      if (res.success && res.data) {
        setOrders(res.data.content || []);
      }
    } catch { Alert.alert('错误', '加载销售单失败'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [statusFilter]);

  useEffect(() => { loadOrders(); }, [loadOrders]);
  const onRefresh = () => { setRefreshing(true); loadOrders(); };

  const handleAction = async (orderId: string, action: string) => {
    try {
      let res;
      if (action === 'confirm') res = await salesApiClient.confirmOrder(orderId);
      else if (action === 'cancel') res = await salesApiClient.cancelOrder(orderId);
      if (res?.success) { Alert.alert('成功', '操作成功'); loadOrders(); }
    } catch { Alert.alert('错误', '操作失败'); }
  };

  const renderOrder = ({ item }: { item: SalesOrder }) => {
    const status = STATUS_MAP[item.status] || { label: item.status, color: '#909399' };
    return (
      <Card style={styles.card} onPress={() => navigation.navigate('SalesOrderDetail', { orderId: item.id })}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <Text variant="titleMedium" style={styles.orderNumber}>{item.orderNumber}</Text>
            <Chip style={[styles.chip, { backgroundColor: status.color + '20' }]} textStyle={{ color: status.color, fontSize: 12 }}>{status.label}</Chip>
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.label}>客户</Text>
            <Text style={styles.value}>{item.customerName || item.customerId}</Text>
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.label}>金额</Text>
            <Text style={[styles.value, styles.amount]}>¥{formatNumberWithCommas(item.totalAmount)}</Text>
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.label}>下单日期</Text>
            <Text style={styles.value}>{item.orderDate}</Text>
          </View>
          {item.status === 'DRAFT' && (
            <View style={styles.actions}>
              <Button mode="contained" compact onPress={() => handleAction(item.id, 'confirm')} style={styles.actionBtn}>确认</Button>
              <Button mode="outlined" compact onPress={() => handleAction(item.id, 'cancel')} style={styles.actionBtn}>取消</Button>
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
        <Appbar.Content title="销售订单" />
        <Appbar.Action icon="refresh" onPress={onRefresh} />
      </Appbar.Header>

      <View style={styles.filterRow}>
        <SegmentedButtons
          value={statusFilter}
          onValueChange={setStatusFilter}
          buttons={[
            { value: 'all', label: '全部' },
            { value: 'DRAFT', label: '草稿' },
            { value: 'CONFIRMED', label: '已确认' },
            { value: 'DELIVERED', label: '已交付' },
          ]}
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
          ListEmptyComponent={<Text style={styles.empty}>暂无销售单</Text>}
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
  orderNumber: { fontWeight: '700' },
  chip: { height: 26 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  label: { color: '#909399', fontSize: 13 },
  value: { fontSize: 13, color: '#333' },
  amount: { fontWeight: '600', color: '#67c23a' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  actionBtn: { flex: 1 },
  empty: { textAlign: 'center', marginTop: 60, color: '#999' },
});
