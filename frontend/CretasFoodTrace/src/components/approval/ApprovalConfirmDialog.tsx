/**
 * 审批确认对话框组件
 *
 * 功能：
 * - 显示影响分析摘要
 * - 审批/拒绝按钮
 * - 备注输入框
 *
 * @version 1.0.0
 * @since 2025-12-31
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DISPATCHER_THEME } from '../../types/dispatcher';

interface ApprovalConfirmDialogProps {
  visible: boolean;
  onClose: () => void;
  onApprove: (comment?: string) => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  planData: {
    planNumber: string;
    productName?: string;
    quantity: number;
    impactLevel: string;
    impactedPlanCount: number;
    forceInsertReason?: string;
    customerName?: string;
  };
}

export default function ApprovalConfirmDialog({
  visible,
  onClose,
  onApprove,
  onReject,
  planData,
}: ApprovalConfirmDialogProps) {
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleApprove = async () => {
    setLoading(true);
    try {
      await onApprove(comment || undefined);
      resetAndClose();
    } catch (error) {
      console.error('Approve failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!comment.trim()) {
      alert('请填写拒绝原因');
      return;
    }
    setLoading(true);
    try {
      await onReject(comment);
      resetAndClose();
    } catch (error) {
      console.error('Reject failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetAndClose = () => {
    setAction(null);
    setComment('');
    onClose();
  };

  const getImpactColor = () => {
    switch (planData.impactLevel) {
      case 'critical': return { bg: '#fff1f0', text: '#ff4d4f' };
      case 'high': return { bg: '#fff7e6', text: '#fa8c16' };
      case 'medium': return { bg: '#fffbe6', text: '#faad14' };
      default: return { bg: '#f6ffed', text: '#52c41a' };
    }
  };

  const impactColor = getImpactColor();

  // 未选择操作时的主界面
  if (!action) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <View style={styles.container}>
            <View style={styles.header}>
              <MaterialCommunityIcons name="alert-circle-outline" size={32} color={DISPATCHER_THEME.primary} />
              <Text style={styles.title}>审批强制插单</Text>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {/* 计划信息 */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>计划信息</Text>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>计划编号:</Text>
                  <Text style={styles.infoValue}>{planData.planNumber}</Text>
                </View>
                {planData.productName && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>产品:</Text>
                    <Text style={styles.infoValue}>{planData.productName}</Text>
                  </View>
                )}
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>数量:</Text>
                  <Text style={styles.infoValue}>{planData.quantity} kg</Text>
                </View>
                {planData.customerName && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>客户:</Text>
                    <Text style={styles.infoValue}>{planData.customerName}</Text>
                  </View>
                )}
              </View>

              {/* 影响分析 */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>影响分析</Text>
                <View style={[styles.impactBadge, { backgroundColor: impactColor.bg }]}>
                  <MaterialCommunityIcons name="alert" size={20} color={impactColor.text} />
                  <Text style={[styles.impactText, { color: impactColor.text }]}>
                    影响等级: {planData.impactLevel === 'critical' ? '严重' : planData.impactLevel === 'high' ? '高' : '中'}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>受影响计划:</Text>
                  <Text style={[styles.infoValue, { color: '#ff4d4f' }]}>
                    {planData.impactedPlanCount} 个
                  </Text>
                </View>
              </View>

              {/* 强制插单原因 */}
              {planData.forceInsertReason && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>强制插单原因</Text>
                  <Text style={styles.reasonText}>{planData.forceInsertReason}</Text>
                </View>
              )}

              {/* 警告提示 */}
              <View style={styles.warningBox}>
                <MaterialCommunityIcons name="information" size={16} color="#fa8c16" />
                <Text style={styles.warningText}>
                  强制插单将影响现有生产计划，请谨慎审批
                </Text>
              </View>
            </ScrollView>

            {/* 操作按钮 */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.rejectButton}
                onPress={() => setAction('reject')}
              >
                <MaterialCommunityIcons name="close-circle" size={20} color="#ff4d4f" />
                <Text style={styles.rejectButtonText}>拒绝</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.approveButton}
                onPress={() => setAction('approve')}
              >
                <MaterialCommunityIcons name="check-circle" size={20} color="#fff" />
                <Text style={styles.approveButtonText}>批准</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // 选择操作后的备注输入界面
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <MaterialCommunityIcons
              name={action === 'approve' ? 'check-circle' : 'close-circle'}
              size={32}
              color={action === 'approve' ? '#52c41a' : '#ff4d4f'}
            />
            <Text style={styles.title}>
              {action === 'approve' ? '批准插单' : '拒绝插单'}
            </Text>
          </View>

          <View style={styles.content}>
            <Text style={styles.inputLabel}>
              {action === 'approve' ? '审批备注（可选）' : '拒绝原因（必填）'}
            </Text>
            <TextInput
              style={styles.textArea}
              value={comment}
              onChangeText={setComment}
              placeholder={action === 'approve' ? '请输入审批备注...' : '请说明拒绝原因...'}
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setAction(null)}
              disabled={loading}
            >
              <Text style={styles.backButtonText}>返回</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                action === 'approve' ? styles.confirmApproveButton : styles.confirmRejectButton,
                loading && styles.disabledButton,
              ]}
              onPress={action === 'approve' ? handleApprove : handleReject}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name={action === 'approve' ? 'check' : 'close'}
                    size={20}
                    color="#fff"
                  />
                  <Text style={styles.confirmButtonText}>
                    {action === 'approve' ? '确认批准' : '确认拒绝'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  content: {
    padding: 20,
    maxHeight: 400,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  impactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  impactText: {
    fontSize: 14,
    fontWeight: '500',
  },
  reasonText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff7e6',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#fa8c16',
  },
  warningText: {
    fontSize: 13,
    color: '#ad8b00',
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    height: 100,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    paddingTop: 0,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#fff1f0',
    borderWidth: 1,
    borderColor: '#ff4d4f',
  },
  rejectButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ff4d4f',
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#52c41a',
  },
  approveButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  backButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    color: '#666',
  },
  confirmApproveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#52c41a',
  },
  confirmRejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#ff4d4f',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  disabledButton: {
    opacity: 0.6,
  },
  cancelButton: {
    padding: 14,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
  },
});
