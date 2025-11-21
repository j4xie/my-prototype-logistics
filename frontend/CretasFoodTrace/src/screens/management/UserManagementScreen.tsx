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
import { userApiClient, UserDTO, CreateUserRequest } from '../../services/api/userApiClient';
import { useAuthStore } from '../../store/authStore';
import { NotImplementedError } from '../../errors';
import { handleError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建UserManagement专用logger
const userManagementLogger = logger.createContextLogger('UserManagement');

/**
 * 用户管理页面
 * 权限：factory_super_admin、platform_admin
 * 功能：用户CRUD、角色管理、激活/停用
 */
export default function UserManagementScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();

  const [users, setUsers] = useState<UserDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<UserDTO | null>(null);

  // Menu visibility states
  const [roleMenuVisible, setRoleMenuVisible] = useState(false);
  const [departmentMenuVisible, setDepartmentMenuVisible] = useState(false);

  // 权限控制
  const userType = user?.userType || 'factory';
  const roleCode = user?.factoryUser?.role || user?.factoryUser?.roleCode || user?.roleCode || 'viewer';
  const isPlatformAdmin = userType === 'platform';
  const isSuperAdmin = roleCode === 'factory_super_admin';
  const canManageUsers = isPlatformAdmin || isSuperAdmin;

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
    { label: '操作员', value: 'operator' },
    { label: '部门管理员', value: 'department_admin' },
    { label: '权限管理员', value: 'permission_admin' },
    { label: '工厂超管', value: 'factory_super_admin' },
  ];

  // 部门选项
  const departmentOptions = [
    { label: '加工部', value: 'processing' },
    { label: '养殖部', value: 'farming' },
    { label: '物流部', value: 'logistics' },
    { label: '质检部', value: 'quality' },
    { label: '管理层', value: 'management' },
  ];

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await userApiClient.getUsers({
        factoryId: user?.factoryId,
        page: 1, // 后端要求 page >= 1
        size: 100,
      });

      // 📊 调试日志：查看API响应结构
      userManagementLogger.debug('API响应结构', {
        hasData: !!response.data,
        dataType: typeof response.data,
        hasContent: !!(response.data && response.data.content),
        isContentArray: response.data && Array.isArray(response.data.content),
        contentLength: response.data && response.data.content ? response.data.content.length : 0,
      });

      // ✅ 正确的数据访问：response.data.content
      if (response.data && response.data.content) {
        userManagementLogger.info('用户列表加载成功', {
          userCount: response.data.content.length,
          factoryId: user?.factoryId,
        });
        setUsers(response.data.content);
      } else {
        userManagementLogger.warn('API返回空数据', { response });
        setUsers([]);
      }
    } catch (error) {
      userManagementLogger.error('加载用户列表失败', error as Error, {
        factoryId: user?.factoryId,
      });
      Alert.alert('错误', (error as any).response?.data?.message || '加载用户列表失败');
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
        factoryId: user?.factoryId,
      });
      userManagementLogger.info('用户搜索完成', {
        keyword: searchQuery,
        resultCount: results.length,
      });
      setUsers(results);
    } catch (error) {
      userManagementLogger.error('搜索用户失败', error as Error, {
        keyword: searchQuery,
        factoryId: user?.factoryId,
      });
      Alert.alert('错误', '搜索失败');
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
      Alert.alert('提示', '用户名、姓名和角色不能为空');
      return;
    }

    if (!editingUser && !formData.password) {
      Alert.alert('提示', '创建用户时密码不能为空');
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
          user?.factoryId
        );
        Alert.alert('成功', '用户信息已更新');
      } else {
        // 创建用户
        await userApiClient.createUser(
          formData as CreateUserRequest,
          user?.factoryId
        );
        Alert.alert('成功', '用户创建成功');
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
      Alert.alert('错误', (error as any).response?.data?.message || '操作失败');
    }
  };

  const handleDelete = (userId: number, userName: string) => {
    Alert.alert(
      '确认删除',
      `确定要删除用户 "${userName}" 吗？此操作不可撤销。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await userApiClient.deleteUser(userId, user?.factoryId);
              userManagementLogger.info('用户删除成功', {
                userId,
                userName,
              });
              Alert.alert('成功', '用户已删除');
              loadUsers();
            } catch (error) {
              userManagementLogger.error('删除用户失败', error as Error, {
                userId,
                userName,
              });
              Alert.alert('错误', (error as any).response?.data?.message || '删除失败');
            }
          },
        },
      ]
    );
  };

  const handleToggleStatus = async (userId: number, currentStatus: boolean) => {
    try {
      if (currentStatus) {
        await userApiClient.deactivateUser(userId, user?.factoryId);
        userManagementLogger.info('用户停用成功', {
          userId,
          factoryId: user?.factoryId,
        });
        Alert.alert('成功', '用户已停用');
      } else {
        await userApiClient.activateUser(userId, user?.factoryId);
        userManagementLogger.info('用户激活成功', {
          userId,
          factoryId: user?.factoryId,
        });
        Alert.alert('成功', '用户已激活');
      }
      loadUsers();
    } catch (error) {
      userManagementLogger.error('切换用户状态失败', error as Error, {
        userId,
        currentStatus,
        factoryId: user?.factoryId,
      });
      Alert.alert('错误', error.response?.data?.message || '操作失败');
    }
  };

  const handleChangeRole = async (userId: number, currentRole: string) => {
    throw new NotImplementedError(
      '用户角色修改',
      'Phase 4',
      '用户角色修改功能尚未实现，请联系系统管理员进行角色调整。'
    );
  };

  const getRoleName = (role: string) => {
    switch (role) {
      case 'factory_super_admin': return '工厂超管';
      case 'permission_admin': return '权限管理员';
      case 'department_admin': return '部门管理员';
      case 'operator': return '操作员';
      case 'viewer': return '查看者';
      case 'unactivated': return '未激活';
      default: return role;
    }
  };

  const getDepartmentName = (dept?: string) => {
    switch (dept) {
      case 'processing': return '加工部';
      case 'farming': return '养殖部';
      case 'logistics': return '物流部';
      case 'quality': return '质检部';
      case 'management': return '管理层';
      default: return dept || '未分配';
    }
  };

  // 筛选用户
  const filteredUsers = users.filter(u => {
    if (filterRole !== 'all' && u.role !== filterRole) {
      return false;
    }
    return true;
  });

  if (!canManageUsers) {
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="用户管理" />
        </Appbar.Header>
        <View style={styles.noPermission}>
          <List.Icon icon="lock" color="#999" />
          <Text style={styles.noPermissionText}>您没有权限访问此页面</Text>
          <Text style={styles.noPermissionHint}>仅限工厂超管和平台管理员</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="用户管理" />
        <Appbar.Action icon="refresh" onPress={loadUsers} />
      </Appbar.Header>

      <ScrollView style={styles.content}>
        {/* Search */}
        <Searchbar
          placeholder="搜索用户名、姓名、手机号"
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
                { value: 'all', label: '全部' },
                { value: 'operator', label: '操作员' },
                { value: 'department_admin', label: '部门管理' },
                { value: 'factory_super_admin', label: '超管' },
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
                <Text style={styles.statLabel}>总用户数</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {users.filter(u => u.isActive).length}
                </Text>
                <Text style={styles.statLabel}>激活</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {users.filter(u => !u.isActive).length}
                </Text>
                <Text style={styles.statLabel}>停用</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Users List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        ) : filteredUsers.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <List.Icon icon="account-outline" color="#999" />
              <Text style={styles.emptyText}>暂无用户</Text>
              <Text style={styles.emptyHint}>点击右下角"+"按钮创建用户</Text>
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
                        {userItem.isActive ? '激活' : '停用'}
                      </Chip>
                      <Chip
                        mode="flat"
                        compact
                        style={[styles.roleChip, { backgroundColor: '#E3F2FD' }]}
                        textStyle={{ color: '#1565C0', fontSize: 11 }}
                      >
                        {getRoleName(userItem.role)}
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
                    编辑
                  </Button>
                  <Button
                    mode="outlined"
                    icon={userItem.isActive ? 'pause' : 'play'}
                    onPress={() => handleToggleStatus(userItem.id, userItem.isActive)}
                    style={styles.actionButton}
                    compact
                  >
                    {userItem.isActive ? '停用' : '激活'}
                  </Button>
                  <Button
                    mode="outlined"
                    icon="delete"
                    onPress={() => handleDelete(userItem.id, userItem.realName)}
                    style={styles.actionButton}
                    compact
                    textColor="#C62828"
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

      {/* Create/Edit Modal */}
      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.modalTitle}>
            {editingUser ? '编辑用户' : '创建用户'}
          </Text>

          <ScrollView style={styles.modalScrollView}>
            {/* Username */}
            <TextInput
              label="用户名 *"
              value={formData.username}
              onChangeText={(text) => setFormData({ ...formData, username: text })}
              mode="outlined"
              style={styles.input}
              disabled={!!editingUser} // 编辑时不可改用户名
              placeholder="登录用户名"
            />

            {/* Password - 只在创建时显示 */}
            {!editingUser && (
              <TextInput
                label="密码 *"
                value={formData.password}
                onChangeText={(text) => setFormData({ ...formData, password: text })}
                mode="outlined"
                style={styles.input}
                secureTextEntry
                placeholder="至少8位，包含字母和数字"
              />
            )}

            {/* Real Name */}
            <TextInput
              label="真实姓名 *"
              value={formData.realName}
              onChangeText={(text) => setFormData({ ...formData, realName: text })}
              mode="outlined"
              style={styles.input}
              placeholder="例如：张三"
            />

            {/* Phone */}
            <TextInput
              label="手机号"
              value={formData.phone}
              onChangeText={(text) => setFormData({ ...formData, phone: text })}
              mode="outlined"
              style={styles.input}
              keyboardType="phone-pad"
              placeholder="例如：+8613800138000"
            />

            {/* Email */}
            <TextInput
              label="邮箱"
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              mode="outlined"
              style={styles.input}
              keyboardType="email-address"
              placeholder="例如：user@example.com"
            />

            {/* Role */}
            <View style={styles.input}>
              <Text style={styles.selectLabel}>角色 *</Text>
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
                    {roleOptions.find(o => o.value === formData.role)?.label || '请选择'}
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
              <Text style={styles.selectLabel}>部门</Text>
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
                    {departmentOptions.find(o => o.value === formData.department)?.label || '请选择'}
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
              label="职位"
              value={formData.position}
              onChangeText={(text) => setFormData({ ...formData, position: text })}
              mode="outlined"
              style={styles.input}
              placeholder="例如：生产主管"
            />
          </ScrollView>

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
              {editingUser ? '保存' : '创建'}
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* FAB */}
      {canManageUsers && (
        <FAB
          icon="plus"
          style={styles.fab}
          onPress={handleAdd}
          label="创建用户"
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
    height: 24,
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
