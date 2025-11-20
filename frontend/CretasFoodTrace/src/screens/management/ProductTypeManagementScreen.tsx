import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Text,
  Appbar,
  FAB,
  Card,
  List,
  Chip,
  IconButton,
  Portal,
  Modal,
  TextInput,
  Button,
  ActivityIndicator,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { productTypeApiClient } from '../../services/api/productTypeApiClient';
import { useAuthStore } from '../../store/authStore';
import { getFactoryId } from '../../types/auth';
import { logger } from '../../utils/logger';

// 创建ProductTypeManagement专用logger
const productTypeLogger = logger.createContextLogger('ProductTypeManagement');

interface ProductType {
  id: string;
  name: string;
  code: string;
  category?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

/**
 * 产品类型管理页面
 */
export default function ProductTypeManagementScreen() {
  const navigation = useNavigation();
  const user = useAuthStore((state) => state.user);
  const factoryId = getFactoryId(user);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<ProductType | null>(null);

  // 表单状态
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    category: '',
    description: '',
  });

  useEffect(() => {
    loadProductTypes();
  }, []);

  const loadProductTypes = async () => {
    try {
      setLoading(true);

      if (!factoryId) {
        productTypeLogger.warn('工厂ID不存在', { userType: user?.userType });
        Alert.alert('错误', '无法获取工厂信息，请重新登录');
        return;
      }

      productTypeLogger.debug('获取产品类型列表', { factoryId });
      const response = await productTypeApiClient.getProductTypes({ factoryId });

      if (response?.data) {
        productTypeLogger.info('产品类型列表加载成功', {
          productTypeCount: response.data.length,
          factoryId,
        });
        // 将后端DTO映射到前端显示格式
        const mappedTypes: ProductType[] = response.data.map((item: any) => ({
          id: item.id,
          name: item.name,
          code: item.productCode || item.code || '',
          category: item.category || undefined,
          description: item.description || undefined,
          isActive: item.isActive !== false,
          createdAt: item.createdAt || new Date().toISOString(),
        }));
        setProductTypes(mappedTypes);
      } else {
        productTypeLogger.warn('API返回数据为空', { factoryId });
        setProductTypes([]);
      }
    } catch (error: unknown) {
      productTypeLogger.error('加载产品类型失败', error as Error, { factoryId });
      const errorMessage = error instanceof Error ? error.message : '加载产品类型失败';
      Alert.alert('错误', errorMessage);
      setProductTypes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingItem(null);
    setFormData({ name: '', code: '', category: '', description: '' });
    setModalVisible(true);
  };

  const handleEdit = (item: ProductType) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      code: item.code,
      category: item.category || '',
      description: item.description || '',
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.code) {
      Alert.alert('提示', '产品名称和代码不能为空');
      return;
    }

    try {
      if (editingItem) {
        // 更新
        // await productTypeApi.updateProductType(editingItem.id, formData);
        Alert.alert('成功', '产品类型更新成功');
      } else {
        // 创建
        // await productTypeApi.createProductType(formData);
        Alert.alert('成功', '产品类型创建成功');
      }
      setModalVisible(false);
      loadProductTypes();
    } catch (error) {
      Alert.alert('错误', editingItem ? '更新失败' : '创建失败');
    }
  };

  const handleDelete = (item: ProductType) => {
    Alert.alert(
      '确认删除',
      `确定要删除产品类型"${item.name}"吗?`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              // await productTypeApi.deleteProductType(item.id);
              Alert.alert('成功', '产品类型删除成功');
              loadProductTypes();
            } catch (error) {
              Alert.alert('错误', '删除失败');
            }
          },
        },
      ]
    );
  };

  const handleToggleStatus = async (item: ProductType) => {
    try {
      // await productTypeApi.updateProductType(item.id, { isActive: !item.isActive });
      Alert.alert('成功', item.isActive ? '已停用' : '已启用');
      loadProductTypes();
    } catch (error) {
      Alert.alert('错误', '操作失败');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="产品类型管理" />
        <Appbar.Action icon="refresh" onPress={loadProductTypes} />
      </Appbar.Header>

      {/* Content */}
      <ScrollView style={styles.content}>
        {/* Stats Card */}
        <Card style={styles.statsCard}>
          <Card.Content>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{productTypes.length}</Text>
                <Text style={styles.statLabel}>总数</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {productTypes.filter(p => p.isActive).length}
                </Text>
                <Text style={styles.statLabel}>启用中</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {new Set(productTypes.map(p => p.category)).size}
                </Text>
                <Text style={styles.statLabel}>分类数</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Product Type List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        ) : productTypes.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <List.Icon icon="information-outline" color="#999" />
              <Text style={styles.emptyText}>暂无产品类型</Text>
              <Text style={styles.emptyHint}>点击右下角"+"按钮添加产品类型</Text>
            </Card.Content>
          </Card>
        ) : (
          productTypes.map((item) => (
            <Card key={item.id} style={styles.itemCard}>
              <Card.Content>
                <View style={styles.itemHeader}>
                  <View style={styles.itemTitleRow}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Chip
                      mode="outlined"
                      compact
                      style={styles.codeChip}
                    >
                      {item.code}
                    </Chip>
                  </View>
                  <View style={styles.itemActions}>
                    <IconButton
                      icon={item.isActive ? 'eye' : 'eye-off'}
                      size={20}
                      onPress={() => handleToggleStatus(item)}
                    />
                    <IconButton
                      icon="pencil"
                      size={20}
                      onPress={() => handleEdit(item)}
                    />
                    <IconButton
                      icon="delete"
                      size={20}
                      onPress={() => handleDelete(item)}
                    />
                  </View>
                </View>

                {item.category && (
                  <Chip mode="outlined" compact style={styles.categoryChip}>
                    {item.category}
                  </Chip>
                )}

                {item.description && (
                  <Text style={styles.itemDescription}>{item.description}</Text>
                )}

                <View style={styles.itemFooter}>
                  <Chip
                    icon={item.isActive ? 'check-circle' : 'close-circle'}
                    mode="flat"
                    compact
                    style={[
                      styles.statusChip,
                      { backgroundColor: item.isActive ? '#E8F5E9' : '#FFEBEE' },
                    ]}
                    textStyle={{
                      color: item.isActive ? '#4CAF50' : '#F44336',
                    }}
                  >
                    {item.isActive ? '启用中' : '已停用'}
                  </Chip>
                </View>
              </Card.Content>
            </Card>
          ))
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Add/Edit Modal */}
      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.modalTitle}>
            {editingItem ? '编辑产品类型' : '添加产品类型'}
          </Text>

          <TextInput
            label="产品名称 *"
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
            mode="outlined"
            style={styles.input}
            placeholder="例如: 鱼片"
          />

          <TextInput
            label="产品代码 *"
            value={formData.code}
            onChangeText={(text) => setFormData({ ...formData, code: text.toUpperCase() })}
            mode="outlined"
            style={styles.input}
            placeholder="例如: YP001"
            autoCapitalize="characters"
          />

          <TextInput
            label="产品分类"
            value={formData.category}
            onChangeText={(text) => setFormData({ ...formData, category: text })}
            mode="outlined"
            style={styles.input}
            placeholder="例如: 主产品"
          />

          <TextInput
            label="产品描述"
            value={formData.description}
            onChangeText={(text) => setFormData({ ...formData, description: text })}
            mode="outlined"
            style={styles.input}
            multiline
            numberOfLines={3}
            placeholder="产品详细描述"
          />

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
              {editingItem ? '更新' : '创建'}
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* FAB */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={handleAdd}
        label="添加产品类型"
      />
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
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
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  emptyCard: {
    margin: 16,
  },
  emptyContent: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 8,
  },
  itemCard: {
    margin: 16,
    marginBottom: 8,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  itemTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  codeChip: {
    height: 24,
  },
  itemActions: {
    flexDirection: 'row',
    marginLeft: 8,
  },
  categoryChip: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  itemDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    marginBottom: 12,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  statusChip: {
    height: 28,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
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
    marginBottom: 20,
  },
  input: {
    marginBottom: 16,
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
  bottomPadding: {
    height: 80,
  },
});
