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
  FAB,
  Searchbar,
  IconButton,
  ActivityIndicator,
  Appbar,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { platformAPI, FactoryDTO } from '../../../services/api/platformApiClient';
import { handleError } from '../../../utils/errorHandler';
import { logger } from '../../../utils/logger';

// Types
interface Factory {
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
  blueprintName?: string;
  blueprintVersion?: string;
  blueprintSynced?: boolean;
  aiQuotaUsed?: number;
  aiQuotaTotal?: number;
}

type StatusFilter = 'all' | 'active' | 'inactive';
type IndustryFilter = string | null;

type FactoryListStackParamList = {
  FactoryList: undefined;
  FactoryDetail: { factoryId: string };
  FactoryAIQuick: undefined;
};

type NavigationProp = NativeStackNavigationProp<FactoryListStackParamList, 'FactoryList'>;

// Logger
const factoryListLogger = logger.createContextLogger('FactoryList');

// Industry types for filter chips
const INDUSTRY_TYPES = [
  { key: 'seafood', label: '水产加工' },
  { key: 'frozen', label: '速冻食品' },
  { key: 'meat', label: '肉类加工' },
];

/**
 * FactoryListScreen - Platform Admin Factory List
 * Displays all factories with search, filter, and navigation to details
 */
export default function FactoryListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation('platform');

  // State
  const [factories, setFactories] = useState<Factory[]>([]);
  const [filteredFactories, setFilteredFactories] = useState<Factory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [industryFilter, setIndustryFilter] = useState<IndustryFilter>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load factories
  const loadFactories = useCallback(async () => {
    try {
      factoryListLogger.debug('Loading factory list');
      const response = await platformAPI.getFactories();

      if (response.success && response.data) {
        const mappedFactories: Factory[] = response.data.map((factory: FactoryDTO, index: number) => {
          const createdAtStr = factory.createdAt ?? new Date().toISOString().split('T')[0]!;
          return {
            id: factory.id,
            name: factory.name || factory.factoryName || t('factory.unknown'),
            code: factory.id || `F${String(index + 1).padStart(3, '0')}`,
            status: factory.isActive !== false ? 'active' : 'inactive',
            industry: getIndustryFromFactory(factory),
            employeeCount: factory.totalUsers || 0,
            departmentCount: factory.departmentCount || 12,
            productTypeCount: factory.productTypeCount || 8,
            contactName: factory.contactName || '',
            contactPhone: factory.contactPhone || '',
            address: factory.address || '',
            createdAt: createdAtStr,
            blueprintName: factory.blueprintName,
            blueprintVersion: factory.blueprintVersion,
            blueprintSynced: factory.blueprintSynced ?? true,
            aiQuotaUsed: factory.aiQuotaUsed || 286,
            aiQuotaTotal: factory.aiQuotaTotal || 500,
          };
        });

        setFactories(mappedFactories);
        factoryListLogger.info('Factory list loaded', { count: mappedFactories.length });
      } else {
        setFactories([]);
        factoryListLogger.warn('Empty factory list returned');
      }
    } catch (error) {
      factoryListLogger.error('Failed to load factories', error as Error);
      handleError(error, {
        title: t('errors.loadFailed'),
        customMessage: t('factoryManagement.messages.loadFailed'),
      });
      setFactories([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Get industry type from factory data
  const getIndustryFromFactory = (factory: FactoryDTO): string => {
    if (factory.industry) return factory.industry;
    // Default based on name or random assignment for demo
    if (factory.name?.includes('海鲜') || factory.name?.includes('水产')) return '水产加工';
    if (factory.name?.includes('速冻')) return '速冻食品';
    if (factory.name?.includes('肉')) return '肉类加工';
    return '水产加工';
  };

  // Filter factories based on search and filters
  useEffect(() => {
    let result = [...factories];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (factory) =>
          factory.name.toLowerCase().includes(query) ||
          factory.code.toLowerCase().includes(query) ||
          factory.address.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((factory) => factory.status === statusFilter);
    }

    // Industry filter
    if (industryFilter) {
      result = result.filter((factory) => factory.industry === industryFilter);
    }

    setFilteredFactories(result);
  }, [factories, searchQuery, statusFilter, industryFilter]);

  // Initial load
  useEffect(() => {
    loadFactories();
  }, [loadFactories]);

  // Pull to refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFactories();
    setRefreshing(false);
  }, [loadFactories]);

  // Navigate to factory detail
  const handleFactoryPress = (factory: Factory) => {
    navigation.navigate('FactoryDetail', { factoryId: factory.id });
  };

  // Navigate to AI Quick setup
  const handleAddFactory = () => {
    // Navigate to FactoryAIQuick or show add factory dialog
    Alert.alert(
      t('factoryManagement.addFactory'),
      t('factoryManagement.detailsInDevelopment', { name: 'AI' }),
      [{ text: t('common.buttons.ok', { defaultValue: 'OK' }) }]
    );
  };

  // Get counts for filter chips
  const getStatusCount = (status: StatusFilter): number => {
    if (status === 'all') return factories.length;
    return factories.filter((f) => f.status === status).length;
  };

  // Render factory item
  const renderFactoryItem = (factory: Factory) => {
    const isInactive = factory.status === 'inactive';

    return (
      <TouchableOpacity
        key={factory.id}
        style={styles.factoryItem}
        onPress={() => handleFactoryPress(factory)}
        activeOpacity={0.7}
      >
        {/* Factory Icon */}
        <View
          style={[
            styles.factoryIcon,
            isInactive && styles.factoryIconInactive,
          ]}
        >
          <Text style={[styles.factoryIconText, isInactive && styles.factoryIconTextInactive]}>
            厂
          </Text>
        </View>

        {/* Factory Content */}
        <View style={styles.factoryContent}>
          <Text
            style={[styles.factoryName, isInactive && styles.factoryNameInactive]}
            numberOfLines={1}
          >
            {factory.name}
          </Text>

          <View style={styles.factoryMeta}>
            {/* Status */}
            <View style={styles.statusContainer}>
              <View
                style={[
                  styles.statusDot,
                  factory.status === 'active' ? styles.statusDotActive : styles.statusDotInactive,
                ]}
              />
              <Text style={styles.statusText}>
                {factory.status === 'active'
                  ? t('factory.status.active')
                  : t('factory.status.stopped')}
              </Text>
            </View>

            {/* Industry Tag */}
            <Text style={styles.industryText}>{factory.industry}</Text>

            {/* Employee Count */}
            <Text style={styles.employeeText}>{factory.employeeCount}人</Text>
          </View>

          {/* Code and Date */}
          <Text style={[styles.factorySubInfo, isInactive && styles.factorySubInfoInactive]}>
            {factory.code} · {isInactive ? '停用于' : '创建于'} {factory.createdAt}
          </Text>
        </View>

        {/* Arrow */}
        <IconButton
          icon="chevron-right"
          size={16}
          iconColor="#bfbfbf"
          style={styles.arrowIcon}
        />
      </TouchableOpacity>
    );
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Appbar.Header elevated>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title={t('factoryManagement.title', { defaultValue: '全部工厂' })} />
          <Appbar.Action icon="plus" onPress={handleAddFactory} />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>{t('factoryManagement.loadingFactories')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <Appbar.Header elevated style={styles.header}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={t('factoryManagement.title', { defaultValue: '全部工厂' })} />
        <Appbar.Action icon="plus" onPress={handleAddFactory} />
      </Appbar.Header>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Search Box */}
        <Searchbar
          placeholder={t('factoryManagement.searchPlaceholder', { defaultValue: '搜索工厂名称、编号、地址...' })}
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
          inputStyle={styles.searchInput}
        />

        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterContainer}
          contentContainerStyle={styles.filterContent}
        >
          {/* Status Filters */}
          <Chip
            mode={statusFilter === 'all' ? 'flat' : 'outlined'}
            selected={statusFilter === 'all'}
            onPress={() => setStatusFilter('all')}
            style={[styles.filterChip, statusFilter === 'all' && styles.filterChipActive]}
            textStyle={statusFilter === 'all' ? styles.filterChipTextActive : styles.filterChipText}
          >
            全部 ({getStatusCount('all')})
          </Chip>
          <Chip
            mode={statusFilter === 'active' ? 'flat' : 'outlined'}
            selected={statusFilter === 'active'}
            onPress={() => setStatusFilter('active')}
            style={[styles.filterChip, statusFilter === 'active' && styles.filterChipActive]}
            textStyle={statusFilter === 'active' ? styles.filterChipTextActive : styles.filterChipText}
          >
            {t('factory.status.active')} ({getStatusCount('active')})
          </Chip>
          <Chip
            mode={statusFilter === 'inactive' ? 'flat' : 'outlined'}
            selected={statusFilter === 'inactive'}
            onPress={() => setStatusFilter('inactive')}
            style={[styles.filterChip, statusFilter === 'inactive' && styles.filterChipActive]}
            textStyle={statusFilter === 'inactive' ? styles.filterChipTextActive : styles.filterChipText}
          >
            {t('factory.status.stopped')} ({getStatusCount('inactive')})
          </Chip>

          {/* Industry Filters */}
          {INDUSTRY_TYPES.map((industry) => (
            <Chip
              key={industry.key}
              mode={industryFilter === industry.label ? 'flat' : 'outlined'}
              selected={industryFilter === industry.label}
              onPress={() =>
                setIndustryFilter(industryFilter === industry.label ? null : industry.label)
              }
              style={[
                styles.filterChip,
                industryFilter === industry.label && styles.filterChipActive,
              ]}
              textStyle={
                industryFilter === industry.label
                  ? styles.filterChipTextActive
                  : styles.filterChipText
              }
            >
              {industry.label}
            </Chip>
          ))}
        </ScrollView>

        {/* Sort and Count */}
        <View style={styles.sortContainer}>
          <Text style={styles.countText}>共 {filteredFactories.length} 家工厂</Text>
          <TouchableOpacity style={styles.sortButton}>
            <Text style={styles.sortText}>按创建时间</Text>
            <IconButton icon="chevron-down" size={14} iconColor="#595959" style={styles.sortIcon} />
          </TouchableOpacity>
        </View>

        {/* Factory List */}
        {filteredFactories.length === 0 ? (
          <Card style={styles.emptyCard} mode="elevated">
            <Card.Content>
              <Text style={styles.emptyText}>
                {searchQuery || statusFilter !== 'all' || industryFilter
                  ? t('factoryManagement.noFactoriesFound')
                  : t('factoryManagement.noFactoryData')}
              </Text>
            </Card.Content>
          </Card>
        ) : (
          filteredFactories.map(renderFactoryItem)
        )}

        {/* Load More */}
        {filteredFactories.length >= 5 && (
          <TouchableOpacity style={styles.loadMore}>
            <Text style={styles.loadMoreText}>加载更多...</Text>
          </TouchableOpacity>
        )}

        {/* Bottom Padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* FAB */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={handleAddFactory}
        color="white"
      />
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
  searchBar: {
    marginBottom: 12,
    backgroundColor: 'white',
    borderRadius: 8,
    elevation: 0,
  },
  searchInput: {
    fontSize: 14,
  },
  filterContainer: {
    marginBottom: 16,
  },
  filterContent: {
    gap: 8,
    paddingRight: 16,
  },
  filterChip: {
    backgroundColor: 'white',
    borderColor: '#e0e0e0',
  },
  filterChipActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  filterChipText: {
    color: '#595959',
    fontSize: 12,
  },
  filterChipTextActive: {
    color: 'white',
    fontSize: 12,
  },
  sortContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  countText: {
    fontSize: 13,
    color: '#8c8c8c',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortText: {
    fontSize: 13,
    color: '#595959',
  },
  sortIcon: {
    margin: 0,
    marginLeft: -8,
  },
  factoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  factoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  factoryIconInactive: {
    backgroundColor: '#f5f5f5',
  },
  factoryIconText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  factoryIconTextInactive: {
    color: '#8c8c8c',
  },
  factoryContent: {
    flex: 1,
  },
  factoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#262626',
    marginBottom: 6,
  },
  factoryNameInactive: {
    color: '#8c8c8c',
  },
  factoryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotActive: {
    backgroundColor: '#52c41a',
  },
  statusDotInactive: {
    backgroundColor: '#ff4d4f',
  },
  statusText: {
    fontSize: 12,
    color: '#595959',
  },
  industryText: {
    fontSize: 12,
    color: '#595959',
  },
  employeeText: {
    fontSize: 12,
    color: '#595959',
  },
  factorySubInfo: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 4,
  },
  factorySubInfoInactive: {
    color: '#bfbfbf',
  },
  arrowIcon: {
    margin: 0,
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: '#8c8c8c',
    fontSize: 14,
  },
  loadMore: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  loadMoreText: {
    fontSize: 13,
    color: '#667eea',
  },
  bottomPadding: {
    height: 80,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 80,
    backgroundColor: '#667eea',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
});
