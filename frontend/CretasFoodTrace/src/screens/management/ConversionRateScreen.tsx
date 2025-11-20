import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Text,
  Appbar,
  Card,
  DataTable,
  Button,
  Portal,
  Modal,
  TextInput,
  List,
  ActivityIndicator,
  Chip,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { materialTypeApiClient } from '../../services/api/materialTypeApiClient';
import { productTypeApiClient } from '../../services/api/productTypeApiClient';
import { conversionApiClient } from '../../services/api/conversionApiClient';
import { useAuthStore } from '../../store/authStore';
import { getFactoryId } from '../../types/auth';

interface MaterialType {
  id: string;
  name: string;
  category?: string;
  unit: string;
}

interface ProductType {
  id: string;
  name: string;
  code: string;
  category?: string;
}

interface ConversionRate {
  id?: string;
  materialTypeId: string;
  productTypeId: string;
  conversionRate: number;
  wastageRate?: number;
  notes?: string;
}

/**
 * 转换率配置页面
 * 支持矩阵视图和快速配置
 */
export default function ConversionRateScreen() {
  const navigation = useNavigation();
  const user = useAuthStore((state) => state.user);
  const factoryId = getFactoryId(user);
  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<MaterialType[]>([]);
  const [products, setProducts] = useState<ProductType[]>([]);
  const [conversions, setConversions] = useState<ConversionRate[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialType | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductType | null>(null);

  const [formData, setFormData] = useState({
    conversionRate: '',
    wastageRate: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      if (!factoryId) {
        console.warn('⚠️ 工厂ID不存在，无法加载转换率数据');
        Alert.alert('错误', '无法获取工厂信息，请重新登录');
        return;
      }

      console.log('📡 调用后端API - 获取转换率配置数据');

      // 并行加载三类数据
      const [materialsRes, productsRes, conversionsRes] = await Promise.all([
        materialTypeApiClient.getMaterialTypes({ factoryId }),
        productTypeApiClient.getProductTypes({ factoryId }),
        conversionApiClient.getConversionRates({ factoryId }),
      ]);

      // 处理原料类型数据
      if (materialsRes?.data) {
        const materialsArray = Array.isArray(materialsRes.data)
          ? materialsRes.data
          : materialsRes.data.content || [];
        const mappedMaterials: MaterialType[] = materialsArray.map((item: any) => ({
          id: item.id,
          name: item.name,
          category: item.category || undefined,
          unit: item.unit || 'kg',
        }));
        setMaterials(mappedMaterials);
        console.log(`✅ 加载原料类型: ${mappedMaterials.length} 个`);
      }

      // 处理产品类型数据
      if (productsRes?.data) {
        const productsArray = Array.isArray(productsRes.data)
          ? productsRes.data
          : productsRes.data.content || [];
        const mappedProducts: ProductType[] = productsArray.map((item: any) => ({
          id: item.id,
          name: item.name,
          code: item.productCode || item.code || '',
          category: item.category || undefined,
        }));
        setProducts(mappedProducts);
        console.log(`✅ 加载产品类型: ${mappedProducts.length} 个`);
      }

      // 处理转换率数据
      if (conversionsRes?.data) {
        const conversionsArray = Array.isArray(conversionsRes.data)
          ? conversionsRes.data
          : conversionsRes.data.content || [];
        const mappedConversions: ConversionRate[] = conversionsArray.map((item: any) => ({
          id: item.id,
          materialTypeId: item.materialTypeId,
          productTypeId: item.productTypeId,
          conversionRate: item.conversionRate,
          wastageRate: item.wastageRate || undefined,
          notes: item.notes || undefined,
        }));
        setConversions(mappedConversions);
        console.log(`✅ 加载转换率配置: ${mappedConversions.length} 个`);
      }

      console.log('✅ 所有数据加载完成');
    } catch (error: unknown) {
      console.error('❌ 加载转换率数据失败:', error);
      const errorMessage = error instanceof Error ? error.message : '加载数据失败';
      Alert.alert('错误', errorMessage);
      setMaterials([]);
      setProducts([]);
      setConversions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCellPress = (material: MaterialType, product: ProductType) => {
    const existing = conversions.find(
      c => c.materialTypeId === material.id && c.productTypeId === product.id
    );

    setSelectedMaterial(material);
    setSelectedProduct(product);

    if (existing) {
      setFormData({
        conversionRate: existing.conversionRate.toString(),
        wastageRate: existing.wastageRate?.toString() || '',
        notes: existing.notes || '',
      });
    } else {
      setFormData({
        conversionRate: '',
        wastageRate: '',
        notes: '',
      });
    }

    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.conversionRate) {
      Alert.alert('提示', '转换率不能为空');
      return;
    }

    const rate = parseFloat(formData.conversionRate);
    if (rate <= 0 || rate > 100) {
      Alert.alert('提示', '转换率必须在0-100之间');
      return;
    }

    if (!factoryId || !selectedMaterial || !selectedProduct) {
      Alert.alert('错误', '数据不完整，无法保存');
      return;
    }

    try {
      const existing = conversions.find(
        (c) => c.materialTypeId === selectedMaterial.id && c.productTypeId === selectedProduct.id
      );

      const conversionData = {
        materialTypeId: selectedMaterial.id,
        productTypeId: selectedProduct.id,
        conversionRate: rate,
        wastageRate: formData.wastageRate ? parseFloat(formData.wastageRate) : undefined,
        notes: formData.notes || undefined,
      };

      if (existing?.id) {
        // 更新现有转换率
        await conversionApiClient.updateConversionRate(existing.id, conversionData, factoryId);
        console.log('✅ 转换率更新成功');
      } else {
        // 创建新转换率
        await conversionApiClient.createConversionRate(conversionData, factoryId);
        console.log('✅ 转换率创建成功');
      }

      Alert.alert('成功', '转换率保存成功');
      setModalVisible(false);
      loadData();
    } catch (error: unknown) {
      console.error('❌ 保存转换率失败:', error);
      const errorMessage = error instanceof Error ? error.message : '保存失败';
      Alert.alert('错误', errorMessage);
    }
  };

  const getConversion = (materialId: string, productId: string) => {
    return conversions.find(
      c => c.materialTypeId === materialId && c.productTypeId === productId
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="转换率配置" />
        <Appbar.Action icon="refresh" onPress={loadData} />
      </Appbar.Header>

      <ScrollView style={styles.content}>
        {/* Info Card */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <View style={styles.infoRow}>
              <List.Icon icon="information" color="#2196F3" />
              <Text style={styles.infoText}>
                点击表格单元格可配置转换率。转换率表示原料转换为产品的比例。
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Stats */}
        <Card style={styles.statsCard}>
          <Card.Content>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{materials.length}</Text>
                <Text style={styles.statLabel}>原料类型</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{products.length}</Text>
                <Text style={styles.statLabel}>产品类型</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{conversions.length}</Text>
                <Text style={styles.statLabel}>已配置</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Conversion Matrix */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        ) : (
          <Card style={styles.matrixCard}>
            <Card.Content>
              <Text style={styles.matrixTitle}>转换率矩阵</Text>
              <ScrollView horizontal>
                <DataTable>
                  <DataTable.Header>
                    <DataTable.Title style={styles.headerCell}>
                      <Text style={styles.headerText}>原料 \ 产品</Text>
                    </DataTable.Title>
                    {products.map(product => (
                      <DataTable.Title key={product.id} style={styles.headerCell}>
                        <Text style={styles.headerText}>{product.name}</Text>
                      </DataTable.Title>
                    ))}
                  </DataTable.Header>

                  {materials.map(material => (
                    <DataTable.Row key={material.id}>
                      <DataTable.Cell style={styles.rowHeaderCell}>
                        <Text style={styles.materialName}>{material.name}</Text>
                      </DataTable.Cell>
                      {products.map(product => {
                        const conversion = getConversion(material.id, product.id);
                        return (
                          <DataTable.Cell
                            key={product.id}
                            style={styles.dataCell}
                            onPress={() => handleCellPress(material, product)}
                          >
                            {conversion ? (
                              <View style={styles.cellContent}>
                                <Text style={styles.conversionValue}>
                                  {conversion.conversionRate}%
                                </Text>
                                {conversion.wastageRate && (
                                  <Text style={styles.wastageValue}>
                                    损耗:{conversion.wastageRate}%
                                  </Text>
                                )}
                              </View>
                            ) : (
                              <Text style={styles.emptyCellText}>点击配置</Text>
                            )}
                          </DataTable.Cell>
                        );
                      })}
                    </DataTable.Row>
                  ))}
                </DataTable>
              </ScrollView>

              {materials.length === 0 || products.length === 0 ? (
                <View style={styles.emptyMatrixHint}>
                  <Text style={styles.emptyMatrixText}>
                    请先在"产品类型管理"和"原料类型管理"中添加类型
                  </Text>
                </View>
              ) : null}
            </Card.Content>
          </Card>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Edit Modal */}
      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.modalTitle}>配置转换率</Text>

          {selectedMaterial && selectedProduct && (
            <View style={styles.conversionInfo}>
              <Chip icon="arrow-right" mode="outlined" style={styles.infoChip}>
                {selectedMaterial.name} → {selectedProduct.name}
              </Chip>
            </View>
          )}

          <TextInput
            label="转换率 (%) *"
            value={formData.conversionRate}
            onChangeText={(text) => setFormData({ ...formData, conversionRate: text })}
            mode="outlined"
            style={styles.input}
            keyboardType="decimal-pad"
            placeholder="例如: 60 (表示 100kg 原料可生产 60kg 产品)"
          />

          <TextInput
            label="损耗率 (%)"
            value={formData.wastageRate}
            onChangeText={(text) => setFormData({ ...formData, wastageRate: text })}
            mode="outlined"
            style={styles.input}
            keyboardType="decimal-pad"
            placeholder="例如: 5 (表示 5% 的损耗)"
          />

          <TextInput
            label="备注"
            value={formData.notes}
            onChangeText={(text) => setFormData({ ...formData, notes: text })}
            mode="outlined"
            style={styles.input}
            multiline
            numberOfLines={2}
            placeholder="可选填写备注信息"
          />

          {/* 预估示例 */}
          {formData.conversionRate && (
            <Card style={styles.exampleCard}>
              <Card.Content>
                <Text style={styles.exampleTitle}>预估示例:</Text>
                <Text style={styles.exampleText}>
                  生产 100kg {selectedProduct?.name}
                </Text>
                <Text style={styles.exampleText}>
                  需要约 {(100 / (parseFloat(formData.conversionRate) / 100) * (1 + (parseFloat(formData.wastageRate || '0') / 100))).toFixed(1)}kg {selectedMaterial?.name}
                </Text>
              </Card.Content>
            </Card>
          )}

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
            >
              保存
            </Button>
          </View>
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
  content: {
    flex: 1,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
  },
  infoCard: {
    margin: 16,
    marginBottom: 8,
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
    marginLeft: -8,
  },
  statsCard: {
    margin: 16,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  matrixCard: {
    margin: 16,
  },
  matrixTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  headerCell: {
    minWidth: 120,
    justifyContent: 'center',
  },
  headerText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  rowHeaderCell: {
    minWidth: 120,
    backgroundColor: '#f5f5f5',
  },
  materialName: {
    fontWeight: '600',
    fontSize: 14,
  },
  dataCell: {
    minWidth: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellContent: {
    alignItems: 'center',
  },
  conversionValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  wastageValue: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  emptyCellText: {
    fontSize: 12,
    color: '#bbb',
  },
  emptyMatrixHint: {
    padding: 20,
    alignItems: 'center',
  },
  emptyMatrixText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  conversionInfo: {
    marginBottom: 16,
  },
  infoChip: {
    alignSelf: 'flex-start',
  },
  input: {
    marginBottom: 16,
  },
  exampleCard: {
    marginBottom: 16,
    backgroundColor: '#FFF3E0',
  },
  exampleTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#E65100',
  },
  exampleText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    minWidth: 100,
  },
  bottomPadding: {
    height: 20,
  },
});
