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
import { useTranslation } from 'react-i18next';
import { departmentApiClient, DepartmentDTO, ApiResponse, PagedResponse } from '../../services/api/departmentApiClient';
import { useAuthStore } from '../../store/authStore';
import { getUserRole, getFactoryId } from '../../types/auth';
import { logger } from '../../utils/logger';

// 创建DepartmentManagement专用logger
const departmentLogger = logger.createContextLogger('DepartmentManagement');

/**
 * 部门管理页面
 * 权限：super_admin, permission_admin
 * 功能：部门CRUD、状态管理、层级结构、初始化默认部门
 */
export default function DepartmentManagementScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation('management');
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
    { name: t('departmentManagement.colors.blue'), value: '#2196F3' },
    { name: t('departmentManagement.colors.green'), value: '#4CAF50' },
    { name: t('departmentManagement.colors.orange'), value: '#FF9800' },
    { name: t('departmentManagement.colors.red'), value: '#F44336' },
    { name: t('departmentManagement.colors.purple'), value: '#9C27B0' },
    { name: t('departmentManagement.colors.cyan'), value: '#00BCD4' },
    { name: t('departmentManagement.colors.pink'), value: '#E91E63' },
    { name: t('departmentManagement.colors.brown'), value: '#795548' },
  ];

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      setLoading(true);
      const response: ApiResponse<PagedResponse<DepartmentDTO>> = await departmentApiClient.getDepartments({
        factoryId: getFactoryId(user),
        page: 1,
        size: 100,
        sortBy: 'displayOrder',
        sortDirection: 'ASC',
      });

      if (response.success && response.data) {
        const departmentCount = response.data.content?.length || 0;
        setDepartments(response.data.content || []);
        departmentLogger.info('部门列表加载成功', {
          departmentCount,
          factoryId: getFactoryId(user),
        });
      }
    } catch (error: unknown) {
      departmentLogger.error('加载部门失败', error, { factoryId: getFactoryId(user) });
      const errorMessage = error instanceof Error ? error.message : t('common.error');
      Alert.alert(t('common.error'), errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleInitializeDefaults = () => {
    Alert.alert(
      t('departmentManagement.initializeDefaults'),
      t('departmentManagement.initializeConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          onPress: async () => {
            try {
              await departmentApiClient.initializeDefaultDepartments(getFactoryId(user));
              departmentLogger.info('默认部门初始化成功', { factoryId: getFactoryId(user) });
              Alert.alert(t('common.success'), t('departmentManagement.initializeSuccess'));
              loadDepartments();
            } catch (error: unknown) {
              departmentLogger.error('初始化失败', error, { factoryId: getFactoryId(user) });
              const errorMessage = error instanceof Error ? error.message : t('departmentManagement.initializeFailed');
              Alert.alert(t('common.error'), errorMessage);
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
        page: 1,
        size: 100,
      });

      if (response.success && response.data) {
        const resultCount = response.data.content?.length || 0;
        setDepartments(response.data.content || []);
        departmentLogger.info('搜索完成', { resultCount, keyword: searchQuery });
      }
    } catch (error: unknown) {
      departmentLogger.error('搜索失败', error, { keyword: searchQuery });
      const errorMessage = error instanceof Error ? error.message : t('common.error');
      Alert.alert(t('common.error'), errorMessage);
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
      Alert.alert(t('common.error'), t('departmentManagement.messages.nameRequired'));
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
        departmentLogger.info('部门更新成功', {
          departmentId: editingItem.id,
          departmentName: formData.name,
        });
        Alert.alert(t('common.success'), t('departmentManagement.messages.updateSuccess'));
      } else {
        // 创建
        await departmentApiClient.createDepartment(
          formData as DepartmentDTO,
          getFactoryId(user)
        );
        departmentLogger.info('部门创建成功', {
          departmentName: formData.name,
          departmentCode: formData.code,
        });
        Alert.alert(t('common.success'), t('departmentManagement.messages.createSuccess'));
      }
      setModalVisible(false);
      loadDepartments();
    } catch (error: unknown) {
      departmentLogger.error('保存部门失败', error, {
        isEdit: !!editingItem,
        departmentName: formData.name,
      });
      const errorMessage = error instanceof Error ? error.message : t('common.error');
      Alert.alert(t('common.error'), errorMessage);
    }
  };

  const handleDelete = (item: DepartmentDTO) => {
    Alert.alert(
      t('common.confirm'),
      t('departmentManagement.messages.deleteConfirm', { name: item.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              if (item.id) {
                await departmentApiClient.deleteDepartment(item.id, getFactoryId(user));
                departmentLogger.info('部门删除成功', {
                  departmentId: item.id,
                  departmentName: item.name,
                });
                Alert.alert(t('common.success'), t('departmentManagement.messages.deleteSuccess'));
                loadDepartments();
              }
            } catch (error: unknown) {
              departmentLogger.error('删除部门失败', error, {
                departmentId: item.id,
                departmentName: item.name,
              });
              const errorMessage = error instanceof Error ? error.message : t('common.error');
              Alert.alert(t('common.error'), errorMessage);
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
        departmentLogger.info('部门状态切换成功', {
          departmentId: item.id,
          departmentName: item.name,
          newStatus: !item.isActive,
        });
        Alert.alert(t('common.success'), item.isActive ? t('departmentManagement.messages.statusUpdated') : t('departmentManagement.messages.statusActivated'));
        loadDepartments();
      }
    } catch (error: unknown) {
      departmentLogger.error('切换部门状态失败', error, {
        departmentId: item.id,
        departmentName: item.name,
      });
      const errorMessage = error instanceof Error ? error.message : t('common.error');
      Alert.alert(t('common.error'), errorMessage);
    }
  };

  if (!canManage) {
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title={t('departmentManagement.title')} />
        </Appbar.Header>
        <View style={styles.noPermission}>
          <List.Icon icon="lock" color="#999" />
          <Text style={styles.noPermissionText}>{t('common.noPermission')}</Text>
          <Text style={styles.noPermissionHint}>{t('common.permissionHint')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={t('departmentManagement.title')} />
        <Appbar.Action icon="refresh" onPress={loadDepartments} />
        <Appbar.Action icon="cog-outline" onPress={handleInitializeDefaults} />
      </Appbar.Header>

      {/* Content */}
      <ScrollView style={styles.content}>
        {/* Search */}
        <Searchbar
          placeholder={t('departmentManagement.searchPlaceholder')}
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
                <Text style={styles.statLabel}>{t('departmentManagement.stats.total')}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {departments.filter(d => d.isActive).length}
                </Text>
                <Text style={styles.statLabel}>{t('departmentManagement.stats.enabled')}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {departments.reduce((sum, d) => sum + (d.employeeCount || 0), 0)}
                </Text>
                <Text style={styles.statLabel}>{t('departmentManagement.stats.totalEmployees')}</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Department List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>{t('common.loading')}</Text>
          </View>
        ) : departments.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <List.Icon icon="office-building-outline" color="#999" />
              <Text style={styles.emptyText}>{t('departmentManagement.empty.noDepartments')}</Text>
              <Text style={styles.emptyHint}>{t('departmentManagement.empty.hint')}</Text>
              <Button
                mode="outlined"
                onPress={handleInitializeDefaults}
                style={{ marginTop: 16 }}
              >
                {t('departmentManagement.initializeDefaults')}
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
                      <Text style={styles.infoLabel}>{t('departmentManagement.form.manager')}: </Text>
                      <Text style={styles.infoValue}>{item.managerName}</Text>
                    </View>
                  )}
                  <View style={styles.infoItem}>
                    <List.Icon icon="account-group" style={styles.infoIcon} />
                    <Text style={styles.infoLabel}>{t('departmentManagement.form.employees')}: </Text>
                    <Text style={styles.infoValue}>{t('departmentManagement.form.employeeCount', { count: item.employeeCount || 0 })}</Text>
                  </View>
                </View>

                {item.parentDepartmentName && (
                  <View style={styles.infoItem}>
                    <List.Icon icon="sitemap" style={styles.infoIcon} />
                    <Text style={styles.infoLabel}>{t('departmentManagement.form.parentDepartment')}: </Text>
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
                    {item.isActive ? t('common.enabled') : t('common.disabled')}
                  </Chip>
                  {item.displayOrder !== undefined && (
                    <Chip mode="outlined" compact style={styles.orderChip}>
                      {t('departmentManagement.form.displayOrder')}: {item.displayOrder}
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
            {editingItem ? t('departmentManagement.edit') : t('departmentManagement.add')}
          </Text>

          <ScrollView
            style={styles.modalScrollView}
            contentContainerStyle={{ paddingBottom: 16 }}
          >
            <TextInput
              label={`${t('departmentManagement.form.name')} *`}
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              mode="outlined"
              style={styles.input}
              placeholder={t('departmentManagement.form.namePlaceholder')}
            />

            <TextInput
              label={t('departmentManagement.form.code')}
              value={formData.code}
              onChangeText={(text) => setFormData({ ...formData, code: text.toUpperCase() })}
              mode="outlined"
              style={styles.input}
              placeholder={t('departmentManagement.form.codePlaceholder')}
              autoCapitalize="characters"
              disabled={!!editingItem}
            />

            <TextInput
              label={t('departmentManagement.form.description')}
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              mode="outlined"
              style={styles.input}
              multiline
              numberOfLines={2}
              placeholder={t('departmentManagement.form.descriptionPlaceholder')}
            />

            <TextInput
              label={t('departmentManagement.form.displayOrder')}
              value={formData.displayOrder?.toString() || '0'}
              onChangeText={(text) => setFormData({ ...formData, displayOrder: parseInt(text) || 0 })}
              mode="outlined"
              style={styles.input}
              keyboardType="number-pad"
              placeholder={t('departmentManagement.form.displayOrderPlaceholder')}
            />

            {/* Color Picker */}
            <View style={styles.colorPickerContainer}>
              <Text style={styles.colorLabel}>{t('departmentManagement.form.departmentColor')}</Text>
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
              <Text style={styles.switchLabel}>{t('departmentManagement.form.isActive')}</Text>
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
              {t('common.cancel')}
            </Button>
            <Button
              mode="contained"
              onPress={handleSave}
            >
              {editingItem ? t('common.update') : t('common.create')}
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
          label={t('departmentManagement.add')}
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
    height: 32,
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
    height: 32,
  },
  orderChip: {
    height: 32,
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
