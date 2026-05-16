/**
 * SampleRequestDetailScreen — S-RD-1 / N48 研发样品详情 (Sprint 2 / Track F).
 *
 * 显示样品全部字段 + Attachment 列表 (Sprint 1 Track C ship) +
 * 状态相关动作按钮 (submit / approve / reject).
 *
 * approve 触发后端 SampleApprovedEventListener:
 *   - 自动建 QuotationTask
 *   - best-effort 自动建 BomRecipe 草稿 (productTypeId + mainMaterial 在字典时)
 *   - 通知销售主管 (NotificationService.sendToRole)
 *
 * 注: navigator 路由整合 (跳 BomConfigScreen 等) 由 organizer 拍板, 留 follow-up PR.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { sampleApiClient, type ProductSample } from '../../services/api/sampleApiClient';
import { AttachmentList } from '../../components/attachment/AttachmentList';

type RDStackParamList = {
  SampleRequestDetail: { sampleId: string };
};

type Route = RouteProp<RDStackParamList, 'SampleRequestDetail'>;

export const SampleRequestDetailScreen: React.FC = () => {
  const route = useRoute<Route>();
  const { sampleId } = route.params;

  const [sample, setSample] = useState<ProductSample | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await sampleApiClient.getSample(sampleId);
      setSample(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [sampleId]);

  useEffect(() => {
    load();
  }, [load]);

  const onSubmit = useCallback(async () => {
    if (!sample) return;
    setActionLoading(true);
    try {
      const updated = await sampleApiClient.submitForApproval(sample.id);
      setSample(updated);
      Alert.alert('已提交审核', `样品 ${updated.sampleCode} 状态: ${updated.status}`);
    } catch (e) {
      Alert.alert('提交失败', e instanceof Error ? e.message : String(e));
    } finally {
      setActionLoading(false);
    }
  }, [sample]);

  const onApprove = useCallback(async () => {
    if (!sample) return;
    setActionLoading(true);
    try {
      const updated = await sampleApiClient.approveSample(sample.id, reviewNotes || undefined);
      setSample(updated);
      Alert.alert(
        '审核通过',
        `样品 ${updated.sampleCode} 已通过. 系统正在自动建 BOM 草稿 + 报价任务 + 通知销售 (异步, 几秒内完成).`,
      );
      setReviewNotes('');
    } catch (e) {
      Alert.alert('审核失败', e instanceof Error ? e.message : String(e));
    } finally {
      setActionLoading(false);
    }
  }, [sample, reviewNotes]);

  const onReject = useCallback(async () => {
    if (!sample) return;
    if (!reviewNotes.trim()) {
      Alert.alert('驳回需要意见', '请在下方输入驳回理由');
      return;
    }
    setActionLoading(true);
    try {
      const updated = await sampleApiClient.rejectSample(sample.id, reviewNotes);
      setSample(updated);
      Alert.alert('已驳回', `样品 ${updated.sampleCode} 已退回研发员`);
      setReviewNotes('');
    } catch (e) {
      Alert.alert('驳回失败', e instanceof Error ? e.message : String(e));
    } finally {
      setActionLoading(false);
    }
  }, [sample, reviewNotes]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !sample) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? '样品未找到'}</Text>
        <TouchableOpacity onPress={load} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>重试</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const showSubmitButton = sample.status === 'DRAFT' || sample.status === 'IN_PROGRESS' || sample.status === 'TESTING';
  const showReviewButtons = sample.status === 'SUBMITTED';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <Text style={styles.code}>{sample.sampleCode}</Text>
        <Text style={styles.name}>{sample.name}</Text>
        <Text style={styles.status}>状态: {sample.status}</Text>
      </View>

      <Section title="样品信息">
        <Row label="规格" value={sample.specification} />
        <Row label="等级" value={sample.grade} />
        <Row label="主原料" value={sample.mainMaterial} />
        <Row label="样品版本" value={sample.sampleVersion} />
        <Row label="储存方式" value={sample.storageMethod} />
        <Row label="产品状态" value={sample.productStatus} />
      </Section>

      <Section title="客户信息">
        <Row label="客户名称" value={sample.customerName} />
        <Row label="客户编码" value={sample.customerCode} />
        <Row label="客户级别" value={sample.customerLevel} />
        <Row label="客户性质" value={sample.customerType} />
        <Row label="业务员" value={sample.salesperson} />
        <Row
          label="客户预期价"
          value={sample.customerExpectedPrice != null ? `¥${sample.customerExpectedPrice}` : undefined}
        />
        <Row label="客户最新要求" value={sample.customerLatestRequirement} multiline />
      </Section>

      <Section title="价格 & 成本">
        <Row label="成品报价" value={sample.productQuotePrice != null ? `¥${sample.productQuotePrice}` : undefined} />
        <Row label="原料价格" value={sample.materialPrice != null ? `¥${sample.materialPrice}` : undefined} />
        <Row label="加工费" value={sample.processingFee != null ? `¥${sample.processingFee}` : undefined} />
        <Row
          label="主原料出成率"
          value={sample.mainMaterialYieldRate != null ? `${sample.mainMaterialYieldRate}%` : undefined}
        />
      </Section>

      {sample.status === 'APPROVED' && sample.bomProductTypeId ? (
        <Section title="自动建链接">
          <Row label="BOM 草稿" value={sample.bomProductTypeId} />
          <Text style={styles.hint}>提示: BOM 草稿已自动建, 请在 BOM 配方模块完善配方项.</Text>
        </Section>
      ) : null}

      {sample.approvalNotes ? (
        <Section title="审核意见">
          <Text style={styles.value}>{sample.approvalNotes}</Text>
        </Section>
      ) : null}

      <Section title="附件 (Sprint 1 Track C)">
        <AttachmentList entityType="RD_SAMPLE" entityId={sample.id} />
      </Section>

      {(showSubmitButton || showReviewButtons) ? (
        <View style={styles.actionsBox}>
          {showReviewButtons ? (
            <TextInput
              style={styles.notesInput}
              placeholder="审核意见 (驳回必填, 通过可选)"
              value={reviewNotes}
              onChangeText={setReviewNotes}
              multiline
              numberOfLines={3}
            />
          ) : null}
          <View style={styles.buttonRow}>
            {showSubmitButton ? (
              <TouchableOpacity
                style={[styles.button, styles.buttonPrimary]}
                onPress={onSubmit}
                disabled={actionLoading}
              >
                <Text style={styles.buttonText}>提交审核</Text>
              </TouchableOpacity>
            ) : null}
            {showReviewButtons ? (
              <>
                <TouchableOpacity
                  style={[styles.button, styles.buttonDanger]}
                  onPress={onReject}
                  disabled={actionLoading}
                >
                  <Text style={styles.buttonText}>驳回</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.buttonSuccess]}
                  onPress={onApprove}
                  disabled={actionLoading}
                >
                  <Text style={styles.buttonText}>通过</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
          {actionLoading ? <ActivityIndicator style={{ marginTop: 8 }} /> : null}
        </View>
      ) : null}
    </ScrollView>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.sectionBody}>{children}</View>
  </View>
);

const Row: React.FC<{ label: string; value?: string | null; multiline?: boolean }> = ({
  label,
  value,
  multiline,
}) => {
  if (value == null || value === '') return null;
  return (
    <View style={multiline ? styles.rowMultiline : styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, multiline && styles.valueMultiline]}>{value}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { color: '#991B1B', marginBottom: 12 },
  retryButton: { backgroundColor: '#2563EB', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 },
  retryButtonText: { color: '#fff' },
  headerCard: {
    backgroundColor: '#fff',
    padding: 16,
    margin: 12,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  code: { fontSize: 13, color: '#6B7280', marginBottom: 4 },
  name: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 6 },
  status: { fontSize: 14, color: '#374151' },
  section: { marginHorizontal: 12, marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#6B7280', marginBottom: 6, paddingHorizontal: 4 },
  sectionBody: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  rowMultiline: { paddingVertical: 6 },
  label: { color: '#6B7280', fontSize: 14 },
  value: { color: '#111827', fontSize: 14, flexShrink: 1, textAlign: 'right' },
  valueMultiline: { textAlign: 'left', marginTop: 4 },
  hint: { color: '#6B7280', fontSize: 12, marginTop: 6, fontStyle: 'italic' },
  actionsBox: {
    backgroundColor: '#fff',
    margin: 12,
    padding: 12,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    padding: 8,
    minHeight: 60,
    marginBottom: 10,
    textAlignVertical: 'top',
  },
  buttonRow: { flexDirection: 'row', gap: 8 },
  button: { flex: 1, paddingVertical: 12, borderRadius: 6, alignItems: 'center' },
  buttonPrimary: { backgroundColor: '#2563EB' },
  buttonSuccess: { backgroundColor: '#10B981' },
  buttonDanger: { backgroundColor: '#EF4444' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});

export default SampleRequestDetailScreen;
