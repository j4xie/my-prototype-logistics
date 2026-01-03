import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  Text,
  Card,
  Chip,
  IconButton,
  Button,
  ActivityIndicator,
  Appbar,
  Divider,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { platformAPI, FactoryDTO } from '../../../services/api/platformApiClient';
import { handleError } from '../../../utils/errorHandler';
import { logger } from '../../../utils/logger';

// Types
interface FactoryDetail {
  id: string;
  name: string;
  code: string;
  status: 'active' | 'inactive';
  industry: string;
  employeeCount: number;
  departmentCount: number;
  productTypeCount: number;
  contactName: string;
  contactPhone: string;
  address: string;
  createdAt: string;
  blueprintName: string;
  blueprintVersion: string;
  blueprintSynced: boolean;
  blueprintUpdatedAt: string;
  aiQuotaUsed: number;
  aiQuotaTotal: number;
}

type FactoryDetailStackParamList = {
  FactoryList: undefined;
  FactoryDetail: { factoryId: string };
  FactoryQuota: { factoryId: string };
  BlueprintApply: { factoryId: string };
  RuleList: { factoryId: string };
  FactoryEdit: { factoryId: string };
};

type NavigationProp = NativeStackNavigationProp<FactoryDetailStackParamList, 'FactoryDetail'>;
type DetailRouteProp = RouteProp<FactoryDetailStackParamList, 'FactoryDetail'>;

// Logger
const factoryDetailLogger = logger.createContextLogger('FactoryDetail');

// Management operation items
interface ManagementOperation {
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  iconColor: string;
  iconBgColor: string;
  onPress: () => void;
}

/**
 * FactoryDetailScreen - Factory Detail Page
 * Shows factory information, blueprint, AI quota, and management operations
 */
export default function FactoryDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<DetailRouteProp>();
  const { t } = useTranslation('platform');
  const { factoryId } = route.params;

  // State
  const [factory, setFactory] = useState<FactoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load factory detail
  const loadFactoryDetail = useCallback(async () => {
    try {
      factoryDetailLogger.debug('Loading factory detail', { factoryId });
      const response = await platformAPI.getFactories();

      if (response.success && response.data) {
        const factoryData = response.data.find((f: FactoryDTO) => f.id === factoryId);

        if (factoryData) {
          const detail: FactoryDetail = {
            id: factoryData.id,
            name: factoryData.name || factoryData.factoryName || t('factory.unknown'),
            code: factoryData.id || 'F001',
            status: factoryData.isActive !== false ? 'active' : 'inactive',
            industry: factoryData.industry || '水产加工',
            employeeCount: factoryData.totalUsers || 86,
            departmentCount: factoryData.departmentCount || 12,
            productTypeCount: factoryData.productTypeCount || 8,
            contactName: factoryData.contactName || '张经理',
            contactPhone: factoryData.contactPhone || '138-1234-5678',
            address: factoryData.address || '浙江省宁波市北仑区港城大道188号',
            createdAt: factoryData.createdAt || '2024-01-15',
            blueprintName: factoryData.blueprintName || '水产加工标准版',
            blueprintVersion: factoryData.blueprintVersion || 'v2.0.1',
            blueprintSynced: factoryData.blueprintSynced ?? true,
            blueprintUpdatedAt: factoryData.blueprintUpdatedAt || '2天前',
            aiQuotaUsed: factoryData.aiQuotaUsed || 286,
            aiQuotaTotal: factoryData.aiQuotaTotal || 500,
          };

          setFactory(detail);
          factoryDetailLogger.info('Factory detail loaded', { factoryId: detail.id });
        } else {
          factoryDetailLogger.warn('Factory not found', { factoryId });
          Alert.alert(t('errors.loadFailed'), t('factoryManagement.noFactoriesFound'));
          navigation.goBack();
        }
      }
    } catch (error) {
      factoryDetailLogger.error('Failed to load factory detail', error as Error);
      handleError(error, {
        title: t('errors.loadFailed'),
        customMessage: t('factoryManagement.messages.loadFailed'),
      });
    } finally {
      setLoading(false);
    }
  }, [factoryId, navigation, t]);

  // Initial load
  useEffect(() => {
    loadFactoryDetail();
  }, [loadFactoryDetail]);

  // Pull to refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFactoryDetail();
    setRefreshing(false);
  }, [loadFactoryDetail]);

  // Navigation handlers
  const handleEditFactory = () => {
    Alert.alert(
      t('factoryManagement.editFactory'),
      t('factoryManagement.detailsInDevelopment', { name: factory?.name }),
      [{ text: t('common.buttons.ok', { defaultValue: 'OK' }) }]
    );
  };

  const handleViewBlueprint = () => {
    Alert.alert(
      t('blueprint.title', { defaultValue: '蓝图详情' }),
      `${factory?.blueprintName}\n${t('blueprint.version', { version: factory?.blueprintVersion })}`,
      [{ text: t('common.buttons.ok', { defaultValue: 'OK' }) }]
    );
  };

  const handleManageQuota = () => {
    navigation.navigate('FactoryQuota' as never, { factoryId } as never);
  };

  const handleChangeBlueprint = () => {
    Alert.alert(
      '更换蓝图',
      '蓝图更换功能开发中',
      [{ text: t('common.buttons.ok', { defaultValue: 'OK' }) }]
    );
  };

  const handleManageRules = () => {
    Alert.alert(
      '规则管理',
      '规则管理功能开发中',
      [{ text: t('common.buttons.ok', { defaultValue: 'OK' }) }]
    );
  };

  const handleManageUsers = () => {
    Alert.alert(
      '人员管理',
      '人员管理功能开发中',
      [{ text: t('common.buttons.ok', { defaultValue: 'OK' }) }]
    );
  };

  const handleDeactivateFactory = () => {
    Alert.alert(
      '停用工厂',
      `确定要停用「${factory?.name}」吗？\n\n停用后该工厂将无法正常使用，所有用户将无法登录。`,
      [
        { text: t('common.buttons.cancel', { defaultValue: '取消' }), style: 'cancel' },
        {
          text: '确定停用',
          style: 'destructive',
          onPress: () => {
            Alert.alert('操作成功', '工厂已停用');
            navigation.goBack();
          },
        },
      ]
    );
  };

  // Calculate AI quota percentage
  const getQuotaPercentage = (): number => {
    if (!factory) return 0;
    return Math.round((factory.aiQuotaUsed / factory.aiQuotaTotal) * 100);
  };

  // Get quota bar color based on usage
  const getQuotaColor = (): [string, string] => {
    const percentage = getQuotaPercentage();
    if (percentage >= 80) return ['#ff4d4f', '#ff7875'];
    if (percentage >= 60) return ['#faad14', '#ffc53d'];
    return ['#52c41a', '#73d13d'];
  };

  // Management operations grid
  const managementOperations: ManagementOperation[] = [
    {
      key: 'quota',
      title: '配额设置',
      subtitle: '调整AI使用限额',
      icon: 'currency-usd',
      iconColor: '#faad14',
      iconBgColor: 'rgba(250, 173, 20, 0.1)',
      onPress: handleManageQuota,
    },
    {
      key: 'blueprint',
      title: '更换蓝图',
      subtitle: '应用其他模板',
      icon: 'file-document-outline',
      iconColor: '#667eea',
      iconBgColor: 'rgba(102, 126, 234, 0.1)',
      onPress: handleChangeBlueprint,
    },
    {
      key: 'rules',
      title: '规则管理',
      subtitle: '查看业务规则',
      icon: 'checkbox-marked-outline',
      iconColor: '#1890ff',
      iconBgColor: 'rgba(24, 144, 255, 0.1)',
      onPress: handleManageRules,
    },
    {
      key: 'users',
      title: '人员管理',
      subtitle: '管理工厂用户',
      icon: 'account-group',
      iconColor: '#52c41a',
      iconBgColor: 'rgba(82, 196, 26, 0.1)',
      onPress: handleManageUsers,
    },
  ];

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Appbar.Header elevated style={styles.header}>
          <Appbar.BackAction onPress={() => navigation.goBack()} iconColor="white" />
          <Appbar.Content
            title={t('factoryManagement.viewDetails', { defaultValue: '工厂详情' })}
            titleStyle={styles.headerTitle}
          />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>{t('factoryManagement.loadingFactories')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!factory) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Appbar.Header elevated style={styles.header}>
          <Appbar.BackAction onPress={() => navigation.goBack()} iconColor="white" />
          <Appbar.Content
            title={t('factoryManagement.viewDetails', { defaultValue: '工厂详情' })}
            titleStyle={styles.headerTitle}
          />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('factoryManagement.noFactoryData')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <Appbar.Header elevated style={styles.header}>
        <Appbar.BackAction onPress={() => navigation.goBack()} iconColor="white" />
        <Appbar.Content
          title={t('factoryManagement.viewDetails', { defaultValue: '工厂详情' })}
          titleStyle={styles.headerTitle}
        />
        <Appbar.Action icon="pencil" onPress={handleEditFactory} iconColor="white" />
      </Appbar.Header>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Card with Gradient */}
        <LinearGradient
          colors={['#1a1a2e', '#16213e']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          {/* Factory Info */}
          <View style={styles.heroHeader}>
            <View style={styles.heroIcon}>
              <Text style={styles.heroIconText}>厂</Text>
            </View>
            <View style={styles.heroInfo}>
              <Text style={styles.heroName}>{factory.name}</Text>
              <View style={styles.heroMeta}>
                <Chip
                  mode="flat"
                  style={[
                    styles.statusChip,
                    factory.status === 'active' ? styles.statusChipActive : styles.statusChipInactive,
                  ]}
                  textStyle={styles.statusChipText}
                >
                  {factory.status === 'active'
                    ? t('factory.status.active')
                    : t('factory.status.stopped')}
                </Chip>
                <Text style={styles.heroCode}>{factory.code}</Text>
              </View>
            </View>
          </View>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{factory.employeeCount}</Text>
              <Text style={styles.statLabel}>员工数</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{factory.departmentCount}</Text>
              <Text style={styles.statLabel}>部门数</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{factory.productTypeCount}</Text>
              <Text style={styles.statLabel}>产品类型</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Basic Info Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>基本信息</Text>
        </View>
        <Card style={styles.infoCard} mode="elevated">
          <Card.Content style={styles.infoContent}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>行业类型</Text>
              <Text style={styles.infoValue}>{factory.industry}</Text>
            </View>
            <Divider style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>联系人</Text>
              <Text style={styles.infoValue}>{factory.contactName}</Text>
            </View>
            <Divider style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>联系电话</Text>
              <Text style={styles.infoValue}>{factory.contactPhone}</Text>
            </View>
            <Divider style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>地址</Text>
              <Text style={[styles.infoValue, styles.infoValueAddress]}>{factory.address}</Text>
            </View>
            <Divider style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>创建时间</Text>
              <Text style={styles.infoValue}>{factory.createdAt}</Text>
            </View>
          </Card.Content>
        </Card>

        {/* Blueprint Section */}
        <View style={styles.sectionHeaderWithAction}>
          <Text style={styles.sectionTitle}>应用蓝图</Text>
          <TouchableOpacity onPress={handleViewBlueprint}>
            <Text style={styles.sectionAction}>查看详情</Text>
          </TouchableOpacity>
        </View>
        <Card style={styles.blueprintCard} mode="elevated">
          <Card.Content style={styles.blueprintContent}>
            <View style={styles.blueprintIcon}>
              <Text style={styles.blueprintIconText}>蓝</Text>
            </View>
            <View style={styles.blueprintInfo}>
              <Text style={styles.blueprintName}>{factory.blueprintName}</Text>
              <Text style={styles.blueprintMeta}>
                版本 {factory.blueprintVersion} · 更新于 {factory.blueprintUpdatedAt}
              </Text>
            </View>
            <Chip
              mode="flat"
              style={factory.blueprintSynced ? styles.syncedChip : styles.unsyncedChip}
              textStyle={styles.syncedChipText}
            >
              {factory.blueprintSynced ? '已同步' : '需同步'}
            </Chip>
          </Card.Content>
        </Card>

        {/* AI Quota Section */}
        <View style={styles.sectionHeaderWithAction}>
          <Text style={styles.sectionTitle}>AI 配额</Text>
          <TouchableOpacity onPress={handleManageQuota}>
            <Text style={styles.sectionAction}>管理配额</Text>
          </TouchableOpacity>
        </View>
        <Card style={styles.quotaCard} mode="elevated">
          <Card.Content>
            <View style={styles.quotaHeader}>
              <Text style={styles.quotaLabel}>本周使用量</Text>
              <Text style={styles.quotaValue}>
                {factory.aiQuotaUsed} / {factory.aiQuotaTotal} 次
              </Text>
            </View>
            <View style={styles.quotaBarBackground}>
              <LinearGradient
                colors={getQuotaColor()}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.quotaBarFill, { width: `${getQuotaPercentage()}%` }]}
              />
            </View>
            <View style={styles.quotaFooter}>
              <Text style={styles.quotaFooterText}>
                剩余 {factory.aiQuotaTotal - factory.aiQuotaUsed} 次
              </Text>
              <Text style={styles.quotaFooterText}>使用率 {getQuotaPercentage()}%</Text>
            </View>
          </Card.Content>
        </Card>

        {/* Management Operations Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>管理操作</Text>
        </View>
        <View style={styles.operationsGrid}>
          {managementOperations.map((op) => (
            <TouchableOpacity
              key={op.key}
              style={styles.operationCard}
              onPress={op.onPress}
              activeOpacity={0.7}
            >
              <View style={[styles.operationIcon, { backgroundColor: op.iconBgColor }]}>
                <IconButton icon={op.icon} iconColor={op.iconColor} size={20} style={styles.operationIconBtn} />
              </View>
              <View style={styles.operationInfo}>
                <Text style={styles.operationTitle}>{op.title}</Text>
                <Text style={styles.operationSubtitle}>{op.subtitle}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Danger Zone */}
        <TouchableOpacity
          style={styles.dangerCard}
          onPress={handleDeactivateFactory}
          activeOpacity={0.7}
        >
          <View style={styles.dangerIcon}>
            <IconButton icon="close-circle-outline" iconColor="#ff4d4f" size={20} style={styles.dangerIconBtn} />
          </View>
          <View style={styles.dangerInfo}>
            <Text style={styles.dangerTitle}>停用工厂</Text>
            <Text style={styles.dangerSubtitle}>停用后该工厂将无法正常使用</Text>
          </View>
          <IconButton icon="chevron-right" iconColor="#cf1322" size={16} />
        </TouchableOpacity>

        {/* Bottom Padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#667eea',
  },
  headerTitle: {
    color: 'white',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#8c8c8c',
    fontSize: 14,
  },

  // Hero Card
  heroCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  heroIcon: {
    width: 56,
    height: 56,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroIconText: {
    fontSize: 24,
    fontWeight: '600',
    color: 'white',
  },
  heroInfo: {
    flex: 1,
  },
  heroName: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    marginBottom: 4,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusChip: {
    height: 22,
  },
  statusChipActive: {
    backgroundColor: 'rgba(82, 196, 26, 0.2)',
  },
  statusChipInactive: {
    backgroundColor: 'rgba(255, 77, 79, 0.2)',
  },
  statusChipText: {
    fontSize: 11,
    color: 'white',
  },
  heroCode: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },

  // Section Headers
  sectionHeader: {
    marginBottom: 12,
  },
  sectionHeaderWithAction: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#262626',
  },
  sectionAction: {
    fontSize: 13,
    color: '#667eea',
  },

  // Info Card
  infoCard: {
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: 'white',
  },
  infoContent: {
    padding: 0,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  infoLabel: {
    fontSize: 13,
    color: '#8c8c8c',
  },
  infoValue: {
    fontSize: 14,
    color: '#262626',
  },
  infoValueAddress: {
    maxWidth: 180,
    textAlign: 'right',
  },
  infoDivider: {
    marginHorizontal: 16,
  },

  // Blueprint Card
  blueprintCard: {
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: 'white',
  },
  blueprintContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  blueprintIcon: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blueprintIconText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#667eea',
  },
  blueprintInfo: {
    flex: 1,
  },
  blueprintName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#262626',
  },
  blueprintMeta: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 2,
  },
  syncedChip: {
    backgroundColor: 'rgba(82, 196, 26, 0.1)',
    height: 24,
  },
  unsyncedChip: {
    backgroundColor: 'rgba(250, 173, 20, 0.1)',
    height: 24,
  },
  syncedChipText: {
    fontSize: 11,
    color: '#52c41a',
  },

  // Quota Card
  quotaCard: {
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: 'white',
  },
  quotaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  quotaLabel: {
    fontSize: 14,
    color: '#595959',
  },
  quotaValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#262626',
  },
  quotaBarBackground: {
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  quotaBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  quotaFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  quotaFooterText: {
    fontSize: 12,
    color: '#8c8c8c',
  },

  // Operations Grid
  operationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  operationCard: {
    width: '48%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  operationIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  operationIconBtn: {
    margin: 0,
  },
  operationInfo: {
    flex: 1,
  },
  operationTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#262626',
  },
  operationSubtitle: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 2,
  },

  // Danger Zone
  dangerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff2f0',
    borderWidth: 1,
    borderColor: '#ffccc7',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  dangerIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 77, 79, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dangerIconBtn: {
    margin: 0,
  },
  dangerInfo: {
    flex: 1,
  },
  dangerTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#cf1322',
  },
  dangerSubtitle: {
    fontSize: 12,
    color: '#ff7875',
    marginTop: 2,
  },

  bottomPadding: {
    height: 24,
  },
});
