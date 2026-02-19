/**
 * 库存预警综合管理页面
 * 三个 Tab：即将过期 / 已过期 / 低库存
 *
 * 调用接口：
 *   GET  /material-batches/inventory/alerts    — 综合预警（低库存 + 即将过期 + 已过期）
 *   POST /material-batches/handle-expired      — 处理已过期批次
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  ListRenderItemInfo,
} from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { WHInventoryStackParamList } from '../../../types/navigation';
import {
  materialBatchApiClient,
  InventoryAlert,
} from '../../../services/api/materialBatchApiClient';
import { handleError } from '../../../utils/errorHandler';

type NavigationProp = NativeStackNavigationProp<WHInventoryStackParamList>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabKey = 'expiring' | 'expired' | 'low_stock';

interface Tab {
  key: TabKey;
  label: string;
  icon: string;
  color: string;
}

const TABS: Tab[] = [
  { key: 'expiring',  label: '即将过期', icon: 'clock-alert-outline',      color: '#f57c00' },
  { key: 'expired',   label: '已过期',   icon: 'alert-circle-outline',      color: '#f44336' },
  { key: 'low_stock', label: '低库存',   icon: 'package-variant-closed',    color: '#2196F3' },
];

// ---------------------------------------------------------------------------
// Helper: days-remaining colour
// ---------------------------------------------------------------------------

const getDaysColor = (days: number | null): string => {
  if (days === null || days <= 0) return '#f44336';
  if (days < 7)  return '#f44336';
  if (days < 30) return '#f57c00';
  return '#4CAF50';
};

const getDaysBadgeStyle = (days: number | null): { bg: string; text: string } => {
  if (days === null || days <= 0) return { bg: '#ffebee', text: '#f44336' };
  if (days < 7)  return { bg: '#ffebee', text: '#f44336' };
  if (days < 30) return { bg: '#fff3e0', text: '#f57c00' };
  return { bg: '#e8f5e9', text: '#4CAF50' };
};

const formatDaysLabel = (days: number | null): string => {
  if (days === null) return '—';
  if (days <= 0) return '已过期';
  if (days === 1) return '明天过期';
  return `${days} 天后过期`;
};

// ---------------------------------------------------------------------------
// Sub-component: ExpiringItem
// ---------------------------------------------------------------------------

interface ExpiringItemProps {
  item: InventoryAlert;
  onNavigateBatch: (batchNumber: string) => void;
}

function ExpiringItem({ item, onNavigateBatch }: ExpiringItemProps) {
  const days = item.daysUntilExpiry;
  const badge = getDaysBadgeStyle(days);
  const daysColor = getDaysColor(days);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <MaterialCommunityIcons name="clock-alert-outline" size={18} color={daysColor} />
          <Text style={styles.cardBatchNumber}>{item.batchNumber ?? '—'}</Text>
        </View>
        <View style={[styles.daysBadge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.daysBadgeText, { color: badge.text }]}>
            {formatDaysLabel(days)}
          </Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <InfoRow label="物料名称" value={item.materialTypeName} />
        <InfoRow label="当前库存" value={item.currentQuantity !== null ? `${item.currentQuantity} kg` : '—'} />
        <InfoRow label="过期日期" value={item.expiryDate ?? '—'} valueStyle={{ color: daysColor, fontWeight: '500' }} />
        <InfoRow label="存储位置" value={item.storageLocation ?? '未知库位'} />
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnSecondary]}
          onPress={() => {
            if (item.batchNumber) {
              onNavigateBatch(item.batchNumber);
            }
          }}
          disabled={!item.batchNumber}
        >
          <Text style={styles.actionBtnSecondaryText}>查看批次</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnWarning]}
          onPress={() => {
            if (item.batchId) {
              navigation.navigate('WHBatchDetail', { batchId: item.batchId });
            } else if (item.batchNumber) {
              navigation.navigate('WHBatchDetail', { batchNumber: item.batchNumber });
            }
          }}
          disabled={!item.batchId && !item.batchNumber}
        >
          <Text style={styles.actionBtnWarningText}>查看详情</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: ExpiredItem
// ---------------------------------------------------------------------------

interface ExpiredItemProps {
  item: InventoryAlert;
  processing: boolean;
  onHandle: (item: InventoryAlert) => void;
}

function ExpiredItem({ item, processing, onHandle }: ExpiredItemProps) {
  return (
    <View style={[styles.card, styles.cardExpired]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <MaterialCommunityIcons name="alert-circle" size={18} color="#f44336" />
          <Text style={styles.cardBatchNumber}>{item.batchNumber ?? '—'}</Text>
        </View>
        <View style={[styles.daysBadge, { backgroundColor: '#ffebee' }]}>
          <Text style={[styles.daysBadgeText, { color: '#f44336' }]}>已过期</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <InfoRow label="物料名称" value={item.materialTypeName} />
        <InfoRow label="剩余库存" value={item.currentQuantity !== null ? `${item.currentQuantity} kg` : '—'} valueStyle={{ color: '#f44336' }} />
        <InfoRow label="过期日期" value={item.expiryDate ?? '—'} valueStyle={{ color: '#f44336', fontWeight: '500' }} />
        <InfoRow label="存储位置" value={item.storageLocation ?? '未知库位'} />
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnDanger, processing && styles.actionBtnDisabled]}
          onPress={() => onHandle(item)}
          disabled={processing}
        >
          {processing ? (
            <ActivityIndicator size="small" color="#d32f2f" />
          ) : (
            <Text style={styles.actionBtnDangerText}>处理</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: LowStockItem
// ---------------------------------------------------------------------------

interface LowStockItemProps {
  item: InventoryAlert;
}

function LowStockItem({ item }: LowStockItemProps) {
  const current = item.currentQuantity ?? 0;
  const minimum = item.minQuantity ?? 0;
  const ratio = minimum > 0 ? current / minimum : 1;
  const barColor = ratio < 0.3 ? '#f44336' : ratio < 0.6 ? '#f57c00' : '#4CAF50';
  const barWidth = `${Math.min(ratio * 100, 100)}%` as const;

  return (
    <View style={[styles.card, styles.cardLowStock]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <MaterialCommunityIcons name="package-variant-closed" size={18} color="#2196F3" />
          <Text style={styles.cardBatchNumber}>{item.materialTypeName}</Text>
        </View>
        <View style={[styles.daysBadge, { backgroundColor: '#e3f2fd' }]}>
          <Text style={[styles.daysBadgeText, { color: '#2196F3' }]}>低库存</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <InfoRow
          label="当前库存"
          value={`${current} kg`}
          valueStyle={{ color: barColor, fontWeight: '600' }}
        />
        <InfoRow label="安全库存" value={`${minimum} kg`} />
        <InfoRow label="存储位置" value={item.storageLocation ?? '未知库位'} />
      </View>

      {/* Stock level bar */}
      <View style={styles.stockBarContainer}>
        <View style={styles.stockBarTrack}>
          <View
            style={[
              styles.stockBarFill,
              { width: barWidth, backgroundColor: barColor },
            ]}
          />
        </View>
        <Text style={[styles.stockBarLabel, { color: barColor }]}>
          {minimum > 0 ? `${Math.round(ratio * 100)}%` : '—'}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Shared: InfoRow
// ---------------------------------------------------------------------------

function InfoRow({
  label,
  value,
  valueStyle,
}: {
  label: string;
  value: string;
  valueStyle?: object;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueStyle]}>{value}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export function InventoryWarningsScreen() {
  const navigation = useNavigation<NavigationProp>();

  const [activeTab, setActiveTab]   = useState<TabKey>('expiring');
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [expiringItems, setExpiringItems]   = useState<InventoryAlert[]>([]);
  const [expiredItems, setExpiredItems]     = useState<InventoryAlert[]>([]);
  const [lowStockItems, setLowStockItems]   = useState<InventoryAlert[]>([]);

  // Abort flag to avoid setState on unmounted component
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // -------------------------------------------------------------------------
  // Load data using the unified /inventory/alerts endpoint
  // -------------------------------------------------------------------------

  const loadData = useCallback(async () => {
    try {
      const response = await materialBatchApiClient.getInventoryWarnings(30);

      if (!mountedRef.current) return;

      if (!response.success) {
        throw new Error(response.message ?? '获取库存预警失败');
      }

      const alerts: InventoryAlert[] = response.data ?? [];

      setExpiringItems(
        alerts
          .filter((a) => a.alertType === 'EXPIRING')
          .sort((a, b) => (a.daysUntilExpiry ?? 999) - (b.daysUntilExpiry ?? 999))
      );
      setExpiredItems(
        alerts.filter((a) => a.alertType === 'EXPIRED')
      );
      setLowStockItems(
        alerts
          .filter((a) => a.alertType === 'LOW_STOCK')
          .sort((a, b) => {
            // Sort by ratio current/min ascending (most critical first)
            const ratioA = (a.minQuantity ?? 0) > 0 ? (a.currentQuantity ?? 0) / (a.minQuantity ?? 1) : 1;
            const ratioB = (b.minQuantity ?? 0) > 0 ? (b.currentQuantity ?? 0) / (b.minQuantity ?? 1) : 1;
            return ratioA - ratioB;
          })
      );
    } catch (error) {
      if (mountedRef.current) {
        handleError(error, { title: '加载库存预警失败' });
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // -------------------------------------------------------------------------
  // Handle expired batch action
  // -------------------------------------------------------------------------

  const handleExpiredItem = useCallback(
    (item: InventoryAlert) => {
      Alert.alert(
        '处理过期批次',
        `确定对批次 "${item.batchNumber ?? item.materialTypeName}" 进行过期处理（报损）吗？\n\n此操作不可撤销。`,
        [
          { text: '取消', style: 'cancel' },
          {
            text: '确定处理',
            style: 'destructive',
            onPress: async () => {
              setProcessing(true);
              try {
                if (item.batchId) {
                  // Per-batch status update to SCRAPPED
                  await materialBatchApiClient.updateBatchStatus(item.batchId, 'SCRAPPED');
                } else {
                  // Fallback: batch-wide handler
                  await materialBatchApiClient.handleExpiredBatches();
                }
                Alert.alert('处理成功', '已完成过期批次的报损处理');
                loadData();
              } catch (error) {
                handleError(error, { title: '处理过期批次失败' });
              } finally {
                if (mountedRef.current) {
                  setProcessing(false);
                }
              }
            },
          },
        ]
      );
    },
    [loadData]
  );

  // -------------------------------------------------------------------------
  // Navigate to batch detail (by batchNumber lookup)
  // -------------------------------------------------------------------------

  const navigateToBatch = useCallback(
    (batchNumber: string) => {
      navigation.navigate('WHBatchDetail', { batchNumber });
    },
    [navigation]
  );

  // -------------------------------------------------------------------------
  // Computed
  // -------------------------------------------------------------------------

  const currentItems: InventoryAlert[] =
    activeTab === 'expiring'
      ? expiringItems
      : activeTab === 'expired'
      ? expiredItems
      : lowStockItems;

  const totalWarnings =
    expiringItems.length + expiredItems.length + lowStockItems.length;

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  const keyExtractor = (item: InventoryAlert, index: number): string =>
    `${item.alertType}-${item.batchNumber ?? item.materialTypeName}-${index}`;

  const renderItem = ({ item }: ListRenderItemInfo<InventoryAlert>) => {
    if (activeTab === 'expiring') {
      return (
        <ExpiringItem
          item={item}
          onNavigateBatch={navigateToBatch}
        />
      );
    }
    if (activeTab === 'expired') {
      return (
        <ExpiredItem
          item={item}
          processing={processing}
          onHandle={handleExpiredItem}
        />
      );
    }
    return <LowStockItem item={item} />;
  };

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <MaterialCommunityIcons name="check-circle-outline" size={64} color="#ccc" />
      <Text style={styles.emptyText}>暂无{TABS.find((t) => t.key === activeTab)?.label}数据</Text>
      <Text style={styles.emptySubtext}>当前没有需要处理的{TABS.find((t) => t.key === activeTab)?.label}记录</Text>
    </View>
  );

  const renderListHeader = () => {
    if (activeTab === 'expired' && expiredItems.length > 0) {
      return (
        <TouchableOpacity
          style={styles.batchHandleBtn}
          onPress={handleAllExpired}
          disabled={processing}
        >
          {processing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <MaterialCommunityIcons name="check-all" size={18} color="#fff" />
              <Text style={styles.batchHandleBtnText}>一键处理全部 ({expiredItems.length})</Text>
            </>
          )}
        </TouchableOpacity>
      );
    }
    return null;
  };

  const handleAllExpired = () => {
    Alert.alert(
      '批量处理所有过期批次',
      `确定对全部 ${expiredItems.length} 个过期批次进行报损处理吗？\n\n此操作不可撤销。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定全部处理',
          style: 'destructive',
          onPress: async () => {
            setProcessing(true);
            try {
              await materialBatchApiClient.handleExpiredBatches();
              Alert.alert('处理成功', `已完成全部 ${expiredItems.length} 个过期批次的报损处理`);
              loadData();
            } catch (error) {
              handleError(error, { title: '批量处理失败' });
            } finally {
              if (mountedRef.current) {
                setProcessing(false);
              }
            }
          },
        },
      ]
    );
  };

  // -------------------------------------------------------------------------
  // Loading screen
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>库存预警管理</Text>
          </View>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------------------------
  // Full render
  // -------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>库存预警管理</Text>
          <Text style={styles.headerSubtitle}>
            共 {totalWarnings} 条预警
            {expiredItems.length > 0 ? ` | 已过期 ${expiredItems.length} 批` : ''}
          </Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      {/* Summary strip */}
      <View style={styles.summaryStrip}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryCount, { color: '#f57c00' }]}>{expiringItems.length}</Text>
          <Text style={styles.summaryLabel}>即将过期</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryCount, { color: '#f44336' }]}>{expiredItems.length}</Text>
          <Text style={styles.summaryLabel}>已过期</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryCount, { color: '#2196F3' }]}>{lowStockItems.length}</Text>
          <Text style={styles.summaryLabel}>低库存</Text>
        </View>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const count =
            tab.key === 'expiring' ? expiringItems.length :
            tab.key === 'expired'  ? expiredItems.length :
                                     lowStockItems.length;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabItem, isActive && styles.tabItemActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name={tab.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                size={16}
                color={isActive ? tab.color : '#999'}
              />
              <Text style={[styles.tabLabel, isActive && { color: tab.color }]}>
                {tab.label}
              </Text>
              {count > 0 && (
                <View
                  style={[
                    styles.tabBadge,
                    { backgroundColor: isActive ? tab.color : '#ccc' },
                  ]}
                >
                  <Text style={styles.tabBadgeText}>{count}</Text>
                </View>
              )}
              {isActive && (
                <View style={[styles.tabIndicator, { backgroundColor: tab.color }]} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* List */}
      <FlatList<InventoryAlert>
        data={currentItems}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#4CAF50']}
          />
        }
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },

  // Header
  header: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  headerRight: {
    width: 32,
  },

  // Summary strip
  summaryStrip: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 4,
  },
  summaryCount: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },

  // Tab bar
  tabBar: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 4,
    position: 'relative',
  },
  tabItemActive: {
    // colour applied via dynamic styles
  },
  tabLabel: {
    fontSize: 13,
    color: '#999',
    fontWeight: '500',
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },

  // List
  listContent: {
    padding: 16,
    paddingBottom: 32,
    flexGrow: 1,
  },

  // Batch handle button (for expired tab header)
  batchHandleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f44336',
    borderRadius: 8,
    paddingVertical: 12,
    marginBottom: 12,
    gap: 8,
  },
  batchHandleBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Card shared
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#e0e0e0',
  },
  cardExpired: {
    borderLeftColor: '#f44336',
    backgroundColor: '#fffafa',
  },
  cardLowStock: {
    borderLeftColor: '#2196F3',
    backgroundColor: '#fafcff',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  cardBatchNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flexShrink: 1,
  },
  daysBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  daysBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardBody: {
    gap: 6,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 13,
    color: '#999',
  },
  infoValue: {
    fontSize: 13,
    color: '#333',
    maxWidth: '65%',
    textAlign: 'right',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#f5f5f5',
    paddingTop: 12,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  actionBtnDanger: {
    backgroundColor: '#ffebee',
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  actionBtnDangerText: {
    color: '#d32f2f',
    fontSize: 13,
    fontWeight: '600',
  },
  actionBtnWarning: {
    backgroundColor: '#fff3e0',
    borderWidth: 1,
    borderColor: '#ffe0b2',
  },
  actionBtnWarningText: {
    color: '#f57c00',
    fontSize: 13,
    fontWeight: '600',
  },
  actionBtnSecondary: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  actionBtnSecondaryText: {
    color: '#555',
    fontSize: 13,
    fontWeight: '500',
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },

  // Stock bar (low stock tab)
  stockBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stockBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  stockBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  stockBarLabel: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 36,
    textAlign: 'right',
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#999',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#bbb',
    marginTop: 6,
    textAlign: 'center',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
});

export default InventoryWarningsScreen;
