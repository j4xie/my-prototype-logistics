import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LogisticsStackParamList } from '../../types/navigation';
import { useAuthStore } from '../../store/authStore';
import {
  shipmentApiClient,
  ShipmentRecord,
  ShipmentStats,
} from '../../services/api/shipmentApiClient';
import { logger } from '../../utils/logger';

const dashboardLogger = logger.createContextLogger('LogisticsDashboard');

// ==================== 主题常量 ====================

const COLORS = {
  primary: '#FAAD14',
  background: '#F5F7FA',
  cardBackground: '#FFFFFF',
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  pending: '#FFA940',
  shipped: '#1890FF',
  delivered: '#52C41A',
  exception: '#FF4D4F',
  border: '#E5E7EB',
  white: '#FFFFFF',
};

// ==================== 类型 ====================

type LogisticsDashboardNavigationProp = NativeStackNavigationProp<
  LogisticsStackParamList,
  'LogisticsDashboard'
>;

interface StatCard {
  label: string;
  count: number;
  color: string;
  icon: string;
  statusKey?: string;
}

// ==================== 辅助组件 ====================

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation('logistics');
  const statusConfig: Record<string, { label: string; color: string }> = {
    pending: { label: t('status.pending'), color: COLORS.pending },
    shipped: { label: t('status.shipped'), color: COLORS.shipped },
    delivered: { label: t('status.delivered'), color: COLORS.delivered },
    returned: { label: t('status.returned'), color: COLORS.exception },
  };
  const config = statusConfig[status] ?? { label: status, color: COLORS.textSecondary };

  return (
    <View style={[styles.badge, { backgroundColor: config.color + '20', borderColor: config.color }]}>
      <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

function ShipmentItem({
  shipment,
  onPress,
}: {
  shipment: ShipmentRecord;
  onPress: () => void;
}) {
  const date = shipment.shipmentDate
    ? new Date(shipment.shipmentDate).toLocaleDateString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
      })
    : '--';

  return (
    <TouchableOpacity style={styles.shipmentItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.shipmentItemLeft}>
        <Text style={styles.shipmentProduct} numberOfLines={1}>
          {shipment.productName}
        </Text>
        <Text style={styles.shipmentTracking} numberOfLines={1}>
          {shipment.trackingNumber ? `运单: ${shipment.trackingNumber}` : `单号: ${shipment.shipmentNumber}`}
        </Text>
        <Text style={styles.shipmentDate}>{date}</Text>
      </View>
      <View style={styles.shipmentItemRight}>
        <StatusBadge status={shipment.status} />
        <MaterialCommunityIcons
          name="chevron-right"
          size={18}
          color={COLORS.textSecondary}
          style={styles.chevron}
        />
      </View>
    </TouchableOpacity>
  );
}

// ==================== 主界面 ====================

export default function LogisticsDashboardScreen() {
  const navigation = useNavigation<LogisticsDashboardNavigationProp>();
  const { user, getFactoryId } = useAuthStore();
  const { t } = useTranslation('logistics');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<ShipmentStats>({
    total: 0,
    pending: 0,
    shipped: 0,
    delivered: 0,
    returned: 0,
  });
  const [recentShipments, setRecentShipments] = useState<ShipmentRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      dashboardLogger.debug('开始加载物流仪表板数据');
      setError(null);

      const [statsResult, shipmentsResult] = await Promise.allSettled([
        shipmentApiClient.getShipmentStats(),
        shipmentApiClient.getShipments({ page: 0, size: 5 }),
      ]);

      if (statsResult.status === 'fulfilled') {
        const val = statsResult.value;
        if (val && typeof val.pending === 'number') {
          setStats(val);
        }
        dashboardLogger.debug('统计数据加载成功', val);
      } else {
        dashboardLogger.warn('统计数据加载失败', { error: statsResult.reason });
      }

      if (shipmentsResult.status === 'fulfilled') {
        const val = shipmentsResult.value as Record<string, any>;
        const rawData = val?.data;
        const list = Array.isArray(rawData) ? rawData
          : Array.isArray(rawData?.content) ? rawData.content
          : Array.isArray(val) ? val : [];
        setRecentShipments(list);
        dashboardLogger.debug('最近出货记录加载成功', { count: list.length });
      } else {
        dashboardLogger.warn('最近出货记录加载失败', { error: shipmentsResult.reason });
      }

      if (statsResult.status === 'rejected' && shipmentsResult.status === 'rejected') {
        setError(t('error.load_failed'));
      }
    } catch (error) {
      dashboardLogger.error('仪表板数据加载异常', { error });
      setError(t('error.load_exception'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const statCards: StatCard[] = [
    {
      label: t('status.pending'),
      count: stats.pending,
      color: COLORS.pending,
      icon: 'package-variant',
      statusKey: 'pending',
    },
    {
      label: t('status.shipped'),
      count: stats.shipped,
      color: COLORS.shipped,
      icon: 'truck-delivery',
      statusKey: 'shipped',
    },
    {
      label: t('status.delivered'),
      count: stats.delivered,
      color: COLORS.delivered,
      icon: 'check-circle',
      statusKey: 'delivered',
    },
    {
      label: t('status.returned'),
      count: stats.returned,
      color: COLORS.exception,
      icon: 'alert-circle',
      statusKey: 'returned',
    },
  ];

  const handleStatCardPress = (statusKey?: string) => {
    navigation.navigate('ShipmentList', { status: statusKey });
  };

  const handleCreateShipment = () => {
    Alert.alert(t('tip', { ns: 'common' }), t('error.use_admin_module'));
  };

  const handleShipmentListPress = () => {
    navigation.navigate('ShipmentList', {});
  };

  const handleTrackingPress = () => {
    Alert.alert(t('tip', { ns: 'common' }), t('error.tracking_coming_soon'));
  };

  const handleShipmentItemPress = (shipment: ShipmentRecord) => {
    Alert.alert(
      shipment.productName,
      `${t('shipment_number', { defaultValue: '出货单号' })}: ${shipment.shipmentNumber}\n${t('status_label', { defaultValue: '状态' })}: ${shipment.status}\n${t('delivery_address', { defaultValue: '收货地址' })}: ${shipment.deliveryAddress}`,
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top']}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>{t('loading', { ns: 'common' })}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 顶部栏 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('title')}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* 错误提示 */}
        {error && (
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEE2E2', padding: 12, borderRadius: 8, marginBottom: 12, gap: 8 }}>
            <MaterialCommunityIcons name="alert-circle" size={20} color="#EF4444" />
            <Text style={{ flex: 1, fontSize: 14, color: '#EF4444' }}>{error}</Text>
          </View>
        )}

        {/* 欢迎语 */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>{t('shipment_overview')}</Text>
          <Text style={styles.welcomeSubtitle}>
            {user && 'factoryUser' in user
              ? `${user.factoryUser?.factoryId ?? ''} · ${t('realtime_data', { defaultValue: '实时数据' })}`
              : t('realtime_data', { defaultValue: '实时数据' })}
          </Text>
        </View>

        {/* 统计卡片 */}
        <View style={styles.statsGrid}>
          {statCards.map((card) => (
            <TouchableOpacity
              key={card.label}
              style={styles.statCard}
              onPress={() => handleStatCardPress(card.statusKey)}
              activeOpacity={0.75}
            >
              <View style={[styles.statIconWrapper, { backgroundColor: card.color + '18' }]}>
                <MaterialCommunityIcons
                  name={card.icon as any}
                  size={22}
                  color={card.color}
                />
              </View>
              <Text style={[styles.statCount, { color: card.color }]}>{card.count}</Text>
              <Text style={styles.statLabel}>{card.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 快捷操作 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('quick_actions', { ns: 'common' })}</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={handleCreateShipment}
              activeOpacity={0.75}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: COLORS.primary + '18' }]}>
                <MaterialCommunityIcons name="plus-box" size={26} color={COLORS.primary} />
              </View>
              <Text style={styles.quickActionLabel}>{t('quick_action.create_shipment')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={handleShipmentListPress}
              activeOpacity={0.75}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: COLORS.shipped + '18' }]}>
                <MaterialCommunityIcons name="format-list-bulleted" size={26} color={COLORS.shipped} />
              </View>
              <Text style={styles.quickActionLabel}>{t('quick_action.shipment_list')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={handleTrackingPress}
              activeOpacity={0.75}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: COLORS.delivered + '18' }]}>
                <MaterialCommunityIcons name="map-marker-path" size={26} color={COLORS.delivered} />
              </View>
              <Text style={styles.quickActionLabel}>{t('quick_action.tracking')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 最近出货 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('recent_shipments')}</Text>
            <TouchableOpacity onPress={handleShipmentListPress}>
              <Text style={styles.seeAllText}>{t('see_all', { ns: 'common' })}</Text>
            </TouchableOpacity>
          </View>

          {recentShipments.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="truck-outline" size={40} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>{t('no_shipments')}</Text>
            </View>
          ) : (
            <View style={styles.shipmentList}>
              {recentShipments.map((shipment) => (
                <ShipmentItem
                  key={shipment.id}
                  shipment={shipment}
                  onPress={() => handleShipmentItemPress(shipment)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ==================== 样式 ====================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  headerRight: {
    width: 32,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },

  // Welcome
  welcomeSection: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 4,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingTop: 16,
    gap: 10,
  },
  statCard: {
    width: '46.5%',
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statCount: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  // Section
  section: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  seeAllText: {
    fontSize: 13,
    color: COLORS.primary,
  },

  // Quick actions
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionItem: {
    flex: 1,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 13,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },

  // Shipment list
  shipmentList: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  shipmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  shipmentItemLeft: {
    flex: 1,
    gap: 2,
  },
  shipmentProduct: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  shipmentTracking: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  shipmentDate: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  shipmentItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chevron: {
    marginLeft: 2,
  },

  // Badge
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '500',
  },

  // Empty state
  emptyState: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    paddingVertical: 40,
    alignItems: 'center',
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
});
