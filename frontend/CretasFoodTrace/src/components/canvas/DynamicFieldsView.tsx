/**
 * DynamicFieldsView.tsx — Round 4 Fix P1-9
 *
 * RN component that renders Canvas V3 dynamic fields for a given module + record.
 * Drop into any detail screen to display platform-configured custom fields without
 * hardcoding the fields in the RN screen itself.
 *
 * Usage:
 *   <DynamicFieldsView
 *     factoryId={factoryId}
 *     moduleCode="sales_order"
 *     recordId={order.id}
 *   />
 *
 * Features:
 *   - Auto-loads effective config from /config/modules/{code}/effective
 *   - Auto-loads values from /{module}/{recordId}/custom-fields
 *   - Respects visibility (field.visible)
 *   - Read-only display (no editing in mobile view, per RN best practice)
 *   - Shows loading/empty states
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { canvasApiClient, EffectiveField } from '../../services/api/canvasApiClient';

interface Props {
  factoryId: string;
  moduleCode: string;
  recordId: string;
  /** If true, only show fields from group === 'custom' (Canvas dynamic) */
  onlyDynamic?: boolean;
  /** Optional header label */
  title?: string;
}

export const DynamicFieldsView: React.FC<Props> = ({
  factoryId,
  moduleCode,
  recordId,
  onlyDynamic = true,
  title,
}) => {
  const [loading, setLoading] = useState(true);
  const [fields, setFields] = useState<EffectiveField[]>([]);
  const [values, setValues] = useState<Record<string, any>>({});

  useEffect(() => {
    // Round 7a P0 fix: previously this useEffect had no cleanup, so when the user
    // rapidly switched factoryId/moduleCode/recordId, the late-arriving response of
    // the previous factory could overwrite state for the new factory. For a compliance
    // angle this was a cross-factory data leak: factory A's user could briefly see
    // factory B's field values if props changed mid-fetch. We now track an "active
    // request id" and discard stale responses.
    let cancelled = false;
    const activeKey = `${factoryId}|${moduleCode}|${recordId}`;

    async function loadData() {
      if (!factoryId || !moduleCode || !recordId) {
        if (!cancelled) setLoading(false);
        return;
      }
      if (!cancelled) setLoading(true);
      try {
        const [config, customValues] = await Promise.all([
          canvasApiClient.getEffectiveConfig(factoryId, moduleCode),
          canvasApiClient.getCustomFields(factoryId, moduleCode, recordId),
        ]);
        if (cancelled) return;  // props changed while we were awaiting — discard
        const allFields = onlyDynamic
          ? canvasApiClient.filterDynamicFields(config)
          : (config?.fields || []).filter(f => f.visible);
        setFields(allFields);
        setValues(customValues);
      } catch (e) {
        if (cancelled) return;
        setFields([]);
        setValues({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [factoryId, moduleCode, recordId, onlyDynamic]);

  function formatValue(field: EffectiveField, value: any): string {
    if (value == null) return '—';
    if (field.type === 'boolean') return value ? '是' : '否';
    if (field.type === 'date' || field.type === 'datetime') {
      try {
        return new Date(value).toLocaleString('zh-CN');
      } catch {
        return String(value);
      }
    }
    if (field.type === 'select' && Array.isArray(field.options)) {
      const opt = field.options.find((o: any) => o.value === value);
      return opt ? opt.label : String(value);
    }
    if (field.type === 'attachment') {
      return String(value).split('/').pop() || String(value);
    }
    if (field.type === 'sub_table') return '查看子表';
    return String(value);
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color="#1890ff" />
        <Text style={styles.loadingText}>加载配置...</Text>
      </View>
    );
  }

  if (fields.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>无自定义字段</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      <ScrollView>
        {fields.map(field => (
          <View key={field.code} style={styles.row}>
            <Text style={styles.label}>{field.label}</Text>
            <Text style={styles.value}>{formatValue(field, values[field.code])}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 12, backgroundColor: '#fff', borderRadius: 8 },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 12, color: '#262626' },
  loading: { padding: 20, alignItems: 'center' },
  loadingText: { marginTop: 8, color: '#8c8c8c', fontSize: 12 },
  empty: { padding: 16, alignItems: 'center' },
  emptyText: { color: '#8c8c8c', fontSize: 12 },
  row: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  label: { flex: 1, fontSize: 13, color: '#8c8c8c' },
  value: { flex: 2, fontSize: 13, color: '#262626', textAlign: 'right' },
});

export default DynamicFieldsView;
