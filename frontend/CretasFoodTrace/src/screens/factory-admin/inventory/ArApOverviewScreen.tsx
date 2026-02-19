import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, RefreshControl } from 'react-native';
import { Text, Appbar, Card, ActivityIndicator, DataTable, SegmentedButtons, Divider } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { financeApiClient, FinanceOverview, ArApTransaction, AgingData } from '../../../services/api/financeApiClient';
import { formatNumberWithCommas } from '../../../utils/formatters';

const TX_TYPE_MAP: Record<string, { text: string; color: string }> = {
  AR_INVOICE: { text: '应收挂账', color: '#e6a23c' },
  AR_PAYMENT: { text: '客户回款', color: '#67c23a' },
  AR_ADJUSTMENT: { text: '应收调整', color: '#909399' },
  AP_INVOICE: { text: '应付挂账', color: '#f56c6c' },
  AP_PAYMENT: { text: '供应商付款', color: '#67c23a' },
  AP_ADJUSTMENT: { text: '应付调整', color: '#909399' },
};

export default function ArApOverviewScreen() {
  const navigation = useNavigation();
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [overview, setOverview] = useState<FinanceOverview | null>(null);
  const [transactions, setTransactions] = useState<ArApTransaction[]>([]);
  const [agingData, setAgingData] = useState<AgingData[]>([]);
  const [agingType, setAgingType] = useState<'CUSTOMER' | 'SUPPLIER'>('CUSTOMER');

  const loadAll = async () => {
    try {
      const [ovRes, txRes, agRes] = await Promise.all([
        financeApiClient.getOverview(),
        financeApiClient.getTransactions({ page: 1, size: 50 }),
        financeApiClient.getAging(agingType),
      ]);
      if (ovRes.success) setOverview(ovRes.data);
      if (txRes.success && txRes.data) setTransactions(txRes.data.content || []);
      if (agRes.success) setAgingData(Array.isArray(agRes.data) ? agRes.data : []);
    } catch { Alert.alert('错误', '加载财务数据失败'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { loadAll(); }, [agingType]);
  const onRefresh = () => { setRefreshing(true); loadAll(); };

  const fmt = (v: number) => v != null ? `¥${formatNumberWithCommas(v)}` : '-';

  if (loading) return (
    <View style={styles.container}>
      <Appbar.Header><Appbar.BackAction onPress={() => navigation.goBack()} /><Appbar.Content title="应收应付" /></Appbar.Header>
      <ActivityIndicator style={styles.loader} size="large" />
    </View>
  );

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="应收应付" />
        <Appbar.Action icon="refresh" onPress={onRefresh} />
      </Appbar.Header>

      <View style={styles.tabRow}>
        <SegmentedButtons
          value={tab}
          onValueChange={setTab}
          buttons={[
            { value: 'overview', label: '概览' },
            { value: 'ar', label: '应收' },
            { value: 'ap', label: '应付' },
            { value: 'aging', label: '账龄' },
          ]}
        />
      </View>

      <ScrollView style={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {tab === 'overview' && overview && (
          <View style={styles.overviewGrid}>
            <StatCard label="应收总额" value={fmt(overview.totalReceivable)} sub={`${overview.receivableCount || 0} 笔未收`} color="#e6a23c" />
            <StatCard label="应付总额" value={fmt(overview.totalPayable)} sub={`${overview.payableCount || 0} 笔未付`} color="#f56c6c" />
            <StatCard label="净额" value={fmt((overview.totalReceivable || 0) - (overview.totalPayable || 0))} sub={(overview.totalReceivable || 0) >= (overview.totalPayable || 0) ? '净应收' : '净应付'} color="#409eff" />
            <StatCard label="逾期金额" value={fmt(overview.overdueAmount)} sub={`${overview.overdueCount || 0} 笔逾期`} color="#f56c6c" />
          </View>
        )}

        {tab === 'ar' && (
          <Card style={styles.card}>
            <Card.Title title="应收账款" titleVariant="titleSmall" />
            <Card.Content>
              {transactions.filter(t => ['AR_INVOICE', 'AR_PAYMENT', 'AR_ADJUSTMENT'].includes(t.transactionType)).length === 0 ? (
                <Text style={styles.empty}>暂无应收记录</Text>
              ) : (
                transactions.filter(t => ['AR_INVOICE', 'AR_PAYMENT', 'AR_ADJUSTMENT'].includes(t.transactionType)).map((tx, idx) => (
                  <TxRow key={idx} tx={tx} />
                ))
              )}
            </Card.Content>
          </Card>
        )}

        {tab === 'ap' && (
          <Card style={styles.card}>
            <Card.Title title="应付账款" titleVariant="titleSmall" />
            <Card.Content>
              {transactions.filter(t => ['AP_INVOICE', 'AP_PAYMENT', 'AP_ADJUSTMENT'].includes(t.transactionType)).length === 0 ? (
                <Text style={styles.empty}>暂无应付记录</Text>
              ) : (
                transactions.filter(t => ['AP_INVOICE', 'AP_PAYMENT', 'AP_ADJUSTMENT'].includes(t.transactionType)).map((tx, idx) => (
                  <TxRow key={idx} tx={tx} />
                ))
              )}
            </Card.Content>
          </Card>
        )}

        {tab === 'aging' && (
          <Card style={styles.card}>
            <Card.Content>
              <SegmentedButtons
                value={agingType}
                onValueChange={(v) => setAgingType(v as 'CUSTOMER' | 'SUPPLIER')}
                buttons={[
                  { value: 'CUSTOMER', label: '应收账龄' },
                  { value: 'SUPPLIER', label: '应付账龄' },
                ]}
                style={styles.agingToggle}
              />
              {agingData.length === 0 ? (
                <Text style={styles.empty}>暂无账龄数据</Text>
              ) : (
                <DataTable>
                  <DataTable.Header>
                    <DataTable.Title>{agingType === 'CUSTOMER' ? '客户' : '供应商'}</DataTable.Title>
                    <DataTable.Title numeric>余额</DataTable.Title>
                    <DataTable.Title numeric>1-30天</DataTable.Title>
                    <DataTable.Title numeric>&gt;180天</DataTable.Title>
                  </DataTable.Header>
                  {agingData.map((row, idx) => (
                    <DataTable.Row key={idx}>
                      <DataTable.Cell>{row.counterpartyName}</DataTable.Cell>
                      <DataTable.Cell numeric>{fmt(row.totalBalance)}</DataTable.Cell>
                      <DataTable.Cell numeric>{fmt(row.days1to30)}</DataTable.Cell>
                      <DataTable.Cell numeric>
                        <Text style={row.over180 > 0 ? { color: '#f56c6c' } : {}}>{fmt(row.over180)}</Text>
                      </DataTable.Cell>
                    </DataTable.Row>
                  ))}
                </DataTable>
              )}
            </Card.Content>
          </Card>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <Card style={styles.statCard}>
      <Card.Content style={styles.statContent}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
        <Text style={styles.statSub}>{sub}</Text>
      </Card.Content>
    </Card>
  );
}

function TxRow({ tx }: { tx: ArApTransaction }) {
  const typeInfo = TX_TYPE_MAP[tx.transactionType] || { text: tx.transactionType, color: '#909399' };
  return (
    <View style={styles.txRow}>
      <View style={styles.txHeader}>
        <Text style={styles.txNum}>{tx.transactionNumber}</Text>
        <Text style={[styles.txType, { color: typeInfo.color }]}>{typeInfo.text}</Text>
      </View>
      <View style={styles.txBody}>
        <Text style={styles.txName}>{tx.counterpartyName || tx.counterpartyId}</Text>
        <Text style={[styles.txAmount, { color: typeInfo.color }]}>¥{formatNumberWithCommas(tx.amount)}</Text>
      </View>
      <Text style={styles.txDate}>{tx.transactionDate}</Text>
      <Divider style={{ marginTop: 8 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  tabRow: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff' },
  scroll: { flex: 1 },
  loader: { flex: 1, justifyContent: 'center' },
  card: { margin: 12, borderRadius: 10 },
  empty: { textAlign: 'center', paddingVertical: 30, color: '#999' },
  overviewGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 8 },
  statCard: { width: '47%', margin: '1.5%', borderRadius: 10 },
  statContent: { alignItems: 'center', paddingVertical: 16 },
  statLabel: { fontSize: 12, color: '#909399' },
  statValue: { fontSize: 20, fontWeight: '700', marginVertical: 4 },
  statSub: { fontSize: 11, color: '#c0c4cc' },
  agingToggle: { marginBottom: 12 },
  txRow: { paddingVertical: 8 },
  txHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  txNum: { fontSize: 13, fontWeight: '600', color: '#333' },
  txType: { fontSize: 12, fontWeight: '500' },
  txBody: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  txName: { fontSize: 13, color: '#666' },
  txAmount: { fontSize: 14, fontWeight: '600' },
  txDate: { fontSize: 11, color: '#c0c4cc' },
});
