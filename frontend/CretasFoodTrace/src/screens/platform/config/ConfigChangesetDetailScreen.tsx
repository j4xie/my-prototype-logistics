/**
 * ConfigChangesetDetailScreen - Configuration changeset detail with diff view
 *
 * Shows comprehensive changeset information including:
 * - Before/after diff comparison
 * - Impact analysis
 * - Operation history
 * - Action buttons (approve, reject, rollback)
 * - Dry-run preview
 *
 * @author Cretas Team
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Pressable,
} from 'react-native';
import {
  Text,
  Card,
  Chip,
  Button,
  IconButton,
  ActivityIndicator,
  Divider,
  Avatar,
  TextInput,
  Portal,
  Modal,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';

import { useAuthStore } from '../../../store/authStore';
import { apiClient } from '../../../services/api/apiClient';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('ConfigChangesetDetailScreen');

// Types
interface ConfigChangeSet {
  id: string;
  factoryId: string;
  configType: ConfigType;
  configId: string;
  configName: string;
  fromVersion: number | null;
  toVersion: number | null;
  beforeSnapshot: string | null;
  afterSnapshot: string | null;
  diffJson: string | null;
  changeSummary: string | null;
  status: ChangeStatus;
  createdBy: number | null;
  createdByName: string | null;
  approvedBy: number | null;
  approvedByName: string | null;
  approvedAt: string | null;
  approvalComment: string | null;
  appliedAt: string | null;
  rolledBackAt: string | null;
  rolledBackBy: number | null;
  rollbackReason: string | null;
  isRollbackable: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DiffResult {
  added: DiffItem[];
  removed: DiffItem[];
  modified: DiffItem[];
  unchanged: DiffItem[];
}

interface DiffItem {
  path: string;
  oldValue?: string;
  newValue?: string;
  value?: string;
}

type ConfigType =
  | 'FORM_TEMPLATE'
  | 'DROOLS_RULE'
  | 'APPROVAL_CHAIN'
  | 'QUALITY_RULE'
  | 'CONVERSION_RATE'
  | 'FACTORY_CAPACITY'
  | 'OTHER';

type ChangeStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'APPLIED'
  | 'REJECTED'
  | 'ROLLED_BACK'
  | 'EXPIRED';

type RootStackParamList = {
  ConfigChangesetList: undefined;
  ConfigChangesetDetail: { changesetId: string };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ConfigChangesetDetail'>;
type RouteProps = RouteProp<RootStackParamList, 'ConfigChangesetDetail'>;

// Config type display mapping
const CONFIG_TYPE_MAP: Record<ConfigType, { label: string; labelEn: string; color: string; icon: string }> = {
  FORM_TEMPLATE: { label: '表单模板', labelEn: 'Form Template', color: '#1890ff', icon: 'file-document' },
  DROOLS_RULE: { label: 'Drools规则', labelEn: 'Drools Rule', color: '#52c41a', icon: 'cog' },
  APPROVAL_CHAIN: { label: '审批链', labelEn: 'Approval Chain', color: '#722ed1', icon: 'account-check' },
  QUALITY_RULE: { label: '质检规则', labelEn: 'Quality Rule', color: '#fa8c16', icon: 'shield-check' },
  CONVERSION_RATE: { label: '转换率', labelEn: 'Conversion Rate', color: '#13c2c2', icon: 'swap-horizontal' },
  FACTORY_CAPACITY: { label: '工厂产能', labelEn: 'Factory Capacity', color: '#eb2f96', icon: 'factory' },
  OTHER: { label: '其他', labelEn: 'Other', color: '#8c8c8c', icon: 'dots-horizontal' },
};

// Status display mapping
const STATUS_MAP: Record<ChangeStatus, { label: string; labelEn: string; color: string; bgColor: string }> = {
  PENDING: { label: '待审批', labelEn: 'Pending', color: '#fa8c16', bgColor: '#fff7e6' },
  APPROVED: { label: '已批准', labelEn: 'Approved', color: '#1890ff', bgColor: '#e6f7ff' },
  APPLIED: { label: '已应用', labelEn: 'Applied', color: '#52c41a', bgColor: '#f6ffed' },
  REJECTED: { label: '已拒绝', labelEn: 'Rejected', color: '#ff4d4f', bgColor: '#fff2f0' },
  ROLLED_BACK: { label: '已回滚', labelEn: 'Rolled Back', color: '#8c8c8c', bgColor: '#f5f5f5' },
  EXPIRED: { label: '已过期', labelEn: 'Expired', color: '#d9d9d9', bgColor: '#fafafa' },
};

export function ConfigChangesetDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { t, i18n } = useTranslation('platform');
  const { user } = useAuthStore();
  const factoryId = user?.factoryId || 'F001';
  const { changesetId } = route.params;

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [changeset, setChangeset] = useState<ConfigChangeSet | null>(null);
  const [diffPreview, setDiffPreview] = useState<DiffResult | null>(null);
  const [dryRunResult, setDryRunResult] = useState<Record<string, unknown> | null>(null);
  const [showDryRunModal, setShowDryRunModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showRollbackModal, setShowRollbackModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rollbackReason, setRollbackReason] = useState('');
  const [approveComment, setApproveComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'diff' | 'history' | 'impact'>('diff');

  const isEn = i18n.language === 'en';

  // Load changeset detail
  const loadChangeset = useCallback(async () => {
    try {
      logger.info('Loading changeset detail', { changesetId });

      // Get changeset detail
      const response = await apiClient.get<{
        success: boolean;
        data: ConfigChangeSet;
      }>(`/api/mobile/${factoryId}/config-changes/${changesetId}`);

      if (response.success && response.data) {
        setChangeset(response.data);

        // Parse diff JSON if available
        if (response.data.diffJson) {
          try {
            const diff = JSON.parse(response.data.diffJson);
            setDiffPreview(diff);
          } catch (e) {
            logger.warn('Failed to parse diff JSON');
          }
        }
      }

      // Get diff preview
      const previewResponse = await apiClient.get<{
        success: boolean;
        data: {
          diff: DiffResult;
          impactAnalysis: Record<string, unknown>;
        };
      }>(`/api/mobile/${factoryId}/config-changes/${changesetId}/preview`);

      if (previewResponse.success && previewResponse.data) {
        setDiffPreview(previewResponse.data.diff);
      }
    } catch (error) {
      logger.error('Failed to load changeset', error as Error);
      if (isAxiosError(error)) {
        Alert.alert(
          isEn ? 'Error' : '错误',
          error.response?.data?.message || (isEn ? 'Failed to load changeset' : '加载变更详情失败')
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [factoryId, changesetId, isEn]);

  useEffect(() => {
    loadChangeset();
  }, [loadChangeset]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadChangeset();
  }, [loadChangeset]);

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  // Handle approve
  const handleApprove = async () => {
    if (!changeset) return;

    Alert.alert(
      isEn ? 'Approve Change' : '审批通过',
      isEn ? 'Are you sure to approve this configuration change?' : '确认批准此配置变更?',
      [
        { text: isEn ? 'Cancel' : '取消', style: 'cancel' },
        {
          text: isEn ? 'Approve' : '批准',
          onPress: async () => {
            setActionLoading(true);
            try {
              const response = await apiClient.post<{
                success: boolean;
                data: ConfigChangeSet;
              }>(`/api/mobile/${factoryId}/config-changes/${changesetId}/approve`, {
                comment: approveComment || undefined,
              });

              if (response.success) {
                setChangeset(response.data);
                Alert.alert(
                  isEn ? 'Success' : '成功',
                  isEn ? 'Configuration change approved' : '配置变更已批准'
                );
              }
            } catch (error) {
              logger.error('Failed to approve', error as Error);
              if (isAxiosError(error)) {
                Alert.alert(
                  isEn ? 'Error' : '错误',
                  error.response?.data?.message || (isEn ? 'Failed to approve' : '审批失败')
                );
              }
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // Handle reject
  const handleReject = async () => {
    if (!changeset || !rejectReason.trim()) {
      Alert.alert(isEn ? 'Error' : '错误', isEn ? 'Please enter reject reason' : '请输入拒绝原因');
      return;
    }

    setActionLoading(true);
    try {
      const response = await apiClient.post<{
        success: boolean;
        data: ConfigChangeSet;
      }>(`/api/mobile/${factoryId}/config-changes/${changesetId}/reject`, {
        reason: rejectReason,
      });

      if (response.success) {
        setChangeset(response.data);
        setShowRejectModal(false);
        setRejectReason('');
        Alert.alert(
          isEn ? 'Success' : '成功',
          isEn ? 'Configuration change rejected' : '配置变更已拒绝'
        );
      }
    } catch (error) {
      logger.error('Failed to reject', error as Error);
      if (isAxiosError(error)) {
        Alert.alert(
          isEn ? 'Error' : '错误',
          error.response?.data?.message || (isEn ? 'Failed to reject' : '拒绝失败')
        );
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Handle apply
  const handleApply = async () => {
    if (!changeset) return;

    Alert.alert(
      isEn ? 'Apply Change' : '应用变更',
      isEn ? 'Are you sure to apply this configuration change? This will make it effective immediately.' : '确认应用此配置变更? 变更将立即生效。',
      [
        { text: isEn ? 'Cancel' : '取消', style: 'cancel' },
        {
          text: isEn ? 'Apply' : '应用',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              const response = await apiClient.post<{
                success: boolean;
                data: ConfigChangeSet;
              }>(`/api/mobile/${factoryId}/config-changes/${changesetId}/apply`);

              if (response.success) {
                setChangeset(response.data);
                Alert.alert(
                  isEn ? 'Success' : '成功',
                  isEn ? 'Configuration change applied' : '配置变更已应用'
                );
              }
            } catch (error) {
              logger.error('Failed to apply', error as Error);
              if (isAxiosError(error)) {
                Alert.alert(
                  isEn ? 'Error' : '错误',
                  error.response?.data?.message || (isEn ? 'Failed to apply' : '应用失败')
                );
              }
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // Handle rollback
  const handleRollback = async () => {
    if (!changeset || !rollbackReason.trim()) {
      Alert.alert(isEn ? 'Error' : '错误', isEn ? 'Please enter rollback reason' : '请输入回滚原因');
      return;
    }

    setActionLoading(true);
    try {
      const response = await apiClient.post<{
        success: boolean;
        data: ConfigChangeSet;
      }>(`/api/mobile/${factoryId}/config-changes/${changesetId}/rollback`, {
        reason: rollbackReason,
      });

      if (response.success) {
        setChangeset(response.data);
        setShowRollbackModal(false);
        setRollbackReason('');
        Alert.alert(
          isEn ? 'Success' : '成功',
          isEn ? 'Configuration change rolled back' : '配置变更已回滚'
        );
      }
    } catch (error) {
      logger.error('Failed to rollback', error as Error);
      if (isAxiosError(error)) {
        Alert.alert(
          isEn ? 'Error' : '错误',
          error.response?.data?.message || (isEn ? 'Failed to rollback' : '回滚失败')
        );
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Handle dry-run
  const handleDryRun = async () => {
    if (!changeset) return;

    setActionLoading(true);
    try {
      const response = await apiClient.post<{
        success: boolean;
        data: Record<string, unknown>;
      }>(`/api/mobile/${factoryId}/config-changes/dry-run`, {
        configType: changeset.configType,
        configId: changeset.configId,
        configName: changeset.configName,
        beforeSnapshot: changeset.beforeSnapshot,
        afterSnapshot: changeset.afterSnapshot,
      });

      if (response.success) {
        setDryRunResult(response.data as Record<string, unknown>);
        setShowDryRunModal(true);
      }
    } catch (error) {
      logger.error('Failed to dry-run', error as Error);
      if (isAxiosError(error)) {
        Alert.alert(
          isEn ? 'Error' : '错误',
          error.response?.data?.message || (isEn ? 'Failed to preview' : '预览失败')
        );
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Render diff item
  const renderDiffItem = (item: DiffItem, type: 'added' | 'removed' | 'modified') => {
    const colors = {
      added: { bg: '#f6ffed', text: '#52c41a', icon: 'plus' },
      removed: { bg: '#fff2f0', text: '#ff4d4f', icon: 'minus' },
      modified: { bg: '#e6f7ff', text: '#1890ff', icon: 'pencil' },
    };
    const config = colors[type];

    return (
      <View key={item.path} style={[styles.diffItem, { backgroundColor: config.bg }]}>
        <View style={styles.diffItemHeader}>
          <Avatar.Icon size={20} icon={config.icon} color={config.text} style={{ backgroundColor: config.bg }} />
          <Text style={[styles.diffPath, { color: config.text }]}>{item.path}</Text>
        </View>
        {type === 'modified' ? (
          <View style={styles.diffValues}>
            <View style={styles.diffValueRow}>
              <Text style={styles.diffValueLabel}>{isEn ? 'Before:' : '变更前:'}</Text>
              <Text style={[styles.diffValue, { color: '#ff4d4f' }]}>{item.oldValue || '-'}</Text>
            </View>
            <View style={styles.diffValueRow}>
              <Text style={styles.diffValueLabel}>{isEn ? 'After:' : '变更后:'}</Text>
              <Text style={[styles.diffValue, { color: '#52c41a' }]}>{item.newValue || '-'}</Text>
            </View>
          </View>
        ) : (
          <Text style={[styles.diffValue, { color: config.text }]}>
            {item.value || item.newValue || item.oldValue || '-'}
          </Text>
        )}
      </View>
    );
  };

  // Render operation history
  const renderOperationHistory = () => {
    if (!changeset) return null;

    const timeline = [
      {
        time: changeset.createdAt,
        action: isEn ? 'Created' : '创建',
        user: changeset.createdByName,
        color: '#1890ff',
      },
    ];

    if (changeset.approvedAt) {
      timeline.push({
        time: changeset.approvedAt,
        action: changeset.status === 'REJECTED' ? (isEn ? 'Rejected' : '拒绝') : (isEn ? 'Approved' : '批准'),
        user: changeset.approvedByName ?? null,
        color: changeset.status === 'REJECTED' ? '#ff4d4f' : '#52c41a',
      });
    }

    if (changeset.appliedAt) {
      timeline.push({
        time: changeset.appliedAt,
        action: isEn ? 'Applied' : '应用',
        user: null,
        color: '#52c41a',
      });
    }

    if (changeset.rolledBackAt) {
      timeline.push({
        time: changeset.rolledBackAt,
        action: isEn ? 'Rolled Back' : '回滚',
        user: null,
        color: '#8c8c8c',
      });
    }

    return (
      <Card style={styles.card}>
        <Card.Content>
          {timeline.map((item, index) => (
            <View key={index} style={styles.timelineItem}>
              <View style={[styles.timelineDot, { backgroundColor: item.color }]} />
              {index < timeline.length - 1 && <View style={styles.timelineLine} />}
              <View style={styles.timelineContent}>
                <Text style={styles.timelineAction}>{item.action}</Text>
                <Text style={styles.timelineTime}>{formatDate(item.time)}</Text>
                {item.user && <Text style={styles.timelineUser}>{item.user}</Text>}
              </View>
            </View>
          ))}

          {/* Show approval comment if exists */}
          {changeset.approvalComment && (
            <View style={styles.commentSection}>
              <Text style={styles.commentLabel}>
                {changeset.status === 'REJECTED' ? (isEn ? 'Reject Reason:' : '拒绝原因:') : (isEn ? 'Comment:' : '备注:')}
              </Text>
              <Text style={styles.commentText}>{changeset.approvalComment}</Text>
            </View>
          )}

          {/* Show rollback reason if exists */}
          {changeset.rollbackReason && (
            <View style={styles.commentSection}>
              <Text style={styles.commentLabel}>{isEn ? 'Rollback Reason:' : '回滚原因:'}</Text>
              <Text style={styles.commentText}>{changeset.rollbackReason}</Text>
            </View>
          )}
        </Card.Content>
      </Card>
    );
  };

  // Loading state
  if (loading || !changeset) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1890ff" />
          <Text style={styles.loadingText}>{isEn ? 'Loading...' : '加载中...'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const typeConfig = CONFIG_TYPE_MAP[changeset.configType] || CONFIG_TYPE_MAP.OTHER;
  const statusConfig = STATUS_MAP[changeset.status] || STATUS_MAP.PENDING;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.header}>
        <View style={styles.headerRow}>
          <IconButton
            icon="arrow-left"
            iconColor="#fff"
            onPress={() => navigation.goBack()}
          />
          <Text variant="titleLarge" style={styles.headerTitle}>
            {isEn ? 'Change Detail' : '变更详情'}
          </Text>
          <IconButton
            icon="refresh"
            iconColor="#fff"
            onPress={onRefresh}
          />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Hero Card */}
        <LinearGradient
          colors={[typeConfig.color, `${typeConfig.color}cc`]}
          style={styles.heroCard}
        >
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <Avatar.Icon size={48} icon={typeConfig.icon} color="#fff" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
            </View>
            <View style={styles.heroInfo}>
              <Text style={styles.heroTitle} numberOfLines={2}>
                {changeset.configName || changeset.configId}
              </Text>
              <Text style={styles.heroSubtitle}>
                {isEn ? typeConfig.labelEn : typeConfig.label}
              </Text>
            </View>
            <Chip
              mode="flat"
              style={[styles.heroStatus, { backgroundColor: statusConfig.bgColor }]}
              textStyle={{ color: statusConfig.color, fontSize: 12 }}
            >
              {isEn ? statusConfig.labelEn : statusConfig.label}
            </Chip>
          </View>

          <View style={styles.heroMeta}>
            <View style={styles.heroMetaItem}>
              <Text style={styles.heroMetaLabel}>{isEn ? 'Version' : '版本'}</Text>
              <Text style={styles.heroMetaValue}>
                v{changeset.fromVersion || 0} → v{changeset.toVersion || 1}
              </Text>
            </View>
            <View style={styles.heroMetaItem}>
              <Text style={styles.heroMetaLabel}>{isEn ? 'Created' : '创建时间'}</Text>
              <Text style={styles.heroMetaValue}>{formatDate(changeset.createdAt)}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <Pressable
            style={[styles.tabItem, activeTab === 'diff' && styles.tabItemActive]}
            onPress={() => setActiveTab('diff')}
          >
            <Text style={[styles.tabText, activeTab === 'diff' && styles.tabTextActive]}>
              {isEn ? 'Changes' : '变更内容'}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabItem, activeTab === 'history' && styles.tabItemActive]}
            onPress={() => setActiveTab('history')}
          >
            <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
              {isEn ? 'History' : '操作历史'}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabItem, activeTab === 'impact' && styles.tabItemActive]}
            onPress={() => setActiveTab('impact')}
          >
            <Text style={[styles.tabText, activeTab === 'impact' && styles.tabTextActive]}>
              {isEn ? 'Impact' : '影响分析'}
            </Text>
          </Pressable>
        </View>

        {/* Tab Content */}
        {activeTab === 'diff' && (
          <View>
            {/* Summary */}
            {changeset.changeSummary && (
              <Card style={styles.card}>
                <Card.Content>
                  <Text style={styles.sectionTitle}>{isEn ? 'Change Summary' : '变更摘要'}</Text>
                  <Text style={styles.summaryText}>{changeset.changeSummary}</Text>
                </Card.Content>
              </Card>
            )}

            {/* Diff View */}
            <Card style={styles.card}>
              <Card.Content>
                <Text style={styles.sectionTitle}>{isEn ? 'Diff Preview' : '差异预览'}</Text>

                {diffPreview ? (
                  <View style={styles.diffContainer}>
                    {diffPreview.added?.length > 0 && (
                      <View style={styles.diffSection}>
                        <Text style={styles.diffSectionTitle}>
                          {isEn ? 'Added' : '新增'} ({diffPreview.added.length})
                        </Text>
                        {diffPreview.added.map(item => renderDiffItem(item, 'added'))}
                      </View>
                    )}

                    {diffPreview.removed?.length > 0 && (
                      <View style={styles.diffSection}>
                        <Text style={styles.diffSectionTitle}>
                          {isEn ? 'Removed' : '删除'} ({diffPreview.removed.length})
                        </Text>
                        {diffPreview.removed.map(item => renderDiffItem(item, 'removed'))}
                      </View>
                    )}

                    {diffPreview.modified?.length > 0 && (
                      <View style={styles.diffSection}>
                        <Text style={styles.diffSectionTitle}>
                          {isEn ? 'Modified' : '修改'} ({diffPreview.modified.length})
                        </Text>
                        {diffPreview.modified.map(item => renderDiffItem(item, 'modified'))}
                      </View>
                    )}

                    {!diffPreview.added?.length && !diffPreview.removed?.length && !diffPreview.modified?.length && (
                      <Text style={styles.noDiffText}>{isEn ? 'No differences found' : '未发现差异'}</Text>
                    )}
                  </View>
                ) : (
                  <View style={styles.snapshotContainer}>
                    <Text style={styles.snapshotLabel}>{isEn ? 'Before:' : '变更前:'}</Text>
                    <ScrollView horizontal style={styles.snapshotScroll}>
                      <Text style={styles.snapshotCode}>
                        {changeset.beforeSnapshot || (isEn ? '(empty)' : '(空)')}
                      </Text>
                    </ScrollView>
                    <Divider style={styles.snapshotDivider} />
                    <Text style={styles.snapshotLabel}>{isEn ? 'After:' : '变更后:'}</Text>
                    <ScrollView horizontal style={styles.snapshotScroll}>
                      <Text style={styles.snapshotCode}>
                        {changeset.afterSnapshot || (isEn ? '(empty)' : '(空)')}
                      </Text>
                    </ScrollView>
                  </View>
                )}
              </Card.Content>
            </Card>
          </View>
        )}

        {activeTab === 'history' && renderOperationHistory()}

        {activeTab === 'impact' && (
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.sectionTitle}>{isEn ? 'Impact Analysis' : '影响分析'}</Text>

              <View style={styles.impactItem}>
                <Avatar.Icon size={36} icon="factory" color="#1890ff" style={styles.impactIcon} />
                <View style={styles.impactInfo}>
                  <Text style={styles.impactLabel}>{isEn ? 'Affected Factories' : '影响工厂'}</Text>
                  <Text style={styles.impactValue}>{changeset.factoryId}</Text>
                </View>
              </View>

              <Divider style={styles.impactDivider} />

              <View style={styles.impactItem}>
                <Avatar.Icon size={36} icon={typeConfig.icon} color={typeConfig.color} style={styles.impactIcon} />
                <View style={styles.impactInfo}>
                  <Text style={styles.impactLabel}>{isEn ? 'Configuration Type' : '配置类型'}</Text>
                  <Text style={styles.impactValue}>{isEn ? typeConfig.labelEn : typeConfig.label}</Text>
                </View>
              </View>

              <Divider style={styles.impactDivider} />

              <View style={styles.impactItem}>
                <Avatar.Icon size={36} icon="alert-circle" color="#fa8c16" style={styles.impactIcon} />
                <View style={styles.impactInfo}>
                  <Text style={styles.impactLabel}>{isEn ? 'Rollback Status' : '可回滚状态'}</Text>
                  <Text style={[styles.impactValue, { color: changeset.isRollbackable ? '#52c41a' : '#ff4d4f' }]}>
                    {changeset.isRollbackable ? (isEn ? 'Rollbackable' : '可回滚') : (isEn ? 'Not Rollbackable' : '不可回滚')}
                  </Text>
                </View>
              </View>

              <View style={styles.dryRunSection}>
                <Button
                  mode="outlined"
                  icon="play-circle"
                  onPress={handleDryRun}
                  loading={actionLoading}
                  style={styles.dryRunButton}
                >
                  {isEn ? 'Dry-Run Preview' : '模拟执行预览'}
                </Button>
              </View>
            </Card.Content>
          </Card>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        {changeset.status === 'PENDING' && (
          <>
            <Button
              mode="outlined"
              onPress={() => setShowRejectModal(true)}
              style={styles.bottomButton}
              textColor="#ff4d4f"
            >
              {isEn ? 'Reject' : '拒绝'}
            </Button>
            <Button
              mode="contained"
              onPress={handleApprove}
              loading={actionLoading}
              style={[styles.bottomButton, styles.approveButton]}
            >
              {isEn ? 'Approve' : '批准'}
            </Button>
          </>
        )}

        {changeset.status === 'APPROVED' && (
          <Button
            mode="contained"
            onPress={handleApply}
            loading={actionLoading}
            style={[styles.bottomButton, styles.applyButton]}
          >
            {isEn ? 'Apply Now' : '立即应用'}
          </Button>
        )}

        {changeset.status === 'APPLIED' && changeset.isRollbackable && (
          <Button
            mode="contained"
            onPress={() => setShowRollbackModal(true)}
            loading={actionLoading}
            style={[styles.bottomButton, styles.rollbackButton]}
          >
            {isEn ? 'Rollback' : '回滚'}
          </Button>
        )}
      </View>

      {/* Reject Modal */}
      <Portal>
        <Modal
          visible={showRejectModal}
          onDismiss={() => setShowRejectModal(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Text style={styles.modalTitle}>{isEn ? 'Reject Change' : '拒绝变更'}</Text>
          <TextInput
            mode="outlined"
            label={isEn ? 'Reject Reason' : '拒绝原因'}
            value={rejectReason}
            onChangeText={setRejectReason}
            multiline
            numberOfLines={3}
            style={styles.modalInput}
          />
          <View style={styles.modalActions}>
            <Button mode="text" onPress={() => setShowRejectModal(false)}>
              {isEn ? 'Cancel' : '取消'}
            </Button>
            <Button
              mode="contained"
              onPress={handleReject}
              loading={actionLoading}
              buttonColor="#ff4d4f"
            >
              {isEn ? 'Confirm Reject' : '确认拒绝'}
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Rollback Modal */}
      <Portal>
        <Modal
          visible={showRollbackModal}
          onDismiss={() => setShowRollbackModal(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Text style={styles.modalTitle}>{isEn ? 'Rollback Change' : '回滚变更'}</Text>
          <TextInput
            mode="outlined"
            label={isEn ? 'Rollback Reason' : '回滚原因'}
            value={rollbackReason}
            onChangeText={setRollbackReason}
            multiline
            numberOfLines={3}
            style={styles.modalInput}
          />
          <View style={styles.modalActions}>
            <Button mode="text" onPress={() => setShowRollbackModal(false)}>
              {isEn ? 'Cancel' : '取消'}
            </Button>
            <Button
              mode="contained"
              onPress={handleRollback}
              loading={actionLoading}
              buttonColor="#8c8c8c"
            >
              {isEn ? 'Confirm Rollback' : '确认回滚'}
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Dry-Run Modal */}
      <Portal>
        <Modal
          visible={showDryRunModal}
          onDismiss={() => setShowDryRunModal(false)}
          contentContainerStyle={styles.dryRunModalContainer}
        >
          <Text style={styles.modalTitle}>{isEn ? 'Dry-Run Result' : '模拟执行结果'}</Text>
          <ScrollView style={styles.dryRunContent}>
            <Text style={styles.dryRunCode}>
              {dryRunResult ? JSON.stringify(dryRunResult, null, 2) : (isEn ? 'No result' : '无结果')}
            </Text>
          </ScrollView>
          <Button mode="contained" onPress={() => setShowDryRunModal(false)}>
            {isEn ? 'Close' : '关闭'}
          </Button>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
  },
  header: {
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#fff',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  heroCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  heroIcon: {
    marginRight: 12,
  },
  heroInfo: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  heroStatus: {
    marginLeft: 8,
  },
  heroMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  heroMetaItem: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 12,
  },
  heroMetaLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  heroMetaValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabItemActive: {
    backgroundColor: '#667eea',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#262626',
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 14,
    color: '#595959',
    lineHeight: 22,
  },
  diffContainer: {
    gap: 16,
  },
  diffSection: {
    gap: 8,
  },
  diffSectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8c8c8c',
    marginBottom: 4,
  },
  diffItem: {
    borderRadius: 8,
    padding: 12,
  },
  diffItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  diffPath: {
    fontSize: 13,
    fontWeight: '500',
  },
  diffValues: {
    gap: 4,
  },
  diffValueRow: {
    flexDirection: 'row',
    gap: 8,
  },
  diffValueLabel: {
    fontSize: 12,
    color: '#8c8c8c',
    width: 60,
  },
  diffValue: {
    fontSize: 13,
    flex: 1,
  },
  noDiffText: {
    fontSize: 14,
    color: '#8c8c8c',
    textAlign: 'center',
    paddingVertical: 20,
  },
  snapshotContainer: {
    gap: 12,
  },
  snapshotLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8c8c8c',
  },
  snapshotScroll: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    maxHeight: 150,
  },
  snapshotCode: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#333',
  },
  snapshotDivider: {
    marginVertical: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
    position: 'relative',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    marginRight: 12,
  },
  timelineLine: {
    position: 'absolute',
    left: 5,
    top: 20,
    bottom: -12,
    width: 2,
    backgroundColor: '#e8e8e8',
  },
  timelineContent: {
    flex: 1,
  },
  timelineAction: {
    fontSize: 15,
    fontWeight: '500',
    color: '#262626',
  },
  timelineTime: {
    fontSize: 13,
    color: '#8c8c8c',
    marginTop: 2,
  },
  timelineUser: {
    fontSize: 13,
    color: '#595959',
    marginTop: 2,
  },
  commentSection: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  commentLabel: {
    fontSize: 12,
    color: '#8c8c8c',
    marginBottom: 4,
  },
  commentText: {
    fontSize: 14,
    color: '#595959',
    lineHeight: 20,
  },
  impactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  impactIcon: {
    backgroundColor: '#f5f5f5',
    marginRight: 12,
  },
  impactInfo: {
    flex: 1,
  },
  impactLabel: {
    fontSize: 13,
    color: '#8c8c8c',
    marginBottom: 2,
  },
  impactValue: {
    fontSize: 15,
    fontWeight: '500',
    color: '#262626',
  },
  impactDivider: {
    backgroundColor: '#f0f0f0',
  },
  dryRunSection: {
    marginTop: 20,
    alignItems: 'center',
  },
  dryRunButton: {
    borderColor: '#667eea',
  },
  bottomActions: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 12,
  },
  bottomButton: {
    flex: 1,
  },
  approveButton: {
    backgroundColor: '#52c41a',
  },
  applyButton: {
    backgroundColor: '#667eea',
  },
  rollbackButton: {
    backgroundColor: '#8c8c8c',
  },
  modalContainer: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#262626',
    marginBottom: 16,
  },
  modalInput: {
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  dryRunModalContainer: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 16,
    padding: 20,
    maxHeight: '70%',
  },
  dryRunContent: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    maxHeight: 300,
  },
  dryRunCode: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#333',
  },
});

export default ConfigChangesetDetailScreen;
