/**
 * Rich Content Renderer
 *
 * Renders structured AI tool results as tables, detail cards, or confirmation previews
 * instead of raw text. Detects content type from the resultData shape.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export interface RichData {
  /** Content type hint from backend (optional) */
  dataType?: 'LIST' | 'DETAIL' | 'CONFIRM' | 'STATS' | 'PAGINATION';
  /** The actual data payload */
  content?: unknown[] | Record<string, unknown>;
  /** Pagination info */
  totalElements?: number;
  totalPages?: number;
  currentPage?: number;
  hasMore?: boolean;
}

/**
 * Detect the best rendering mode from raw resultData
 */
export function detectRichData(resultData: Record<string, unknown> | undefined): RichData | undefined {
  if (!resultData) return undefined;

  // List/table result (from buildPageResult)
  if (Array.isArray(resultData.content) && resultData.content.length > 0) {
    return {
      dataType: 'LIST',
      content: resultData.content as unknown[],
      totalElements: resultData.totalElements as number,
      totalPages: resultData.totalPages as number,
      currentPage: resultData.currentPage as number,
      hasMore: resultData.hasMore as boolean,
    };
  }

  // Confirmation/preview
  if (resultData.status === 'PREVIEW' || resultData.status === 'PAGINATION_READY') {
    return { dataType: 'CONFIRM', content: resultData };
  }

  // Statistics result
  if (resultData.totalOrders !== undefined || resultData.totalAmount !== undefined ||
      resultData.statusCounts !== undefined) {
    return { dataType: 'STATS', content: resultData };
  }

  // Single detail result with identifiable fields
  if (resultData.orderId || resultData.planId || resultData.batchId ||
      resultData.transferId || resultData.returnOrderId) {
    return { dataType: 'DETAIL', content: resultData };
  }

  return undefined;
}

interface Props {
  data: RichData;
}

export function RichContentRenderer({ data }: Props) {
  switch (data.dataType) {
    case 'LIST':
      return <ListRenderer items={data.content as unknown[]} pagination={data} />;
    case 'DETAIL':
      return <DetailRenderer detail={data.content as Record<string, unknown>} />;
    case 'STATS':
      return <StatsRenderer stats={data.content as Record<string, unknown>} />;
    default:
      return null;
  }
}

// ==================== List/Table Renderer ====================

function ListRenderer({ items, pagination }: { items: unknown[]; pagination: RichData }) {
  if (!items || items.length === 0) return null;

  // Extract column keys from first item
  const firstItem = items[0] as Record<string, unknown>;
  const displayKeys = Object.keys(firstItem)
    .filter(k => !k.endsWith('Id') && k !== 'id' && k !== 'factoryId' &&
                 typeof firstItem[k] !== 'object')
    .slice(0, 5); // Max 5 columns for mobile

  return (
    <View style={listStyles.container}>
      {/* Header row */}
      <View style={listStyles.headerRow}>
        {displayKeys.map(key => (
          <Text key={key} style={listStyles.headerCell} numberOfLines={1}>
            {formatColumnName(key)}
          </Text>
        ))}
      </View>

      {/* Data rows */}
      <ScrollView style={listStyles.body} nestedScrollEnabled>
        {items.slice(0, 10).map((item, idx) => {
          const row = item as Record<string, unknown>;
          return (
            <View key={idx} style={[listStyles.dataRow, idx % 2 === 0 && listStyles.evenRow]}>
              {displayKeys.map(key => (
                <Text key={key} style={listStyles.dataCell} numberOfLines={2}>
                  {formatValue(row[key])}
                </Text>
              ))}
            </View>
          );
        })}
      </ScrollView>

      {/* Pagination footer */}
      {pagination.totalElements !== undefined && (
        <View style={listStyles.footer}>
          <Text style={listStyles.footerText}>
            共 {pagination.totalElements} 条 · 第 {pagination.currentPage}/{pagination.totalPages} 页
            {pagination.hasMore ? ' · 说"下一页"查看更多' : ''}
          </Text>
        </View>
      )}
    </View>
  );
}

// ==================== Detail Card Renderer ====================

function DetailRenderer({ detail }: { detail: Record<string, unknown> }) {
  const displayEntries = Object.entries(detail)
    .filter(([k, v]) => v !== null && v !== undefined && k !== 'factoryId' &&
                         typeof v !== 'object')
    .slice(0, 12);

  return (
    <View style={detailStyles.container}>
      {displayEntries.map(([key, value]) => (
        <View key={key} style={detailStyles.row}>
          <Text style={detailStyles.label}>{formatColumnName(key)}</Text>
          <Text style={detailStyles.value} numberOfLines={2}>{formatValue(value)}</Text>
        </View>
      ))}
    </View>
  );
}

// ==================== Stats Renderer ====================

function StatsRenderer({ stats }: { stats: Record<string, unknown> }) {
  const numericEntries = Object.entries(stats)
    .filter(([, v]) => typeof v === 'number' || typeof v === 'string')
    .slice(0, 8);

  return (
    <View style={statsStyles.container}>
      {numericEntries.map(([key, value]) => (
        <View key={key} style={statsStyles.card}>
          <Text style={statsStyles.value}>{formatValue(value)}</Text>
          <Text style={statsStyles.label}>{formatColumnName(key)}</Text>
        </View>
      ))}
    </View>
  );
}

// ==================== Helpers ====================

const COLUMN_NAMES: Record<string, string> = {
  orderNumber: '订单编号', planNumber: '计划编号', batchNumber: '批次号',
  transferNumber: '调拨编号', returnNumber: '退货编号',
  status: '状态', productName: '产品', productTypeName: '产品类型',
  quantity: '数量', plannedQuantity: '计划数量', actualQuantity: '实际数量',
  totalAmount: '总金额', unitPrice: '单价', price: '价格',
  supplierId: '供应商', customerName: '客户', supplierName: '供应商',
  createdAt: '创建时间', updatedAt: '更新时间', plannedDate: '计划日期',
  message: '消息', remark: '备注', notes: '备注',
  totalOrders: '总订单', totalElements: '总记录数',
  currentPage: '当前页', hasMore: '有更多',
  statusDisplayName: '状态',
};

function formatColumnName(key: string): string {
  return COLUMN_NAMES[key] || key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .trim();
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return value.toLocaleString();
    return value.toFixed(2);
  }
  const str = String(value);
  // Truncate long values
  return str.length > 50 ? str.substring(0, 47) + '...' : str;
}

// ==================== Styles ====================

const listStyles = StyleSheet.create({
  container: { marginTop: 8, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
  headerRow: { flexDirection: 'row', backgroundColor: '#f1f5f9', paddingVertical: 8, paddingHorizontal: 4 },
  headerCell: { flex: 1, fontSize: 11, fontWeight: '600', color: '#475569', paddingHorizontal: 4 },
  body: { maxHeight: 240 },
  dataRow: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 4, borderTopWidth: 0.5, borderColor: '#e2e8f0' },
  evenRow: { backgroundColor: '#f8fafc' },
  dataCell: { flex: 1, fontSize: 12, color: '#334155', paddingHorizontal: 4 },
  footer: { backgroundColor: '#f1f5f9', paddingVertical: 6, paddingHorizontal: 8 },
  footerText: { fontSize: 11, color: '#64748b', textAlign: 'center' },
});

const detailStyles = StyleSheet.create({
  container: { marginTop: 8, backgroundColor: '#f8fafc', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  row: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 0.5, borderColor: '#e2e8f0' },
  label: { width: 90, fontSize: 12, color: '#64748b', fontWeight: '500' },
  value: { flex: 1, fontSize: 12, color: '#1e293b' },
});

const statsStyles = StyleSheet.create({
  container: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { backgroundColor: '#f0f4ff', borderRadius: 8, padding: 10, minWidth: 80, alignItems: 'center', borderWidth: 1, borderColor: '#dbeafe' },
  value: { fontSize: 16, fontWeight: '700', color: '#3b52cc' },
  label: { fontSize: 10, color: '#64748b', marginTop: 2 },
});
