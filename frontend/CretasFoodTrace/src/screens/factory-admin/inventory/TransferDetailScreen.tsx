import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Appbar, Card, Chip, Button, ActivityIndicator, DataTable, Divider } from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
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

const STEPS = ['草稿', '已申请', '已批准', '已发运', '已签收', '已确认'];
const STEP_KEYS = ['DRAFT', 'REQUESTED', 'APPROVED', 'SHIPPED', 'RECEIVED', 'CONFIRMED'];

export default function TransferDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<FAManagementStackParamList, 'TransferDetail'>>();
  const { transferId } = route.params;
  const { user } = useAuthStore();
  const factoryId = user?.factoryId || user?.factoryUser?.factoryId || '';

  const [transfer, setTransfer] = useState<InternalTransfer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadTransfer(); }, [transferId]);

  const loadTransfer = async () => {
    try {
      setLoading(true);
      const res = await transferApiClient.getTransfer(transferId);
      if (res.success) setTransfer(res.data);
    } catch { Alert.alert('错误', '加载失败'); }
    finally { setLoading(false); }
  };

  const handleAction = async (action: string) => {
    const labels: Record<string, string> = {
      request: '提交申请', approve: '审批通过', reject: '驳回',
      ship: '确认发运', receive: '确认签收', confirm: '确认入库', cancel: '取消',
    };
    Alert.alert('确认', `确认${labels[action]}？`, [
      { text: '取消', style: 'cancel' },
      { text: '确定', onPress: async () => {
        try {
          const fn = (transferApiClient as any)[action + 'Transfer'];
          if (fn) {
            const res = await fn.call(transferApiClient, transferId);
            if (res?.success) { Alert.alert('成功', '操作成功'); loadTransfer(); }
          }
        } catch { Alert.alert('错误', '操作失败'); }
      }},
    ]);
  };

  if (loading) return (
    <View style={styles.container}>
      <Appbar.Header><Appbar.BackAction onPress={() => navigation.goBack()} /><Appbar.Content title="调拨详情" /></Appbar.Header>
      <ActivityIndicator style={styles.loader} size="large" />
    </View>
  );

  if (!transfer) return (
    <View style={styles.container}>
      <Appbar.Header><Appbar.BackAction onPress={() => navigation.goBack()} /><Appbar.Content title="调拨详情" /></Appbar.Header>
      <Text style={styles.empty}>调拨单不存在</Text>
    </View>
  );

  const status = STATUS_MAP[transfer.status] || { label: transfer.status, color: '#909399' };
  const isOutbound = transfer.sourceFactoryId === factoryId;
  const currentStep = STEP_KEYS.indexOf(transfer.status);

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="调拨详情" />
        <Appbar.Action icon="refresh" onPress={loadTransfer} />
      </Appbar.Header>

      <ScrollView style={styles.scroll}>
        {/* 状态流转 */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.stepsRow}>
              {STEPS.map((step, idx) => (
                <View key={idx} style={styles.stepItem}>
                  <View style={[styles.stepDot, idx <= currentStep && { backgroundColor: '#409eff' }]} />
                  <Text style={[styles.stepLabel, idx <= currentStep && { color: '#409eff' }]}>{step}</Text>
                  {idx < STEPS.length - 1 && <View style={[styles.stepLine, idx < currentStep && { backgroundColor: '#409eff' }]} />}
                </View>
              ))}
            </View>
          </Card.Content>
        </Card>

        {/* 基本信息 */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.row}>
              <Text variant="titleMedium" style={styles.bold}>{transfer.transferNumber}</Text>
              <Chip style={{ backgroundColor: status.color + '20' }} textStyle={{ color: status.color, fontSize: 12 }}>{status.label}</Chip>
            </View>
            <Divider style={styles.divider} />
            <InfoRow label="类型" value={transfer.transferType === 'HQ_TO_BRANCH' ? '总部→分部' : transfer.transferType === 'BRANCH_TO_BRANCH' ? '分部→分部' : '分部→总部'} />
            <InfoRow label="调出方" value={transfer.sourceFactory?.name || transfer.sourceFactoryId} />
            <InfoRow label="调入方" value={transfer.targetFactory?.name || transfer.targetFactoryId} />
            <InfoRow label="总金额" value={`¥${formatNumberWithCommas(transfer.totalAmount)}`} valueStyle={styles.amountText} />
            <InfoRow label="调拨日期" value={transfer.transferDate} />
            <InfoRow label="预计到达" value={transfer.expectedArrivalDate || '-'} />
            <InfoRow label="申请人" value={transfer.requestedBy || '-'} />
            <InfoRow label="审批人" value={transfer.approvedBy || '-'} />
            {transfer.remark ? <InfoRow label="备注" value={transfer.remark} /> : null}
          </Card.Content>
        </Card>

        {/* 明细 */}
        <Card style={styles.card}>
          <Card.Title title="调拨明细" titleVariant="titleSmall" />
          <Card.Content>
            <DataTable>
              <DataTable.Header>
                <DataTable.Title>类型</DataTable.Title>
                <DataTable.Title>品名</DataTable.Title>
                <DataTable.Title numeric>数量</DataTable.Title>
                <DataTable.Title numeric>已收</DataTable.Title>
              </DataTable.Header>
              {(transfer.items || []).map((item, idx) => (
                <DataTable.Row key={idx}>
                  <DataTable.Cell>{item.itemType === 'RAW_MATERIAL' ? '原料' : '成品'}</DataTable.Cell>
                  <DataTable.Cell>{item.materialTypeName || item.productTypeName || '-'}</DataTable.Cell>
                  <DataTable.Cell numeric>{item.quantity} {item.unit}</DataTable.Cell>
                  <DataTable.Cell numeric>{item.receivedQuantity}</DataTable.Cell>
                </DataTable.Row>
              ))}
            </DataTable>
          </Card.Content>
        </Card>

        {/* 操作按钮 */}
        <View style={styles.actionBar}>
          {transfer.status === 'DRAFT' && (
            <>
              <Button mode="contained" onPress={() => handleAction('request')} style={styles.actionBtn}>提交申请</Button>
              <Button mode="outlined" onPress={() => handleAction('cancel')} style={styles.actionBtn}>取消</Button>
            </>
          )}
          {transfer.status === 'REQUESTED' && (
            <>
              <Button mode="contained" onPress={() => handleAction('approve')} style={styles.actionBtn}>审批通过</Button>
              <Button mode="outlined" textColor="#f56c6c" onPress={() => handleAction('reject')} style={styles.actionBtn}>驳回</Button>
            </>
          )}
          {transfer.status === 'APPROVED' && isOutbound && (
            <Button mode="contained" onPress={() => handleAction('ship')} style={styles.actionBtn}>确认发运</Button>
          )}
          {transfer.status === 'SHIPPED' && !isOutbound && (
            <Button mode="contained" onPress={() => handleAction('receive')} style={styles.actionBtn}>确认签收</Button>
          )}
          {transfer.status === 'RECEIVED' && !isOutbound && (
            <Button mode="contained" onPress={() => handleAction('confirm')} style={styles.actionBtn}>确认入库</Button>
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
  amountText: { fontWeight: '700', color: '#409eff' },
  stepsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  stepItem: { alignItems: 'center', flex: 1 },
  stepDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#ddd', marginBottom: 4 },
  stepLabel: { fontSize: 10, color: '#999' },
  stepLine: { position: 'absolute', top: 5, right: -20, width: 40, height: 2, backgroundColor: '#ddd' },
  actionBar: { flexDirection: 'row', gap: 10, padding: 12 },
  actionBtn: { flex: 1 },
});
