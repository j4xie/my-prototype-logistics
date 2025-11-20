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
  Switch,
  Menu,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { departmentApiClient, DepartmentDTO, ApiResponse, PagedResponse } from '../../services/api/departmentApiClient';
import { useAuthStore } from '../../store/authStore';
import { getUserRole, getFactoryId } from '../../types/auth';

/**
 * 部门管理页面
 * 权限：super_admin, permission_admin
 * 功能：部门CRUD、状态管理、层级结构、初始化默认部门
 */
export default function DepartmentManagementScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();

  const [departments, setDepartments] = useState<DepartmentDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<DepartmentDTO | null>(null);
  const [colorMenuVisible, setColorMenuVisible] = useState(false);

  // 权限控制
  const userType = user?.userType || 'factory';
  const roleCode = getUserRole(user);
  const isPlatformAdmin = userType === 'platform';
  const isSuperAdmin = roleCode === 'factory_super_admin';
  const isPermissionAdmin = roleCode === 'permission_admin';
  const canManage = isPlatformAdmin || isSuperAdmin || isPermissionAdmin;

  // 表单状态
  const [formData, setFormData] = useState<Partial<DepartmentDTO>>({
    name: '',
    code: '',
    description: '',
    managerUserId: undefined,
    parentDepartmentId: undefined,
    isActive: true,
    displayOrder: 0,
    color: '#2196F3',
    icon: 'office-building',
  });

  // 预设颜色
  const presetColors = [
    { name: '蓝色', value: '#2196F3' },
    { name: '绿色', value: '#4CAF50' },
    { name: '橙色', value: '#FF9800' },
    { name: '红色', value: '#F44336' },
    { name: '紫色', value: '#9C27B0' },
    { name: '青色', value: '#00BCD4' },
    { name: '粉色', value: '#E91E63' },
    { name: '棕色', value: '#795548' },
  ];

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      setLoading(true);
      const response: ApiResponse<PagedResponse<DepartmentDTO>> = await departmentApiClient.getDepartments({
        factoryId: getFactoryId(user),
        page: 0,
        size: 100,
        sortBy: 'displayOrder',
        sortDirection: 'ASC',
      });

      if (response.success && response.data) {
        setDepartments(response.data.content || []);
      }
    } catch (error: unknown) {
      console.error('加载部门失败:', error);
      const errorMessage = error instanceof Error ? error.message : '加载部门失败';
      Alert.alert('错误', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleInitializeDefaults = () => {
    Alert.alert(
      '初始化默认部门',
      '将创建5个默认部门（养殖、加工、物流、质量、管理）。已有部门的工厂将跳过此操作。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认',
          onPress: async () => {
            try {
              await departmentApiClient.initializeDefaultDepartments(getFactoryId(user));
              Alert.alert('成功', '默认部门初始化成功');
              loadDepartments();
            } catch (error: unknown) {
              console.error('初始化失败:', error);
              const errorMessage = error instanceof Error ? error.message : '初始化失败';
              Alert.alert('错误', errorMessage);
            }
          },
        },
      ]
    );
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadDepartments();
      return;
    }

    try {
      setLoading(true);
      const response: ApiResponse<PagedResponse<DepartmentDTO>> = await departmentApiClient.searchDepartments({
        keyword: searchQuery,
        factoryId: getFactoryId(user),
        page: 0,
        size: 100,
      });

      if (response.success && response.data) {
        setDepartments(response.data.content || []);
      }
    } catch (error: unknown) {
      console.error('搜索失败:', error);
      const errorMessage = error instanceof Error ? error.message : '搜索失败';
      Alert.alert('错误', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      code: '',
      description: '',
      managerUserId: undefined,
      parentDepartmentId: undefined,
      isActive: true,
      displayOrder: departments.length,
      color: '#2196F3',
      icon: 'office-building',
    });
    setModalVisible(true);
  };

  const handleEdit = (item: DepartmentDTO) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      code: item.code || '',
      description: item.description || '',
      managerUserId: item.managerUserId,
      parentDepartmentId: item.parentDepartmentId,
      isActive: item.isActive !== undefined ? item.isActive : true,
      displayOrder: item.displayOrder || 0,
      color: item.color || '#2196F3',
      icon: item.icon || 'office-building',
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.name) {
      Alert.alert('提示', '部门名称不能为空');
      return;
    }

    try {
      if (editingItem && editingItem.id) {
        // 更新
        await departmentApiClient.updateDepartment(
          editingItem.id,
          formData as DepartmentDTO,
          getFactoryId(user)
        );
        Alert.alert('成功', '部门更新成功');
      } else {
        // 创建
        await departmentApiClient.createDepartment(
          formData as DepartmentDTO,
          getFactoryId(user)
        );
        Alert.alert('成功', '部门创建成功');
      }
      setModalVisible(false);
      loadDepartments();
    } catch (error: unknown) {
      console.error('保存失败:', error);
      const errorMessage = error instanceof Error ? error.message : (editingItem ? '更新失败' : '创建失败');
      Alert.alert('错误', errorMessage);
    }
  };

  const handleDelete = (item: DepartmentDTO) => {
    Alert.alert(
      '确认删除',
      `确定要删除部门"${item.name}"吗？此操作不可撤销。\n\n注意：有子部门或员工的部门无法删除。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              if (item.id) {
                await departmentApiClient.deleteDepartment(item.id, getFactoryId(user));
                Alert.alert('成功', '部门删除成功');
                loadDepartments();
              }
            } catch (error: unknown) {
              console.error('删除失败:', error);
              const errorMessage = error instanceof Error ? error.message : '删除失败';
              Alert.alert('错误', errorMessage);
            }
          },
        },
      ]
    );
  };

  const handleToggleStatus = async (item: DepartmentDTO) => {
    try {
      if (item.id) {
        await departmentApiClient.updateDepartment(
          item.id,
          { isActive: !item.isActive } as DepartmentDTO,
          getFactoryId(user)
        );
        Alert.alert('成功', item.isActive ? '已停用' : '已启用');
        loadDepartments();
      }
    } catch (error: unknown) {
      console.error('切换状态失败:', error);
      const errorMessage = error instanceof Error ? error.message : '操作失败';
      Alert.alert('错误', errorMessage);
    }
  };

  if (!canManage) {
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="部门管理" />
        </Appbar.Header>
        <View style={styles.noPermission}>
          <List.Icon icon="lock" color="#999" />
          <Text style={styles.noPermissionText}>您没有权限访问此页面</Text>
          <Text style={styles.noPermissionHint}>仅限工厂超管和权限管理员</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="部门管理" />
        <Appbar.Action icon="refresh" onPress={loadDepartments} />
        <Appbar.Action icon="cog-outline" onPress={handleInitializeDefaults} />
      </Appbar.Header>

      {/* Content */}
      <ScrollView style={styles.content}>
        {/* Search */}
        <Searchbar
          placeholder="搜索部门编码、名称"
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
                <Text style={styles.statValue}>{departments.length}</Text>
                <Text style={styles.statLabel}>总部门数</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {departments.filter(d => d.isActive).length}
                </Text>
                <Text style={styles.statLabel}>启用中</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {departments.reduce((sum, d) => sum + (d.employeeCount || 0), 0)}
                </Text>
                <Text style={styles.statLabel}>总员工数</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Department List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        ) : departments.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <List.Icon icon="office-building-outline" color="#999" />
              <Text style={styles.emptyText}>暂无部门</Text>
              <Text style={styles.emptyHint}>点击右下角"+"按钮添加部门</Text>
              <Button
                mode="outlined"
                onPress={handleInitializeDefaults}
                style={{ marginTop: 16 }}
              >
                初始化默认部门
              </Button>
            </Card.Content>
          </Card>
        ) : (
          departments.map((item) => (
            <Card key={item.id} style={styles.itemCard}>
              <Card.Content>
                <View style={styles.itemHeader}>
                  <View style={styles.itemTitleRow}>
                    {/* Color Indicator */}
                    <View
                      style={[
                        styles.colorIndicator,
                        { backgroundColor: item.color || '#2196F3' }
                      ]}
                    />
                    <Text style={styles.itemName}>{item.name}</Text>
                    {item.code && (
                      <Chip mode="outlined" compact style={styles.codeChip}>
                        {item.code}
                      </Chip>
                    )}
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

                {/* Description */}
                {item.description && (
                  <Text style={styles.itemDescription}>{item.description}</Text>
                )}

                {/* Info Row */}
                <View style={styles.infoRow}>
                  {item.managerName && (
                    <View style={styles.infoItem}>
                      <List.Icon icon="account-tie" style={styles.infoIcon} />
                      <Text style={styles.infoLabel}>负责人: </Text>
                      <Text style={styles.infoValue}>{item.managerName}</Text>
                    </View>
                  )}
                  <View style={styles.infoItem}>
                    <List.Icon icon="account-group" style={styles.infoIcon} />
                    <Text style={styles.infoLabel}>员工: </Text>
                    <Text style={styles.infoValue}>{item.employeeCount || 0}人</Text>
                  </View>
                </View>

                {item.parentDepartmentName && (
                  <View style={styles.infoItem}>
                    <List.Icon icon="sitemap" style={styles.infoIcon} />
                    <Text style={styles.infoLabel}>上级部门: </Text>
                    <Text style={styles.infoValue}>{item.parentDepartmentName}</Text>
                  </View>
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
                  {item.displayOrder !== undefined && (
                    <Chip mode="outlined" compact style={styles.orderChip}>
                      排序: {item.displayOrder}
                    </Chip>
                  )}
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
            {editingItem ? '编辑部门' : '添加部门'}
          </Text>

          <ScrollView
            style={styles.modalScrollView}
            contentContainerStyle={{ paddingBottom: 16 }}
          >
            <TextInput
              label="部门名称 *"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              mode="outlined"
              style={styles.input}
              placeholder="例如: 生产部/质检部/物流部"
            />

            <TextInput
              label="部门编码"
              value={formData.code}
              onChangeText={(text) => setFormData({ ...formData, code: text.toUpperCase() })}
              mode="outlined"
              style={styles.input}
              placeholder="例如: DEPT001"
              autoCapitalize="characters"
              disabled={!!editingItem}
            />

            <TextInput
              label="描述"
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              mode="outlined"
              style={styles.input}
              multiline
              numberOfLines={2}
              placeholder="部门详细描述"
            />

            <TextInput
              label="显示顺序"
              value={formData.displayOrder?.toString() || '0'}
              onChangeText={(text) => setFormData({ ...formData, displayOrder: parseInt(text) || 0 })}
              mode="outlined"
              style={styles.input}
              keyboardType="number-pad"
              placeholder="数字越小越靠前"
            />

            {/* Color Picker */}
            <View style={styles.colorPickerContainer}>
              <Text style={styles.colorLabel}>部门颜色</Text>
              <View style={styles.colorGrid}>
                {presetColors.map((color) => (
                  <Button
                    key={color.value}
                    mode={formData.color === color.value ? 'contained' : 'outlined'}
                    onPress={() => setFormData({ ...formData, color: color.value })}
                    style={[
                      styles.colorButton,
                      { backgroundColor: formData.color === color.value ? color.value : 'transparent' }
                    ]}
                    labelStyle={{ color: formData.color === color.value ? 'white' : color.value }}
                    compact
                  >
                    {color.name}
                  </Button>
                ))}
              </View>
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>是否启用</Text>
              <Switch
                value={formData.isActive}
                onValueChange={(value) => setFormData({ ...formData, isActive: value })}
              />
            </View>
          </ScrollView>

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setModalVisible(false)}
            >
              取消
            </Button>
            <Button
              mode="contained"
              onPress={handleSave}
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
          label="添加部门"
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
  colorIndicator: {
    width: 4,
    height: 24,
    borderRadius: 2,
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
  itemDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    marginBottom: 8,
  },
  infoRow: {
    marginBottom: 4,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  infoIcon: {
    margin: 0,
    marginRight: 4,
    width: 24,
  },
  infoLabel: {
    fontSize: 13,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 8,
    marginTop: 8,
  },
  statusChip: {
    height: 28,
  },
  orderChip: {
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
    maxHeight: 800,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    marginBottom: 16,
  },
  colorPickerContainer: {
    marginBottom: 16,
  },
  colorLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorButton: {
    minWidth: 70,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  switchLabel: {
    fontSize: 16,
    color: '#333',
  },
  modalScrollView: {
    flexGrow: 0,
    flexShrink: 1,
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
  bottomPadding: {
    height: 80,
  },
});
