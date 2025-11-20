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
  Searchbar,
  Menu,
  Divider,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { materialTypeApiClient, MaterialType, CreateMaterialTypeRequest } from '../../services/api/materialTypeApiClient';
import { materialSpecApiClient, DEFAULT_SPEC_CONFIG, SpecConfig } from '../../services/api/materialSpecApiClient';
import { useAuthStore } from '../../store/authStore';
import { handleError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建MaterialTypeManagement专用logger
const materialTypeLogger = logger.createContextLogger('MaterialTypeManagement');

/**
 * 原材料类型管理页面
 * 权限：super_admin、platform_admin
 * 功能：原材料类型CRUD、状态管理、搜索筛选
 */
export default function MaterialTypeManagementScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();

  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<MaterialType | null>(null);

  // Menu visibility states
  const [categoryMenuVisible, setCategoryMenuVisible] = useState(false);
  const [unitMenuVisible, setUnitMenuVisible] = useState(false);
  const [storageMenuVisible, setStorageMenuVisible] = useState(false);
  const [specMenuVisible, setSpecMenuVisible] = useState(false);

  // 规格配置状态
  const [specConfig, setSpecConfig] = useState<SpecConfig>(DEFAULT_SPEC_CONFIG);
  const [customSpecMode, setCustomSpecMode] = useState(false);
  const [customSpecValue, setCustomSpecValue] = useState('');

  // 权限控制
  const userType = user?.userType || 'factory';
  // 修复：后端可能返回 position 字段的值（如 proc_admin），需要映射到实际角色代码
  const rawRole = user?.factoryUser?.role || user?.factoryUser?.roleCode || user?.roleCode || 'viewer';
  const position = user?.factoryUser?.position || '';
  
  // 角色映射：将 position 值（如 proc_admin）映射到实际角色代码
  let roleCode = rawRole;
  if (rawRole === 'proc_admin' || position === 'proc_admin' || rawRole === 'department_admin') {
    roleCode = 'department_admin';
  }
  
  const isPlatformAdmin = userType === 'platform';
  // 修复：permission_admin 和 department_admin 也应该有管理权限
  const isSuperAdmin = roleCode === 'factory_super_admin' || roleCode === 'permission_admin';
  const isDepartmentAdmin = roleCode === 'department_admin';
  const canManage = isPlatformAdmin || isSuperAdmin || isDepartmentAdmin;

  // 权限检查日志
  materialTypeLogger.debug('权限检查', {
    userType,
    rawRole,
    position,
    roleCode,
    isPlatformAdmin,
    isSuperAdmin,
    isDepartmentAdmin,
    canManage,
  });

  // 常用选项
  const categoryOptions = ['海鲜', '肉类', '蔬菜', '水果', '粉类', '米面', '油类', '调料', '其他'];
  const unitOptions = ['kg', '斤', '克', '个', '箱', '袋', '瓶', '罐'];
  const storageTypeOptions = ['新鲜', '冻货', '干货', '常温'];

  // 表单状态
  const [formData, setFormData] = useState<Partial<CreateMaterialTypeRequest>>({
    code: '', // 将由后端自动生成
    name: '',
    category: '',
    specification: '',
    unit: 'kg',
    shelfLife: 0,
    storageType: '新鲜',
    storageConditions: '',
    description: '',
  });

  useEffect(() => {
    loadMaterialTypes();
    loadSpecConfig();
  }, []);

  const loadSpecConfig = async () => {
    try {
      materialTypeLogger.debug('加载规格配置', { factoryId: user?.factoryId });
      const response = await materialSpecApiClient.getSpecConfig(user?.factoryId);
      materialTypeLogger.info('规格配置加载成功', { hasData: !!response.data });
      setSpecConfig(response.data);
    } catch (error) {
      materialTypeLogger.warn('规格配置加载失败，使用默认配置', error);
      // 使用前端默认配置作为fallback
      setSpecConfig(DEFAULT_SPEC_CONFIG);
    }
  };

  const loadMaterialTypes = async () => {
    try {
      setLoading(true);
      materialTypeLogger.debug('开始加载原材料类型', { factoryId: user?.factoryId });

      // 使用 getActiveMaterialTypes 获取激活的原材料类型列表（返回 List，不需要分页）
      const response = await materialTypeApiClient.getActiveMaterialTypes(user?.factoryId);

      materialTypeLogger.debug('API响应接收', { hasData: !!response.data });

      // 后端返回格式: ApiResponse<List<RawMaterialTypeDTO>>
      // response.data 直接是数组
      if (response && response.data && Array.isArray(response.data)) {
        materialTypeLogger.info('原材料类型加载成功', { count: response.data.length });
        setMaterialTypes(response.data);
      } else if (Array.isArray(response)) {
        // 兼容旧格式（直接返回数组）
        materialTypeLogger.info('原材料类型加载成功(兼容格式)', { count: response.length });
        setMaterialTypes(response);
      } else {
        materialTypeLogger.warn('响应格式异常', { response });
        setMaterialTypes([]);
      }
    } catch (error) {
      materialTypeLogger.error('加载原材料类型失败', error, {
        status: error.response?.status,
      });
      Alert.alert('错误', error.response?.data?.message || '加载原材料类型失败');
      setMaterialTypes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadMaterialTypes();
      return;
    }

    try {
      setLoading(true);
      // searchMaterialTypes 返回分页响应: ApiResponse<PageResponse<RawMaterialTypeDTO>>
      const response = await materialTypeApiClient.searchMaterialTypes(searchQuery, user?.factoryId);
      
      // 处理分页响应格式
      if (response && response.data && response.data.content) {
        setMaterialTypes(response.data.content);
      } else if (response && response.data && Array.isArray(response.data)) {
        setMaterialTypes(response.data);
      } else if (Array.isArray(response)) {
        setMaterialTypes(response);
      } else {
        setMaterialTypes([]);
      }
    } catch (error) {
      materialTypeLogger.error('搜索失败', error, { query: searchQuery });
      Alert.alert('错误', error.response?.data?.message || '搜索失败');
      setMaterialTypes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingItem(null);
    setFormData({
      code: '', // 自动生成，不需要用户输入
      name: '',
      category: categoryOptions[0], // 默认选择第一个类别
      specification: '',
      unit: 'kg',
      shelfLife: 7, // 默认保质期7天
      storageType: '新鲜',
      storageConditions: '',
      description: '',
    });
    setCustomSpecMode(false);
    setCustomSpecValue('');
    setModalVisible(true);
  };

  const handleEdit = (item: MaterialType) => {
    setEditingItem(item);
    setFormData({
      code: item.code,
      name: item.name,
      category: item.category || '',
      specification: item.specification || '',
      unit: item.unit,
      shelfLife: item.shelfLife || 0,
      storageType: item.storageType,
      storageConditions: item.storageConditions || '',
      description: item.description || '',
    });
    setCustomSpecMode(false);
    setCustomSpecValue('');
    setModalVisible(true);
  };

  const handleSave = async () => {
    // 验证必填项（编码不需要验证，由后端自动生成）
    if (!formData.name || !formData.category || !formData.unit || !formData.storageType) {
      Alert.alert('提示', '原料名称、类别、单位和储存类型不能为空');
      return;
    }

    try {
      if (editingItem) {
        // 更新 - 保留原有编码
        await materialTypeApiClient.updateMaterialType(
          editingItem.id,
          formData as Partial<CreateMaterialTypeRequest>,
          user?.factoryId
        );
        Alert.alert('成功', '原材料类型更新成功');
      } else {
        // 创建 - 移除code字段，让后端自动生成
        const { code, ...dataWithoutCode } = formData;
        await materialTypeApiClient.createMaterialType(
          dataWithoutCode as CreateMaterialTypeRequest,
          user?.factoryId
        );
        Alert.alert('成功', '原材料类型创建成功');
      }
      setModalVisible(false);
      loadMaterialTypes();
    } catch (error) {
      materialTypeLogger.error(editingItem ? '更新失败' : '创建失败', error);
      Alert.alert('错误', error.response?.data?.message || (editingItem ? '更新失败' : '创建失败'));
    }
  };

  const handleDelete = (item: MaterialType) => {
    Alert.alert(
      '确认删除',
      `确定要删除原材料类型"${item.name}"吗？此操作不可撤销。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await materialTypeApiClient.deleteMaterialType(item.id, user?.factoryId);
              Alert.alert('成功', '原材料类型删除成功');
              loadMaterialTypes();
            } catch (error) {
              materialTypeLogger.error('删除失败', error, { itemId: item.id });
              Alert.alert('错误', error.response?.data?.message || '删除失败');
            }
          },
        },
      ]
    );
  };

  const handleToggleStatus = async (item: MaterialType) => {
    try {
      // 传递完整数据，并进行字段映射（materialCode → code, description → notes）
      const updateData = {
        code: item.materialCode,
        name: item.name,
        unit: item.unit,
        category: item.category,
        storageType: item.storageType,
        notes: item.description || '',
        isActive: !item.isActive,
      };

      await materialTypeApiClient.updateMaterialType(
        item.id,
        updateData,
        user?.factoryId
      );
      Alert.alert('成功', item.isActive ? '已停用' : '已启用');
      loadMaterialTypes();
    } catch (error) {
      materialTypeLogger.error('切换状态失败', error, { itemId: item.id });
      Alert.alert('错误', error.response?.data?.message || '操作失败');
    }
  };

  if (!canManage) {
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="原材料类型管理" />
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
        <Appbar.Content title="原材料类型管理" />
        <Appbar.Action icon="refresh" onPress={loadMaterialTypes} />
      </Appbar.Header>

      {/* Content */}
      <ScrollView style={styles.content}>
        {/* Search */}
        <Searchbar
          placeholder="搜索原料编码、名称、类别"
          onChangeText={setSearchQuery}
          value={searchQuery}
          onSubmitEditing={handleSearch}
          style={styles.searchbar}
        />

        {/* Stats Card */}
        <Card style={styles.statsCard}>
          <Card.Content>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{materialTypes.length}</Text>
                <Text style={styles.statLabel}>总数</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {materialTypes.filter(m => m.isActive).length}
                </Text>
                <Text style={styles.statLabel}>启用中</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {new Set(materialTypes.map(m => m.category)).size}
                </Text>
                <Text style={styles.statLabel}>分类数</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Material Type List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        ) : materialTypes.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <List.Icon icon="package-variant" color="#999" />
              <Text style={styles.emptyText}>暂无原材料类型</Text>
              <Text style={styles.emptyHint}>点击右下角"+"按钮添加原材料类型</Text>
            </Card.Content>
          </Card>
        ) : (
          materialTypes.map((item) => (
            <Card key={item.id} style={styles.itemCard} mode="elevated">
              <Card.Content>
                {/* Header Row */}
                <View style={styles.itemHeader}>
                  <View style={styles.leftHeader}>
                    <View style={styles.iconContainer}>
                      <List.Icon
                        icon="package-variant"
                        color="#fff"
                        style={styles.iconStyle}
                      />
                    </View>
                    <View style={styles.titleContainer}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemCode}>{item.code}</Text>
                    </View>
                  </View>
                  <Chip
                    icon={item.isActive ? 'check-circle' : 'close-circle'}
                    mode="flat"
                    style={[
                      styles.statusChip,
                      { backgroundColor: item.isActive ? '#E8F5E9' : '#FFEBEE' },
                    ]}
                    textStyle={{
                      fontSize: 12,
                      fontWeight: '500',
                      color: item.isActive ? '#2E7D32' : '#C62828',
                    }}
                  >
                    {item.isActive ? '启用中' : '已停用'}
                  </Chip>
                </View>

                {/* Info Tags */}
                <View style={styles.tagsRow}>
                  {item.category && item.category.trim() !== '' && (
                    <Chip mode="outlined" style={styles.tagChip}>
                      {item.category}
                    </Chip>
                  )}
                  {item.storageType && item.storageType.trim() !== '' && (
                    <Chip mode="outlined" style={styles.tagChip}>
                      {item.storageType}
                    </Chip>
                  )}
                  {item.unit && item.unit.trim() !== '' && (
                    <Chip mode="outlined" style={styles.tagChip}>
                      {item.unit}
                    </Chip>
                  )}
                  {item.shelfLife && item.shelfLife > 0 && (
                    <Chip mode="outlined" style={styles.tagChip}>
                      {item.shelfLife}天
                    </Chip>
                  )}
                </View>

                {/* Action Buttons */}
                <View style={styles.actionRow}>
                  <Button
                    mode="outlined"
                    icon={item.isActive ? 'eye' : 'eye-off'}
                    onPress={() => handleToggleStatus(item)}
                    style={styles.actionButton}
                  >
                    {item.isActive ? '停用' : '启用'}
                  </Button>
                  <Button
                    mode="outlined"
                    icon="pencil"
                    onPress={() => handleEdit(item)}
                    style={styles.actionButton}
                  >
                    编辑
                  </Button>
                  <Button
                    mode="outlined"
                    icon="delete"
                    onPress={() => handleDelete(item)}
                    style={styles.actionButton}
                    textColor="#F44336"
                  >
                    删除
                  </Button>
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
            {editingItem ? '编辑原材料类型' : '添加原材料类型'}
          </Text>

          <ScrollView style={styles.modalScrollView} contentContainerStyle={{ paddingBottom: 16 }}>
            {/* 编辑时显示编码（只读），创建时自动生成不显示 */}
            {editingItem && (
              <TextInput
                label="原料编码"
                value={formData.code}
                mode="outlined"
                style={styles.input}
                disabled
                right={<TextInput.Icon icon="lock" />}
              />
            )}


            <TextInput
              label="原料名称 *"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              mode="outlined"
              style={styles.input}
              placeholder="例如: 三文鱼"
            />

            {/* 类别下拉选择 */}
            <Menu
              visible={categoryMenuVisible}
              onDismiss={() => setCategoryMenuVisible(false)}
              anchor={
                <TextInput
                  label="类别 *"
                  value={formData.category}
                  mode="outlined"
                  style={styles.input}
                  editable={false}
                  right={<TextInput.Icon icon="menu-down" onPress={() => setCategoryMenuVisible(true)} />}
                  onPressIn={() => setCategoryMenuVisible(true)}
                />
              }
            >
              {categoryOptions.map((cat) => (
                <Menu.Item
                  key={cat}
                  onPress={() => {
                    setFormData({ ...formData, category: cat });
                    setCategoryMenuVisible(false);
                  }}
                  title={cat}
                />
              ))}
            </Menu>

            {/* 规格说明 - 动态下拉选择或自定义输入 */}
            <Menu
              visible={specMenuVisible}
              onDismiss={() => setSpecMenuVisible(false)}
              anchor={
                <TextInput
                  label="规格说明"
                  value={customSpecMode ? customSpecValue : formData.specification}
                  mode="outlined"
                  style={styles.input}
                  editable={customSpecMode}
                  right={
                    customSpecMode ? (
                      <TextInput.Icon
                        icon="close"
                        onPress={() => {
                          setCustomSpecMode(false);
                          setCustomSpecValue('');
                        }}
                      />
                    ) : (
                      <TextInput.Icon
                        icon="menu-down"
                        onPress={() => setSpecMenuVisible(true)}
                      />
                    )
                  }
                  onPressIn={() => !customSpecMode && setSpecMenuVisible(true)}
                  onChangeText={(text) => {
                    if (customSpecMode) {
                      setCustomSpecValue(text);
                      setFormData({ ...formData, specification: text });
                    }
                  }}
                  placeholder={customSpecMode ? '输入自定义规格' : '从列表选择或自定义（可选）'}
                />
              }
            >
              {/* 当前类别的规格选项 */}
              {(specConfig[formData.category || categoryOptions[0]] || []).map((spec) => (
                <Menu.Item
                  key={spec}
                  title={spec}
                  onPress={() => {
                    setFormData({ ...formData, specification: spec });
                    setSpecMenuVisible(false);
                    setCustomSpecMode(false);
                  }}
                />
              ))}
              <Divider />
              <Menu.Item
                leadingIcon="pencil"
                title="➕ 自定义输入"
                onPress={() => {
                  setCustomSpecMode(true);
                  setSpecMenuVisible(false);
                  setCustomSpecValue(formData.specification || '');
                }}
              />
            </Menu>

            {/* 单位下拉选择 */}
            <Menu
              visible={unitMenuVisible}
              onDismiss={() => setUnitMenuVisible(false)}
              anchor={
                <TextInput
                  label="单位 *"
                  value={formData.unit}
                  mode="outlined"
                  style={styles.input}
                  editable={false}
                  right={<TextInput.Icon icon="menu-down" onPress={() => setUnitMenuVisible(true)} />}
                  onPressIn={() => setUnitMenuVisible(true)}
                />
              }
            >
              {unitOptions.map((unit) => (
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

            <TextInput
              label="保质期（天）"
              value={formData.shelfLife?.toString() || ''}
              onChangeText={(text) => setFormData({ ...formData, shelfLife: parseInt(text) || 0 })}
              mode="outlined"
              style={styles.input}
              keyboardType="numeric"
              placeholder="例如: 7"
            />

            {/* 储存类型下拉选择 */}
            <Menu
              visible={storageMenuVisible}
              onDismiss={() => setStorageMenuVisible(false)}
              anchor={
                <TextInput
                  label="储存类型 *"
                  value={formData.storageType}
                  mode="outlined"
                  style={styles.input}
                  editable={false}
                  right={<TextInput.Icon icon="menu-down" onPress={() => setStorageMenuVisible(true)} />}
                  onPressIn={() => setStorageMenuVisible(true)}
                />
              }
            >
              {storageTypeOptions.map((type) => (
                <Menu.Item
                  key={type}
                  onPress={() => {
                    setFormData({ ...formData, storageType: type });
                    setStorageMenuVisible(false);
                  }}
                  title={type}
                />
              ))}
            </Menu>

            <TextInput
              label="储存条件"
              value={formData.storageConditions}
              onChangeText={(text) => setFormData({ ...formData, storageConditions: text })}
              mode="outlined"
              style={styles.input}
              multiline
              numberOfLines={2}
              placeholder="例如: 0-4℃冷藏"
            />

            <TextInput
              label="描述"
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              mode="outlined"
              style={styles.input}
              multiline
              numberOfLines={3}
              placeholder="原料详细描述（可选）"
            />
          </ScrollView>

          {/* 底部按钮 */}
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
      {canManage && (
        <FAB
          icon="plus"
          style={styles.fab}
          onPress={handleAdd}
          label="添加原材料类型"
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
    color: '#999',
    marginTop: 16,
  },
  noPermissionHint: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 8,
  },
  searchbar: {
    margin: 16,
    marginBottom: 8,
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
    marginBottom: 12,
    borderRadius: 12,
    elevation: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  leftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconStyle: {
    margin: 0,
    width: 28,
    height: 28,
  },
  titleContainer: {
    flex: 1,
  },
  itemName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 2,
  },
  itemCode: {
    fontSize: 13,
    color: '#757575',
  },
  statusChip: {
    height: 28,
    paddingHorizontal: 4,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  tagChip: {
    height: 32,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
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
    maxHeight: 800,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  modalScrollView: {
    flexGrow: 0,
    flexShrink: 1,
  },
  input: {
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingTop: 16,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  modalButton: {
    minWidth: 100,
  },
  bottomPadding: {
    height: 100,
  },
});
