import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Appbar, Card, Chip, Button, ActivityIndicator, DataTable, Divider } from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FAManagementStackParamList } from '../../../types/navigation';
import { returnOrderApiClient, ReturnOrder } from '../../../services/api/returnOrderApiClient';
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

const TYPE_MAP: Record<string, string> = {
  PURCHASE_RETURN: '采购退货',
  SALES_RETURN: '销售退货',
};

export default function ReturnOrderDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<FAManagementStackParamList, 'ReturnOrderDetail'>>();
  const { returnId } = route.params;

  const [order, setOrder] = useState<ReturnOrder | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadOrder(); }, [returnId]);

  const loadOrder = async () => {
    try {
      setLoading(true);
      const res = await returnOrderApiClient.getReturnOrder(returnId);
      if (res.success) setOrder(res.data);
    } catch { Alert.alert('错误', '加载失败'); }
    finally { setLoading(false); }
  };

  const handleAction = async (action: string) => {
    const actionLabels: Record<string, string> = {
      submit: '提交审批', approve: '审批通过', reject: '驳回', complete: '完成退货',
    };
    Alert.alert('确认', `确认${actionLabels[action]}？`, [
      { text: '取消', style: 'cancel' },
      { text: '确定', onPress: async () => {
        try {
          let res;
          switch (action) {
            case 'submit': res = await returnOrderApiClient.submitReturnOrder(returnId); break;
            case 'approve': res = await returnOrderApiClient.approveReturnOrder(returnId); break;
            case 'reject': res = await returnOrderApiClient.rejectReturnOrder(returnId); break;
            case 'complete': res = await returnOrderApiClient.completeReturnOrder(returnId); break;
          }
          if (res?.success) { Alert.alert('成功', '操作成功'); loadOrder(); }
        } catch { Alert.alert('错误', '操作失败'); }
      }},
    ]);
  };

  if (loading) return (
    <View style={styles.container}>
      <Appbar.Header><Appbar.BackAction onPress={() => navigation.goBack()} /><Appbar.Content title="退货详情" /></Appbar.Header>
      <ActivityIndicator style={styles.loader} size="large" />
    </View>
  );

  if (!order) return (
    <View style={styles.container}>
      <Appbar.Header><Appbar.BackAction onPress={() => navigation.goBack()} /><Appbar.Content title="退货详情" /></Appbar.Header>
      <Text style={styles.empty}>退货单不存在</Text>
    </View>
  );

  const status = STATUS_MAP[order.status] || { label: order.status, color: '#909399' };

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="退货详情" />
        <Appbar.Action icon="refresh" onPress={loadOrder} />
      </Appbar.Header>

      <ScrollView style={styles.scroll}>
        {/* 基本信息 */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.row}>
              <Text variant="titleMedium" style={styles.bold}>{order.returnNumber}</Text>
              <Chip style={{ backgroundColor: status.color + '20' }} textStyle={{ color: status.color, fontSize: 12 }}>{status.label}</Chip>
            </View>
            <Divider style={styles.divider} />
            <InfoRow label="退货类型" value={TYPE_MAP[order.returnType] || order.returnType} />
            <InfoRow label="交易对手" value={order.counterpartyId} />
            <InfoRow label="总金额" value={`¥${formatNumberWithCommas(order.totalAmount)}`} valueStyle={styles.amountText} />
            <InfoRow label="退货日期" value={order.returnDate} />
            {order.sourceOrderId ? <InfoRow label="原始订单" value={order.sourceOrderId} /> : null}
            {order.reason ? <InfoRow label="退货原因" value={order.reason} /> : null}
            {order.remark ? <InfoRow label="备注" value={order.remark} /> : null}
          </Card.Content>
        </Card>

        {/* 退货明细 */}
        <Card style={styles.card}>
          <Card.Title title="退货明细" titleVariant="titleSmall" />
          <Card.Content>
            <DataTable>
              <DataTable.Header>
                <DataTable.Title>品名</DataTable.Title>
                <DataTable.Title numeric>数量</DataTable.Title>
                <DataTable.Title numeric>单价</DataTable.Title>
                <DataTable.Title numeric>金额</DataTable.Title>
              </DataTable.Header>
              {(order.items || []).map((item, idx) => (
                <DataTable.Row key={idx}>
                  <DataTable.Cell>{item.itemName || item.materialTypeId || item.productTypeId || '-'}</DataTable.Cell>
                  <DataTable.Cell numeric>{item.quantity}</DataTable.Cell>
                  <DataTable.Cell numeric>{item.unitPrice != null ? `¥${formatNumberWithCommas(item.unitPrice)}` : '-'}</DataTable.Cell>
                  <DataTable.Cell numeric>{item.lineAmount != null ? `¥${formatNumberWithCommas(item.lineAmount)}` : '-'}</DataTable.Cell>
                </DataTable.Row>
              ))}
            </DataTable>
          </Card.Content>
        </Card>

        {/* 操作按钮 */}
        <View style={styles.actionBar}>
          {order.status === 'DRAFT' && (
            <Button mode="contained" onPress={() => handleAction('submit')} style={styles.actionBtn}>提交审批</Button>
          )}
          {order.status === 'SUBMITTED' && (
            <>
              <Button mode="contained" onPress={() => handleAction('approve')} style={styles.actionBtn}>审批通过</Button>
              <Button mode="outlined" textColor="#f56c6c" onPress={() => handleAction('reject')} style={styles.actionBtn}>驳回</Button>
            </>
          )}
          {order.status === 'APPROVED' && (
            <Button mode="contained" onPress={() => handleAction('complete')} style={styles.actionBtn}>完成退货</Button>
          )}
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value, valueStyle }: { label: string; value: string; valueStyle?: any }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueStyle]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { flex: 1 },
  loader: { flex: 1, justifyContent: 'center' },
  empty: { textAlign: 'center', marginTop: 60, color: '#999' },
  card: { margin: 12, marginBottom: 0, borderRadius: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bold: { fontWeight: '700' },
  divider: { marginVertical: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  infoLabel: { color: '#909399', fontSize: 13 },
  infoValue: { fontSize: 13, color: '#333' },
  amountText: { fontWeight: '700', color: '#e6a23c' },
  actionBar: { flexDirection: 'row', gap: 10, padding: 12 },
  actionBtn: { flex: 1 },
});
