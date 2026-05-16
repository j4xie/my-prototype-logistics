/**
 * Sprint2-J P-FIN-1 — 财务审核详情页
 *
 * 触发: 采购单 status=PENDING_FINANCE_REVIEW. 来源:
 *  (a) 运营 approveOrder 时三价标红 OR 总金额超阈值 → 自动跳此状态
 *  (b) 运营 approve 后手动 submitForFinanceReview
 *
 * 功能:
 *  - 加载订单详情 + 三价对比 (priceAlert=true 行红色背景)
 *  - 财务通过 (notes 可选) / 驳回 (notes 必填) — 调 financeApprove/financeReject
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Text, Appbar, Card, Chip, Button, ActivityIndicator,
  DataTable, Divider, TextInput,
} from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FAManagementStackParamList } from '../../../types/navigation';
import {
  purchaseApiClient, PurchaseOrder, MaterialPriceComparison,
} from '../../../services/api/purchaseApiClient';
import { formatNumberWithCommas } from '../../../utils/formatters';

type Nav = NativeStackNavigationProp<FAManagementStackParamList>;

const formatPrice = (v: number | null): string =>
  v == null ? '-' : `¥${formatNumberWithCommas(v.toFixed(2))}`;

const formatVariance = (v: number | null): string => {
  if (v == null) return '-';
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
};

export default function PurchaseOrderFinanceReviewScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<FAManagementStackParamList, 'PurchaseOrderFinanceReview'>>();
  const { orderId } = route.params;

  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [priceComparisons, setPriceComparisons] = useState<MaterialPriceComparison[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [orderRes, priceRes] = await Promise.all([
        purchaseApiClient.getOrder(orderId),
        purchaseApiClient.getOrderPriceComparison(orderId),
      ]);
      if (orderRes.success) setOrder(orderRes.data);
      if (priceRes.success) setPriceComparisons(priceRes.data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '加载失败';
      Alert.alert('错误', msg);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleApprove = () => {
    Alert.alert('财务审核通过', '确认通过此采购单的财务审核?', [
      { text: '取消', style: 'cancel' },
      {
        text: '确认通过',
        onPress: async () => {
          try {
            setSubmitting(true);
            const res = await purchaseApiClient.financeApprove(orderId, notes || undefined);
            if (res.success) {
              Alert.alert('成功', '财务审核已通过', [
                { text: '确定', onPress: () => navigation.goBack() },
              ]);
            }
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : '操作失败';
            Alert.alert('错误', msg);
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  };

  const handleReject = () => {
    if (!notes.trim()) {
      Alert.alert('提示', '驳回必须填写备注说明原因');
      return;
    }
    Alert.alert('财务驳回', `确认驳回?\n备注: ${notes}`, [
      { text: '取消', style: 'cancel' },
      {
        text: '确认驳回',
        style: 'destructive',
        onPress: async () => {
          try {
            setSubmitting(true);
            const res = await purchaseApiClient.financeReject(orderId, notes);
            if (res.success) {
              Alert.alert('已驳回', '订单已退回采购员', [
                { text: '确定', onPress: () => navigation.goBack() },
              ]);
            }
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : '操作失败';
            Alert.alert('错误', msg);
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.center}>
        <Text>订单不存在</Text>
      </View>
    );
  }

  const alertCount = priceComparisons.filter(p => p.priceAlert).length;
  const canReview = order.status === 'PENDING_FINANCE_REVIEW';

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="财务审核" subtitle={order.orderNumber} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* 摘要卡片 */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.summaryRow}>
              <Text variant="titleMedium">{order.orderNumber}</Text>
              <Chip
                style={[
                  styles.statusChip,
                  alertCount > 0 ? styles.statusChipAlert : null,
                ]}
                textStyle={alertCount > 0 ? styles.statusChipAlertText : undefined}
              >
                {alertCount > 0 ? `三价标红 ${alertCount}` : '价格正常'}
              </Chip>
            </View>
            <Divider style={{ marginVertical: 8 }} />
            <Text>供应商: {order.supplierName ?? order.supplierId}</Text>
            <Text>总金额: ¥{formatNumberWithCommas(order.totalAmount?.toFixed(2) ?? '0.00')}</Text>
            <Text>下单日期: {order.orderDate}</Text>
            <Text>状态: {order.status}</Text>
            {!canReview && (
              <Text style={styles.notReviewable}>
                ⚠ 仅 PENDING_FINANCE_REVIEW 状态可审核 (当前: {order.status})
              </Text>
            )}
          </Card.Content>
        </Card>

        {/* 三价对比表 */}
        <Card style={styles.card}>
          <Card.Title title="三价对比" subtitle={`${priceComparisons.length} 项 / 标红 ${alertCount}`} />
          <Card.Content>
            <DataTable>
              <DataTable.Header>
                <DataTable.Title style={styles.colMaterial}>物料</DataTable.Title>
                <DataTable.Title numeric>BOM价</DataTable.Title>
                <DataTable.Title numeric>移动均</DataTable.Title>
                <DataTable.Title numeric>当前价</DataTable.Title>
                <DataTable.Title numeric>偏差</DataTable.Title>
              </DataTable.Header>
              {priceComparisons.map((p) => {
                const variance = p.varianceFromBom ?? p.varianceFromAvg;
                return (
                  <DataTable.Row
                    key={p.materialTypeId}
                    style={p.priceAlert ? styles.redRow : undefined}
                  >
                    <DataTable.Cell style={styles.colMaterial}>
                      <Text style={p.priceAlert ? styles.redText : undefined}>
                        {p.materialName ?? p.materialTypeId}
                      </Text>
                    </DataTable.Cell>
                    <DataTable.Cell numeric>{formatPrice(p.bomStandardPrice)}</DataTable.Cell>
                    <DataTable.Cell numeric>{formatPrice(p.movingAvgPrice)}</DataTable.Cell>
                    <DataTable.Cell numeric>{formatPrice(p.currentPrice)}</DataTable.Cell>
                    <DataTable.Cell numeric>
                      <Text style={p.priceAlert ? styles.redText : undefined}>
                        {formatVariance(variance)}
                      </Text>
                    </DataTable.Cell>
                  </DataTable.Row>
                );
              })}
              {priceComparisons.length === 0 && (
                <View style={{ padding: 16 }}>
                  <Text>无明细</Text>
                </View>
              )}
            </DataTable>
            {priceComparisons.some(p => p.dataSourceHint) && (
              <View style={styles.hintBox}>
                <Text variant="labelSmall" style={{ color: '#666' }}>
                  ℹ 部分价格缺失提示见明细。BOM/移动均价基于历史配置和入库累积。
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* 审核操作 */}
        {canReview && (
          <Card style={styles.card}>
            <Card.Title title="审核意见" />
            <Card.Content>
              <TextInput
                label="备注 (驳回必填, 通过可选)"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                mode="outlined"
                disabled={submitting}
              />
              <View style={styles.actionRow}>
                <Button
                  mode="outlined"
                  onPress={handleReject}
                  disabled={submitting}
                  style={styles.actionBtn}
                  textColor="#C62828"
                >
                  驳回
                </Button>
                <Button
                  mode="contained"
                  onPress={handleApprove}
                  disabled={submitting}
                  style={styles.actionBtn}
                  loading={submitting}
                >
                  通过
                </Button>
              </View>
            </Card.Content>
          </Card>
        )}

        {!canReview && order.financeReviewNotes && (
          <Card style={styles.card}>
            <Card.Title title="历史审核意见" />
            <Card.Content>
              <Text>{order.financeReviewNotes}</Text>
              {order.financeReviewedAt && (
                <Text variant="labelSmall" style={{ marginTop: 4, color: '#666' }}>
                  审核于 {order.financeReviewedAt}
                </Text>
              )}
            </Card.Content>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { padding: 12, paddingBottom: 50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusChip: { backgroundColor: '#E8F5E9' },
  statusChipAlert: { backgroundColor: '#FFEBEE' },
  statusChipAlertText: { color: '#C62828', fontWeight: 'bold' },
  redRow: { backgroundColor: '#FFE4E1' },
  redText: { color: '#C62828', fontWeight: 'bold' },
  colMaterial: { flex: 2 },
  hintBox: { marginTop: 8, padding: 8, backgroundColor: '#F9F9F9', borderRadius: 4 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, gap: 8 },
  actionBtn: { flex: 1 },
  notReviewable: { color: '#C62828', marginTop: 4 },
});
