/**
 * 告警管理页面
 *
 * 功能：
 * - 告警列表展示（按严重程度排序）
 * - 多维度筛选（严重程度、状态、类型）
 * - 确认告警、解决告警操作
 * - 下拉刷新
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { DISPATCHER_THEME, SchedulingAlert, AlertSeverity, SchedulingAlertType } from '../../../types/dispatcher';
import { schedulingApiClient } from '../../../services/api/schedulingApiClient';

// 告警类型映射（与任务要求对齐）
type AlertType =
  | 'low_probability'
  | 'resource_conflict'
  | 'deadline_risk'
  | 'efficiency_drop'
  | 'worker_shortage';

// 告警状态类型
type AlertStatus = 'pending' | 'acknowledged' | 'resolved';

// 扩展告警接口以支持更多字段
interface DisplayAlert extends SchedulingAlert {
  status: AlertStatus;
  planId?: string;
  suggestedAction?: string;
  acknowledgedAt?: string;
  acknowledgedBy?: number;
}

// 严重程度排序权重
const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// 严重程度样式配置
const SEVERITY_STYLES: Record<AlertSeverity, { bg: string; text: string; label: string }> = {
  critical: { bg: '#fff1f0', text: '#ff4d4f', label: '严重' },
  high: { bg: '#fff7e6', text: '#fa8c16', label: '警告' },
  medium: { bg: '#e6f7ff', text: '#1890ff', label: '提示' },
  low: { bg: '#f6ffed', text: '#52c41a', label: '信息' },
};

// 告警类型图标和标签
const ALERT_TYPE_CONFIG: Record<string, { icon: string; label: string }> = {
  low_probability: { icon: 'chart-line-variant', label: '完成概率低' },
  resource_conflict: { icon: 'alert-octagon', label: '资源冲突' },
  deadline_risk: { icon: 'clock-alert', label: '交期风险' },
  efficiency_drop: { icon: 'trending-down', label: '效率下降' },
  worker_shortage: { icon: 'account-alert', label: '人员不足' },
  equipment_unavailable: { icon: 'wrench-clock', label: '设备不可用' },
  material_shortage: { icon: 'package-variant-closed-remove', label: '物料短缺' },
  efficiency_low: { icon: 'speedometer-slow', label: '效率偏低' },
  capacity_overload: { icon: 'factory', label: '产能超载' },
};

// 筛选选项
const severityOptions = ['全部', '严重', '警告', '提示', '信息'];
const statusOptions = ['全部', '未处理', '已确认', '已解决'];
const typeOptions = ['全部类型', '完成概率低', '资源冲突', '交期风险', '效率下降', '人员不足'];

// 筛选值映射
const severityFilterMap: Record<string, AlertSeverity | undefined> = {
  '全部': undefined,
  '严重': 'critical',
  '警告': 'high',
  '提示': 'medium',
  '信息': 'low',
};

const statusFilterMap: Record<string, AlertStatus | undefined> = {
  '全部': undefined,
  '未处理': 'pending',
  '已确认': 'acknowledged',
  '已解决': 'resolved',
};

const typeFilterMap: Record<string, string | undefined> = {
  '全部类型': undefined,
  '完成概率低': 'low_probability',
  '资源冲突': 'resource_conflict',
  '交期风险': 'deadline_risk',
  '效率下降': 'efficiency_drop',
  '人员不足': 'worker_shortage',
};

export default function AlertListScreen() {
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<DisplayAlert[]>([]);

  // 筛选状态
  const [selectedSeverity, setSelectedSeverity] = useState('全部');
  const [selectedStatus, setSelectedStatus] = useState('全部');
  const [selectedType, setSelectedType] = useState('全部类型');

  // 解决弹窗状态
  const [resolveModalVisible, setResolveModalVisible] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<DisplayAlert | null>(null);
  const [resolutionText, setResolutionText] = useState('');
  const [operationLoading, setOperationLoading] = useState(false);

  // 转换后端告警数据为显示格式
  const convertToDisplayAlert = useCallback((alert: SchedulingAlert): DisplayAlert => {
    // 确定状态
    let status: AlertStatus = 'pending';
    if (alert.isResolved) {
      status = 'resolved';
    } else if ((alert as DisplayAlert).acknowledgedAt) {
      status = 'acknowledged';
    }

    return {
      ...alert,
      status,
      suggestedAction: alert.suggestion,
    };
  }, []);

  // 加载告警列表
  const loadAlerts = useCallback(async () => {
    try {
      // 根据筛选条件决定调用哪个API
      const severityFilter = severityFilterMap[selectedSeverity];
      const statusFilter = statusFilterMap[selectedStatus];
      const typeFilter = typeFilterMap[selectedType];

      // 如果筛选未解决的告警，优先使用 getUnresolvedAlerts
      if (statusFilter === 'pending' || statusFilter === 'acknowledged') {
        const response = await schedulingApiClient.getUnresolvedAlerts();
        if (response.success && response.data) {
          const converted = response.data.map(convertToDisplayAlert);
          setAlerts(converted);
        }
      } else {
        // 使用分页API获取所有告警
        const response = await schedulingApiClient.getAlerts({
          severity: severityFilter,
          alertType: typeFilter,
          page: 0,
          size: 100,
        });
        if (response.success && response.data) {
          const converted = response.data.content.map(convertToDisplayAlert);
          setAlerts(converted);
        }
      }
    } catch (error) {
      console.error('加载告警列表失败:', error);
      Alert.alert('加载失败', '无法加载告警列表，请检查网络');
    }
  }, [selectedSeverity, selectedStatus, selectedType, convertToDisplayAlert]);

  // 初始加载
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadAlerts();
      setLoading(false);
    };
    init();
  }, [loadAlerts]);

  // 下拉刷新
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAlerts();
    setRefreshing(false);
  }, [loadAlerts]);

  // 确认告警
  const handleAcknowledge = useCallback(async (alert: DisplayAlert) => {
    if (alert.status !== 'pending') return;

    try {
      setOperationLoading(true);
      const response = await schedulingApiClient.acknowledgeAlert(alert.id);
      if (response.success) {
        Alert.alert('成功', '已确认该告警');
        await loadAlerts();
      } else {
        Alert.alert('失败', response.message || '确认告警失败');
      }
    } catch (error) {
      console.error('确认告警失败:', error);
      Alert.alert('错误', '确认告警失败，请稍后重试');
    } finally {
      setOperationLoading(false);
    }
  }, [loadAlerts]);

  // 打开解决弹窗
  const openResolveModal = useCallback((alert: DisplayAlert) => {
    setSelectedAlert(alert);
    setResolutionText('');
    setResolveModalVisible(true);
  }, []);

  // 解决告警
  const handleResolve = useCallback(async () => {
    if (!selectedAlert) return;

    if (!resolutionText.trim()) {
      Alert.alert('提示', '请输入处理说明');
      return;
    }

    try {
      setOperationLoading(true);
      const response = await schedulingApiClient.resolveAlert(
        selectedAlert.id,
        resolutionText.trim()
      );
      if (response.success) {
        Alert.alert('成功', '告警已解决');
        setResolveModalVisible(false);
        await loadAlerts();
      } else {
        Alert.alert('失败', response.message || '解决告警失败');
      }
    } catch (error) {
      console.error('解决告警失败:', error);
      Alert.alert('错误', '解决告警失败，请稍后重试');
    } finally {
      setOperationLoading(false);
    }
  }, [selectedAlert, resolutionText, loadAlerts]);

  // 筛选并排序告警
  const filteredAlerts = useMemo(() => {
    let result = [...alerts];

    // 按严重程度筛选
    const severityFilter = severityFilterMap[selectedSeverity];
    if (severityFilter) {
      result = result.filter(a => a.severity === severityFilter);
    }

    // 按状态筛选
    const statusFilter = statusFilterMap[selectedStatus];
    if (statusFilter) {
      result = result.filter(a => a.status === statusFilter);
    }

    // 按类型筛选
    const typeFilter = typeFilterMap[selectedType];
    if (typeFilter) {
      result = result.filter(a => a.alertType === typeFilter);
    }

    // 按严重程度排序
    result.sort((a, b) => {
      const orderA = SEVERITY_ORDER[a.severity] ?? 4;
      const orderB = SEVERITY_ORDER[b.severity] ?? 4;
      if (orderA !== orderB) return orderA - orderB;
      // 同等严重程度按时间倒序
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return result;
  }, [alerts, selectedSeverity, selectedStatus, selectedType]);

  // 获取告警类型配置
  const getAlertTypeConfig = (alertType: string) => {
    return ALERT_TYPE_CONFIG[alertType] || { icon: 'alert', label: alertType };
  };

  // 获取状态标签
  const getStatusLabel = (status: AlertStatus) => {
    switch (status) {
      case 'pending': return { bg: '#fff7e6', text: '#fa8c16', label: '未处理' };
      case 'acknowledged': return { bg: '#e6f7ff', text: '#1890ff', label: '已确认' };
      case 'resolved': return { bg: '#f6ffed', text: '#52c41a', label: '已解决' };
      default: return { bg: '#f5f5f5', text: '#999', label: status };
    }
  };

  // 格式化时间
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  // 渲染告警卡片
  const renderAlertCard = (alert: DisplayAlert) => {
    const severityStyle = SEVERITY_STYLES[alert.severity];
    const statusStyle = getStatusLabel(alert.status);
    const typeConfig = getAlertTypeConfig(alert.alertType);

    return (
      <View
        key={alert.id}
        style={[
          styles.alertCard,
          { borderLeftColor: severityStyle.text },
        ]}
      >
        {/* Header */}
        <View style={styles.alertHeader}>
          <View style={styles.alertTypeRow}>
            <View style={[styles.alertTypeIcon, { backgroundColor: severityStyle.bg }]}>
              <MaterialCommunityIcons
                name={typeConfig.icon as any}
                size={18}
                color={severityStyle.text}
              />
            </View>
            <View style={styles.alertTitleSection}>
              <Text style={styles.alertTitle}>{alert.title}</Text>
              <Text style={styles.alertTypeLabel}>{typeConfig.label}</Text>
            </View>
          </View>
          <View style={styles.alertBadges}>
            <View style={[styles.severityBadge, { backgroundColor: severityStyle.bg }]}>
              <Text style={[styles.severityText, { color: severityStyle.text }]}>
                {severityStyle.label}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.statusText, { color: statusStyle.text }]}>
                {statusStyle.label}
              </Text>
            </View>
          </View>
        </View>

        {/* Content */}
        <Text style={styles.alertMessage}>{alert.message}</Text>

        {/* Meta Info */}
        {(alert.scheduleId || alert.planId) && (
          <View style={styles.metaRow}>
            <MaterialCommunityIcons name="link-variant" size={12} color="#999" />
            <Text style={styles.metaText}>
              关联: {alert.scheduleId || alert.planId}
            </Text>
          </View>
        )}

        {/* Suggestion */}
        {alert.suggestedAction && (
          <View style={styles.suggestionBox}>
            <MaterialCommunityIcons name="lightbulb-outline" size={14} color="#fa8c16" />
            <Text style={styles.suggestionText}>建议: {alert.suggestedAction}</Text>
          </View>
        )}

        {/* Resolution (if resolved) */}
        {alert.status === 'resolved' && alert.resolution && (
          <View style={styles.resolutionBox}>
            <MaterialCommunityIcons name="check-circle-outline" size={14} color="#52c41a" />
            <Text style={styles.resolutionText}>处理: {alert.resolution}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.alertFooter}>
          <Text style={styles.alertTime}>{formatTime(alert.createdAt)}</Text>

          {/* Action Buttons */}
          {alert.status !== 'resolved' && (
            <View style={styles.actionButtons}>
              {alert.status === 'pending' && (
                <TouchableOpacity
                  style={styles.acknowledgeButton}
                  onPress={() => handleAcknowledge(alert)}
                  disabled={operationLoading}
                >
                  <MaterialCommunityIcons name="check" size={14} color="#1890ff" />
                  <Text style={styles.acknowledgeButtonText}>确认</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.resolveButton}
                onPress={() => openResolveModal(alert)}
                disabled={operationLoading}
              >
                <MaterialCommunityIcons name="check-all" size={14} color="#fff" />
                <Text style={styles.resolveButtonText}>解决</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  // 统计数据
  const stats = useMemo(() => {
    const critical = alerts.filter(a => a.severity === 'critical' && a.status !== 'resolved').length;
    const high = alerts.filter(a => a.severity === 'high' && a.status !== 'resolved').length;
    const pending = alerts.filter(a => a.status === 'pending').length;
    return { critical, high, pending };
  }, [alerts]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>告警管理</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#ff4d4f' }]}>{stats.critical}</Text>
          <Text style={styles.statLabel}>严重</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#fa8c16' }]}>{stats.high}</Text>
          <Text style={styles.statLabel}>警告</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#1890ff' }]}>{stats.pending}</Text>
          <Text style={styles.statLabel}>待处理</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContainer}
        >
          {/* Severity Filter */}
          {severityOptions.map((option) => (
            <TouchableOpacity
              key={`severity-${option}`}
              style={[
                styles.filterChip,
                selectedSeverity === option && styles.filterChipActive,
              ]}
              onPress={() => setSelectedSeverity(option)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedSeverity === option && styles.filterChipTextActive,
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContainer}
        >
          {/* Status Filter */}
          {statusOptions.map((option) => (
            <TouchableOpacity
              key={`status-${option}`}
              style={[
                styles.filterChip,
                selectedStatus === option && styles.filterChipActive,
              ]}
              onPress={() => setSelectedStatus(option)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedStatus === option && styles.filterChipTextActive,
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContainer}
        >
          {/* Type Filter */}
          {typeOptions.map((option) => (
            <TouchableOpacity
              key={`type-${option}`}
              style={[
                styles.filterChip,
                selectedType === option && styles.filterChipActive,
              ]}
              onPress={() => setSelectedType(option)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedType === option && styles.filterChipTextActive,
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            告警列表 ({filteredAlerts.length})
          </Text>
        </View>

        {/* Loading / Empty / Alert Cards */}
        {loading ? (
          <View style={styles.emptyContainer}>
            <ActivityIndicator size="large" color={DISPATCHER_THEME.primary} />
            <Text style={styles.emptyText}>加载中...</Text>
          </View>
        ) : filteredAlerts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="bell-check-outline" size={48} color="#52c41a" />
            <Text style={styles.emptyText}>暂无告警</Text>
            <Text style={styles.emptySubtext}>所有告警已处理完毕</Text>
          </View>
        ) : (
          filteredAlerts.map(renderAlertCard)
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Resolve Modal */}
      <Modal
        visible={resolveModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setResolveModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>解决告警</Text>
              <TouchableOpacity
                onPress={() => setResolveModalVisible(false)}
                disabled={operationLoading}
              >
                <MaterialCommunityIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {selectedAlert && (
              <View style={styles.modalAlertInfo}>
                <View style={styles.modalAlertRow}>
                  <View
                    style={[
                      styles.modalSeverityDot,
                      { backgroundColor: SEVERITY_STYLES[selectedAlert.severity].text },
                    ]}
                  />
                  <Text style={styles.modalAlertTitle}>{selectedAlert.title}</Text>
                </View>
                <Text style={styles.modalAlertMessage}>{selectedAlert.message}</Text>
              </View>
            )}

            <Text style={styles.modalLabel}>处理说明</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="请输入处理说明..."
              placeholderTextColor="#999"
              value={resolutionText}
              onChangeText={setResolutionText}
              multiline
              numberOfLines={4}
              editable={!operationLoading}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setResolveModalVisible(false)}
                disabled={operationLoading}
              >
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={handleResolve}
                disabled={operationLoading}
              >
                {operationLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmText}>确认解决</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 10,
    alignSelf: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  filterScroll: {
    marginBottom: 8,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterChipActive: {
    backgroundColor: DISPATCHER_THEME.primary,
    borderColor: DISPATCHER_THEME.primary,
  },
  filterChipText: {
    fontSize: 12,
    color: '#666',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  sectionHeader: {
    marginTop: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  alertCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  alertTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  alertTypeIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTitleSection: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  alertTypeLabel: {
    fontSize: 11,
    color: '#999',
  },
  alertBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  severityText: {
    fontSize: 10,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '500',
  },
  alertMessage: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  metaText: {
    fontSize: 11,
    color: '#999',
  },
  suggestionBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff7e6',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    gap: 6,
  },
  suggestionText: {
    flex: 1,
    fontSize: 12,
    color: '#d46b08',
    lineHeight: 18,
  },
  resolutionBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f6ffed',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    gap: 6,
  },
  resolutionText: {
    flex: 1,
    fontSize: 12,
    color: '#389e0d',
    lineHeight: 18,
  },
  alertFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  alertTime: {
    fontSize: 11,
    color: '#999',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  acknowledgeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1890ff',
    gap: 4,
  },
  acknowledgeButtonText: {
    fontSize: 12,
    color: '#1890ff',
    fontWeight: '500',
  },
  resolveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#52c41a',
    gap: 4,
  },
  resolveButtonText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
  },
  emptySubtext: {
    fontSize: 12,
    color: '#999',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalAlertInfo: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  modalAlertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  modalSeverityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modalAlertTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  modalAlertMessage: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  modalLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  modalCancelText: {
    fontSize: 14,
    color: '#666',
  },
  modalConfirmButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#52c41a',
  },
  modalConfirmText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
});
