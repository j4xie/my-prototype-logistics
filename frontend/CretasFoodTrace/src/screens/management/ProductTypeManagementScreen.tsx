import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
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
  Menu,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { productTypeApiClient } from '../../services/api/productTypeApiClient';
import { useAuthStore } from '../../store/authStore';
import { getFactoryId } from '../../types/auth';
import { logger } from '../../utils/logger';
import { canManageBasicData, getPermissionDebugInfo } from '../../utils/permissionHelper';

// 创建ProductTypeManagement专用logger
const productTypeLogger = logger.createContextLogger('ProductTypeManagement');

// 下拉选项常量
const UNIT_OPTIONS = ['kg', '件', '盒', '包', '条', '桶'] as const;
const CATEGORY_OPTIONS = ['海鲜', '冷冻水产', '加工成品', '半成品'] as const;

interface ProductType {
  id: string;
  name: string;
  code: string;
  category?: string;
  unit?: string;
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

  // 下拉菜单可见状态
  const [categoryMenuVisible, setCategoryMenuVisible] = useState(false);
  const [unitMenuVisible, setUnitMenuVisible] = useState(false);

  // 权限检查
  const canManage = canManageBasicData(user);

  // 权限检查日志
  useEffect(() => {
    const debugInfo = getPermissionDebugInfo(user);
    productTypeLogger.debug('权限检查', {
      ...debugInfo,
      canManage,
    });
  }, [user]);

  // 表单状态 (简化: 只需名称、单位、分类)
  const [formData, setFormData] = useState({
    name: '',
    unit: 'kg',      // 默认单位
    category: '海鲜', // 默认分类
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
          unit: item.unit || 'kg',
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
    setFormData({ name: '', unit: 'kg', category: '海鲜' });
    setModalVisible(true);
  };

  const handleEdit = (item: ProductType) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      unit: item.unit || 'kg',
      category: item.category || '海鲜',
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('提示', '产品名称不能为空');
      return;
    }

    try {
      // 映射前端字段到后端期望的字段格式
      // 注意: productCode 不传，后端自动生成 SKU
      const requestData = {
        name: formData.name.trim(),
        unit: formData.unit,
        category: formData.category,
      };

      if (editingItem) {
        // 更新
        await productTypeApiClient.updateProductType(editingItem.id, requestData, factoryId);
        Alert.alert('成功', '产品类型更新成功');
        productTypeLogger.info('产品类型更新成功', { id: editingItem.id, name: formData.name });
      } else {
        // 创建 (后端会自动生成 SKU)
        await productTypeApiClient.createProductType(requestData, factoryId);
        Alert.alert('成功', '产品类型创建成功');
        productTypeLogger.info('产品类型创建成功', { name: formData.name });
      }
      setModalVisible(false);
      loadProductTypes();
    } catch (error) {
      productTypeLogger.error(editingItem ? '更新产品类型失败' : '创建产品类型失败', error as Error);
      const errorMessage = error instanceof Error ? error.message : '操作失败';
      Alert.alert('错误', editingItem ? `更新失败: ${errorMessage}` : `创建失败: ${errorMessage}`);
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
              await productTypeApiClient.deleteProductType(item.id, factoryId);
              Alert.alert('成功', '产品类型删除成功');
              productTypeLogger.info('产品类型删除成功', { id: item.id, name: item.name });
              loadProductTypes();
            } catch (error) {
              productTypeLogger.error('删除产品类型失败', error as Error, { id: item.id });
              const errorMessage = error instanceof Error ? error.message : '删除失败';
              Alert.alert('错误', errorMessage);
            }
          },
        },
      ]
    );
  };

  const handleToggleStatus = async (item: ProductType) => {
    try {
      await productTypeApiClient.updateProductType(
        item.id,
        { isActive: !item.isActive },
        factoryId
      );
      Alert.alert('成功', item.isActive ? '已停用' : '已启用');
      productTypeLogger.info('产品类型状态切换成功', {
        id: item.id,
        name: item.name,
        newStatus: !item.isActive,
      });
      loadProductTypes();
    } catch (error) {
      productTypeLogger.error('切换产品类型状态失败', error as Error, { id: item.id });
      const errorMessage = error instanceof Error ? error.message : '操作失败';
      Alert.alert('错误', errorMessage);
    }
  };

  // 无权限界面
  if (!canManage) {
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="产品类型管理" />
        </Appbar.Header>
        <View style={styles.noPermission}>
          <List.Icon icon="lock" color="#999" />
          <Text style={styles.noPermissionText}>您没有权限访问此页面</Text>
          <Text style={styles.noPermissionHint}>仅限工厂超管、权限管理员和部门管理员</Text>
        </View>
      </View>
    );
  }

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

                <View style={styles.chipRow}>
                  {item.category && (
                    <Chip mode="outlined" compact style={styles.categoryChip}>
                      {item.category}
                    </Chip>
                  )}
                  {item.unit && (
                    <Chip mode="outlined" compact style={styles.unitChip}>
                      单位: {item.unit}
                    </Chip>
                  )}
                </View>

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

          {/* 产品名称 */}
          <TextInput
            label="产品名称 *"
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
            mode="outlined"
            style={styles.input}
            placeholder="例如: 带鱼"
          />

          {/* 编辑时显示产品代码(只读) */}
          {editingItem && (
            <TextInput
              label="产品代码 (自动生成)"
              value={editingItem.code}
              mode="outlined"
              style={styles.input}
              disabled
            />
          )}

          {/* 单位下拉菜单 */}
          <View style={styles.dropdownContainer}>
            <Text style={styles.dropdownLabel}>单位</Text>
            <Menu
              visible={unitMenuVisible}
              onDismiss={() => setUnitMenuVisible(false)}
              anchor={
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setUnitMenuVisible(true)}
                >
                  <Text style={styles.dropdownButtonText}>{formData.unit}</Text>
                  <List.Icon icon="chevron-down" />
                </TouchableOpacity>
              }
            >
              {UNIT_OPTIONS.map((unit) => (
                <Menu.Item
                  key={unit}
                  onPress={() => {
                    setFormData({ ...formData, unit });
                    setUnitMenuVisible(false);
                  }}
                  title={unit}
                />
              ))}
            </Menu>
          </View>

          {/* 分类下拉菜单 */}
          <View style={styles.dropdownContainer}>
            <Text style={styles.dropdownLabel}>分类</Text>
            <Menu
              visible={categoryMenuVisible}
              onDismiss={() => setCategoryMenuVisible(false)}
              anchor={
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setCategoryMenuVisible(true)}
                >
                  <Text style={styles.dropdownButtonText}>{formData.category}</Text>
                  <List.Icon icon="chevron-down" />
                </TouchableOpacity>
              }
            >
              {CATEGORY_OPTIONS.map((category) => (
                <Menu.Item
                  key={category}
                  onPress={() => {
                    setFormData({ ...formData, category });
                    setCategoryMenuVisible(false);
                  }}
                  title={category}
                />
              ))}
            </Menu>
          </View>

          {/* 提示信息 */}
          {!editingItem && (
            <Text style={styles.hintText}>产品代码将自动生成</Text>
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
  noPermission: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noPermissionText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  noPermissionHint: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
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
    height: 31,
  },
  itemActions: {
    flexDirection: 'row',
    marginLeft: 8,
    marginTop: 22,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  categoryChip: {
    height: 31,
  },
  unitChip: {
    height: 31,
    backgroundColor: '#E3F2FD',
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  statusChip: {
    height: 31,
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
  dropdownContainer: {
    marginBottom: 16,
  },
  dropdownLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#333',
  },
  hintText: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
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
  bottomPadding: {
    height: 80,
  },
});
