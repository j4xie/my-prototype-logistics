/**
 * 电子秤品牌型号列表界面 (平台管理员)
 * 管理所有电子秤品牌和型号配置
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  FlatList,
  TextInput,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon } from 'react-native-paper';
import scaleApiClient, {
  ScaleBrandModel,
  ScaleType,
  BrandInfo,
} from '../../../services/api/scaleApiClient';

type StackParamList = {
  ScaleBrandModelList: undefined;
  ScaleBrandModelDetail: { modelId: string; isNew?: boolean };
};

type NavigationProp = NativeStackNavigationProp<StackParamList, 'ScaleBrandModelList'>;

const SCALE_TYPES: { value: ScaleType | 'all'; label: string; icon: string }[] = [
  { value: 'all', label: '全部', icon: 'scale' },
  { value: 'DESKTOP', label: '桌面秤', icon: 'monitor' },
  { value: 'PLATFORM', label: '台秤', icon: 'table' },
  { value: 'FLOOR', label: '地磅', icon: 'floor-plan' },
];

export function ScaleBrandModelListScreen() {
  const navigation = useNavigation<NavigationProp>();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [brandModels, setBrandModels] = useState<ScaleBrandModel[]>([]);
  const [brands, setBrands] = useState<BrandInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [selectedScaleType, setSelectedScaleType] = useState<ScaleType | 'all'>('all');

  const loadBrands = useCallback(async () => {
    try {
      const data = await scaleApiClient.getBrands();
      setBrands(data);
    } catch (err) {
      console.error('加载品牌列表失败:', err);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const params: Parameters<typeof scaleApiClient.getBrandModels>[0] = {};
      if (selectedBrand !== 'all') {
        params.brandCode = selectedBrand;
      }
      if (selectedScaleType !== 'all') {
        params.scaleType = selectedScaleType;
      }
      if (searchKeyword) {
        params.keyword = searchKeyword;
      }
      const data = await scaleApiClient.getBrandModels(params);
      setBrandModels(data);
    } catch (err) {
      console.error('加载品牌型号列表失败:', err);
      setError('加载品牌型号列表失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchKeyword, selectedBrand, selectedScaleType]);

  useEffect(() => {
    loadBrands();
  }, [loadBrands]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const getScaleTypeLabel = (type?: ScaleType): string => {
    switch (type) {
      case 'DESKTOP':
        return '桌面秤';
      case 'PLATFORM':
        return '台秤';
      case 'FLOOR':
        return '地磅';
      default:
        return '未知';
    }
  };

  const getScaleTypeColor = (type?: ScaleType): string => {
    switch (type) {
      case 'DESKTOP':
        return '#3182ce';
      case 'PLATFORM':
        return '#38a169';
      case 'FLOOR':
        return '#d69e2e';
      default:
        return '#718096';
    }
  };

  const renderInterfaceIcons = (item: ScaleBrandModel) => {
    const interfaces: { key: keyof ScaleBrandModel; icon: string; label: string }[] = [
      { key: 'hasSerialPort', icon: 'serial-port', label: '串口' },
      { key: 'hasWifi', icon: 'wifi', label: 'WiFi' },
      { key: 'hasEthernet', icon: 'ethernet', label: '以太网' },
      { key: 'hasBluetooth', icon: 'bluetooth', label: '蓝牙' },
      { key: 'hasUsb', icon: 'usb', label: 'USB' },
    ];

    return (
      <View style={styles.interfaceRow}>
        {interfaces.map(
          ({ key, icon, label }) =>
            item[key] && (
              <View key={key} style={styles.interfaceIcon}>
                <Icon source={icon} size={14} color="#4a5568" />
              </View>
            )
        )}
      </View>
    );
  };

  const renderBrandModelItem = ({ item }: { item: ScaleBrandModel }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('ScaleBrandModelDetail', { modelId: item.id })}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardInfo}>
          <Icon source="scale-balance" size={24} color="#3182ce" />
          <View style={styles.cardTextInfo}>
            <Text style={styles.brandName}>{item.brandName}</Text>
            <Text style={styles.modelCode}>{item.modelCode}</Text>
          </View>
        </View>
        <View style={styles.cardBadges}>
          {item.isRecommended && (
            <View style={[styles.badge, styles.badgeRecommended]}>
              <Icon source="star" size={10} color="#fff" />
              <Text style={styles.badgeText}>推荐</Text>
            </View>
          )}
          {item.isVerified && (
            <View style={[styles.badge, styles.badgeVerified]}>
              <Icon source="check-decagram" size={10} color="#fff" />
              <Text style={styles.badgeText}>已验证</Text>
            </View>
          )}
          <View style={[styles.badge, { backgroundColor: getScaleTypeColor(item.scaleType) }]}>
            <Text style={styles.badgeText}>{getScaleTypeLabel(item.scaleType)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.cardDetails}>
        {item.weightRange && (
          <View style={styles.detailRow}>
            <Icon source="weight" size={16} color="#718096" />
            <Text style={styles.detailLabel}>量程:</Text>
            <Text style={styles.detailText}>{item.weightRange}</Text>
          </View>
        )}
        {item.accuracy && (
          <View style={styles.detailRow}>
            <Icon source="target" size={16} color="#718096" />
            <Text style={styles.detailLabel}>精度:</Text>
            <Text style={styles.detailText}>{item.accuracy}</Text>
          </View>
        )}
        <View style={styles.detailRow}>
          <Icon source="connection" size={16} color="#718096" />
          <Text style={styles.detailLabel}>接口:</Text>
          {renderInterfaceIcons(item)}
        </View>
      </View>

      {item.manufacturer && (
        <View style={styles.manufacturerRow}>
          <Icon source="factory" size={14} color="#a0aec0" />
          <Text style={styles.manufacturerText}>{item.manufacturer}</Text>
        </View>
      )}

      {item.description && (
        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>
      )}

      <View style={styles.cardFooter}>
        <TouchableOpacity
          style={styles.footerButton}
          onPress={() => navigation.navigate('ScaleBrandModelDetail', { modelId: item.id })}
        >
          <Icon source="eye" size={16} color="#3182ce" />
          <Text style={styles.footerButtonText}>查看详情</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const BrandFilterChips = () => (
    <View style={styles.filterContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <TouchableOpacity
          style={[styles.filterChip, selectedBrand === 'all' && styles.filterChipActive]}
          onPress={() => setSelectedBrand('all')}
        >
          <Text style={[styles.filterChipText, selectedBrand === 'all' && styles.filterChipTextActive]}>
            全部品牌
          </Text>
        </TouchableOpacity>
        {brands.map(brand => (
          <TouchableOpacity
            key={brand.brandCode}
            style={[styles.filterChip, selectedBrand === brand.brandCode && styles.filterChipActive]}
            onPress={() => setSelectedBrand(brand.brandCode)}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedBrand === brand.brandCode && styles.filterChipTextActive,
              ]}
            >
              {brand.brandName}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const ScaleTypeFilterChips = () => (
    <View style={styles.scaleTypeContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {SCALE_TYPES.map(type => (
          <TouchableOpacity
            key={type.value}
            style={[styles.scaleTypeChip, selectedScaleType === type.value && styles.scaleTypeChipActive]}
            onPress={() => setSelectedScaleType(type.value)}
          >
            <Icon
              source={type.icon}
              size={14}
              color={selectedScaleType === type.value ? '#fff' : '#4a5568'}
            />
            <Text
              style={[
                styles.scaleTypeChipText,
                selectedScaleType === type.value && styles.scaleTypeChipTextActive,
              ]}
            >
              {type.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3182ce" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* 搜索框 */}
      <View style={styles.searchContainer}>
        <Icon source="magnify" size={20} color="#718096" />
        <TextInput
          style={styles.searchInput}
          placeholder="搜索品牌或型号..."
          value={searchKeyword}
          onChangeText={setSearchKeyword}
          returnKeyType="search"
        />
        {searchKeyword.length > 0 && (
          <TouchableOpacity onPress={() => setSearchKeyword('')}>
            <Icon source="close-circle" size={20} color="#718096" />
          </TouchableOpacity>
        )}
      </View>

      {/* 品牌筛选 */}
      <BrandFilterChips />

      {/* 秤类型筛选 */}
      <ScaleTypeFilterChips />

      {/* 品牌型号列表 */}
      {error ? (
        <View style={styles.errorContainer}>
          <Icon source="alert-circle" size={48} color="#e53e3e" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadData}>
            <Text style={styles.retryButtonText}>重试</Text>
          </TouchableOpacity>
        </View>
      ) : brandModels.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon source="scale-balance" size={64} color="#a0aec0" />
          <Text style={styles.emptyTitle}>暂无品牌型号</Text>
          <Text style={styles.emptySubtitle}>点击右下角按钮添加新品牌型号</Text>
        </View>
      ) : (
        <FlatList
          data={brandModels}
          renderItem={renderBrandModelItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3182ce']} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* 添加按钮 */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('ScaleBrandModelDetail', { modelId: '', isNew: true })}
        activeOpacity={0.8}
      >
        <Icon source="plus" size={24} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#718096',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    height: 44,
    marginLeft: 8,
    fontSize: 15,
    color: '#2d3748',
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#edf2f7',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#3182ce',
  },
  filterChipText: {
    fontSize: 13,
    color: '#4a5568',
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  scaleTypeContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  scaleTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#e2e8f0',
    marginRight: 8,
    gap: 4,
  },
  scaleTypeChipActive: {
    backgroundColor: '#3182ce',
  },
  scaleTypeChipText: {
    fontSize: 12,
    color: '#4a5568',
  },
  scaleTypeChipTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardTextInfo: {
    marginLeft: 12,
    flex: 1,
  },
  brandName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
  },
  modelCode: {
    fontSize: 14,
    color: '#3182ce',
    marginTop: 2,
    fontWeight: '500',
  },
  cardBadges: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    maxWidth: 140,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 2,
  },
  badgeRecommended: {
    backgroundColor: '#ed8936',
  },
  badgeVerified: {
    backgroundColor: '#48bb78',
  },
  badgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '500',
  },
  cardDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailLabel: {
    fontSize: 13,
    color: '#718096',
    width: 40,
  },
  detailText: {
    fontSize: 13,
    color: '#2d3748',
    fontWeight: '500',
  },
  interfaceRow: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 4,
  },
  interfaceIcon: {
    backgroundColor: '#edf2f7',
    borderRadius: 4,
    padding: 4,
  },
  manufacturerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  manufacturerText: {
    fontSize: 12,
    color: '#a0aec0',
  },
  description: {
    fontSize: 13,
    color: '#718096',
    marginBottom: 12,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#edf2f7',
    gap: 16,
  },
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerButtonText: {
    fontSize: 13,
    color: '#3182ce',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 15,
    color: '#718096',
    marginTop: 12,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#3182ce',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4a5568',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#718096',
    marginTop: 8,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3182ce',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3182ce',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
});

export default ScaleBrandModelListScreen;
