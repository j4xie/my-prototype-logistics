/**
 * Sprint 2 Track E (S-MRP-1 / N31) — 销售单缺料审核屏幕.
 *
 * 路径: factory-admin/inventory/SalesOrderShortageReviewScreen.tsx (Day 4 接入路由).
 * 数据: salesApiClient.getShortageReport(orderId) (异步生成, 可能返回 NOT_AVAILABLE).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Appbar, Banner, Button, Text } from 'react-native-paper';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FAManagementStackParamList } from '../../../types/navigation';
import {
  salesApiClient,
  SalesOrder,
  ShortageProcurementSuggestion,
  ShortageProductionSuggestion,
  ShortageReport,
} from '../../../services/api/salesApiClient';
import { ShortageChainCard } from '../../../components/chain/ShortageChainCard';

type Nav = NativeStackNavigationProp<FAManagementStackParamList>;
type ScreenRoute = RouteProp<FAManagementStackParamList, 'SalesOrderShortageReview'>;

export default function SalesOrderShortageReviewScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<ScreenRoute>();
  const { orderId } = route.params;

  const [report, setReport] = useState<ShortageReport | null>(null);
  const [salesOrder, setSalesOrder] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 并行 — report (异步生成, 可能 NOT_AVAILABLE) + order (用于 chain-card header 摘要)
      const [reportRes, orderRes] = await Promise.all([
        salesApiClient.getShortageReport(orderId),
        salesApiClient.getOrder(orderId),
      ]);
      if (reportRes.success) setReport(reportRes.data);
      if (orderRes.success) setSalesOrder(orderRes.data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '加载失败';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  const handleConfirmProcurement = (_suggestions: ShortageProcurementSuggestion[]) => {
    // Day 4 接线 — 跳 PurchaseOrderCreate 预填. Day 3 仅占位.
    Alert.alert('TODO Day 4', '一键采购建单 — 待跳 PurchaseOrderCreate 预填.');
  };

  const handleConfirmProduction = (_suggestions: ShortageProductionSuggestion[]) => {
    Alert.alert('TODO Day 4', '一键创建生产任务 — 待跳 ProductionPlanCreate 预填.');
  };

  const handleDingTalkPush = () => {
    // Day 4 + Track B1 钉钉 PoC ship 后激活
    Alert.alert('TODO Day 4 / Track B1', '钉钉推送依赖 Sprint 1 Track B1 PoC merge.');
  };

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="销售单缺料分析" subtitle={salesOrder?.orderNumber ?? orderId} />
        <Appbar.Action icon="refresh" onPress={load} disabled={loading} />
      </Appbar.Header>

      {loading && <ActivityIndicator size="large" style={styles.loader} />}

      {!loading && error && (
        <Banner visible icon="alert-circle">
          {`加载失败: ${error}`}
        </Banner>
      )}

      {!loading && !error && report?.analysisStatus === 'NOT_AVAILABLE' && (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>缺料分析尚未生成</Text>
          <Text style={styles.emptyHint}>
            {report.analysisSummary ?? '请确认销售订单已通过财务审核, 报告将在几秒内自动生成。'}
          </Text>
          <Button mode="outlined" onPress={load} style={styles.retryBtn}>重试</Button>
        </View>
      )}

      {!loading && !error && report?.analysisStatus === 'PENDING' && (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>分析进行中...</Text>
          <Text style={styles.emptyHint}>后端正在生成快照, 请稍候。</Text>
          <Button mode="outlined" onPress={load} style={styles.retryBtn}>刷新</Button>
        </View>
      )}

      {!loading && !error && report?.analysisStatus === 'FAILED' && (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>分析失败</Text>
          <Text style={styles.emptyHint}>{report.analysisSummary ?? '请联系管理员排查。'}</Text>
          <Button mode="outlined" onPress={load} style={styles.retryBtn}>重试</Button>
        </View>
      )}

      {!loading && !error && report?.analysisStatus === 'COMPLETED' && (
        <ScrollView>
          <ShortageChainCard
            report={report}
            salesOrder={salesOrder ?? undefined}
            onConfirmProcurement={handleConfirmProcurement}
            onConfirmProduction={handleConfirmProduction}
            onDingTalkPush={handleDingTalkPush}
          />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loader: { marginTop: 80 },
  empty: { padding: 32, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '500', color: '#606266', marginTop: 24, marginBottom: 8 },
  emptyHint: { fontSize: 14, color: '#909399', textAlign: 'center', lineHeight: 22 },
  retryBtn: { marginTop: 16 },
});
