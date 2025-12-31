import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Card,
  Text,
  Surface,
  Chip,
  ActivityIndicator,
  Avatar,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  DispositionHistory as DispositionHistoryType,
  DispositionAction,
  getActionLabel,
  getActionColor,
  getActionIcon,
} from '../../types/qualityDisposition';
import { qualityDispositionAPI } from '../../services/api/qualityDispositionApiClient';
import { useAuthStore } from '../../store/authStore';

/**
 * 处置历史组件 Props
 */
interface DispositionHistoryProps {
  batchId: number;
  inspectionId?: string;
  autoRefresh?: boolean;
}

/**
 * 处置历史组件
 *
 * 功能:
 * - 时间线展示历史处置记录
 * - 显示操作人、时间、动作、备注
 * - 显示审批状态
 */
export const DispositionHistory: React.FC<DispositionHistoryProps> = ({
  batchId,
  inspectionId,
  autoRefresh = false,
}) => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<DispositionHistoryType[]>([]);
  const [error, setError] = useState<string | null>(null);

  /**
   * 加载处置历史
   */
  useEffect(() => {
    loadHistory();
  }, [batchId, inspectionId]);

  const loadHistory = async () => {
    if (!user?.factoryId) {
      setError('未找到工厂ID');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await qualityDispositionAPI.getDispositionHistory(
        user.factoryId,
        batchId
      );

      // 如果指定了 inspectionId，则过滤
      const filteredHistory = inspectionId
        ? result.filter(h => h.inspectionId === inspectionId)
        : result;

      setHistory(filteredHistory);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载处置历史失败';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 格式化日期时间
   */
  const formatDateTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  /**
   * 获取审批状态颜色
   */
  const getApprovalStatusColor = (status?: string): string => {
    if (!status) return '#9E9E9E';
    switch (status) {
      case 'APPROVED':
        return '#00C853';
      case 'PENDING':
        return '#FF9800';
      case 'REJECTED':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  /**
   * 获取审批状态文本
   */
  const getApprovalStatusText = (status?: string): string => {
    if (!status) return '无需审批';
    switch (status) {
      case 'APPROVED':
        return '已批准';
      case 'PENDING':
        return '待审批';
      case 'REJECTED':
        return '已拒绝';
      default:
        return status;
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
          <Text style={styles.loadingText}>加载处置历史...</Text>
        </Card.Content>
      </Card>
    );
  }

  /**
   * 渲染错误状态
   */
  if (error) {
    return (
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.errorContainer}>
            <MaterialCommunityIcons name="alert-circle" size={48} color="#F44336" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        </Card.Content>
      </Card>
    );
  }

  /**
   * 渲染空状态
   */
  if (history.length === 0) {
    return (
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="history" size={64} color="#BDBDBD" />
            <Text style={styles.emptyText}>暂无处置记录</Text>
          </View>
        </Card.Content>
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <Card.Content>
        {/* 标题 */}
        <View style={styles.header}>
          <MaterialCommunityIcons name="history" size={24} color="#2196F3" />
          <Text style={styles.headerText}>处置历史</Text>
          <Chip mode="outlined" compact>
            {history.length} 条记录
          </Chip>
        </View>

        {/* 时间线 */}
        <ScrollView style={styles.timeline}>
          {history.map((item, index) => {
            const actionColor = getActionColor(item.action as DispositionAction);
            const actionIcon = getActionIcon(item.action as DispositionAction);
            const approvalStatusColor = getApprovalStatusColor(item.approvalStatus);
            const isLast = index === history.length - 1;

            return (
              <View key={item.id} style={styles.timelineItem}>
                {/* 时间线节点 */}
                <View style={styles.timelineNode}>
                  <Avatar.Icon
                    size={40}
                    icon={actionIcon}
                    style={[styles.nodeIcon, { backgroundColor: actionColor }]}
                  />
                  {!isLast && <View style={styles.timelineLine} />}
                </View>

                {/* 内容卡片 */}
                <Surface style={styles.contentCard}>
                  {/* 动作和时间 */}
                  <View style={styles.actionRow}>
                    <Text style={[styles.actionText, { color: actionColor }]}>
                      {item.actionDescription}
                    </Text>
                    <Text style={styles.timeText}>{formatDateTime(item.createdAt)}</Text>
                  </View>

                  {/* 质检数据 */}
                  <View style={styles.dataRow}>
                    <Chip mode="outlined" compact style={styles.dataChip}>
                      合格率: {item.passRate.toFixed(1)}%
                    </Chip>
                    <Chip mode="outlined" compact style={styles.dataChip}>
                      等级: {item.qualityGrade}
                    </Chip>
                  </View>

                  {/* 原因 */}
                  {item.reason && (
                    <View style={styles.reasonContainer}>
                      <MaterialCommunityIcons name="text" size={16} color="#666" />
                      <Text style={styles.reasonText}>{item.reason}</Text>
                    </View>
                  )}

                  {/* 执行人 */}
                  <View style={styles.executorRow}>
                    <MaterialCommunityIcons name="account" size={16} color="#666" />
                    <Text style={styles.executorText}>
                      {item.executorName} ({item.executorRole})
                    </Text>
                  </View>

                  {/* 审批信息 */}
                  {item.requiresApproval && (
                    <View style={styles.approvalContainer}>
                      <View style={styles.approvalRow}>
                        <MaterialCommunityIcons
                          name="file-check"
                          size={16}
                          color={approvalStatusColor}
                        />
                        <Text style={[styles.approvalStatus, { color: approvalStatusColor }]}>
                          {getApprovalStatusText(item.approvalStatus)}
                        </Text>
                      </View>
                      {item.approverName && (
                        <Text style={styles.approverText}>
                          审批人: {item.approverName}
                        </Text>
                      )}
                      {item.approvedAt && (
                        <Text style={styles.approvedAtText}>
                          审批时间: {formatDateTime(item.approvedAt)}
                        </Text>
                      )}
                    </View>
                  )}

                  {/* 结果状态 */}
                  <View style={styles.statusRow}>
                    <MaterialCommunityIcons name="state-machine" size={16} color="#666" />
                    <Text style={styles.statusText}>批次状态: {item.newStatus}</Text>
                  </View>
                </Surface>
              </View>
            );
          })}
        </ScrollView>
      </Card.Content>
    </Card>
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
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#BDBDBD',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
    flex: 1,
  },
  timeline: {
    maxHeight: 500,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineNode: {
    width: 60,
    alignItems: 'center',
  },
  nodeIcon: {
    marginBottom: 8,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: '#E0E0E0',
  },
  contentCard: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    elevation: 1,
    marginLeft: 12,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  timeText: {
    fontSize: 12,
    color: '#999',
  },
  dataRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dataChip: {
    marginRight: 8,
  },
  reasonContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  reasonText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
    flex: 1,
  },
  executorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  executorText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  approvalContainer: {
    backgroundColor: '#F5F5F5',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  approvalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  approvalStatus: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  approverText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 20,
  },
  approvedAtText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
});
