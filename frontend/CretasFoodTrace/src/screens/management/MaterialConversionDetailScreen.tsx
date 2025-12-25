import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, Alert, RefreshControl, ScrollView } from 'react-native';
import {
  Text,
  Appbar,
  Card,
  Button,
  Portal,
  Modal,
  TextInput,
  Searchbar,
  List,
  ActivityIndicator,
  Chip,
  FAB,
  IconButton,
  Divider,
} from 'react-native-paper';
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import { conversionApiClient, SuggestedConversion } from '../../services/api/conversionApiClient';
import { productTypeApiClient } from '../../services/api/productTypeApiClient';
import { useAuthStore } from '../../store/authStore';
import { getFactoryId } from '../../types/auth';
import { ManagementStackParamList } from '../../types/navigation';
import { logger } from '../../utils/logger';

// 创建专用logger
const detailLogger = logger.createContextLogger('MaterialConversionDetail');

type RouteProps = RouteProp<ManagementStackParamList, 'MaterialConversionDetail'>;

interface ProductType {
  id: string;
  name: string;
  code: string;
  category?: string;
}

interface ConversionRate {
  id: string;
  materialTypeId: string;
  productTypeId: string;
  conversionRate: number;
  wastageRate?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ConversionWithProduct extends ConversionRate {
  productName: string;
  productCode: string;
}

/**
 * 原料转换率详情页面
 *
 * 功能：
 * - 显示该原料的所有已配置转换率
 * - 搜索过滤产品
 * - 添加/编辑/删除转换率
 * - 显示智能建议（基于历史数据）
 */
export default function MaterialConversionDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { materialTypeId, materialName } = route.params;

  const user = useAuthStore((state) => state.user);
  const factoryId = getFactoryId(user);

  // 数据状态
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [conversions, setConversions] = useState<ConversionWithProduct[]>([]);
  const [products, setProducts] = useState<ProductType[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal 状态
  const [modalVisible, setModalVisible] = useState(false);
  const [editingConversion, setEditingConversion] = useState<ConversionWithProduct | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductType | null>(null);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [showProductList, setShowProductList] = useState(false);

  // 表单状态
  const [formData, setFormData] = useState({
    conversionRate: '',
    wastageRate: '',
    notes: '',
  });

  // 建议状态
  const [suggestion, setSuggestion] = useState<SuggestedConversion | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);

  /**
   * 加载数据
   */
  const loadData = async () => {
    try {
      if (!factoryId) {
        Alert.alert('错误', '无法获取工厂信息，请重新登录');
        return;
      }

      detailLogger.info('加载原料转换率详情', { materialTypeId, materialName, factoryId });

      // 并行加载转换率和产品列表
      const [conversionsRes, productsRes] = await Promise.all([
        conversionApiClient.getConversionsByMaterial(materialTypeId, factoryId),
        productTypeApiClient.getProductTypes({ factoryId }),
      ]);

      // 处理产品数据
      let productsArray: ProductType[] = [];
      if (productsRes && 'data' in productsRes && productsRes.data) {
        const productsData = productsRes.data as unknown;
        productsArray = Array.isArray(productsData)
          ? productsData
          : ((productsData as { content?: ProductType[] })?.content ?? []);
        productsArray = productsArray.map((item: ProductType) => ({
          id: item.id,
          name: item.name,
          code: (item as { productCode?: string }).productCode ?? item.code ?? '',
          category: item.category ?? undefined,
        }));
      }
      setProducts(productsArray);

      // 处理转换率数据
      let conversionsArray: ConversionRate[] = [];
      if (conversionsRes && typeof conversionsRes === 'object' && conversionsRes !== null && 'data' in conversionsRes && conversionsRes.data) {
        const conversionsData = conversionsRes.data as unknown;
        conversionsArray = Array.isArray(conversionsData)
          ? conversionsData
          : ((conversionsData as { content?: ConversionRate[] })?.content ?? []);
      }

      // 合并产品信息
      const conversionsWithProduct: ConversionWithProduct[] = conversionsArray.map((conv) => {
        const product = productsArray.find((p) => p.id === conv.productTypeId);
        return {
          ...conv,
          productName: product?.name ?? '未知产品',
          productCode: product?.code ?? '',
        };
      });

      setConversions(conversionsWithProduct);
      detailLogger.info('数据加载完成', {
        conversions: conversionsWithProduct.length,
        products: productsArray.length,
      });
    } catch (error: unknown) {
      detailLogger.error('加载数据失败', error);
      const errorMessage = error instanceof Error ? error.message : '加载数据失败';
      Alert.alert('错误', errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 初始加载
  useEffect(() => {
    loadData();
  }, []);

  // 页面聚焦时刷新
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [materialTypeId, factoryId])
  );

  /**
   * 下拉刷新
   */
  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  /**
   * 过滤后的转换率列表
   */
  const filteredConversions = conversions.filter((conv) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      conv.productName.toLowerCase().includes(query) ||
      conv.productCode.toLowerCase().includes(query)
    );
  });

  /**
   * 过滤后的产品列表（用于添加时选择）
   */
  const filteredProducts = products.filter((product) => {
    // 排除已配置的产品
    const isConfigured = conversions.some((c) => c.productTypeId === product.id);
    if (isConfigured) return false;

    if (!productSearchQuery) return true;
    const query = productSearchQuery.toLowerCase();
    return (
      product.name.toLowerCase().includes(query) ||
      product.code.toLowerCase().includes(query)
    );
  });

  /**
   * 打开添加对话框
   */
  const handleAdd = () => {
    setEditingConversion(null);
    setSelectedProduct(null);
    setProductSearchQuery('');
    setShowProductList(true);
    setFormData({ conversionRate: '', wastageRate: '', notes: '' });
    setSuggestion(null);
    setModalVisible(true);
  };

  /**
   * 打开编辑对话框
   */
  const handleEdit = (conversion: ConversionWithProduct) => {
    setEditingConversion(conversion);
    setSelectedProduct({
      id: conversion.productTypeId,
      name: conversion.productName,
      code: conversion.productCode,
    });
    setShowProductList(false);
    setFormData({
      conversionRate: conversion.conversionRate.toString(),
      wastageRate: conversion.wastageRate?.toString() ?? '',
      notes: conversion.notes ?? '',
    });
    setSuggestion(null);
    setModalVisible(true);
  };

  /**
   * 选择产品后获取建议
   */
  const handleSelectProduct = async (product: ProductType) => {
    setSelectedProduct(product);
    setShowProductList(false);

    // 获取建议
    if (factoryId) {
      setSuggestLoading(true);
      try {
        const result = await conversionApiClient.getSuggestedConversion({
          materialTypeId,
          productTypeId: product.id,
          factoryId,
        });

        if (result.success && result.data) {
          setSuggestion(result.data);
          detailLogger.info('获取建议成功', {
            hasData: result.data.hasData,
            sampleCount: result.data.sampleCount,
          });
        }
      } catch (error) {
        detailLogger.warn('获取建议失败', error);
      } finally {
        setSuggestLoading(false);
      }
    }
  };

  /**
   * 使用建议值
   */
  const handleUseSuggestion = () => {
    if (suggestion?.hasData) {
      setFormData({
        conversionRate: suggestion.suggestedRate?.toFixed(2) ?? '',
        wastageRate: suggestion.suggestedWastageRate?.toFixed(2) ?? '',
        notes: `基于 ${suggestion.sampleCount} 批次历史数据自动计算`,
      });
    }
  };

  /**
   * 保存转换率
   */
  const handleSave = async () => {
    if (!selectedProduct) {
      Alert.alert('提示', '请选择产品');
      return;
    }

    if (!formData.conversionRate) {
      Alert.alert('提示', '请输入转换率');
      return;
    }

    const rate = parseFloat(formData.conversionRate);
    if (rate <= 0 || rate > 100) {
      Alert.alert('提示', '转换率必须在 0-100 之间');
      return;
    }

    if (!factoryId) {
      Alert.alert('错误', '无法获取工厂信息');
      return;
    }

    try {
      const conversionData = {
        materialTypeId,
        productTypeId: selectedProduct.id,
        conversionRate: rate,
        wastageRate: formData.wastageRate ? parseFloat(formData.wastageRate) : undefined,
        notes: formData.notes || undefined,
      };

      if (editingConversion?.id) {
        // 更新
        await conversionApiClient.updateConversionRate(editingConversion.id, conversionData, factoryId);
        detailLogger.info('转换率更新成功', { id: editingConversion.id });
        Alert.alert('成功', '转换率已更新');
      } else {
        // 创建
        await conversionApiClient.createConversionRate(conversionData, factoryId);
        detailLogger.info('转换率创建成功', { productId: selectedProduct.id });
        Alert.alert('成功', '转换率已创建');
      }

      setModalVisible(false);
      loadData();
    } catch (error: unknown) {
      detailLogger.error('保存失败', error);
      const errorMessage = error instanceof Error ? error.message : '保存失败';
      Alert.alert('错误', errorMessage);
    }
  };

  /**
   * 删除转换率
   */
  const handleDelete = (conversion: ConversionWithProduct) => {
    Alert.alert(
      '确认删除',
      `确定要删除 "${conversion.productName}" 的转换率配置吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!factoryId) return;
              await conversionApiClient.deleteConversionRate(conversion.id, factoryId);
              detailLogger.info('转换率删除成功', { id: conversion.id });
              Alert.alert('成功', '已删除');
              loadData();
            } catch (error: unknown) {
              detailLogger.error('删除失败', error);
              const errorMessage = error instanceof Error ? error.message : '删除失败';
              Alert.alert('错误', errorMessage);
            }
          },
        },
      ]
    );
  };

  /**
   * 渲染转换率卡片
   */
  const renderConversionCard = ({ item }: { item: ConversionWithProduct }) => {
    return (
      <Card style={styles.conversionCard} mode="elevated">
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.productInfo}>
              <Text variant="titleMedium" style={styles.productName}>
                {item.productName}
              </Text>
              {item.productCode && (
                <Text style={styles.productCode}>SKU: {item.productCode}</Text>
              )}
            </View>
            <View style={styles.cardActions}>
              <IconButton
                icon="pencil"
                size={20}
                onPress={() => handleEdit(item)}
              />
              <IconButton
                icon="delete"
                size={20}
                iconColor="#F44336"
                onPress={() => handleDelete(item)}
              />
            </View>
          </View>

          <Divider style={styles.cardDivider} />

          <View style={styles.rateRow}>
            <View style={styles.rateItem}>
              <Text style={styles.rateValue}>{item.conversionRate}%</Text>
              <Text style={styles.rateLabel}>转换率</Text>
            </View>
            {item.wastageRate != null && (
              <View style={styles.rateItem}>
                <Text style={styles.rateValue}>{item.wastageRate}%</Text>
                <Text style={styles.rateLabel}>损耗率</Text>
              </View>
            )}
          </View>

          {item.notes && (
            <Text style={styles.notes} numberOfLines={2}>
              {item.notes}
            </Text>
          )}
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={`${materialName} 转换率`} />
        <Appbar.Action icon="refresh" onPress={handleRefresh} />
      </Appbar.Header>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      ) : (
        <>
          {/* 搜索栏 */}
          <View style={styles.searchContainer}>
            <Searchbar
              placeholder="搜索产品名称或SKU..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchbar}
            />
          </View>

          {/* 统计信息 */}
          <View style={styles.statsBar}>
            <Text style={styles.statsText}>
              已配置 <Text style={styles.statsHighlight}>{conversions.length}</Text> 个产品转换率
            </Text>
          </View>

          {/* 转换率列表 */}
          <FlatList
            data={filteredConversions}
            renderItem={renderConversionCard}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {searchQuery
                    ? '未找到匹配的转换率配置'
                    : '尚未配置任何转换率，点击右下角按钮添加'}
                </Text>
              </View>
            }
            ListFooterComponent={<View style={styles.bottomPadding} />}
          />

          {/* 添加按钮 */}
          <FAB
            icon="plus"
            style={styles.fab}
            onPress={handleAdd}
          />
        </>
      )}

      {/* 添加/编辑 Modal */}
      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <ScrollView>
            <Text style={styles.modalTitle}>
              {editingConversion ? '编辑转换率' : '添加转换率'}
            </Text>

            {/* 原料信息 */}
            <View style={styles.materialRow}>
              <Text style={styles.materialLabel}>原料:</Text>
              <Chip mode="outlined">{materialName}</Chip>
            </View>

            {/* 产品选择 */}
            {showProductList ? (
              <View style={styles.productSelectContainer}>
                <Text style={styles.fieldLabel}>选择产品 *</Text>
                <Searchbar
                  placeholder="搜索产品..."
                  value={productSearchQuery}
                  onChangeText={setProductSearchQuery}
                  style={styles.productSearchbar}
                />
                <View style={styles.productList}>
                  {filteredProducts.length === 0 ? (
                    <Text style={styles.noProductText}>
                      {products.length === 0
                        ? '暂无可选产品'
                        : conversions.length === products.length
                        ? '所有产品都已配置转换率'
                        : '未找到匹配产品'}
                    </Text>
                  ) : (
                    filteredProducts.slice(0, 10).map((product) => (
                      <List.Item
                        key={product.id}
                        title={product.name}
                        description={product.code ? `SKU: ${product.code}` : undefined}
                        onPress={() => handleSelectProduct(product)}
                        right={(props) => <List.Icon {...props} icon="chevron-right" />}
                        style={styles.productItem}
                      />
                    ))
                  )}
                  {filteredProducts.length > 10 && (
                    <Text style={styles.moreProductsText}>
                      还有 {filteredProducts.length - 10} 个产品，请搜索缩小范围
                    </Text>
                  )}
                </View>
              </View>
            ) : selectedProduct ? (
              <View style={styles.selectedProductContainer}>
                <Text style={styles.fieldLabel}>产品 *</Text>
                <Card style={styles.selectedProductCard} mode="outlined">
                  <Card.Content style={styles.selectedProductContent}>
                    <View>
                      <Text variant="bodyLarge">{selectedProduct.name}</Text>
                      {selectedProduct.code && (
                        <Text style={styles.selectedProductCode}>
                          SKU: {selectedProduct.code}
                        </Text>
                      )}
                    </View>
                    {!editingConversion && (
                      <Button
                        mode="text"
                        compact
                        onPress={() => {
                          setSelectedProduct(null);
                          setShowProductList(true);
                          setSuggestion(null);
                        }}
                      >
                        更换
                      </Button>
                    )}
                  </Card.Content>
                </Card>
              </View>
            ) : null}

            {/* 建议区域 */}
            {selectedProduct && (
              <>
                {suggestLoading ? (
                  <Card style={styles.suggestionCard}>
                    <Card.Content style={styles.suggestionLoading}>
                      <ActivityIndicator size="small" />
                      <Text style={styles.suggestionLoadingText}>正在计算建议值...</Text>
                    </Card.Content>
                  </Card>
                ) : suggestion ? (
                  <Card
                    style={[
                      styles.suggestionCard,
                      suggestion.hasData ? styles.suggestionSuccess : styles.suggestionInfo,
                    ]}
                  >
                    <Card.Content>
                      {suggestion.hasData ? (
                        <>
                          <View style={styles.suggestionHeader}>
                            <List.Icon
                              icon="lightbulb-on"
                              color="#4CAF50"
                            />
                            <Text style={styles.suggestionTitle}>
                              基于 {suggestion.sampleCount} 批次历史数据
                            </Text>
                          </View>
                          <View style={styles.suggestionRow}>
                            <Text style={styles.suggestionLabel}>建议转换率:</Text>
                            <Text style={styles.suggestionValue}>
                              {suggestion.suggestedRate?.toFixed(2)}%
                            </Text>
                          </View>
                          {suggestion.suggestedWastageRate != null && (
                            <View style={styles.suggestionRow}>
                              <Text style={styles.suggestionLabel}>建议损耗率:</Text>
                              <Text style={styles.suggestionValue}>
                                {suggestion.suggestedWastageRate.toFixed(2)}%
                              </Text>
                            </View>
                          )}
                          <View style={styles.suggestionRow}>
                            <Text style={styles.suggestionLabel}>置信度:</Text>
                            <Chip
                              mode="flat"
                              compact
                              style={[
                                styles.confidenceChip,
                                suggestion.confidence === 'HIGH'
                                  ? styles.confidenceHigh
                                  : suggestion.confidence === 'MEDIUM'
                                  ? styles.confidenceMedium
                                  : styles.confidenceLow,
                              ]}
                            >
                              {suggestion.confidence === 'HIGH'
                                ? '高'
                                : suggestion.confidence === 'MEDIUM'
                                ? '中'
                                : '低'}
                            </Chip>
                          </View>
                          <Button
                            mode="contained"
                            icon="check"
                            onPress={handleUseSuggestion}
                            style={styles.useSuggestionButton}
                            buttonColor="#4CAF50"
                          >
                            使用建议值
                          </Button>
                        </>
                      ) : (
                        <View style={styles.noSuggestionContainer}>
                          <List.Icon icon="information-outline" color="#757575" />
                          <Text style={styles.noSuggestionText}>{suggestion.message}</Text>
                        </View>
                      )}
                    </Card.Content>
                  </Card>
                ) : null}

                {/* 表单输入 */}
                <TextInput
                  label="转换率 (%) *"
                  value={formData.conversionRate}
                  onChangeText={(text) => setFormData({ ...formData, conversionRate: text })}
                  mode="outlined"
                  style={styles.input}
                  keyboardType="decimal-pad"
                  placeholder="例如: 60"
                />

                <TextInput
                  label="损耗率 (%)"
                  value={formData.wastageRate}
                  onChangeText={(text) => setFormData({ ...formData, wastageRate: text })}
                  mode="outlined"
                  style={styles.input}
                  keyboardType="decimal-pad"
                  placeholder="例如: 5"
                />

                <TextInput
                  label="备注"
                  value={formData.notes}
                  onChangeText={(text) => setFormData({ ...formData, notes: text })}
                  mode="outlined"
                  style={styles.input}
                  multiline
                  numberOfLines={2}
                />
              </>
            )}

            {/* 按钮 */}
            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => setModalVisible(false)}
                style={styles.modalButton}
              >
                取消
              </Button>
              <Button
                mode="contained"
                onPress={handleSave}
                style={styles.modalButton}
                disabled={!selectedProduct}
              >
                保存
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>
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
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
    backgroundColor: '#fff',
  },
  searchbar: {
    elevation: 0,
    backgroundColor: '#f5f5f5',
  },
  statsBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  statsText: {
    fontSize: 14,
    color: '#666',
  },
  statsHighlight: {
    fontWeight: 'bold',
    color: '#2196F3',
  },
  listContent: {
    padding: 16,
  },
  conversionCard: {
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontWeight: '600',
    color: '#333',
  },
  productCode: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    marginRight: -8,
    marginTop: -8,
  },
  cardDivider: {
    marginVertical: 12,
  },
  rateRow: {
    flexDirection: 'row',
    gap: 32,
  },
  rateItem: {
    alignItems: 'flex-start',
  },
  rateValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  rateLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  notes: {
    fontSize: 13,
    color: '#666',
    marginTop: 12,
    fontStyle: 'italic',
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
    height: 80,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#2196F3',
  },
  // Modal 样式
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 8,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  materialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  materialLabel: {
    fontSize: 14,
    color: '#666',
  },
  fieldLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  productSelectContainer: {
    marginBottom: 16,
  },
  productSearchbar: {
    elevation: 0,
    backgroundColor: '#f5f5f5',
    marginBottom: 8,
  },
  productList: {
    maxHeight: 200,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  productItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  noProductText: {
    padding: 16,
    textAlign: 'center',
    color: '#999',
  },
  moreProductsText: {
    padding: 8,
    textAlign: 'center',
    fontSize: 12,
    color: '#666',
    backgroundColor: '#F5F5F5',
  },
  selectedProductContainer: {
    marginBottom: 16,
  },
  selectedProductCard: {
    backgroundColor: '#E3F2FD',
  },
  selectedProductContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedProductCode: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  suggestionCard: {
    marginBottom: 16,
    borderRadius: 8,
  },
  suggestionSuccess: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
    borderWidth: 1,
  },
  suggestionInfo: {
    backgroundColor: '#ECEFF1',
    borderColor: '#9E9E9E',
    borderWidth: 1,
  },
  suggestionLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  suggestionLoadingText: {
    marginLeft: 12,
    color: '#666',
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
    marginLeft: 4,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  suggestionLabel: {
    fontSize: 13,
    color: '#666',
    width: 90,
  },
  suggestionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
  },
  confidenceChip: {
    height: 24,
  },
  confidenceHigh: {
    backgroundColor: '#C8E6C9',
  },
  confidenceMedium: {
    backgroundColor: '#FFE0B2',
  },
  confidenceLow: {
    backgroundColor: '#EEEEEE',
  },
  useSuggestionButton: {
    marginTop: 12,
  },
  noSuggestionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  noSuggestionText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 8,
  },
  input: {
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    minWidth: 100,
  },
});
