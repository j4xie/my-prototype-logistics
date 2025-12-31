import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Dimensions,
  TextInput,
} from 'react-native';
import {
  Modal,
  Portal,
  Text,
  Button,
  IconButton,
  Divider,
  ActivityIndicator,
  Chip,
} from 'react-native-paper';
import { theme } from '../../theme';
import {
  DiffPreviewResult,
  ChangeStatus,
  configChangeSetApiClient,
} from '../../services/api/configChangeSetApiClient';

interface DiffPreviewModalProps {
  visible: boolean;
  onDismiss: () => void;
  changeSetId: string | null;
  onApproved?: () => void;
  onRejected?: () => void;
  onRolledBack?: () => void;
}

interface DiffItem {
  field: string;
  value?: unknown;
  oldValue?: unknown;
  newValue?: unknown;
}

/**
 * 配置变更差异预览弹窗
 *
 * 功能:
 * - 显示变更前后对比
 * - 结构化差异展示 (新增/删除/修改)
 * - 审批/拒绝操作
 * - 回滚确认
 */
export const DiffPreviewModal: React.FC<DiffPreviewModalProps> = ({
  visible,
  onDismiss,
  changeSetId,
  onApproved,
  onRejected,
  onRolledBack,
}) => {
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<DiffPreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [showRollbackInput, setShowRollbackInput] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rollbackReason, setRollbackReason] = useState('');

  // 加载预览数据
  React.useEffect(() => {
    if (visible && changeSetId) {
      loadPreview();
    } else {
      // 重置状态
      setPreviewData(null);
      setError(null);
      setShowRejectInput(false);
      setShowRollbackInput(false);
      setRejectReason('');
      setRollbackReason('');
    }
  }, [visible, changeSetId]);

  const loadPreview = async () => {
    if (!changeSetId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await configChangeSetApiClient.previewDiff(changeSetId);
      setPreviewData(data);
    } catch (err) {
      console.error('加载差异预览失败:', err);
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  // 审批通过
  const handleApprove = async () => {
    if (!changeSetId) return;

    setActionLoading(true);
    try {
      await configChangeSetApiClient.approveChangeSet(changeSetId);
      onApproved?.();
      onDismiss();
    } catch (err) {
      console.error('审批失败:', err);
      setError(err instanceof Error ? err.message : '审批失败');
    } finally {
      setActionLoading(false);
    }
  };

  // 拒绝
  const handleReject = async () => {
    if (!changeSetId || !rejectReason.trim()) {
      setError('请输入拒绝原因');
      return;
    }

    setActionLoading(true);
    try {
      await configChangeSetApiClient.rejectChangeSet(changeSetId, {
        reason: rejectReason.trim(),
      });
      onRejected?.();
      onDismiss();
    } catch (err) {
      console.error('拒绝失败:', err);
      setError(err instanceof Error ? err.message : '拒绝失败');
    } finally {
      setActionLoading(false);
    }
  };

  // 回滚
  const handleRollback = async () => {
    if (!changeSetId || !rollbackReason.trim()) {
      setError('请输入回滚原因');
      return;
    }

    setActionLoading(true);
    try {
      await configChangeSetApiClient.rollbackChangeSet(changeSetId, {
        reason: rollbackReason.trim(),
      });
      onRolledBack?.();
      onDismiss();
    } catch (err) {
      console.error('回滚失败:', err);
      setError(err instanceof Error ? err.message : '回滚失败');
    } finally {
      setActionLoading(false);
    }
  };

  // 获取状态样式
  const getStatusStyle = (status: ChangeStatus): { bg: string; text: string } => {
    const styles: Record<ChangeStatus, { bg: string; text: string }> = {
      PENDING: { bg: '#FFF7E6', text: '#FA8C16' },
      APPROVED: { bg: '#F6FFED', text: '#52C41A' },
      APPLIED: { bg: '#E6F7FF', text: '#1890FF' },
      REJECTED: { bg: '#FFF1F0', text: '#FF4D4F' },
      ROLLED_BACK: { bg: '#F5F5F5', text: '#8C8C8C' },
      EXPIRED: { bg: '#F5F5F5', text: '#8C8C8C' },
    };
    return styles[status] ?? { bg: '#F5F5F5', text: '#8C8C8C' };
  };

  // 渲染差异项
  const renderDiffSection = (
    title: string,
    items: DiffItem[],
    type: 'added' | 'removed' | 'modified'
  ) => {
    if (!items || items.length === 0) return null;

    const colors = {
      added: { bg: '#F6FFED', border: '#B7EB8F', text: '#52C41A', icon: '+' },
      removed: { bg: '#FFF1F0', border: '#FFA39E', text: '#FF4D4F', icon: '-' },
      modified: { bg: '#E6F7FF', border: '#91D5FF', text: '#1890FF', icon: '~' },
    };

    const color = colors[type];

    return (
      <View style={styles.diffSection}>
        <Text style={[styles.diffSectionTitle, { color: color.text }]}>
          {color.icon} {title} ({items.length})
        </Text>
        {items.map((item, index) => (
          <View
            key={`${type}-${index}`}
            style={[styles.diffItem, { backgroundColor: color.bg, borderColor: color.border }]}
          >
            <Text style={styles.diffFieldName}>{item.field}</Text>
            {type === 'modified' ? (
              <View style={styles.modifiedValues}>
                <View style={styles.valueRow}>
                  <Text style={styles.valueLabel}>旧值:</Text>
                  <Text style={[styles.valueText, styles.oldValue]}>
                    {formatValue(item.oldValue)}
                  </Text>
                </View>
                <View style={styles.valueRow}>
                  <Text style={styles.valueLabel}>新值:</Text>
                  <Text style={[styles.valueText, styles.newValue]}>
                    {formatValue(item.newValue)}
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={styles.valueText}>{formatValue(item.value)}</Text>
            )}
          </View>
        ))}
      </View>
    );
  };

  // 格式化值显示
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) {
      return '(空)';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  // 渲染操作按钮
  const renderActions = () => {
    if (!previewData) return null;

    const { status } = previewData;

    // 待审批状态: 显示审批/拒绝按钮
    if (status === 'PENDING') {
      if (showRejectInput) {
        return (
          <View style={styles.actionSection}>
            <Text style={styles.inputLabel}>请输入拒绝原因:</Text>
            <TextInput
              style={styles.reasonInput}
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="拒绝原因..."
              multiline
              numberOfLines={2}
            />
            <View style={styles.actionRow}>
              <Button
                mode="outlined"
                onPress={() => setShowRejectInput(false)}
                style={styles.actionButton}
              >
                取消
              </Button>
              <Button
                mode="contained"
                onPress={handleReject}
                loading={actionLoading}
                disabled={actionLoading || !rejectReason.trim()}
                style={styles.actionButton}
                buttonColor={theme.colors.error}
              >
                确认拒绝
              </Button>
            </View>
          </View>
        );
      }

      return (
        <View style={styles.actionRow}>
          <Button
            mode="outlined"
            onPress={() => setShowRejectInput(true)}
            style={styles.actionButton}
            textColor={theme.colors.error}
          >
            拒绝
          </Button>
          <Button
            mode="contained"
            onPress={handleApprove}
            loading={actionLoading}
            disabled={actionLoading}
            style={styles.actionButton}
          >
            审批通过
          </Button>
        </View>
      );
    }

    // 已应用状态 + 可回滚: 显示回滚按钮
    if (status === 'APPLIED') {
      if (showRollbackInput) {
        return (
          <View style={styles.actionSection}>
            <Text style={styles.inputLabel}>请输入回滚原因:</Text>
            <TextInput
              style={styles.reasonInput}
              value={rollbackReason}
              onChangeText={setRollbackReason}
              placeholder="回滚原因..."
              multiline
              numberOfLines={2}
            />
            <View style={styles.actionRow}>
              <Button
                mode="outlined"
                onPress={() => setShowRollbackInput(false)}
                style={styles.actionButton}
              >
                取消
              </Button>
              <Button
                mode="contained"
                onPress={handleRollback}
                loading={actionLoading}
                disabled={actionLoading || !rollbackReason.trim()}
                style={styles.actionButton}
                buttonColor="#FA8C16"
              >
                确认回滚
              </Button>
            </View>
          </View>
        );
      }

      return (
        <View style={styles.actionRow}>
          <Button
            mode="outlined"
            onPress={() => setShowRollbackInput(true)}
            style={styles.actionButton}
            textColor="#FA8C16"
          >
            回滚变更
          </Button>
        </View>
      );
    }

    // 其他状态: 仅关闭按钮
    return (
      <View style={styles.actionRow}>
        <Button mode="outlined" onPress={onDismiss} style={styles.actionButton}>
          关闭
        </Button>
      </View>
    );
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modalContainer}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>配置变更预览</Text>
          <IconButton
            icon="close"
            size={24}
            onPress={onDismiss}
            style={styles.closeButton}
          />
        </View>

        <Divider />

        {/* Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>加载中...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <Button mode="outlined" onPress={loadPreview} style={styles.retryButton}>
                重试
              </Button>
            </View>
          ) : previewData ? (
            <>
              {/* Meta Info */}
              <View style={styles.metaSection}>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>配置类型:</Text>
                  <Text style={styles.metaValue}>
                    {configChangeSetApiClient.getConfigTypeName(previewData.configType)}
                  </Text>
                </View>
                {previewData.configName && (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>配置名称:</Text>
                    <Text style={styles.metaValue}>{previewData.configName}</Text>
                  </View>
                )}
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>版本变更:</Text>
                  <Text style={styles.metaValue}>
                    v{previewData.fromVersion ?? 0} → v{previewData.toVersion ?? 1}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>状态:</Text>
                  <Chip
                    style={[
                      styles.statusChip,
                      { backgroundColor: getStatusStyle(previewData.status).bg },
                    ]}
                    textStyle={{ color: getStatusStyle(previewData.status).text }}
                  >
                    {configChangeSetApiClient.getStatusName(previewData.status)}
                  </Chip>
                </View>
                {previewData.changeSummary && (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>变更摘要:</Text>
                    <Text style={styles.metaValue}>{previewData.changeSummary}</Text>
                  </View>
                )}
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>创建者:</Text>
                  <Text style={styles.metaValue}>
                    {previewData.createdBy ?? '未知'} ({previewData.createdAt})
                  </Text>
                </View>
              </View>

              <Divider style={styles.sectionDivider} />

              {/* Diff Display */}
              <Text style={styles.sectionTitle}>变更详情</Text>
              {previewData.diff ? (
                <>
                  {renderDiffSection('新增字段', previewData.diff.added ?? [], 'added')}
                  {renderDiffSection('删除字段', previewData.diff.removed ?? [], 'removed')}
                  {renderDiffSection('修改字段', previewData.diff.modified ?? [], 'modified')}
                  {(!previewData.diff.added?.length &&
                    !previewData.diff.removed?.length &&
                    !previewData.diff.modified?.length) && (
                    <Text style={styles.noDiffText}>无实质性变更</Text>
                  )}
                </>
              ) : (
                <Text style={styles.noDiffText}>无差异数据</Text>
              )}
            </>
          ) : null}
        </ScrollView>

        <Divider />

        {/* Actions */}
        <View style={styles.footer}>{renderActions()}</View>
      </Modal>
    </Portal>
  );
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const styles = StyleSheet.create({
  modalContainer: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: 16,
    borderRadius: theme.custom.borderRadius.l,
    maxHeight: SCREEN_HEIGHT * 0.85,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  closeButton: {
    margin: 0,
  },
  scrollView: {
    maxHeight: SCREEN_HEIGHT * 0.55,
  },
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    color: theme.colors.textSecondary,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  errorText: {
    color: theme.colors.error,
    marginBottom: 12,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
  },
  metaSection: {
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metaLabel: {
    width: 80,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  metaValue: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text,
  },
  statusChip: {
    height: 26,
  },
  sectionDivider: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 12,
  },
  diffSection: {
    marginBottom: 16,
  },
  diffSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  diffItem: {
    padding: 12,
    borderRadius: theme.custom.borderRadius.s,
    borderWidth: 1,
    marginBottom: 8,
  },
  diffFieldName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  modifiedValues: {
    marginTop: 4,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
  },
  valueLabel: {
    width: 40,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  valueText: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.text,
    fontFamily: 'monospace',
  },
  oldValue: {
    color: '#FF4D4F',
    textDecorationLine: 'line-through',
  },
  newValue: {
    color: '#52C41A',
  },
  noDiffText: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    paddingVertical: 16,
  },
  footer: {
    padding: 16,
  },
  actionSection: {
    width: '100%',
  },
  inputLabel: {
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: 8,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.custom.borderRadius.s,
    padding: 12,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 12,
    backgroundColor: theme.colors.surfaceVariant,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  actionButton: {
    minWidth: 100,
  },
});

export default DiffPreviewModal;
