/**
 * ConfigChangesetListScreen - Configuration changeset list with filtering
 *
 * Displays all configuration change records with status filtering,
 * time filtering, and type filtering capabilities.
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
  Pressable,
  Alert,
} from 'react-native';
import {
  Text,
  Card,
  Chip,
  Button,
  IconButton,
  ActivityIndicator,
  Appbar,
  Searchbar,
  Menu,
  Divider,
  Avatar,
  Badge,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';

import { useAuthStore } from '../../../store/authStore';
import { apiClient } from '../../../services/api/apiClient';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('ConfigChangesetListScreen');

// Types based on backend entity
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

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ConfigChangesetList'>;

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

// Filter options
const STATUS_FILTERS: { key: ChangeStatus | 'all'; label: string; labelEn: string }[] = [
  { key: 'all', label: '全部', labelEn: 'All' },
  { key: 'PENDING', label: '待审批', labelEn: 'Pending' },
  { key: 'APPROVED', label: '已批准', labelEn: 'Approved' },
  { key: 'APPLIED', label: '已应用', labelEn: 'Applied' },
  { key: 'REJECTED', label: '已拒绝', labelEn: 'Rejected' },
  { key: 'ROLLED_BACK', label: '已回滚', labelEn: 'Rolled Back' },
];

const TYPE_FILTERS: { key: ConfigType | 'all'; label: string; labelEn: string }[] = [
  { key: 'all', label: '全部类型', labelEn: 'All Types' },
  { key: 'DROOLS_RULE', label: '规则变更', labelEn: 'Rule Change' },
  { key: 'FORM_TEMPLATE', label: '蓝图变更', labelEn: 'Blueprint Change' },
  { key: 'QUALITY_RULE', label: '质检变更', labelEn: 'Quality Change' },
  { key: 'APPROVAL_CHAIN', label: '审批变更', labelEn: 'Approval Change' },
  { key: 'CONVERSION_RATE', label: '配额变更', labelEn: 'Quota Change' },
];

export function ConfigChangesetListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t, i18n } = useTranslation('platform');
  const { user } = useAuthStore();
  const factoryId = user?.factoryId || 'F001';

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [changesets, setChangesets] = useState<ConfigChangeSet[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ChangeStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<ConfigType | 'all'>('all');
  const [typeMenuVisible, setTypeMenuVisible] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const isEn = i18n.language === 'en';

  // Load changesets
  const loadChangesets = useCallback(async (reset = false) => {
    try {
      logger.info('Loading configuration changesets');

      const currentPage = reset ? 0 : page;
      const statusParam = statusFilter !== 'all' ? `&status=${statusFilter}` : '';
      const response = await apiClient.get<{
        success: boolean;
        data: {
          content: ConfigChangeSet[];
          totalPages: number;
          totalElements: number;
        };
      }>(`/api/mobile/${factoryId}/config-changes?page=${currentPage}&size=20${statusParam}`);

      if (response.success && response.data) {
        const newData = response.data.content;
        if (reset) {
          setChangesets(newData);
        } else {
          setChangesets(prev => [...prev, ...newData]);
        }
        setTotalPages(response.data.totalPages);
        setHasMore(currentPage + 1 < response.data.totalPages);
      }

      // Get pending count
      const countResponse = await apiClient.get<{
        success: boolean;
        data: { count: number };
      }>(`/api/mobile/${factoryId}/config-changes/pending/count`);
      if (countResponse.success && countResponse.data) {
        setPendingCount(countResponse.data.count);
      }
    } catch (error) {
      logger.error('Failed to load changesets', error as Error);
      if (isAxiosError(error)) {
        Alert.alert(
          isEn ? 'Error' : '错误',
          error.response?.data?.message || (isEn ? 'Failed to load configuration changes' : '加载配置变更失败')
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [factoryId, page, statusFilter, isEn]);

  useEffect(() => {
    loadChangesets(true);
  }, [statusFilter]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(0);
    loadChangesets(true);
  }, [loadChangesets]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1);
      loadChangesets(false);
    }
  }, [loading, hasMore, loadChangesets]);

  // Filter changesets
  const filteredChangesets = changesets.filter(cs => {
    const matchesType = typeFilter === 'all' || cs.configType === typeFilter;
    const matchesSearch = !searchQuery ||
      cs.configName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cs.changeSummary?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  // Navigate to detail
  const handleViewDetail = (changeset: ConfigChangeSet) => {
    navigation.navigate('ConfigChangesetDetail', { changesetId: changeset.id });
  };

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  // Render status filter tabs
  const renderStatusTabs = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.statusTabs}
      contentContainerStyle={styles.statusTabsContent}
    >
      {STATUS_FILTERS.map(filter => {
        const isSelected = statusFilter === filter.key;
        return (
          <Chip
            key={filter.key}
            selected={isSelected}
            onPress={() => setStatusFilter(filter.key)}
            style={[
              styles.statusChip,
              isSelected && { backgroundColor: '#1890ff20' },
            ]}
            textStyle={[
              styles.statusChipText,
              isSelected && { color: '#1890ff' },
            ]}
          >
            {isEn ? filter.labelEn : filter.label}
            {filter.key === 'PENDING' && pendingCount > 0 && (
              <Text style={styles.pendingBadge}> ({pendingCount})</Text>
            )}
          </Chip>
        );
      })}
    </ScrollView>
  );

  // Render changeset item
  const renderChangesetItem = (changeset: ConfigChangeSet) => {
    const typeConfig = CONFIG_TYPE_MAP[changeset.configType] || CONFIG_TYPE_MAP.OTHER;
    const statusConfig = STATUS_MAP[changeset.status] || STATUS_MAP.PENDING;

    return (
      <Card
        key={changeset.id}
        style={styles.changesetCard}
        mode="elevated"
        onPress={() => handleViewDetail(changeset)}
      >
        <Card.Content>
          {/* Header Row */}
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Avatar.Icon
                size={40}
                icon={typeConfig.icon}
                color="#fff"
                style={{ backgroundColor: typeConfig.color }}
              />
              <View style={styles.cardTitleContainer}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {changeset.configName || changeset.configId}
                </Text>
                <View style={styles.cardMetaRow}>
                  <Chip
                    compact
                    style={[styles.typeBadge, { backgroundColor: typeConfig.color + '20' }]}
                    textStyle={{ color: typeConfig.color, fontSize: 10 }}
                  >
                    {isEn ? typeConfig.labelEn : typeConfig.label}
                  </Chip>
                  <Text style={styles.versionText}>
                    v{changeset.fromVersion || 0} → v{changeset.toVersion || 1}
                  </Text>
                </View>
              </View>
            </View>

            <Chip
              compact
              style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}
              textStyle={{ color: statusConfig.color, fontSize: 11 }}
            >
              {isEn ? statusConfig.labelEn : statusConfig.label}
            </Chip>
          </View>

          {/* Summary */}
          {changeset.changeSummary && (
            <Text style={styles.summaryText} numberOfLines={2}>
              {changeset.changeSummary}
            </Text>
          )}

          {/* Footer */}
          <View style={styles.cardFooter}>
            <View style={styles.footerLeft}>
              <Avatar.Icon size={20} icon="account" style={styles.footerIcon} />
              <Text style={styles.footerText}>
                {changeset.createdByName || (isEn ? 'Unknown' : '未知')}
              </Text>
            </View>
            <Text style={styles.footerDate}>
              {formatDate(changeset.createdAt)}
            </Text>
          </View>

          {/* Status specific info */}
          {changeset.status === 'APPLIED' && changeset.appliedAt && (
            <View style={styles.statusInfo}>
              <Text style={styles.statusInfoText}>
                {isEn ? 'Applied: ' : '应用时间: '}{formatDate(changeset.appliedAt)}
              </Text>
            </View>
          )}
          {changeset.status === 'ROLLED_BACK' && changeset.rolledBackAt && (
            <View style={styles.statusInfo}>
              <Text style={styles.statusInfoText}>
                {isEn ? 'Rolled back: ' : '回滚时间: '}{formatDate(changeset.rolledBackAt)}
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>
    );
  };

  // Loading state
  if (loading && changesets.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title={isEn ? 'Config Changes' : '配置变更追踪'} />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1890ff" />
          <Text style={styles.loadingText}>
            {isEn ? 'Loading...' : '加载中...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

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
            {isEn ? 'Configuration Changes' : '配置变更追踪'}
          </Text>
          <IconButton
            icon="refresh"
            iconColor="#fff"
            onPress={onRefresh}
          />
        </View>

        {/* Statistics */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{changesets.length}</Text>
            <Text style={styles.statLabel}>{isEn ? 'Total' : '全部'}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#fadb14' }]}>{pendingCount}</Text>
            <Text style={styles.statLabel}>{isEn ? 'Pending' : '待审批'}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#52c41a' }]}>
              {changesets.filter(c => c.status === 'APPLIED').length}
            </Text>
            <Text style={styles.statLabel}>{isEn ? 'Applied' : '已应用'}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Search and Filter */}
      <View style={styles.filterContainer}>
        <Searchbar
          placeholder={isEn ? 'Search changes...' : '搜索变更...'}
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchbar}
        />

        <Menu
          visible={typeMenuVisible}
          onDismiss={() => setTypeMenuVisible(false)}
          anchor={
            <Pressable
              style={styles.typeFilterButton}
              onPress={() => setTypeMenuVisible(true)}
            >
              <Text style={styles.typeFilterText}>
                {typeFilter === 'all'
                  ? (isEn ? 'All Types' : '全部类型')
                  : (isEn ? CONFIG_TYPE_MAP[typeFilter].labelEn : CONFIG_TYPE_MAP[typeFilter].label)}
              </Text>
              <IconButton icon="chevron-down" size={18} />
            </Pressable>
          }
        >
          {TYPE_FILTERS.map(filter => (
            <Menu.Item
              key={filter.key}
              onPress={() => {
                setTypeFilter(filter.key);
                setTypeMenuVisible(false);
              }}
              title={isEn ? filter.labelEn : filter.label}
              leadingIcon={typeFilter === filter.key ? 'check' : undefined}
            />
          ))}
        </Menu>
      </View>

      {/* Status Tabs */}
      {renderStatusTabs()}

      {/* Changeset List */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onScrollEndDrag={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 50) {
            loadMore();
          }
        }}
      >
        {filteredChangesets.length === 0 ? (
          <View style={styles.emptyState}>
            <Avatar.Icon
              size={64}
              icon="file-document-outline"
              color="#999"
              style={{ backgroundColor: '#f0f0f0' }}
            />
            <Text style={styles.emptyText}>
              {isEn ? 'No configuration changes found' : '暂无配置变更记录'}
            </Text>
          </View>
        ) : (
          <>
            {filteredChangesets.map(changeset => renderChangesetItem(changeset))}
            {loading && (
              <View style={styles.loadingMore}>
                <ActivityIndicator size="small" />
                <Text style={styles.loadingMoreText}>
                  {isEn ? 'Loading more...' : '加载更多...'}
                </Text>
              </View>
            )}
          </>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
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
    paddingBottom: 16,
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
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
    gap: 12,
  },
  searchbar: {
    flex: 1,
    borderRadius: 12,
    elevation: 2,
  },
  typeFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingLeft: 12,
    paddingRight: 4,
    height: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  typeFilterText: {
    fontSize: 13,
    color: '#333',
  },
  statusTabs: {
    marginBottom: 8,
  },
  statusTabsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  statusChip: {
    backgroundColor: '#fff',
  },
  statusChipText: {
    fontSize: 13,
  },
  pendingBadge: {
    color: '#fa8c16',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 8,
  },
  changesetCard: {
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: 8,
  },
  cardTitleContainer: {
    marginLeft: 12,
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#262626',
    marginBottom: 4,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeBadge: {
    height: 22,
  },
  versionText: {
    fontSize: 12,
    color: '#8c8c8c',
  },
  statusBadge: {
    height: 24,
  },
  summaryText: {
    fontSize: 14,
    color: '#595959',
    lineHeight: 20,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerIcon: {
    backgroundColor: '#f0f0f0',
  },
  footerText: {
    fontSize: 12,
    color: '#8c8c8c',
  },
  footerDate: {
    fontSize: 12,
    color: '#8c8c8c',
  },
  statusInfo: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  statusInfoText: {
    fontSize: 12,
    color: '#52c41a',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
  loadingMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  loadingMoreText: {
    fontSize: 14,
    color: '#8c8c8c',
  },
});

export default ConfigChangesetListScreen;
