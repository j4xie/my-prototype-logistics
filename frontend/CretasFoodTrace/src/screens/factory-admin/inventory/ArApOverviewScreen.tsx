import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ScrollView,
  Alert,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Text,
  Appbar,
  Card,
  ActivityIndicator,
  Chip,
  Divider,
  Surface,
  FAB,
  Portal,
  Modal,
  TextInput,
  Button,
  SegmentedButtons,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import {
  financeApiClient,
  FinanceOverview,
  ArApTransaction,
  AgingData,
  CounterpartyType,
  PaymentMethod,
  RecordTransactionRequest,
} from '../../../services/api/financeApiClient';
import { formatNumberWithCommas } from '../../../utils/formatters';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ==================== 常量 ====================

const TX_TYPE_MAP: Record<string, { text: string; color: string }> = {
  AR_INVOICE: { text: '应收挂账', color: '#e6a23c' },
  AR_PAYMENT: { text: '客户回款', color: '#67c23a' },
  AR_ADJUSTMENT: { text: '应收调整', color: '#909399' },
  AP_INVOICE: { text: '应付挂账', color: '#f56c6c' },
  AP_PAYMENT: { text: '供应商付款', color: '#67c23a' },
  AP_ADJUSTMENT: { text: '应付调整', color: '#909399' },
};

const PAYMENT_METHOD_MAP: Record<string, string> = {
  CASH: '现金',
  BANK_TRANSFER: '银行转账',
  WECHAT: '微信',
  ALIPAY: '支付宝',
  CHECK: '支票',
  CREDIT: '赊账',
  POS: 'POS',
  OTHER: '其他',
};

const KPI_CARD_CONFIGS = [
  { key: 'ar', label: '应收总额', bg: '#7C3AED', accent: '#9d5cf0' },
  { key: 'ap', label: '应付总额', bg: '#EC4899', accent: '#f06db5' },
  { key: 'net', label: '净额', bg: '#3B82F6', accent: '#60a5fa' },
  { key: 'overdue', label: '逾期金额', bg: '#EF4444', accent: '#f87171' },
] as const;

type TabKey = 'overview' | 'ar' | 'ap' | 'aging';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: '概览' },
  { key: 'ar', label: '应收' },
  { key: 'ap', label: '应付' },
  { key: 'aging', label: '账龄' },
];

// ==================== 子组件 ====================

interface KpiCardProps {
  label: string;
  value: string;
  sub: string;
  bg: string;
  accent: string;
}

function KpiCard({ label, value, sub, bg, accent }: KpiCardProps) {
  const cardWidth = (SCREEN_WIDTH - 36) / 2;
  return (
    <View style={[styles.kpiCard, { backgroundColor: bg, width: cardWidth }]}>
      <View style={[styles.kpiAccentDot, { backgroundColor: accent }]} />
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiSub}>{sub}</Text>
    </View>
  );
}

interface TxRowProps {
  tx: ArApTransaction;
}

function TxRow({ tx }: TxRowProps) {
  const typeInfo = TX_TYPE_MAP[tx.transactionType] ?? { text: tx.transactionType, color: '#909399' };
  const paymentLabel = tx.paymentMethod ? (PAYMENT_METHOD_MAP[tx.paymentMethod] ?? tx.paymentMethod) : null;

  return (
    <View style={styles.txRow}>
      <View style={styles.txHeader}>
        <Text style={styles.txNum}>{tx.transactionNumber}</Text>
        <Chip
          style={[styles.txChip, { backgroundColor: typeInfo.color + '20' }]}
          textStyle={[styles.txChipText, { color: typeInfo.color }]}
        >
          {typeInfo.text}
        </Chip>
      </View>

      <View style={styles.txBody}>
        <Text style={styles.txName} numberOfLines={1}>
          {tx.counterpartyName ?? tx.counterpartyId}
        </Text>
        <Text style={[styles.txAmount, { color: typeInfo.color }]}>
          ¥{formatNumberWithCommas(tx.amount)}
        </Text>
      </View>

      <View style={styles.txFooter}>
        <Text style={styles.txDate}>{tx.transactionDate}</Text>
        {tx.dueDate ? (
          <Text style={styles.txDue}>到期：{tx.dueDate}</Text>
        ) : null}
        {paymentLabel ? (
          <Text style={styles.txPayment}>{paymentLabel}</Text>
        ) : null}
      </View>

      {tx.remark ? (
        <Text style={styles.txRemark} numberOfLines={1}>
          备注：{tx.remark}
        </Text>
      ) : null}

      <Divider style={styles.txDivider} />
    </View>
  );
}

interface AgingRowProps {
  row: AgingData;
  isCustomer: boolean;
}

function AgingRow({ row, isCustomer: _isCustomer }: AgingRowProps) {
  const fmt = (v: number) => (v != null && v !== 0 ? `¥${formatNumberWithCommas(v)}` : '-');
  return (
    <View style={styles.agingRow}>
      <View style={styles.agingNameCell}>
        <Text style={styles.agingName} numberOfLines={1}>
          {row.counterpartyName}
        </Text>
        <Text style={styles.agingTotal}>{fmt(row.totalBalance)}</Text>
      </View>

      <View style={styles.agingBuckets}>
        <AgingBucket label="未到期" value={fmt(row.current)} color="#67c23a" />
        <AgingBucket label="1-30天" value={fmt(row.days1to30)} color="#e6a23c" />
        <AgingBucket label="31-60天" value={fmt(row.days31to60)} color="#e6a23c" />
        <AgingBucket label="61-90天" value={fmt(row.days61to90)} color="#f56c6c" />
        <AgingBucket label="91-180天" value={fmt(row.days91to180)} color="#f56c6c" />
        <AgingBucket
          label=">180天"
          value={fmt(row.over180)}
          color={row.over180 > 0 ? '#f56c6c' : '#909399'}
          bold={row.over180 > 0}
        />
      </View>

      <Divider style={styles.agingDivider} />
    </View>
  );
}

interface AgingBucketProps {
  label: string;
  value: string;
  color: string;
  bold?: boolean;
}

function AgingBucket({ label, value, color, bold }: AgingBucketProps) {
  return (
    <View style={styles.agingBucket}>
      <Text style={styles.agingBucketLabel}>{label}</Text>
      <Text style={[styles.agingBucketValue, { color }, bold ? styles.agingBucketBold : null]}>
        {value}
      </Text>
    </View>
  );
}

// ==================== 主页面 ====================

export default function ArApOverviewScreen() {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [overview, setOverview] = useState<FinanceOverview | null>(null);
  const [arTransactions, setArTransactions] = useState<ArApTransaction[]>([]);
  const [apTransactions, setApTransactions] = useState<ArApTransaction[]>([]);
  const [agingData, setAgingData] = useState<AgingData[]>([]);
  const [agingType, setAgingType] = useState<CounterpartyType>('CUSTOMER');
  const [arPage, setArPage] = useState(1);
  const [apPage, setApPage] = useState(1);
  const [arTotal, setArTotal] = useState(0);
  const [apTotal, setApTotal] = useState(0);
  const [arLoadingMore, setArLoadingMore] = useState(false);
  const [apLoadingMore, setApLoadingMore] = useState(false);

  const PAGE_SIZE = 20;

  const fmt = (v: number | null | undefined): string => {
    if (v == null) return '-';
    return `¥${formatNumberWithCommas(v)}`;
  };

  // ==================== 数据加载 ====================

  const loadOverview = useCallback(async () => {
    try {
      const res = await financeApiClient.getOverview();
      if (res.success) setOverview(res.data);
    } catch {
      // overview is non-critical, silent fail
    }
  }, []);

  const loadArTransactions = useCallback(async (page: number, append = false) => {
    if (append) setArLoadingMore(true);
    try {
      const res = await financeApiClient.getTransactions({
        counterpartyType: 'CUSTOMER',
        page,
        size: PAGE_SIZE,
      });
      if (res.success && res.data) {
        const newItems = res.data.content ?? [];
        setArTransactions(prev => (append ? [...prev, ...newItems] : newItems));
        setArTotal(res.data.totalElements ?? 0);
      }
    } catch {
      if (!append) Alert.alert('错误', '加载应收记录失败');
    } finally {
      setArLoadingMore(false);
    }
  }, []);

  const loadApTransactions = useCallback(async (page: number, append = false) => {
    if (append) setApLoadingMore(true);
    try {
      const res = await financeApiClient.getTransactions({
        counterpartyType: 'SUPPLIER',
        page,
        size: PAGE_SIZE,
      });
      if (res.success && res.data) {
        const newItems = res.data.content ?? [];
        setApTransactions(prev => (append ? [...prev, ...newItems] : newItems));
        setApTotal(res.data.totalElements ?? 0);
      }
    } catch {
      if (!append) Alert.alert('错误', '加载应付记录失败');
    } finally {
      setApLoadingMore(false);
    }
  }, []);

  const loadAging = useCallback(
    async (type: CounterpartyType) => {
      try {
        const res = await financeApiClient.getAging(type);
        if (res.success) setAgingData(Array.isArray(res.data) ? res.data : []);
      } catch {
        // non-critical
      }
    },
    []
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadOverview(),
        loadArTransactions(1, false),
        loadApTransactions(1, false),
        loadAging(agingType),
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [agingType, loadOverview, loadArTransactions, loadApTransactions, loadAging]);

  useEffect(() => {
    loadAll();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setArPage(1);
    setApPage(1);
    loadAll();
  };

  const handleAgingTypeChange = (type: CounterpartyType) => {
    setAgingType(type);
    loadAging(type);
  };

  const handleArLoadMore = () => {
    if (arLoadingMore || arTransactions.length >= arTotal) return;
    const nextPage = arPage + 1;
    setArPage(nextPage);
    loadArTransactions(nextPage, true);
  };

  const handleApLoadMore = () => {
    if (apLoadingMore || apTransactions.length >= apTotal) return;
    const nextPage = apPage + 1;
    setApPage(nextPage);
    loadApTransactions(nextPage, true);
  };

  // ==================== KPI 数据 ====================

  const netAmount = (overview?.totalReceivable ?? 0) - (overview?.totalPayable ?? 0);

  const kpiValues: Record<string, { value: string; sub: string }> = {
    ar: {
      value: fmt(overview?.totalReceivable),
      sub: `${overview?.receivableCount ?? 0} 笔未收`,
    },
    ap: {
      value: fmt(overview?.totalPayable),
      sub: `${overview?.payableCount ?? 0} 笔未付`,
    },
    net: {
      value: fmt(netAmount),
      sub: netAmount >= 0 ? '净应收' : '净应付',
    },
    overdue: {
      value: fmt(overview?.overdueAmount),
      sub: `${overview?.overdueCount ?? 0} 笔逾期`,
    },
  };

  // ==================== 收付款弹窗 ====================

  const [paymentVisible, setPaymentVisible] = useState(false);
  const [paymentType, setPaymentType] = useState<'ar' | 'ap'>('ar');
  const [paymentCounterpartyId, setPaymentCounterpartyId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethodVal, setPaymentMethodVal] = useState<PaymentMethod>('BANK_TRANSFER');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentRemark, setPaymentRemark] = useState('');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
    { value: 'CASH', label: '现金' },
    { value: 'BANK_TRANSFER', label: '银行转账' },
    { value: 'WECHAT', label: '微信' },
    { value: 'ALIPAY', label: '支付宝' },
    { value: 'CHECK', label: '支票' },
    { value: 'POS', label: 'POS' },
    { value: 'OTHER', label: '其他' },
  ];

  const openPaymentModal = () => {
    setPaymentType(activeTab === 'ap' ? 'ap' : 'ar');
    setPaymentCounterpartyId('');
    setPaymentAmount('');
    setPaymentMethodVal('BANK_TRANSFER');
    setPaymentReference('');
    setPaymentRemark('');
    setPaymentVisible(true);
  };

  const handlePaymentSubmit = async () => {
    if (!paymentCounterpartyId.trim()) {
      Alert.alert('提示', '请输入交易对手ID');
      return;
    }
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('提示', '请输入有效金额');
      return;
    }

    setPaymentSubmitting(true);
    try {
      const request: RecordTransactionRequest = {
        counterpartyId: paymentCounterpartyId.trim(),
        amount,
        paymentMethod: paymentMethodVal,
        paymentReference: paymentReference.trim() || undefined,
        remark: paymentRemark.trim() || undefined,
      };

      const res = paymentType === 'ar'
        ? await financeApiClient.recordArPayment(request)
        : await financeApiClient.recordApPayment(request);

      if (res.success) {
        Alert.alert('成功', paymentType === 'ar' ? '收款记录已创建' : '付款记录已创建');
        setPaymentVisible(false);
        onRefresh();
      } else {
        Alert.alert('失败', res.message || '操作失败');
      }
    } catch {
      Alert.alert('错误', '请求失败');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  // ==================== 渲染 ====================

  const renderKpiSection = () => (
    <View style={styles.kpiGrid}>
      {KPI_CARD_CONFIGS.map(cfg => {
        const data = kpiValues[cfg.key];
        return (
          <KpiCard
            key={cfg.key}
            label={cfg.label}
            value={data?.value ?? '-'}
            sub={data?.sub ?? ''}
            bg={cfg.bg}
            accent={cfg.accent}
          />
        );
      })}
    </View>
  );

  const renderArItem = ({ item }: { item: ArApTransaction }) => <TxRow tx={item} />;
  const renderApItem = ({ item }: { item: ArApTransaction }) => <TxRow tx={item} />;

  const renderArFooter = () => {
    if (!arLoadingMore) return null;
    return <ActivityIndicator style={styles.loadMoreIndicator} size="small" />;
  };

  const renderApFooter = () => {
    if (!apLoadingMore) return null;
    return <ActivityIndicator style={styles.loadMoreIndicator} size="small" />;
  };

  const renderAgingSection = () => (
    <View>
      {/* 账龄类型切换 */}
      <View style={styles.agingToggle}>
        <TouchableOpacity
          style={[
            styles.agingToggleBtn,
            agingType === 'CUSTOMER' && styles.agingToggleBtnActive,
          ]}
          onPress={() => handleAgingTypeChange('CUSTOMER')}
        >
          <Text
            style={[
              styles.agingToggleBtnText,
              agingType === 'CUSTOMER' && styles.agingToggleBtnTextActive,
            ]}
          >
            应收账龄
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.agingToggleBtn,
            agingType === 'SUPPLIER' && styles.agingToggleBtnActive,
          ]}
          onPress={() => handleAgingTypeChange('SUPPLIER')}
        >
          <Text
            style={[
              styles.agingToggleBtnText,
              agingType === 'SUPPLIER' && styles.agingToggleBtnTextActive,
            ]}
          >
            应付账龄
          </Text>
        </TouchableOpacity>
      </View>

      {agingData.length === 0 ? (
        <Text style={styles.emptyText}>
          暂无{agingType === 'CUSTOMER' ? '应收' : '应付'}账龄数据
        </Text>
      ) : (
        <Card style={styles.agingCard}>
          <Card.Content style={styles.agingCardContent}>
            {agingData.map((row, idx) => (
              <AgingRow key={row.counterpartyId ?? idx} row={row} isCustomer={agingType === 'CUSTOMER'} />
            ))}
          </Card.Content>
        </Card>
      )}
    </View>
  );

  const renderOverviewTab = () => (
    <ScrollView
      style={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {renderKpiSection()}

      {/* 最近交易 */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>最近交易</Text>
      </View>
      <Card style={styles.card}>
        <Card.Content>
          {arTransactions.length === 0 && apTransactions.length === 0 ? (
            <Text style={styles.emptyText}>暂无交易记录</Text>
          ) : (
            [...arTransactions, ...apTransactions]
              .sort((a, b) => {
                const da = a.transactionDate ?? '';
                const db = b.transactionDate ?? '';
                return db.localeCompare(da);
              })
              .slice(0, 10)
              .map((tx, idx) => <TxRow key={tx.id ?? idx} tx={tx} />)
          )}
        </Card.Content>
      </Card>

      <View style={styles.bottomPad} />
    </ScrollView>
  );

  const renderArTab = () => (
    <FlatList
      data={arTransactions}
      keyExtractor={(item, idx) => item.id ?? String(idx)}
      renderItem={renderArItem}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View style={styles.listHeader}>
          <Text style={styles.listHeaderText}>
            共 {arTotal} 条应收记录
          </Text>
        </View>
      }
      ListEmptyComponent={
        <Text style={styles.emptyText}>暂无应收账款记录</Text>
      }
      ListFooterComponent={renderArFooter}
      onEndReached={handleArLoadMore}
      onEndReachedThreshold={0.3}
    />
  );

  const renderApTab = () => (
    <FlatList
      data={apTransactions}
      keyExtractor={(item, idx) => item.id ?? String(idx)}
      renderItem={renderApItem}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View style={styles.listHeader}>
          <Text style={styles.listHeaderText}>
            共 {apTotal} 条应付记录
          </Text>
        </View>
      }
      ListEmptyComponent={
        <Text style={styles.emptyText}>暂无应付账款记录</Text>
      }
      ListFooterComponent={renderApFooter}
      onEndReached={handleApLoadMore}
      onEndReachedThreshold={0.3}
    />
  );

  const renderAgingTab = () => (
    <ScrollView
      style={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {renderAgingSection()}
      <View style={styles.bottomPad} />
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="应收应付管理" />
        <Appbar.Action icon="refresh" onPress={onRefresh} />
      </Appbar.Header>

      {/* Tab Bar */}
      <Surface style={styles.tabBar} elevation={1}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text
              style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}
            >
              {tab.label}
            </Text>
            {activeTab === tab.key && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </Surface>

      {/* Content */}
      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loaderText}>加载中...</Text>
        </View>
      ) : (
        <>
          {activeTab === 'overview' && renderOverviewTab()}
          {activeTab === 'ar' && renderArTab()}
          {activeTab === 'ap' && renderApTab()}
          {activeTab === 'aging' && renderAgingTab()}
        </>
      )}

      {/* 收付款 FAB */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={openPaymentModal}
        label={activeTab === 'ap' ? '付款' : '收款'}
      />

      {/* 收付款弹窗 */}
      <Portal>
        <Modal
          visible={paymentVisible}
          onDismiss={() => setPaymentVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <ScrollView>
            <Text variant="titleMedium" style={styles.modalTitle}>
              {paymentType === 'ar' ? '记录收款' : '记录付款'}
            </Text>

            <SegmentedButtons
              value={paymentType}
              onValueChange={(v) => setPaymentType(v as 'ar' | 'ap')}
              buttons={[
                { value: 'ar', label: '收款(应收)' },
                { value: 'ap', label: '付款(应付)' },
              ]}
              style={styles.modalSegmented}
            />

            <TextInput
              label={paymentType === 'ar' ? '客户ID' : '供应商ID'}
              value={paymentCounterpartyId}
              onChangeText={setPaymentCounterpartyId}
              mode="outlined"
              style={styles.modalInput}
            />

            <TextInput
              label="金额"
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              mode="outlined"
              keyboardType="numeric"
              style={styles.modalInput}
            />

            <Text style={styles.modalLabel}>支付方式</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.methodScroll}>
              {PAYMENT_METHOD_OPTIONS.map(opt => (
                <Chip
                  key={opt.value}
                  selected={paymentMethodVal === opt.value}
                  onPress={() => setPaymentMethodVal(opt.value)}
                  style={styles.methodChip}
                >
                  {opt.label}
                </Chip>
              ))}
            </ScrollView>

            <TextInput
              label="付款凭证号（选填）"
              value={paymentReference}
              onChangeText={setPaymentReference}
              mode="outlined"
              style={styles.modalInput}
            />

            <TextInput
              label="备注（选填）"
              value={paymentRemark}
              onChangeText={setPaymentRemark}
              mode="outlined"
              style={styles.modalInput}
            />

            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => setPaymentVisible(false)}
                style={styles.modalBtn}
              >
                取消
              </Button>
              <Button
                mode="contained"
                onPress={handlePaymentSubmit}
                loading={paymentSubmitting}
                disabled={paymentSubmitting}
                style={styles.modalBtn}
              >
                确认
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>
    </View>
  );
}

// ==================== 样式 ====================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  tabItemActive: {},
  tabLabel: {
    fontSize: 14,
    color: '#909399',
  },
  tabLabelActive: {
    color: '#667eea',
    fontWeight: '600',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: '15%',
    right: '15%',
    height: 2,
    backgroundColor: '#667eea',
    borderRadius: 1,
  },

  // Loader
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loaderText: {
    color: '#909399',
    fontSize: 14,
  },

  // KPI Grid
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    paddingTop: 12,
    gap: 8,
  },
  kpiCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  kpiAccentDot: {
    position: 'absolute',
    top: -12,
    right: -12,
    width: 60,
    height: 60,
    borderRadius: 30,
    opacity: 0.4,
  },
  kpiLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 6,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  kpiSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
  },

  // Scroll / list
  scroll: {
    flex: 1,
  },
  listContent: {
    padding: 12,
    paddingBottom: 60,
  },
  listHeader: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  listHeaderText: {
    fontSize: 12,
    color: '#909399',
  },
  loadMoreIndicator: {
    paddingVertical: 16,
  },

  // Section
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#606266',
  },

  // Card
  card: {
    marginHorizontal: 12,
    borderRadius: 10,
  },

  // Transaction row
  txRow: {
    paddingVertical: 10,
  },
  txHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  txNum: {
    fontSize: 13,
    fontWeight: '600',
    color: '#303133',
    flex: 1,
    marginRight: 8,
  },
  txChip: {
    height: 24,
  },
  txChipText: {
    fontSize: 11,
    lineHeight: 14,
  },
  txBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  txName: {
    fontSize: 13,
    color: '#606266',
    flex: 1,
    marginRight: 8,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  txFooter: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 2,
  },
  txDate: {
    fontSize: 11,
    color: '#c0c4cc',
  },
  txDue: {
    fontSize: 11,
    color: '#c0c4cc',
  },
  txPayment: {
    fontSize: 11,
    color: '#c0c4cc',
  },
  txRemark: {
    fontSize: 11,
    color: '#c0c4cc',
    fontStyle: 'italic',
    marginBottom: 2,
  },
  txDivider: {
    marginTop: 8,
  },

  // Aging
  agingToggle: {
    flexDirection: 'row',
    margin: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e4e7ed',
  },
  agingToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  agingToggleBtnActive: {
    backgroundColor: '#667eea',
  },
  agingToggleBtnText: {
    fontSize: 13,
    color: '#606266',
  },
  agingToggleBtnTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  agingCard: {
    marginHorizontal: 12,
    borderRadius: 10,
  },
  agingCardContent: {
    paddingTop: 4,
  },
  agingRow: {
    paddingVertical: 10,
  },
  agingNameCell: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  agingName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#303133',
    flex: 1,
    marginRight: 8,
  },
  agingTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#303133',
  },
  agingBuckets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  agingBucket: {
    minWidth: '30%',
    marginBottom: 4,
  },
  agingBucketLabel: {
    fontSize: 10,
    color: '#909399',
    marginBottom: 2,
  },
  agingBucketValue: {
    fontSize: 12,
    fontWeight: '500',
  },
  agingBucketBold: {
    fontWeight: '700',
  },
  agingDivider: {
    marginTop: 8,
  },

  // FAB
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#667eea',
  },

  // Payment modal
  modalContainer: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 12,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalSegmented: {
    marginBottom: 12,
  },
  modalInput: {
    marginBottom: 10,
  },
  modalLabel: {
    fontSize: 13,
    color: '#606266',
    marginBottom: 6,
    marginTop: 4,
  },
  methodScroll: {
    marginBottom: 10,
  },
  methodChip: {
    marginRight: 6,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  modalBtn: {
    flex: 1,
  },

  // Empty / misc
  emptyText: {
    textAlign: 'center',
    paddingVertical: 40,
    color: '#c0c4cc',
    fontSize: 14,
  },
  bottomPad: {
    height: 40,
  },
});
