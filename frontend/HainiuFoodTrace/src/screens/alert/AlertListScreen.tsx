import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { AlertService } from '../../services/alert/alertService';
import { AlertNotification } from '../../services/api/alertApiClient';
import { useAuthStore } from '../../store/authStore';
import { usePermission } from '../../hooks/usePermission';
import { useNotifications } from '../../hooks/useNotifications';

interface FilterOptions {
  severity?: AlertNotification['severity'];
  status?: AlertNotification['status'];
  alertType?: AlertNotification['alertType'];
}

export const AlertListScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const { hasPermission } = usePermission();
  const { setBadgeCount, clearAllNotifications } = useNotifications();

  // 状态管理
  const [alerts, setAlerts] = useState<AlertNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAlerts, setSelectedAlerts] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({});
  const [error, setError] = useState<string | null>(null);

  // 分页状态
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    hasMore: true
  });

  // 权限检查
  const canManageAlerts = hasPermission('alerts:manage') || hasPermission('admin:all');
  const canResolveAlerts = hasPermission('alerts:resolve') || canManageAlerts;

  // 加载告警列表
  const loadAlerts = async (page: number = 1, clearPrevious: boolean = false) => {
    try {
      if (page === 1) setLoading(true);
      else setLoadingMore(true);

      setError(null);

      const response = await AlertService.getAlerts({
        page,
        limit: pagination.limit,
        ...filters,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        useCache: page === 1 // 只有第一页使用缓存
      });

      if (response.success && response.data) {
        const newAlerts = response.data.alerts;

        if (clearPrevious || page === 1) {
          setAlerts(newAlerts);
        } else {
          setAlerts(prev => [...prev, ...newAlerts]);
        }

        setPagination({
          page: response.data.page,
          limit: response.data.limit,
          total: response.data.total,
          hasMore: newAlerts.length === pagination.limit
        });

        console.log('告警列表加载成功:', {
          page,
          count: newAlerts.length,
          total: response.data.total
        });

        // 更新应用徽章数量为未解决的告警数量
        const unresolvedCount = newAlerts.filter(alert => 
          !['resolved', 'closed'].includes(alert.status)
        ).length;
        setBadgeCount(unresolvedCount);
      } else {
        throw new Error(response.message || '加载告警列表失败');
      }
    } catch (error) {
      console.error('加载告警列表失败:', error);
      setError(error.message || '加载失败');
      
      if (page === 1) {
        Alert.alert('加载失败', error.message || '无法获取告警列表，请检查网络连接后重试');
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  // 刷新列表
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setSelectedAlerts([]);
    loadAlerts(1, true);
  }, [filters]);

  // 加载更多
  const loadMore = useCallback(() => {
    if (pagination.hasMore && !loadingMore && !loading) {
      loadAlerts(pagination.page + 1, false);
    }
  }, [pagination, loadingMore, loading]);

  // 筛选变化时重新加载
  useEffect(() => {
    loadAlerts(1, true);
  }, [filters]);

  // 页面聚焦时刷新
  useFocusEffect(
    useCallback(() => {
      loadAlerts(1, true);
    }, [])
  );

  // 导航到告警详情
  const navigateToAlertDetail = (alert: AlertNotification) => {
    navigation.navigate('AlertDetail' as never, { alertId: alert.id } as never);
  };

  // 快速确认告警
  const quickAcknowledgeAlert = async (alertId: string) => {
    try {
      const response = await AlertService.acknowledgeAlert(alertId, '快速确认');
      
      if (response.success) {
        // 更新本地状态
        setAlerts(prev => 
          prev.map(alert => 
            alert.id === alertId 
              ? { ...alert, status: 'acknowledged' }
              : alert
          )
        );
        Alert.alert('成功', '告警已确认');
      } else {
        Alert.alert('确认失败', response.message || '操作失败');
      }
    } catch (error) {
      Alert.alert('确认失败', '网络错误，请重试');
    }
  };

  // 批量操作
  const batchProcessAlerts = async (action: 'acknowledge' | 'resolve') => {
    if (selectedAlerts.length === 0) {
      Alert.alert('提示', '请先选择要操作的告警');
      return;
    }

    const actionText = action === 'acknowledge' ? '确认' : '解决';
    
    Alert.alert(
      '确认操作',
      `确定要${actionText}选中的 ${selectedAlerts.length} 个告警吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          onPress: async () => {
            try {
              const response = await AlertService.batchProcessAlerts(selectedAlerts, {
                type: action,
                data: action === 'resolve' ? { resolutionNotes: `批量${actionText}` } : {}
              });

              if (response.success && response.result) {
                Alert.alert(
                  '操作完成',
                  `成功${actionText} ${response.result.succeeded.length} 个告警${
                    response.result.failed.length > 0 
                      ? `，${response.result.failed.length} 个失败` 
                      : ''
                  }`
                );
                setSelectedAlerts([]);
                onRefresh();
              } else {
                Alert.alert('操作失败', response.message || '批量操作失败');
              }
            } catch (error) {
              Alert.alert('操作失败', '网络错误，请重试');
            }
          }
        }
      ]
    );
  };

  // 切换选择状态
  const toggleSelection = (alertId: string) => {
    setSelectedAlerts(prev => 
      prev.includes(alertId)
        ? prev.filter(id => id !== alertId)
        : [...prev, alertId]
    );
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedAlerts.length === alerts.length) {
      setSelectedAlerts([]);
    } else {
      setSelectedAlerts(alerts.map(alert => alert.id));
    }
  };

  // 渲染告警项
  const renderAlertItem = ({ item }: { item: AlertNotification }) => {
    const severityInfo = AlertService.getSeverityDisplayInfo(item.severity);
    const statusInfo = AlertService.getStatusDisplayInfo(item.status);
    const typeInfo = AlertService.getTypeDisplayInfo(item.alertType);
    const isSelected = selectedAlerts.includes(item.id);

    return (
      <TouchableOpacity
        style={[
          styles.alertItem,
          isSelected && styles.alertItemSelected,
          item.severity === 'critical' && styles.criticalAlert
        ]}
        onPress={() => navigateToAlertDetail(item)}
        onLongPress={() => toggleSelection(item.id)}
      >
        {/* 左侧严重程度指示器 */}
        <View style={[styles.severityIndicator, { backgroundColor: severityInfo.color }]} />
        
        <View style={styles.alertContent}>
          {/* 头部信息 */}
          <View style={styles.alertHeader}>
            <View style={styles.alertTypeTag}>
              <Ionicons name={typeInfo.icon as any} size={12} color={typeInfo.color} />
              <Text style={[styles.alertTypeText, { color: typeInfo.color }]}>
                {typeInfo.label}
              </Text>
            </View>
            
            <View style={styles.alertMeta}>
              <View style={styles.severityTag}>
                <Text style={[styles.severityText, { color: severityInfo.color }]}>
                  {severityInfo.label}
                </Text>
              </View>
              <Text style={styles.timeText}>
                {AlertService.formatTime(item.createdAt)}
              </Text>
            </View>
          </View>

          {/* 告警标题 */}
          <Text style={styles.alertTitle} numberOfLines={2}>
            {item.title}
          </Text>

          {/* 告警消息 */}
          <Text style={styles.alertMessage} numberOfLines={2}>
            {item.message}
          </Text>

          {/* 状态和操作 */}
          <View style={styles.alertFooter}>
            <View style={[styles.statusTag, { backgroundColor: statusInfo.color }]}>
              <Ionicons name={statusInfo.icon as any} size={12} color="white" />
              <Text style={styles.statusText}>{statusInfo.label}</Text>
            </View>

            {/* 快速操作 */}
            {item.status === 'new' && canResolveAlerts && (
              <TouchableOpacity
                style={styles.quickActionButton}
                onPress={(e) => {
                  e.stopPropagation();
                  quickAcknowledgeAlert(item.id);
                }}
              >
                <Ionicons name="checkmark-circle-outline" size={20} color="#00AA88" />
              </TouchableOpacity>
            )}

            {/* 选择指示器 */}
            {isSelected && (
              <View style={styles.selectionIndicator}>
                <Ionicons name="checkmark-circle" size={20} color="#007AFF" />
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // 渲染筛选器
  const renderFilters = () => (
    <View style={styles.filtersContainer}>
      {/* 严重程度筛选 */}
      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>严重程度:</Text>
        <View style={styles.filterOptions}>
          {(['critical', 'high', 'medium', 'low'] as const).map(severity => (
            <TouchableOpacity
              key={severity}
              style={[
                styles.filterOption,
                filters.severity === severity && styles.filterOptionActive
              ]}
              onPress={() => 
                setFilters(prev => ({
                  ...prev,
                  severity: prev.severity === severity ? undefined : severity
                }))
              }
            >
              <Text style={[
                styles.filterOptionText,
                filters.severity === severity && styles.filterOptionTextActive
              ]}>
                {AlertService.getSeverityDisplayInfo(severity).label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 状态筛选 */}
      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>状态:</Text>
        <View style={styles.filterOptions}>
          {(['new', 'acknowledged', 'in_progress', 'resolved'] as const).map(status => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterOption,
                filters.status === status && styles.filterOptionActive
              ]}
              onPress={() => 
                setFilters(prev => ({
                  ...prev,
                  status: prev.status === status ? undefined : status
                }))
              }
            >
              <Text style={[
                styles.filterOptionText,
                filters.status === status && styles.filterOptionTextActive
              ]}>
                {AlertService.getStatusDisplayInfo(status).label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  // 计算摘要数据
  const summaryData = useMemo(() => {
    const critical = alerts.filter(a => a.severity === 'critical').length;
    const unresolved = alerts.filter(a => !['resolved', 'closed'].includes(a.status)).length;
    return { critical, unresolved, total: alerts.length };
  }, [alerts]);

  return (
    <SafeAreaView style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>告警中心</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setShowFilters(!showFilters)}
            >
              <Ionicons name="filter" size={20} color="#007AFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={onRefresh}
            >
              <Ionicons name="refresh" size={20} color="#007AFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => clearAllNotifications()}
            >
              <Ionicons name="notifications-off" size={20} color="#007AFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* 摘要信息 */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNumber}>{summaryData.total}</Text>
            <Text style={styles.summaryLabel}>总计</Text>
          </View>
          <View style={[styles.summaryItem, styles.criticalSummary]}>
            <Text style={[styles.summaryNumber, styles.criticalNumber]}>
              {summaryData.critical}
            </Text>
            <Text style={[styles.summaryLabel, styles.criticalLabel]}>紧急</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNumber}>{summaryData.unresolved}</Text>
            <Text style={styles.summaryLabel}>未解决</Text>
          </View>
        </View>
      </View>

      {/* 筛选器 */}
      {showFilters && renderFilters()}

      {/* 批量操作栏 */}
      {selectedAlerts.length > 0 && (
        <View style={styles.batchActionBar}>
          <TouchableOpacity
            style={styles.selectAllButton}
            onPress={toggleSelectAll}
          >
            <Text style={styles.selectAllText}>
              {selectedAlerts.length === alerts.length ? '取消全选' : '全选'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.selectedCountText}>
            已选择 {selectedAlerts.length} 项
          </Text>

          <View style={styles.batchActions}>
            <TouchableOpacity
              style={styles.batchActionButton}
              onPress={() => batchProcessAlerts('acknowledge')}
            >
              <Text style={styles.batchActionText}>确认</Text>
            </TouchableOpacity>
            
            {canResolveAlerts && (
              <TouchableOpacity
                style={[styles.batchActionButton, styles.resolveButton]}
                onPress={() => batchProcessAlerts('resolve')}
              >
                <Text style={[styles.batchActionText, styles.resolveButtonText]}>解决</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* 列表 */}
      {loading && alerts.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>加载告警列表...</Text>
        </View>
      ) : error && alerts.length === 0 ? (
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={48} color="#FF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
            <Text style={styles.retryButtonText}>重试</Text>
          </TouchableOpacity>
        </View>
      ) : alerts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off" size={48} color="#CCCCCC" />
          <Text style={styles.emptyText}>暂无告警</Text>
          <Text style={styles.emptySubtext}>系统运行正常</Text>
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(item) => item.id}
          renderItem={renderAlertItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.1}
          ListFooterComponent={() => 
            loadingMore ? (
              <View style={styles.loadMoreContainer}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.loadMoreText}>加载更多...</Text>
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  criticalSummary: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#FFEEEE',
  },
  summaryNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  criticalNumber: {
    color: '#FF4444',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  criticalLabel: {
    color: '#FF4444',
  },
  filtersContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterGroup: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 8,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filterOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: 'white',
  },
  filterOptionActive: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  filterOptionText: {
    fontSize: 12,
    color: '#666666',
  },
  filterOptionTextActive: {
    color: '#007AFF',
    fontWeight: '500',
  },
  batchActionBar: {
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  selectAllButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  selectAllText: {
    fontSize: 14,
    color: '#007AFF',
  },
  selectedCountText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    color: '#333333',
  },
  batchActions: {
    flexDirection: 'row',
  },
  batchActionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginLeft: 8,
    borderRadius: 4,
    backgroundColor: '#E3F2FD',
  },
  resolveButton: {
    backgroundColor: '#E8F5E8',
  },
  batchActionText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  resolveButtonText: {
    color: '#00AA88',
  },
  listContainer: {
    paddingVertical: 8,
  },
  alertItem: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
    flexDirection: 'row',
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  alertItemSelected: {
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  criticalAlert: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF4444',
  },
  severityIndicator: {
    width: 4,
  },
  alertContent: {
    flex: 1,
    padding: 12,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  alertTypeTag: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertTypeText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  alertMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  severityTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  severityText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  timeText: {
    fontSize: 12,
    color: '#666666',
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  alertMessage: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    marginBottom: 8,
  },
  alertFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: 'white',
    marginLeft: 4,
    fontWeight: '500',
  },
  quickActionButton: {
    padding: 4,
  },
  selectionIndicator: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF4444',
    marginTop: 12,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    color: '#666666',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999999',
    marginTop: 4,
  },
  loadMoreContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  loadMoreText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666666',
  },
});

export default AlertListScreen;