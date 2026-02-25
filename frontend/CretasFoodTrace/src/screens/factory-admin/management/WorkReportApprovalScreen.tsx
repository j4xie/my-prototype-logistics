import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, Alert, RefreshControl, TextInput as RNTextInput } from 'react-native';
import { Text, Appbar, Card, Chip, Button, ActivityIndicator, SegmentedButtons, Modal, Portal, IconButton } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FAManagementStackParamList } from '../../../types/navigation';
import { workReportingApiClient } from '../../../services/api/workReportingApiClient';
import type { WorkReportResponse } from '../../../types/workReporting';
import { formatNumberWithCommas, formatDate } from '../../../utils/formatters';

type Nav = NativeStackNavigationProp<FAManagementStackParamList>;

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  SUBMITTED: { label: '待审批', color: '#e6a23c' },
  APPROVED: { label: '已批准', color: '#67c23a' },
  REJECTED: { label: '已拒绝', color: '#f56c6c' },
  DRAFT: { label: '草稿', color: '#909399' },
};

type FilterValue = 'ALL' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
type TypeFilterValue = 'ALL' | 'PROGRESS' | 'HOURS';

const FILTER_TABS: { value: FilterValue; label: string }[] = [
  { value: 'ALL', label: '全部' },
  { value: 'SUBMITTED', label: '待审批' },
  { value: 'APPROVED', label: '已批准' },
  { value: 'REJECTED', label: '已拒绝' },
];

const TYPE_FILTER_TABS: { value: TypeFilterValue; label: string }[] = [
  { value: 'ALL', label: '全部类型' },
  { value: 'PROGRESS', label: '进度' },
  { value: 'HOURS', label: '工时' },
];

const TYPE_MAP: Record<string, { label: string; color: string }> = {
  PROGRESS: { label: '进度', color: '#1890ff' },
  HOURS: { label: '工时', color: '#7c3aed' },
};

export default function WorkReportApprovalScreen() {
  const navigation = useNavigation<Nav>();
  const [reports, setReports] = useState<WorkReportResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterValue>('SUBMITTED');
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilterValue>('ALL');
  const [allReports, setAllReports] = useState<WorkReportResponse[]>([]);

  const loadReports = useCallback(async () => {
    try {
      const res = await workReportingApiClient.getReports({
        page: 1,
        size: 50,
      });
      if (res.success && res.data) {
        const items = res.data.content || [];
        setAllReports(items);
      }
    } catch {
      Alert.alert('错误', '加载报工列表失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let filtered = allReports;
    if (filter !== 'ALL') {
      filtered = filtered.filter(r => r.status === filter);
    }
    if (typeFilter !== 'ALL') {
      filtered = filtered.filter(r => r.reportType === typeFilter);
    }
    setReports(filtered);
  }, [allReports, filter, typeFilter]);

  useEffect(() => { setLoading(true); loadReports(); }, [loadReports]);

  const onRefresh = () => { setRefreshing(true); loadReports(); };

  const handleApprove = (reportId: number) => {
    Alert.alert('确认审批', '确定批准该报工记录？', [
      { text: '取消', style: 'cancel' },
      {
        text: '批准', onPress: async () => {
          try {
            const res = await workReportingApiClient.approveReport(reportId, true);
            if (res.success) {
              Alert.alert('成功', '已批准');
              loadReports();
            }
          } catch { Alert.alert('错误', '审批失败'); }
        },
      },
    ]);
  };

  const handleReject = (reportId: number) => {
    setRejectingId(reportId);
    setRejectReason('');
    setRejectModalVisible(true);
  };

  const confirmReject = async () => {
    if (!rejectingId) return;
    if (!rejectReason.trim()) {
      Alert.alert('提示', '请填写拒绝原因');
      return;
    }
    setSubmitting(true);
    try {
      const res = await workReportingApiClient.approveReport(rejectingId, false, rejectReason.trim());
      if (res.success) {
        setRejectModalVisible(false);
        Alert.alert('成功', '已拒绝');
        loadReports();
      }
    } catch { Alert.alert('错误', '操作失败'); }
    finally { setSubmitting(false); }
  };

  const renderReport = ({ item }: { item: WorkReportResponse }) => {
    const status = STATUS_MAP[item.status || ''] || { label: item.status || '-', color: '#909399' };
    const typeInfo = TYPE_MAP[item.reportType] || { label: item.reportType || '-', color: '#909399' };
    return (
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Text variant="titleMedium" style={styles.reporterName}>
                {item.reporterName || `工人#${item.workerId}`}
              </Text>
              <Chip
                style={[styles.typeChip, { backgroundColor: typeInfo.color + '15' }]}
                textStyle={{ color: typeInfo.color, fontSize: 11 }}
                compact
              >
                {typeInfo.label}
              </Chip>
            </View>
            <Chip
              style={[styles.chip, { backgroundColor: status.color + '20' }]}
              textStyle={{ color: status.color, fontSize: 12 }}
            >
              {status.label}
            </Chip>
          </View>

          {item.productName ? (
            <View style={styles.cardRow}>
              <Text style={styles.label}>产品</Text>
              <Text style={styles.value}>{item.productName}</Text>
            </View>
          ) : null}

          {item.processCategory ? (
            <View style={styles.cardRow}>
              <Text style={styles.label}>工序</Text>
              <Text style={styles.value}>{item.processCategory}</Text>
            </View>
          ) : null}

          {item.reportType === 'HOURS' ? (
            <>
              {item.totalWorkMinutes != null && (
                <View style={styles.cardRow}>
                  <Text style={styles.label}>总工时</Text>
                  <Text style={[styles.value, styles.outputQty]}>
                    {Math.round(item.totalWorkMinutes / 60 * 10) / 10}小时
                  </Text>
                </View>
              )}
              {item.totalWorkers != null && (
                <View style={styles.cardRow}>
                  <Text style={styles.label}>工人数</Text>
                  <Text style={styles.value}>{item.totalWorkers}人</Text>
                </View>
              )}
            </>
          ) : (
            <>
              <View style={styles.cardRow}>
                <Text style={styles.label}>产量</Text>
                <Text style={[styles.value, styles.outputQty]}>
                  {formatNumberWithCommas(item.outputQuantity || 0)}
                </Text>
              </View>

              {item.goodQuantity != null && (
                <View style={styles.cardRow}>
                  <Text style={styles.label}>良品</Text>
                  <Text style={styles.value}>{formatNumberWithCommas(item.goodQuantity)}</Text>
                </View>
              )}

              {item.defectQuantity != null && Number(item.defectQuantity) > 0 && (
                <View style={styles.cardRow}>
                  <Text style={styles.label}>不良品</Text>
                  <Text style={[styles.value, { color: '#f56c6c' }]}>
                    {formatNumberWithCommas(item.defectQuantity)}
                  </Text>
                </View>
              )}
            </>
          )}

          <View style={styles.cardRow}>
            <Text style={styles.label}>日期</Text>
            <Text style={styles.value}>{item.reportDate || '-'}</Text>
          </View>

          {item.status === 'REJECTED' && item.rejectionReason ? (
            <View style={styles.rejectionRow}>
              <Text style={styles.rejectionLabel}>拒绝原因</Text>
              <Text style={styles.rejectionText}>{item.rejectionReason}</Text>
            </View>
          ) : null}

          {item.status === 'SUBMITTED' && (
            <View style={styles.actions}>
              <Button
                mode="contained"
                compact
                onPress={() => handleApprove(item.id)}
                style={styles.actionBtn}
                buttonColor="#67c23a"
              >
                批准
              </Button>
              <Button
                mode="outlined"
                compact
                textColor="#f56c6c"
                onPress={() => handleReject(item.id)}
                style={styles.actionBtn}
              >
                拒绝
              </Button>
            </View>
          )}
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="生产报工审批" />
        <Appbar.Action icon="refresh" onPress={onRefresh} />
      </Appbar.Header>

      <View style={styles.filterRow}>
        <SegmentedButtons
          value={filter}
          onValueChange={(v) => setFilter(v as FilterValue)}
          buttons={FILTER_TABS}
          style={styles.segmented}
        />
        <SegmentedButtons
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v as TypeFilterValue)}
          buttons={TYPE_FILTER_TABS}
          style={styles.typeSegmented}
          density="small"
        />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" />
      ) : (
        <FlatList
          data={reports}
          keyExtractor={item => String(item.id)}
          renderItem={renderReport}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text style={styles.empty}>暂无报工记录</Text>}
        />
      )}

      <Portal>
        <Modal
          visible={rejectModalVisible}
          onDismiss={() => !submitting && setRejectModalVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <View style={styles.modalHeader}>
            <Text variant="titleMedium" style={styles.modalTitle}>拒绝报工</Text>
            <IconButton icon="close" size={20} onPress={() => !submitting && setRejectModalVisible(false)} />
          </View>
          <Text style={styles.modalHint}>请填写拒绝原因，以便报工人了解并修正：</Text>
          <RNTextInput
            style={styles.reasonInput}
            placeholder="例如：产量数据与实际不符，请核实后重新提交"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={rejectReason}
            onChangeText={setRejectReason}
            maxLength={500}
          />
          <Text style={styles.charCount}>{rejectReason.length}/500</Text>
          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setRejectModalVisible(false)}
              disabled={submitting}
              style={styles.modalBtn}
            >
              取消
            </Button>
            <Button
              mode="contained"
              buttonColor="#f56c6c"
              onPress={confirmReject}
              loading={submitting}
              disabled={submitting || !rejectReason.trim()}
              style={styles.modalBtn}
            >
              确认拒绝
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  filterRow: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#fff' },
  segmented: { marginBottom: 6 },
  typeSegmented: { marginTop: 2 },
  loader: { flex: 1, justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 32 },
  empty: { textAlign: 'center', color: '#999', marginTop: 40, fontSize: 14 },
  card: { marginBottom: 12, borderRadius: 12, backgroundColor: '#fff', elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 },
  reporterName: { fontWeight: '600', color: '#333' },
  typeChip: { height: 24 },
  chip: { height: 28 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  label: { color: '#999', fontSize: 13 },
  value: { color: '#333', fontSize: 13 },
  outputQty: { fontWeight: '600', color: '#1890ff' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, gap: 8 },
  actionBtn: { borderRadius: 8 },
  rejectionRow: { backgroundColor: '#fef0f0', borderRadius: 8, padding: 8, marginTop: 8 },
  rejectionLabel: { color: '#f56c6c', fontSize: 12, fontWeight: '600', marginBottom: 2 },
  rejectionText: { color: '#c45656', fontSize: 13, lineHeight: 18 },
  modalContainer: { backgroundColor: '#fff', margin: 24, borderRadius: 16, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontWeight: '600', color: '#333' },
  modalHint: { color: '#666', fontSize: 13, marginTop: 4, marginBottom: 12 },
  reasonInput: { borderWidth: 1, borderColor: '#dcdfe6', borderRadius: 8, padding: 12, fontSize: 14, minHeight: 100, color: '#333', backgroundColor: '#fafafa' },
  charCount: { textAlign: 'right', color: '#999', fontSize: 12, marginTop: 4 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16, gap: 12 },
  modalBtn: { borderRadius: 8, minWidth: 90 },
});
