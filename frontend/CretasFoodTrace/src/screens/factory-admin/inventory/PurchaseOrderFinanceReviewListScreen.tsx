/**
 * Sprint2-J P-FIN-1 — 财务待审采购单列表
 *
 * 财务角色登录后入口. 仅列 status=PENDING_FINANCE_REVIEW. 点击进 FinanceReview 详情.
 */

import React, { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, Appbar, Card, Chip, ActivityIndicator } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FAManagementStackParamList } from '../../../types/navigation';
import { purchaseApiClient, PurchaseOrder } from '../../../services/api/purchaseApiClient';
import { formatNumberWithCommas } from '../../../utils/formatters';

type Nav = NativeStackNavigationProp<FAManagementStackParamList>;

export default function PurchaseOrderFinanceReviewListScreen() {
  const navigation = useNavigation<Nav>();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await purchaseApiClient.getOrdersByStatus('PENDING_FINANCE_REVIEW', { page: 1, size: 50 });
      if (res.success) setOrders(res.data.content);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="财务待审" subtitle={`${orders.length} 单待审核`} />
      </Appbar.Header>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.empty}>暂无待审采购单</Text>}
        renderItem={({ item }) => (
          <Card
            style={styles.card}
            onPress={() => navigation.navigate('PurchaseOrderFinanceReview', { orderId: item.id })}
          >
            <Card.Content>
              <View style={styles.row}>
                <Text variant="titleSmall">{item.orderNumber}</Text>
                <Chip compact style={styles.chip}>待财审</Chip>
              </View>
              <Text>供应商: {item.supplierName ?? item.supplierId}</Text>
              <Text>总金额: ¥{formatNumberWithCommas((item.totalAmount ?? 0).toFixed(2))}</Text>
              <Text style={styles.date}>下单 {item.orderDate}</Text>
            </Card.Content>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 12 },
  card: { marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  chip: { backgroundColor: '#FFEBEE' },
  date: { color: '#666', fontSize: 12, marginTop: 4 },
  empty: { textAlign: 'center', marginTop: 50, color: '#999' },
});
