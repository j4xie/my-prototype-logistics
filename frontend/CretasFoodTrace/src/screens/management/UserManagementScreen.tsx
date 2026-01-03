import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Text,
  Appbar,
  FAB,
  Card,
  Chip,
  Portal,
  Modal,
  TextInput,
  Button,
  ActivityIndicator,
  List,
  Searchbar,
  SegmentedButtons,
  Menu,
  IconButton,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { userApiClient, UserDTO, CreateUserRequest } from '../../services/api/userApiClient';
import { useAuthStore } from '../../store/authStore';
import { NotImplementedError } from '../../errors';
import { handleError, getErrorMsg } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import { canManageUsers, getPermissionDebugInfo, getFactoryId } from '../../utils/permissionHelper';

// 创建UserManagement专用logger
const userManagementLogger = logger.createContextLogger('UserManagement');

/**
 * 用户管理页面
 * 权限：factory_super_admin、platform_admin
 * 功能：用户CRUD、角色管理、激活/停用
 */
export default function UserManagementScreen() {
  const { t } = useTranslation('management');
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const factoryId = getFactoryId(user);

  const [users, setUsers] = useState<UserDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<UserDTO | null>(null);

  // Menu visibility states
  const [roleMenuVisible, setRoleMenuVisible] = useState(false);
  const [departmentMenuVisible, setDepartmentMenuVisible] = useState(false);

  // 权限控制 - 使用统一的权限检查工具
  const canManage = canManageUsers(user);

  // 权限检查日志
  useEffect(() => {
    const debugInfo = getPermissionDebugInfo(user);
    userManagementLogger.debug('权限检查', {
      ...debugInfo,
      canManage,
    });
  }, [user]);

  // 表单数据
  const [formData, setFormData] = useState<Partial<CreateUserRequest>>({
    username: '',
    password: '',
    realName: '',
    email: '',
    phone: '',
    role: 'operator',
    department: 'processing',
    position: '',
  });

  // 角色选项
  const roleOptions = [
    { label: t('userManagement.roles.operator'), value: 'operator' },
    { label: t('userManagement.roles.departmentAdmin'), value: 'department_admin' },
    { label: t('userManagement.roles.permissionAdmin'), value: 'permission_admin' },
    { label: t('userManagement.roles.factorySuperAdmin'), value: 'factory_super_admin' },
  ];

  // 部门选项
  const departmentOptions = [
    { label: t('userManagement.departments.processing'), value: 'processing' },
    { label: t('userManagement.departments.logistics'), value: 'logistics' },
    { label: t('userManagement.departments.quality'), value: 'quality' },
    { label: t('userManagement.departments.management'), value: 'management' },
  ];

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await userApiClient.getUsers({
        factoryId: factoryId,
        page: 1,
        size: 100,
      });
      console.log("response=", response);
      // 处理分页响应 - userApiClient.getUsers 返回 PageResponse<UserDTO>
      const userData = response.content;

      userManagementLogger.info('用户列表加载成功', {
        userCount: userData.length,
        factoryId,
      });
      setUsers(userData);
    } catch (error) {
      userManagementLogger.error('加载用户列表失败', error as Error, {
        factoryId,
      });
      const errorMessage = error instanceof Error ? error.message : t('userManagement.messages.loadFailed');
      Alert.alert(t('common.error'), errorMessage);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadUsers();
      return;
    }

    try {
      setLoading(true);
      const results = await userApiClient.searchUsers({
        keyword: searchQuery,
        factoryId: factoryId,
      });
      userManagementLogger.info('用户搜索完成', {
        keyword: searchQuery,
        resultCount: results.length,
      });
      setUsers(results);
    } catch (error) {
      userManagementLogger.error('搜索用户失败', error as Error, {
        keyword: searchQuery,
        factoryId: factoryId,
      });
      Alert.alert(t('common.error'), t('userManagement.messages.searchFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingUser(null);
    setFormData({
      username: '',
      password: '',
      realName: '',
      email: '',
      phone: '',
      role: 'operator',
      department: 'processing',
      position: '',
    });
    setModalVisible(true);
  };

  const handleEdit = (user: UserDTO) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: '', // 不显示密码
      realName: user.realName,
      email: user.email || '',
      phone: user.phone || '',
      role: user.role,
      department: user.department || 'processing',
      position: user.position || '',
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    // 验证必填项
    if (!formData.username || !formData.realName || !formData.role) {
      Alert.alert(t('common.error'), t('userManagement.messages.requiredFields'));
      return;
    }

    if (!editingUser && !formData.password) {
      Alert.alert(t('common.error'), t('userManagement.messages.passwordRequired'));
      return;
    }

    try {
      if (editingUser) {
        // 更新用户
        await userApiClient.updateUser(
          editingUser.id,
          {
            realName: formData.realName!,
            email: formData.email,
            phone: formData.phone,
            department: formData.department,
            position: formData.position,
          },
          factoryId
        );
        Alert.alert(t('common.success'), t('userManagement.messages.updateSuccess'));
      } else {
        // 创建用户
        await userApiClient.createUser(
          formData as CreateUserRequest,
          factoryId
        );
        Alert.alert(t('common.success'), t('userManagement.messages.createSuccess'));
      }

      userManagementLogger.info(editingUser ? '用户更新成功' : '用户创建成功', {
        username: formData.username,
        realName: formData.realName,
        role: formData.role,
      });
      setModalVisible(false);
      loadUsers();
    } catch (error) {
      userManagementLogger.error('保存用户失败', error as Error, {
        isEdit: !!editingUser,
        username: formData.username,
      });
      Alert.alert(t('common.error'), (error as any).response?.data?.message || t('userManagement.messages.saveFailed'));
    }
  };

  const handleDelete = (userId: number, userName: string) => {
    Alert.alert(
      t('userManagement.confirmDelete.title'),
      t('userManagement.confirmDelete.message', { name: userName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await userApiClient.deleteUser(userId, factoryId);
              userManagementLogger.info('用户删除成功', {
                userId,
                userName,
              });
              Alert.alert(t('common.success'), t('userManagement.messages.deleteSuccess'));
              loadUsers();
            } catch (error) {
              userManagementLogger.error('删除用户失败', error as Error, {
                userId,
                userName,
              });
              Alert.alert(t('common.error'), (error as any).response?.data?.message || t('userManagement.messages.deleteFailed'));
            }
          },
        },
      ]
    );
  };

  const handleToggleStatus = async (userId: number, currentStatus: boolean) => {
    try {
      if (currentStatus) {
        await userApiClient.deactivateUser(userId, factoryId);
        userManagementLogger.info('用户停用成功', {
          userId,
          factoryId: factoryId,
        });
        Alert.alert(t('common.success'), t('userManagement.messages.deactivateSuccess'));
      } else {
        await userApiClient.activateUser(userId, factoryId);
        userManagementLogger.info('用户激活成功', {
          userId,
          factoryId: factoryId,
        });
        Alert.alert(t('common.success'), t('userManagement.messages.activateSuccess'));
      }
      loadUsers();
    } catch (error) {
      userManagementLogger.error('切换用户状态失败', error as Error, {
        userId,
        currentStatus,
        factoryId: factoryId,
      });
      const errorMessage = error instanceof Error ? error.message : t('userManagement.messages.toggleStatusFailed');
      Alert.alert(t('common.error'), errorMessage);
    }
  };

  const handleChangeRole = async (userId: number, currentRole: string) => {
    throw new NotImplementedError(
      '用户角色修改',
      'Phase 4',
      '用户角色修改功能尚未实现，请联系系统管理员进行角色调整。'
    );
  };

  // 获取角色显示名称 - 支持大写枚举值(后端roleCode)和小写值(前端本地)
  const getRoleName = (role?: string, roleCode?: string, roleDisplayName?: string) => {
    // 优先使用后端返回的显示名称
    if (roleDisplayName) return roleDisplayName;

    // 标准化角色代码（转小写）
    const normalizedRole = (roleCode ?? role ?? '').toLowerCase();

    switch (normalizedRole) {
      case 'factory_super_admin': return t('userManagement.roles.factorySuperAdmin');
      case 'permission_admin': return t('userManagement.roles.permissionAdmin');
      case 'department_admin': return t('userManagement.roles.departmentAdmin');
      case 'operator': return t('userManagement.roles.operator');
      case 'viewer': return t('userManagement.roles.viewer');
      case 'unactivated': return t('userManagement.roles.unactivated');
      default: return normalizedRole || t('userManagement.roles.unknown');
    }
  };

  const getDepartmentName = (dept?: string) => {
    switch (dept) {
      case 'processing': return t('userManagement.departments.processing');
      case 'logistics': return t('userManagement.departments.logistics');
      case 'quality': return t('userManagement.departments.quality');
      case 'management': return t('userManagement.departments.management');
      default: return dept || t('userManagement.departments.unassigned');
    }
  };

  // 筛选用户 - 使用 roleCode 字段匹配（后端返回大写枚举如 OPERATOR）
  const filteredUsers = users.filter(u => {
    if (filterRole !== 'all') {
      // 后端返回 roleCode 为大写枚举值（如 OPERATOR, DEPARTMENT_ADMIN, FACTORY_SUPER_ADMIN）
      const userRoleCode = u.roleCode?.toLowerCase();
      if (userRoleCode !== filterRole) {
        return false;
      }
    }
    return true;
  });

  if (!canManageUsers) {
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title={t('userManagement.title')} />
        </Appbar.Header>
        <View style={styles.noPermission}>
          <List.Icon icon="lock" color="#999" />
          <Text style={styles.noPermissionText}>{t('userManagement.noPermission.title')}</Text>
          <Text style={styles.noPermissionHint}>{t('userManagement.noPermission.hint')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={t('userManagement.title')} />
        <Appbar.Action icon="refresh" onPress={loadUsers} />
      </Appbar.Header>

      <ScrollView style={styles.content}>
        {/* Search */}
        <Searchbar
          placeholder={t('userManagement.searchPlaceholder')}
          onChangeText={setSearchQuery}
          value={searchQuery}
          onSubmitEditing={handleSearch}
          style={styles.searchbar}
        />

        {/* Filter */}
        <Card style={styles.filterCard}>
          <Card.Content>
            <SegmentedButtons
              value={filterRole}
              onValueChange={setFilterRole}
              buttons={[
                { value: 'all', label: t('userManagement.filter.all') },
                { value: 'operator', label: t('userManagement.filter.operator') },
                { value: 'department_admin', label: t('userManagement.filter.departmentAdmin') },
                { value: 'factory_super_admin', label: t('userManagement.filter.superAdmin') },
              ]}
            />
          </Card.Content>
        </Card>

        {/* Stats */}
        <Card style={styles.statsCard}>
          <Card.Content>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{users.length}</Text>
                <Text style={styles.statLabel}>{t('userManagement.stats.totalUsers')}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {users.filter(u => u.isActive).length}
                </Text>
                <Text style={styles.statLabel}>{t('userManagement.stats.active')}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {users.filter(u => !u.isActive).length}
                </Text>
                <Text style={styles.statLabel}>{t('userManagement.stats.inactive')}</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Users List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>{t('common.loading')}</Text>
          </View>
        ) : filteredUsers.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <List.Icon icon="account-outline" color="#999" />
              <Text style={styles.emptyText}>{t('userManagement.empty.noUsers')}</Text>
              <Text style={styles.emptyHint}>{t('userManagement.empty.hint')}</Text>
            </Card.Content>
          </Card>
        ) : (
          filteredUsers.map((userItem) => (
            <Card key={userItem.id} style={styles.userCard}>
              <Card.Content>
                {/* Header */}
                <View style={styles.userHeader}>
                  <View style={styles.userTitleRow}>
                    <View>
                      <Text style={styles.userName}>{userItem.realName}</Text>
                      <Text style={styles.userUsername}>@{userItem.username}</Text>
                    </View>
                    <View style={styles.statusChips}>
                      <Chip
                        mode="flat"
                        compact
                        style={[
                          styles.roleChip,
                          { backgroundColor: userItem.isActive ? '#E8F5E9' : '#FFEBEE' }
                        ]}
                        textStyle={{
                          color: userItem.isActive ? '#2E7D32' : '#C62828',
                          fontSize: 11
                        }}
                      >
                        {userItem.isActive ? t('common.active') : t('common.inactive')}
                      </Chip>
                      <Chip
                        mode="flat"
                        compact
                        style={[styles.roleChip, { backgroundColor: '#E3F2FD' }]}
                        textStyle={{ color: '#1565C0', fontSize: 11 }}
                      >
                        {getRoleName(userItem.role, userItem.roleCode, userItem.roleDisplayName)}
                      </Chip>
                    </View>
                  </View>
                </View>

                {/* Info */}
                <View style={styles.userInfo}>
                  {userItem.department && (
                    <View style={styles.infoRow}>
                      <List.Icon icon="office-building" style={styles.infoIcon} />
                      <Text style={styles.infoText}>{getDepartmentName(userItem.department)}</Text>
                    </View>
                  )}
                  {userItem.phone && (
                    <View style={styles.infoRow}>
                      <List.Icon icon="phone" style={styles.infoIcon} />
                      <Text style={styles.infoText}>{userItem.phone}</Text>
                    </View>
                  )}
                  {userItem.email && (
                    <View style={styles.infoRow}>
                      <List.Icon icon="email" style={styles.infoIcon} />
                      <Text style={styles.infoText}>{userItem.email}</Text>
                    </View>
                  )}
                </View>

                {/* Actions */}
                <View style={styles.actionRow}>
                  <Button
                    mode="outlined"
                    icon="pencil"
                    onPress={() => handleEdit(userItem)}
                    style={styles.actionButton}
                    compact
                  >
                    {t('userManagement.actions.edit')}
                  </Button>
                  <Button
                    mode="outlined"
                    icon={userItem.isActive ? 'pause' : 'play'}
                    onPress={() => handleToggleStatus(userItem.id, userItem.isActive)}
                    style={styles.actionButton}
                    compact
                  >
                    {userItem.isActive ? t('userManagement.actions.deactivate') : t('userManagement.actions.activate')}
                  </Button>
                  <Button
                    mode="outlined"
                    icon="delete"
                    onPress={() => handleDelete(userItem.id, userItem.realName)}
                    style={styles.actionButton}
                    compact
                    textColor="#C62828"
                  >
                    {t('userManagement.actions.delete')}
                  </Button>
                </View>
              </Card.Content>
            </Card>
          ))
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Create/Edit Modal */}
      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.modalTitle}>
            {editingUser ? t('userManagement.editUser') : t('userManagement.createUser')}
          </Text>

          <ScrollView style={styles.modalScrollView}>
            {/* Username */}
            <TextInput
              label={t('userManagement.form.username')}
              value={formData.username}
              onChangeText={(text) => setFormData({ ...formData, username: text })}
              mode="outlined"
              style={styles.input}
              disabled={!!editingUser} // 编辑时不可改用户名
              placeholder={t('userManagement.form.usernamePlaceholder')}
            />

            {/* Password - 只在创建时显示 */}
            {!editingUser && (
              <TextInput
                label={t('userManagement.form.password')}
                value={formData.password}
                onChangeText={(text) => setFormData({ ...formData, password: text })}
                mode="outlined"
                style={styles.input}
                secureTextEntry
                placeholder={t('userManagement.form.passwordPlaceholder')}
              />
            )}

            {/* Real Name */}
            <TextInput
              label={t('userManagement.form.realName')}
              value={formData.realName}
              onChangeText={(text) => setFormData({ ...formData, realName: text })}
              mode="outlined"
              style={styles.input}
              placeholder={t('userManagement.form.realNamePlaceholder')}
            />

            {/* Phone */}
            <TextInput
              label={t('userManagement.form.phone')}
              value={formData.phone}
              onChangeText={(text) => setFormData({ ...formData, phone: text })}
              mode="outlined"
              style={styles.input}
              keyboardType="phone-pad"
              placeholder={t('userManagement.form.phonePlaceholder')}
            />

            {/* Email */}
            <TextInput
              label={t('userManagement.form.email')}
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              mode="outlined"
              style={styles.input}
              keyboardType="email-address"
              placeholder={t('userManagement.form.emailPlaceholder')}
            />

            {/* Role */}
            <View style={styles.input}>
              <Text style={styles.selectLabel}>{t('userManagement.form.role')}</Text>
              <Menu
                visible={roleMenuVisible}
                onDismiss={() => setRoleMenuVisible(false)}
                anchor={
                  <Button
                    mode="outlined"
                    onPress={() => setRoleMenuVisible(true)}
                    icon="menu-down"
                    contentStyle={{ justifyContent: 'space-between' }}
                    style={styles.selectButton}
                  >
                    {roleOptions.find(o => o.value === formData.role)?.label || t('userManagement.form.selectPlaceholder')}
                  </Button>
                }
              >
                {roleOptions.map(opt => (
                  <Menu.Item
                    key={opt.value}
                    onPress={() => {
                      setFormData({ ...formData, role: opt.value });
                      setRoleMenuVisible(false);
                    }}
                    title={opt.label}
                  />
                ))}
              </Menu>
            </View>

            {/* Department */}
            <View style={styles.input}>
              <Text style={styles.selectLabel}>{t('userManagement.form.department')}</Text>
              <Menu
                visible={departmentMenuVisible}
                onDismiss={() => setDepartmentMenuVisible(false)}
                anchor={
                  <Button
                    mode="outlined"
                    onPress={() => setDepartmentMenuVisible(true)}
                    icon="menu-down"
                    contentStyle={{ justifyContent: 'space-between' }}
                    style={styles.selectButton}
                  >
                    {departmentOptions.find(o => o.value === formData.department)?.label || t('userManagement.form.selectPlaceholder')}
                  </Button>
                }
              >
                {departmentOptions.map(opt => (
                  <Menu.Item
                    key={opt.value}
                    onPress={() => {
                      setFormData({ ...formData, department: opt.value });
                      setDepartmentMenuVisible(false);
                    }}
                    title={opt.label}
                  />
                ))}
              </Menu>
            </View>

            {/* Position */}
            <TextInput
              label={t('userManagement.form.position')}
              value={formData.position}
              onChangeText={(text) => setFormData({ ...formData, position: text })}
              mode="outlined"
              style={styles.input}
              placeholder={t('userManagement.form.positionPlaceholder')}
            />
          </ScrollView>

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setModalVisible(false)}
              style={styles.modalButton}
            >
              {t('common.cancel')}
            </Button>
            <Button
              mode="contained"
              onPress={handleSave}
              style={styles.modalButton}
            >
              {editingUser ? t('common.save') : t('common.create')}
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
          label={t('userManagement.createUser')}
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
  filterCard: {
    margin: 16,
    marginBottom: 8,
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
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
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
  userCard: {
    margin: 16,
    marginBottom: 8,
  },
  userHeader: {
    marginBottom: 12,
  },
  userTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  userUsername: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  statusChips: {
    flexDirection: 'row',
    gap: 4,
  },
  roleChip: {
    height: 32,
  },
  userInfo: {
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  infoIcon: {
    margin: 0,
    marginRight: 4,
    width: 28,
  },
  infoText: {
    fontSize: 13,
    color: '#666',
  },
  actionRow: {
    flexDirection: 'row',
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
    marginBottom: 20,
  },
  input: {
    marginBottom: 16,
  },
  selectLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  selectButton: {
    justifyContent: 'flex-start',
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
  modalButton: {
    minWidth: 100,
  },
  bottomPadding: {
    height: 80,
  },
});
