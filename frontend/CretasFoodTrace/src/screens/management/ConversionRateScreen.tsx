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
      // TODO: 实际API调用
      // const [materialsRes, productsRes, conversionsRes] = await Promise.all([
      //   materialTypeApi.getMaterialTypes(),
      //   productTypeApi.getProductTypes(),
      //   conversionApi.getConversionRates(),
      // ]);

      // Mock 数据
      setMaterials([
        { id: '1', name: '鲈鱼', category: '鱼类', unit: 'kg' },
        { id: '2', name: '带鱼', category: '鱼类', unit: 'kg' },
      ]);

      setProducts([
        { id: '1', name: '鱼片', code: 'YP001', category: '主产品' },
        { id: '2', name: '鱼头', code: 'YT001', category: '副产品' },
      ]);

      setConversions([
        { id: '1', materialTypeId: '1', productTypeId: '1', conversionRate: 60, wastageRate: 5 },
      ]);
    } catch (error) {
      Alert.alert('错误', '加载数据失败');
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

    try {
      // await conversionApi.upsertConversionRate({
      //   materialTypeId: selectedMaterial!.id,
      //   productTypeId: selectedProduct!.id,
      //   conversionRate: rate,
      //   wastageRate: formData.wastageRate ? parseFloat(formData.wastageRate) : undefined,
      //   notes: formData.notes,
      // });

      Alert.alert('成功', '转换率保存成功');
      setModalVisible(false);
      loadData();
    } catch (error) {
      Alert.alert('错误', '保存失败');
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
