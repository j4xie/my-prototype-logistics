import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Card,
  Text,
  Button,
  Chip,
  Surface,
  Portal,
  Dialog,
  TextInput,
  ActivityIndicator,
  Divider,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  DispositionEvaluation,
  DispositionResult,
  DispositionAction,
  getActionLabel,
  getActionColor,
  getActionIcon,
  formatConfidence,
} from '../../types/qualityDisposition';
import { qualityDispositionAPI } from '../../services/api/qualityDispositionApiClient';
import { useAuthStore } from '../../store/authStore';

/**
 * 处置建议组件 Props
 */
interface DispositionSuggestionProps {
  batchId: number;
  inspectionId: string;
  qualityScore: number;
  hasSecurityIssue?: boolean;
  onDispositionComplete?: (result: DispositionResult) => void;
}

/**
 * 处置建议组件
 *
 * 功能:
 * - 根据质检分数显示 AI 推荐的处置动作
 * - 显示置信度和推理原因
 * - 显示备选处置方案
 * - 如需审批，显示审批状态
 * - 执行处置按钮
 */
export const DispositionSuggestion: React.FC<DispositionSuggestionProps> = ({
  batchId,
  inspectionId,
  qualityScore,
  hasSecurityIssue = false,
  onDispositionComplete,
}) => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [evaluation, setEvaluation] = useState<DispositionEvaluation | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 确认对话框状态
  const [confirmDialogVisible, setConfirmDialogVisible] = useState(false);
  const [selectedAction, setSelectedAction] = useState<DispositionAction | null>(null);
  const [operatorComment, setOperatorComment] = useState('');

  /**
   * 加载处置评估
   */
  useEffect(() => {
    loadEvaluation();
  }, [inspectionId]);

  const loadEvaluation = async () => {
    if (!user?.factoryId) {
      setError('未找到工厂ID');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 构建质检结果
      const qualityResult = {
        inspectionId,
        productionBatchId: batchId,
        inspectorId: user.id,
        sampleSize: 0, // 后端会从质检记录中获取
        passCount: 0,
        failCount: 0,
      };

      const result = await qualityDispositionAPI.evaluateDisposition(
        user.factoryId,
        qualityResult
      );

      setEvaluation(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载处置建议失败';
      setError(errorMessage);
      Alert.alert('错误', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 执行处置动作
   */
  const handleExecuteDisposition = async (action: DispositionAction) => {
    setSelectedAction(action);
    setOperatorComment('');
    setConfirmDialogVisible(true);
  };

  /**
   * 确认执行处置
   */
  const confirmExecuteDisposition = async () => {
    if (!selectedAction || !user?.factoryId) return;

    try {
      setExecuting(true);
      setConfirmDialogVisible(false);

      const request = {
        batchId,
        inspectionId,
        actionCode: selectedAction,
        operatorComment: operatorComment || undefined,
        executorId: user.id,
      };

      const result = await qualityDispositionAPI.executeDisposition(
        user.factoryId,
        request
      );

      Alert.alert('成功', result.message);

      // 回调通知父组件
      if (onDispositionComplete) {
        onDispositionComplete(result);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '执行处置失败';
      Alert.alert('错误', errorMessage);
    } finally {
      setExecuting(false);
      setSelectedAction(null);
      setOperatorComment('');
    }
  };

  /**
   * 渲染加载状态
   */
  if (loading) {
    return (
      <Card style={styles.card}>
        <Card.Content style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>正在评估处置建议...</Text>
        </Card.Content>
      </Card>
    );
  }

  /**
   * 渲染错误状态
   */
  if (error || !evaluation) {
    return (
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.errorContainer}>
            <MaterialCommunityIcons name="alert-circle" size={48} color="#F44336" />
            <Text style={styles.errorText}>{error || '无法获取处置建议'}</Text>
            <Button mode="outlined" onPress={loadEvaluation} style={styles.retryButton}>
              重新加载
            </Button>
          </View>
        </Card.Content>
      </Card>
    );
  }

  const { recommendedAction, inspectionSummary, alternativeActions } = evaluation;
  const actionColor = getActionColor(recommendedAction as DispositionAction);
  const actionIcon = getActionIcon(recommendedAction as DispositionAction);

  return (
    <>
      <Card style={styles.card}>
        <Card.Content>
          {/* 标题 */}
          <View style={styles.header}>
            <MaterialCommunityIcons name="robot" size={24} color="#2196F3" />
            <Text style={styles.headerText}>AI 处置建议</Text>
            <Chip mode="outlined" style={styles.confidenceChip}>
              置信度: {formatConfidence(evaluation.confidence)}
            </Chip>
          </View>

          <Divider style={styles.divider} />

          {/* 质检摘要 */}
          <Surface style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>合格率:</Text>
              <Text style={styles.summaryValue}>
                {inspectionSummary.passRate.toFixed(1)}%
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>质量等级:</Text>
              <Chip style={styles.gradeChip}>{inspectionSummary.qualityGrade}</Chip>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>抽样数量:</Text>
              <Text style={styles.summaryValue}>
                {inspectionSummary.sampleSize} (通过: {inspectionSummary.passCount},
                不合格: {inspectionSummary.failCount})
              </Text>
            </View>
          </Surface>

          {/* 推荐动作 */}
          <Surface style={[styles.recommendedCard, { borderColor: actionColor }]}>
            <View style={styles.actionHeader}>
              <MaterialCommunityIcons name={actionIcon as keyof typeof MaterialCommunityIcons.glyphMap} size={32} color={actionColor} />
              <View style={styles.actionInfo}>
                <Text style={styles.actionTitle}>推荐动作</Text>
                <Text style={[styles.actionName, { color: actionColor }]}>
                  {evaluation.recommendedActionDescription}
                </Text>
              </View>
            </View>

            {/* 处置原因 */}
            <View style={styles.reasonContainer}>
              <Text style={styles.reasonLabel}>原因:</Text>
              <Text style={styles.reasonText}>{evaluation.reason}</Text>
            </View>

            {/* 规则信息 */}
            {evaluation.triggeredRuleName && (
              <View style={styles.ruleInfo}>
                <MaterialCommunityIcons name="file-check" size={16} color="#666" />
                <Text style={styles.ruleText}>触发规则: {evaluation.triggeredRuleName}</Text>
              </View>
            )}

            {/* 审批提示 */}
            {evaluation.requiresApproval && (
              <Surface style={styles.approvalNotice}>
                <MaterialCommunityIcons name="alert" size={20} color="#FF9800" />
                <Text style={styles.approvalText}>此动作需要审批</Text>
              </Surface>
            )}

            {/* 执行按钮 */}
            <Button
              mode="contained"
              onPress={() => handleExecuteDisposition(recommendedAction as DispositionAction)}
              loading={executing}
              disabled={executing}
              style={[styles.executeButton, { backgroundColor: actionColor }]}
              icon={actionIcon}
            >
              {evaluation.requiresApproval ? '提交审批' : '执行处置'}
            </Button>
          </Surface>

          {/* 备选动作 */}
          {alternativeActions && alternativeActions.length > 0 && (
            <>
              <Divider style={styles.divider} />
              <Text style={styles.alternativeTitle}>备选方案</Text>
              {alternativeActions.map((alt, index) => {
                const altColor = getActionColor(alt.action as DispositionAction);
                const altIcon = getActionIcon(alt.action as DispositionAction);

                return (
                  <Surface key={index} style={styles.alternativeCard}>
                    <View style={styles.alternativeHeader}>
                      <MaterialCommunityIcons name={altIcon as keyof typeof MaterialCommunityIcons.glyphMap} size={24} color={altColor} />
                      <Text style={[styles.alternativeName, { color: altColor }]}>
                        {alt.description}
                      </Text>
                    </View>
                    {alt.requiresApproval && (
                      <Chip mode="outlined" style={styles.approvalChip} compact>
                        需审批
                      </Chip>
                    )}
                    <Button
                      mode="outlined"
                      onPress={() => handleExecuteDisposition(alt.action as DispositionAction)}
                      style={styles.alternativeButton}
                      compact
                    >
                      选择此方案
                    </Button>
                  </Surface>
                );
              })}
            </>
          )}
        </Card.Content>
      </Card>

      {/* 确认对话框 */}
      <Portal>
        <Dialog visible={confirmDialogVisible} onDismiss={() => setConfirmDialogVisible(false)}>
          <Dialog.Title>确认执行处置</Dialog.Title>
          <Dialog.Content>
            <Text>
              确定要执行 {selectedAction && getActionLabel(selectedAction)} 吗？
            </Text>
            <TextInput
              label="备注 (可选)"
              value={operatorComment}
              onChangeText={setOperatorComment}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.commentInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmDialogVisible(false)}>取消</Button>
            <Button onPress={confirmExecuteDisposition} mode="contained">
              确认
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    marginVertical: 8,
    marginHorizontal: 16,
    elevation: 2,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  errorText: {
    marginTop: 16,
    marginBottom: 24,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
    flex: 1,
  },
  confidenceChip: {
    marginLeft: 8,
  },
  divider: {
    marginVertical: 16,
  },
  summaryCard: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
    minWidth: 80,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  gradeChip: {
    height: 28,
  },
  recommendedCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 16,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionInfo: {
    marginLeft: 12,
    flex: 1,
  },
  actionTitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  actionName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  reasonContainer: {
    marginBottom: 12,
  },
  reasonLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 14,
    lineHeight: 20,
  },
  ruleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  ruleText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  approvalNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FFF3E0',
    marginBottom: 12,
  },
  approvalText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#FF9800',
    fontWeight: '500',
  },
  executeButton: {
    marginTop: 8,
  },
  alternativeTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  alternativeCard: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#FAFAFA',
  },
  alternativeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  alternativeName: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  approvalChip: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  alternativeButton: {
    marginTop: 4,
  },
  commentInput: {
    marginTop: 16,
  },
});
