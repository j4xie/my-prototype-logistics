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

  const handleConfirmProcurement = (suggestions: ShortageProcurementSuggestion[]) => {
    Alert.alert(
      '生成采购单',
      `准备打开采购建单页面, 待补 ${suggestions.length} 项物料 (供应商/单价需采购员补充)。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '打开',
          onPress: () => {
            // PurchaseOrderCreate 路由当前签名 = undefined, 暂不支持 prefill suggestions。
            // 跨 Chat 跟 Chat J (PurchaseOrderApprovalFlow) 协调后再扩 ParamList。
            navigation.navigate('PurchaseOrderCreate' as never);
          },
        },
      ],
    );
  };

  const handleConfirmProduction = (suggestions: ShortageProductionSuggestion[]) => {
    // ProductionPlanCreate 路由当前不在 FAManagementStack — 由 dispatcher / workshop-supervisor 拥有,
    // 跨 Chat 接线待后续 PR。Sprint 2 Track E 范围仅占位提示。
    Alert.alert(
      '生产任务建议',
      `已为 ${suggestions.length} 个 SKU 生成建议。\n跨模块路由 (生产排班/工序) 暂未接入, 请走 [生产管理] Tab 手工新建。`,
    );
  };

  const handleDingTalkPush = () => {
    // 后端 SalesOrderShortageReportListener 在财务审核通过事件中已自动调
    // NotificationService.notifyRole(factoryId, "FACTORY_ADMIN", ...)。
    // 当前 impl=LoggingNotificationServiceImpl (只 log);
    // Track B1 钉钉 PoC merge 后通过 @Primary 自动转钉钉, 业务代码 0 改动。
    Alert.alert(
      '通知已发出',
      '缺料告警已在审核通过时自动推送至工厂管理员。\nTrack B1 钉钉 PoC merge 后会自动转钉钉群。',
    );
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
