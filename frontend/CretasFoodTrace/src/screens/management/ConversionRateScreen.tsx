import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, Alert, RefreshControl } from 'react-native';
import {
  Text,
  Appbar,
  Card,
  List,
  ActivityIndicator,
  Surface,
  Divider,
  Chip,
  IconButton,
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { materialTypeApiClient } from '../../services/api/materialTypeApiClient';
import { conversionApiClient } from '../../services/api/conversionApiClient';
import { useAuthStore } from '../../store/authStore';
import { getFactoryId } from '../../types/auth';
import { ManagementStackParamList } from '../../types/navigation';
import { logger } from '../../utils/logger';

// 创建ConversionRate专用logger
const conversionLogger = logger.createContextLogger('ConversionRate');

type NavigationProp = NativeStackNavigationProp<ManagementStackParamList, 'ConversionRate'>;

interface MaterialType {
  id: string;
  name: string;
  category?: string;
  unit: string;
}

interface ConversionRate {
  id?: string;
  materialTypeId: string;
  productTypeId: string;
  conversionRate: number;
  wastageRate?: number;
  notes?: string;
}

interface MaterialWithStats extends MaterialType {
  configuredCount: number;
  avgConversionRate?: number;
  avgWastageRate?: number;
}

/**
 * 转换率配置页面 - 原料卡片列表视图
 *
 * 设计思路：
 * - 以原料为中心展示（不是矩阵）
 * - 每个原料显示为一张卡片
 * - 点击卡片进入详情页查看/配置该原料的所有转换率
 */
export default function ConversionRateScreen() {
  const navigation = useNavigation<NavigationProp>();
  const user = useAuthStore((state) => state.user);
  const factoryId = getFactoryId(user);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [materials, setMaterials] = useState<MaterialWithStats[]>([]);
  const [totalConfigured, setTotalConfigured] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);

  /**
   * 加载数据
   */
  const loadData = async () => {
    try {
      if (!factoryId) {
        conversionLogger.warn('工厂ID不存在，无法加载转换率数据');
        Alert.alert('错误', '无法获取工厂信息，请重新登录');
        return;
      }

      conversionLogger.info('加载转换率配置数据', { factoryId });

      // 并行加载原料和转换率数据
      const [materialsRes, conversionsRes] = await Promise.all([
        materialTypeApiClient.getMaterialTypes({ factoryId }),
        conversionApiClient.getConversionRates({ factoryId }),
      ]);

      // 处理原料类型数据
      let materialsArray: MaterialType[] = [];
      if (materialsRes && 'data' in materialsRes && materialsRes.data) {
        const materialsData = materialsRes.data as unknown;
        materialsArray = Array.isArray(materialsData)
          ? materialsData
          : ((materialsData as { content?: MaterialType[] })?.content ?? []);
        materialsArray = materialsArray.map((item: MaterialType) => ({
          id: item.id,
          name: item.name,
          category: item.category ?? undefined,
          unit: item.unit ?? 'kg',
        }));
      }

      // 处理转换率数据
      let conversionsArray: ConversionRate[] = [];
      if (conversionsRes && typeof conversionsRes === 'object' && conversionsRes !== null && 'data' in conversionsRes && conversionsRes.data) {
        const conversionsData = conversionsRes.data as unknown;
        conversionsArray = Array.isArray(conversionsData)
          ? conversionsData
          : ((conversionsData as { content?: ConversionRate[] })?.content ?? []);
      }

      // 计算每个原料的统计数据
      const materialsWithStats: MaterialWithStats[] = materialsArray.map((material) => {
        const materialConversions = conversionsArray.filter(
          (c) => c.materialTypeId === material.id
        );

        const configuredCount = materialConversions.length;
        let avgConversionRate: number | undefined;
        let avgWastageRate: number | undefined;

        if (configuredCount > 0) {
          avgConversionRate = materialConversions.reduce((sum, c) => sum + c.conversionRate, 0) / configuredCount;
          const wastageRates = materialConversions.filter((c) => c.wastageRate != null);
          if (wastageRates.length > 0) {
            avgWastageRate = wastageRates.reduce((sum, c) => sum + (c.wastageRate ?? 0), 0) / wastageRates.length;
          }
        }

        return {
          ...material,
          configuredCount,
          avgConversionRate,
          avgWastageRate,
        };
      });

      setMaterials(materialsWithStats);
      setTotalConfigured(conversionsArray.length);

      // 统计不同产品数量
      const uniqueProducts = new Set(conversionsArray.map((c) => c.productTypeId));
      setTotalProducts(uniqueProducts.size);

      conversionLogger.info('数据加载完成', {
        materials: materialsWithStats.length,
        conversions: conversionsArray.length,
        products: uniqueProducts.size,
      });
    } catch (error: unknown) {
      conversionLogger.error('加载转换率数据失败', error);
      const errorMessage = error instanceof Error ? error.message : '加载数据失败';
      Alert.alert('错误', errorMessage);
      setMaterials([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 初始加载
  useEffect(() => {
    loadData();
  }, []);

  // 页面聚焦时刷新数据
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [factoryId])
  );

  /**
   * 下拉刷新
   */
  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  /**
   * 点击原料卡片
   */
  const handleMaterialPress = (material: MaterialWithStats) => {
    navigation.navigate('MaterialConversionDetail', {
      materialTypeId: material.id,
      materialName: material.name,
    });
  };

  /**
   * 渲染原料卡片
   */
  const renderMaterialCard = ({ item }: { item: MaterialWithStats }) => {
    const hasConfig = item.configuredCount > 0;

    return (
      <Card
        style={styles.materialCard}
        mode="elevated"
        onPress={() => handleMaterialPress(item)}
      >
        <Card.Content style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <View style={styles.materialInfo}>
              <Text variant="titleMedium" style={styles.materialName}>
                {item.name}
              </Text>
              {item.category && (
                <Chip mode="outlined" compact style={styles.categoryChip}>
                  {item.category}
                </Chip>
              )}
            </View>
            <View style={styles.configCount}>
              <Text
                style={[
                  styles.configCountText,
                  hasConfig ? styles.configCountActive : styles.configCountEmpty,
                ]}
              >
                {item.configuredCount}
              </Text>
              <Text style={styles.configCountLabel}>个产品</Text>
            </View>
          </View>

          <Divider style={styles.cardDivider} />

          <View style={styles.cardStats}>
            {hasConfig ? (
              <>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {item.avgConversionRate?.toFixed(1)}%
                  </Text>
                  <Text style={styles.statLabel}>平均转换率</Text>
                </View>
                {item.avgWastageRate != null && (
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>
                      {item.avgWastageRate.toFixed(1)}%
                    </Text>
                    <Text style={styles.statLabel}>平均损耗</Text>
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.noConfigText}>尚未配置转换率</Text>
            )}
          </View>

          <View style={styles.arrowIcon} pointerEvents="none">
            <IconButton
              icon="chevron-right"
              size={24}
            />
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="转换率配置" />
        <Appbar.Action icon="refresh" onPress={handleRefresh} />
      </Appbar.Header>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      ) : (
        <FlatList
          data={materials}
          renderItem={renderMaterialCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListHeaderComponent={
            <>
              {/* 提示信息 */}
              <Card style={styles.infoCard}>
                <Card.Content>
                  <View style={styles.infoRow}>
                    <List.Icon icon="information" color="#2196F3" />
                    <Text style={styles.infoText}>
                      选择原料查看和配置转换率
                    </Text>
                  </View>
                </Card.Content>
              </Card>

              {/* 统计概览 */}
              <Surface style={styles.statsCard} elevation={1}>
                <View style={styles.statsRow}>
                  <View style={styles.statsItem}>
                    <Text style={styles.statsValue}>{materials.length}</Text>
                    <Text style={styles.statsLabel}>原料类型</Text>
                  </View>
                  <View style={styles.statsDivider} />
                  <View style={styles.statsItem}>
                    <Text style={styles.statsValue}>{totalProducts}</Text>
                    <Text style={styles.statsLabel}>产品类型</Text>
                  </View>
                  <View style={styles.statsDivider} />
                  <View style={styles.statsItem}>
                    <Text style={[styles.statsValue, styles.statsValueHighlight]}>
                      {totalConfigured}
                    </Text>
                    <Text style={styles.statsLabel}>已配置</Text>
                  </View>
                </View>
              </Surface>

              {/* 原料列表标题 */}
              <Text style={styles.sectionTitle}>原料列表</Text>
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                暂无原料类型，请先在"原材料类型管理"中添加
              </Text>
            </View>
          }
          ListFooterComponent={<View style={styles.bottomPadding} />}
        />
      )}
    </View>
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
  listContent: {
    padding: 16,
  },
  infoCard: {
    marginBottom: 12,
    backgroundColor: '#E3F2FD',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statsItem: {
    alignItems: 'center',
    flex: 1,
  },
  statsValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  statsValueHighlight: {
    color: '#2196F3',
  },
  statsLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statsDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E0E0E0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    marginTop: 4,
  },
  materialCard: {
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  cardContent: {
    position: 'relative',
    paddingRight: 40,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  materialInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  materialName: {
    fontWeight: '600',
    color: '#333',
  },
  categoryChip: {
    height: 24,
  },
  configCount: {
    alignItems: 'center',
    paddingLeft: 12,
  },
  configCountText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  configCountActive: {
    color: '#4CAF50',
  },
  configCountEmpty: {
    color: '#BDBDBD',
  },
  configCountLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  cardDivider: {
    marginVertical: 8,
  },
  cardStats: {
    flexDirection: 'row',
    gap: 24,
  },
  statItem: {
    alignItems: 'flex-start',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2196F3',
  },
  statLabel: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  noConfigText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  arrowIcon: {
    position: 'absolute',
    right: 0,
    top: '50%',
    marginTop: -12,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  bottomPadding: {
    height: 20,
  },
});
