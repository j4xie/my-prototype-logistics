/**
 * Sprint 2 Track E (S-MRP-1 / N31) — 销售订单缺料分析 chain-card.
 *
 * 3 段卡片:
 *   ① 销售单摘要 (订单号 / 状态 / 客户)
 *   ② 缺料列表 + 推荐采购建议 (供应商 / 单价 / leadDays / 三价对比 by Sprint 1 Track C)
 *   ③ 推荐生产任务 (产品 / 工序链 by Sprint 1 Track D2 / 计划起止)
 *
 * 由 SalesOrderShortageReviewScreen + AIChat (displayHint=chain-card) 渲染。
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Divider, Text } from 'react-native-paper';
import type {
  ShortageReport,
  ShortageProcurementSuggestion,
  ShortageProductionSuggestion,
  FgLineItem,
  MaterialShortageItem,
  SalesOrder,
} from '../../services/api/salesApiClient';

export interface ShortageChainCardProps {
  /** 报告快照 (来自 GET /sales/orders/{id}/shortage-report 或 AIChat Tool 输出). */
  report: ShortageReport;
  /** 销售单摘要 — 可选, 缺省时仅显示 salesOrderId. */
  salesOrder?: Pick<SalesOrder, 'id' | 'orderNumber' | 'customerName' | 'status'>;
  /** 一键确认采购 — 跳 PurchaseOrderCreate 预填. Day 4 接线. */
  onConfirmProcurement?: (suggestions: ShortageProcurementSuggestion[]) => void;
  /** 一键确认生产 — 跳 ProductionPlanCreate 预填. Day 4 接线. */
  onConfirmProduction?: (suggestions: ShortageProductionSuggestion[]) => void;
  /** 推钉钉群 (依赖 Sprint 1 Track B1 PoC; 未 merge 时为 No-op). */
  onDingTalkPush?: () => void;
}

const STATUS_COLOR: Record<string, string> = {
  COMPLETED: '#67c23a',
  PENDING: '#e6a23c',
  FAILED: '#f56c6c',
  NOT_AVAILABLE: '#909399',
};

export function ShortageChainCard(props: ShortageChainCardProps) {
  const { report, salesOrder, onConfirmProcurement, onConfirmProduction, onDingTalkPush } = props;

  const status = report.analysisStatus;
  const fg: FgLineItem[] = report.available ?? [];
  const shortage: MaterialShortageItem[] = report.shortage ?? [];
  const procurement = report.procurementSuggestions ?? [];
  const production = report.productionSuggestions ?? [];

  return (
    <View style={styles.container} testID="shortage-chain-card">
      {/* ── ① 销售单摘要 ───────────────────────────────────────── */}
      <Card style={styles.card} testID="shortage-chain-card-summary">
        <Card.Title
          title="销售订单缺料分析"
          subtitle={salesOrder?.orderNumber ?? report.salesOrderId}
          right={() => (
            <Chip
              style={[styles.statusChip, { backgroundColor: STATUS_COLOR[status] ?? '#909399' }]}
              textStyle={styles.statusChipText}
            >
              {status}
            </Chip>
          )}
        />
        <Card.Content>
          {salesOrder?.customerName && (
            <Text style={styles.row}>客户: {salesOrder.customerName}</Text>
          )}
          {report.analysisSummary && (
            <Text style={styles.summary}>{report.analysisSummary}</Text>
          )}
        </Card.Content>
      </Card>

      {/* ── ② 缺料列表 + 推荐采购 ───────────────────────────────── */}
      <Card style={styles.card} testID="shortage-chain-card-procurement">
        <Card.Title title="原辅料短缺 + 采购建议" subtitle={`${shortage.length} 项缺料 / ${procurement.length} 张采购建议`} />
        <Card.Content>
          {shortage.length === 0 && (
            <Text style={styles.empty}>原料库存充足, 无需采购。</Text>
          )}
          {shortage.map((s, i) => {
            const sug = procurement.find(p => p.materialId === s.materialTypeId);
            return (
              <View key={s.materialTypeId} style={styles.itemRow}>
                <Text style={styles.itemTitle}>{i + 1}. {s.materialTypeName ?? s.materialTypeId}</Text>
                <Text style={styles.itemMeta}>
                  缺口 {fmt(s.shortfallQuantity)}{sug?.unit ? ` ${sug.unit}` : ''}
                  {' · '}需求 {fmt(s.requiredQuantity)} · 现存 {fmt(s.availableQuantity)}
                </Text>
                {sug && (
                  <Text style={styles.itemSub}>
                    供应商: {sug.suggestedSupplierName ?? '待补充'}
                    {sug.estimatedPrice != null && ` · 估价 ¥${fmt(sug.estimatedPrice)}`}
                    {sug.leadDays != null && ` · 到货 ${sug.leadDays}d`}
                    {sug.priceComparison?.priceAlert && (
                      <Text style={styles.priceAlert}>  ⚠ {sug.priceComparison.priceAlert}</Text>
                    )}
                  </Text>
                )}
                {i < shortage.length - 1 && <Divider style={styles.divider} />}
              </View>
            );
          })}
          {procurement.length > 0 && (
            <Button
              mode="contained"
              style={styles.actionBtn}
              onPress={() => onConfirmProcurement?.(procurement)}
              disabled={!onConfirmProcurement}
            >
              一键生成采购单 ({procurement.length})
            </Button>
          )}
        </Card.Content>
      </Card>

      {/* ── ③ 推荐生产任务 ──────────────────────────────────────── */}
      <Card style={styles.card} testID="shortage-chain-card-production">
        <Card.Title title="生产任务建议" subtitle={`${production.length} 个 SKU 缺成品`} />
        <Card.Content>
          {fg.filter(l => l.shortfallQuantity > 0).length === 0 && (
            <Text style={styles.empty}>成品库存充足, 直接发货即可。</Text>
          )}
          {production.map((p, i) => (
            <View key={p.productId} style={styles.itemRow}>
              <Text style={styles.itemTitle}>{i + 1}. {p.productName ?? p.productId}</Text>
              <Text style={styles.itemMeta}>计划生产 {fmt(p.plannedQty)}</Text>
              {p.workProcessNames && p.workProcessNames.length > 0 && (
                <Text style={styles.itemSub}>工序: {p.workProcessNames.join(' → ')}</Text>
              )}
              {p.startDate && p.endDate && (
                <Text style={styles.itemSub}>计划: {p.startDate} → {p.endDate}</Text>
              )}
              {i < production.length - 1 && <Divider style={styles.divider} />}
            </View>
          ))}
          {production.length > 0 && (
            <Button
              mode="contained"
              style={styles.actionBtn}
              onPress={() => onConfirmProduction?.(production)}
              disabled={!onConfirmProduction}
            >
              一键创建生产任务 ({production.length})
            </Button>
          )}
        </Card.Content>
      </Card>

      {/* ── 钉钉推送 (依赖 Track B1) ─────────────────────────────── */}
      {onDingTalkPush && (
        <Button
          mode="outlined"
          icon="message-text-outline"
          style={styles.dingBtn}
          onPress={onDingTalkPush}
        >
          推送到钉钉群
        </Button>
      )}
    </View>
  );
}

function fmt(n: number | undefined | null): string {
  if (n == null) return '-';
  return Number.isInteger(n) ? String(n) : Number(n).toFixed(2);
}

const styles = StyleSheet.create({
  container: { padding: 12 },
  card: { marginBottom: 12 },
  statusChip: { marginRight: 12 },
  statusChipText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  row: { fontSize: 14, marginVertical: 2 },
  summary: { fontSize: 14, color: '#606266', marginTop: 8, lineHeight: 20 },
  itemRow: { paddingVertical: 6 },
  itemTitle: { fontSize: 15, fontWeight: '500', color: '#303133' },
  itemMeta: { fontSize: 13, color: '#606266', marginTop: 2 },
  itemSub: { fontSize: 12, color: '#909399', marginTop: 2 },
  priceAlert: { color: '#f56c6c', fontWeight: '500' },
  divider: { marginTop: 8 },
  empty: { fontSize: 14, color: '#909399', fontStyle: 'italic' },
  actionBtn: { marginTop: 12 },
  dingBtn: { marginTop: 4 },
});

export default ShortageChainCard;
