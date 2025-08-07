# TASK-RN-008: 用户管理界面

> React Native Android开发 - 用户管理界面实现任务
>
> 创建时间: 2025-08-05
> 预计工期: 2天 (16小时)
> 优先级: 高
> 状态: 待开始

## 📋 任务概述

基于前面建立的认证系统、权限控制和API客户端，实现完整的用户管理界面，包括用户列表、权限分配、批量操作、白名单管理等功能，支持搜索、筛选、分页等高级功能。

## 🎯 任务目标

- 实现支持搜索、筛选、分页的用户管理界面
- 创建可视化权限分配和角色管理界面
- 支持批量操作（激活/停用用户）功能
- 实现白名单管理（单个添加 + Excel批量导入）
- 提供优秀的移动端用户体验和交互设计

## 📋 详细步骤

### **Day 1: 用户列表和基础管理** (8小时)

#### 1.1 用户列表界面 (4小时)

**1.1.1 用户列表组件**
```tsx
// src/screens/admin/UserManagementScreen.tsx
import React, { useState, useMemo } from 'react';
import { View, StyleSheet, RefreshControl } from 'react-native';
import { 
  Searchbar, 
  FAB, 
  Portal,
  Modal,
  Card,
  Text,
  Chip,
  IconButton,
  Menu,
  Divider
} from 'react-native-paper';
import { FlashList } from '@shopify/flash-list';
import { usePermissions } from '@/hooks/usePermissions';
import { usePaginatedRequest } from '@/hooks/useApiRequest';
import { UserListItem } from '@/components/user/UserListItem';
import { UserFilterSheet } from '@/components/user/UserFilterSheet';
import { BatchActionBar } from '@/components/user/BatchActionBar';
import { CreateUserModal } from '@/components/user/CreateUserModal';
import { userApi } from '@/services/api/userApi';

interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: string;
  department: string;
  status: 'active' | 'inactive' | 'suspended';
  lastLogin: string;
  createdAt: string;
}

interface UserFilters {
  role?: string;
  department?: string;
  status?: string;
  dateRange?: { start: Date; end: Date };
}

export const UserManagementScreen: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<UserFilters>({});
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  const { hasPermission, canManageUser } = usePermissions();

  // 分页用户数据请求
  const {
    data: userData,
    allData: allUsers,
    loading,
    error,
    loadMore,
    refresh,
    currentPage
  } = usePaginatedRequest(
    (page, pageSize) => userApi.getUsers({
      page,
      limit: pageSize,
      search: searchQuery,
      ...filters
    }),
    {
      immediate: true,
      pageSize: 20,
      onError: (error) => {
        console.error('Failed to load users:', error);
      }
    }
  );

  // 过滤和搜索用户
  const filteredUsers = useMemo(() => {
    let users = allUsers;

    // 本地搜索过滤（如果服务端搜索不够精确）
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      users = users.filter(user => 
        user.fullName.toLowerCase().includes(query) ||
        user.username.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
      );
    }

    return users;
  }, [allUsers, searchQuery]);

  // 处理用户选择
  const handleUserSelect = (userId: string, selected: boolean) => {
    const newSelected = new Set(selectedUsers);
    if (selected) {
      newSelected.add(userId);
    } else {
      newSelected.delete(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
    }
  };

  // 批量操作
  const handleBatchAction = async (action: string) => {
    const userIds = Array.from(selectedUsers);
    
    try {
      switch (action) {
        case 'activate':
          await userApi.batchActivateUsers(userIds);
          break;
        case 'deactivate':
          await userApi.batchDeactivateUsers(userIds);
          break;
        case 'delete':
          await userApi.batchDeleteUsers(userIds);
          break;
      }
      
      setSelectedUsers(new Set());
      refresh();
    } catch (error) {
      console.error('Batch action failed:', error);
    }
  };

  // 渲染用户项
  const renderUserItem = ({ item: user }: { item: User }) => (
    <UserListItem
      user={user}
      selected={selectedUsers.has(user.id)}
      onSelect={(selected) => handleUserSelect(user.id, selected)}
      onPress={() => {
        // 导航到用户详情页
        // navigation.navigate('UserDetails', { userId: user.id });
      }}
      showActions={canManageUser(user)}
    />
  );

  const canCreateUsers = hasPermission('create_users');
  const canBatchManage = hasPermission('manage_factory_users');

  return (
    <View style={styles.container}>
      {/* 搜索栏 */}
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="搜索用户..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
        />
        <IconButton
          icon="filter-variant"
          mode="contained"
          onPress={() => setFilterSheetVisible(true)}
          style={styles.filterButton}
        />
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <IconButton
              icon="dots-vertical"
              onPress={() => setMenuVisible(true)}
            />
          }
        >
          <Menu.Item 
            onPress={() => {
              setMenuVisible(false);
              refresh();
            }} 
            title="刷新数据" 
            leadingIcon="refresh"
          />
          <Menu.Item 
            onPress={() => {
              setMenuVisible(false);
              // 导出用户数据
            }} 
            title="导出数据" 
            leadingIcon="download"
            disabled={!hasPermission('export_user_data')}
          />
          <Divider />
          <Menu.Item 
            onPress={() => {
              setMenuVisible(false);
              handleSelectAll();
            }} 
            title={selectedUsers.size === filteredUsers.length ? "取消全选" : "全选"}
            leadingIcon="select-all"
          />
        </Menu>
      </View>

      {/* 统计信息 */}
      <Card style={styles.statsCard}>
        <Card.Content style={styles.statsContent}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{userData.total}</Text>
            <Text style={styles.statLabel}>总用户</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {filteredUsers.filter(u => u.status === 'active').length}
            </Text>
            <Text style={styles.statLabel}>活跃用户</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {filteredUsers.filter(u => u.status === 'inactive').length}
            </Text>
            <Text style={styles.statLabel}>待激活</Text>
          </View>
          {selectedUsers.size > 0 && (
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{selectedUsers.size}</Text>
              <Text style={styles.statLabel}>已选择</Text>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* 用户列表 */}
      <FlashList
        data={filteredUsers}
        renderItem={renderUserItem}
        keyExtractor={(item) => item.id}
        estimatedItemSize={80}
        refreshControl={
          <RefreshControl
            refreshing={loading && currentPage === 1}
            onRefresh={refresh}
          />
        }
        onEndReached={() => {
          if (userData.hasMore && !loading) {
            loadMore();
          }
        }}
        onEndReachedThreshold={0.1}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>暂无用户数据</Text>
          </View>
        }
        contentContainerStyle={styles.listContainer}
      />

      {/* 批量操作栏 */}
      {selectedUsers.size > 0 && canBatchManage && (
        <BatchActionBar
          selectedCount={selectedUsers.size}
          onAction={handleBatchAction}
          onCancel={() => setSelectedUsers(new Set())}
        />
      )}

      {/* 创建用户按钮 */}
      {canCreateUsers && (
        <FAB
          icon="plus"
          style={styles.fab}
          onPress={() => setCreateModalVisible(true)}
        />
      )}

      {/* 过滤器弹窗 */}
      <Portal>
        <UserFilterSheet
          visible={filterSheetVisible}
          filters={filters}
          onFiltersChange={setFilters}
          onDismiss={() => setFilterSheetVisible(false)}
        />
      </Portal>

      {/* 创建用户弹窗 */}
      <Portal>
        <CreateUserModal
          visible={createModalVisible}
          onDismiss={() => setCreateModalVisible(false)}
          onUserCreated={() => {
            setCreateModalVisible(false);
            refresh();
          }}
        />
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white'
  },
  searchBar: {
    flex: 1,
    marginRight: 8
  },
  filterButton: {
    marginRight: 4
  },
  statsCard: {
    margin: 16,
    marginBottom: 8
  },
  statsContent: {
    flexDirection: 'row',
    justifyContent: 'space-around'
  },
  statItem: {
    alignItems: 'center'
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1976D2'
  },
  statLabel: {
    fontSize: 12,
    color: '#666'
  },
  listContainer: {
    paddingHorizontal: 16
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60
  },
  emptyText: {
    fontSize: 16,
    color: '#999'
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0
  }
});
```

**1.1.2 用户列表项组件**
```tsx
// src/components/user/UserListItem.tsx
import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { 
  Card, 
  Text, 
  Avatar, 
  Chip, 
  IconButton, 
  Menu,
  Checkbox 
} from 'react-native-paper';
import { RoleIndicator } from '@/components/permission/RoleIndicator';
import { format } from 'date-fns';

interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: string;
  department: string;
  status: 'active' | 'inactive' | 'suspended';
  lastLogin: string;
  createdAt: string;
}

interface UserListItemProps {
  user: User;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  onPress: () => void;
  showActions: boolean;
}

export const UserListItem: React.FC<UserListItemProps> = ({
  user,
  selected,
  onSelect,
  onPress,
  showActions
}) => {
  const [menuVisible, setMenuVisible] = useState(false);

  const getStatusColor = (status: string) => {
    const colors = {
      active: '#4CAF50',
      inactive: '#FF9800', 
      suspended: '#F44336'
    };
    return colors[status] || '#999';
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      active: '正常',
      inactive: '待激活',
      suspended: '已停用'
    };
    return labels[status] || status;
  };

  const handleMenuAction = (action: string) => {
    setMenuVisible(false);
    // 处理菜单操作
    switch (action) {
      case 'edit':
        // 编辑用户
        break;
      case 'activate':
        // 激活用户
        break;
      case 'suspend':
        // 停用用户
        break;
      case 'delete':
        // 删除用户
        break;
    }
  };

  return (
    <Card style={[styles.card, selected && styles.selectedCard]}>
      <TouchableOpacity onPress={onPress} style={styles.touchable}>
        <View style={styles.content}>
          {/* 左侧：复选框和头像 */}
          <View style={styles.leftSection}>
            <Checkbox
              status={selected ? 'checked' : 'unchecked'}
              onPress={() => onSelect(!selected)}
            />
            <Avatar.Text
              size={48}
              label={user.fullName.charAt(0)}
              style={styles.avatar}
            />
          </View>

          {/* 中间：用户信息 */}
          <View style={styles.userInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.fullName} numberOfLines={1}>
                {user.fullName}
              </Text>
              <Chip
                mode="outlined"
                style={[styles.statusChip, { borderColor: getStatusColor(user.status) }]}
                textStyle={[styles.statusText, { color: getStatusColor(user.status) }]}
                compact
              >
                {getStatusLabel(user.status)}
              </Chip>
            </View>

            <Text style={styles.username} numberOfLines={1}>
              @{user.username}
            </Text>

            <Text style={styles.email} numberOfLines={1}>
              {user.email}
            </Text>

            <View style={styles.metaRow}>
              <RoleIndicator
                role={user.role as any}
                userType="factory_user"
                department={user.department}
                size="small"
              />
              
              {user.lastLogin && (
                <Text style={styles.lastLogin}>
                  最后登录: {format(new Date(user.lastLogin), 'MM-dd HH:mm')}
                </Text>
              )}
            </View>
          </View>

          {/* 右侧：操作菜单 */}
          {showActions && (
            <Menu
              visible={menuVisible}
              onDismiss={() => setMenuVisible(false)}
              anchor={
                <IconButton
                  icon="dots-vertical"
                  size={20}
                  onPress={() => setMenuVisible(true)}
                />
              }
            >
              <Menu.Item 
                onPress={() => handleMenuAction('edit')} 
                title="编辑" 
                leadingIcon="pencil"
              />
              {user.status === 'inactive' && (
                <Menu.Item 
                  onPress={() => handleMenuAction('activate')} 
                  title="激活" 
                  leadingIcon="check-circle"
                />
              )}
              {user.status === 'active' && (
                <Menu.Item 
                  onPress={() => handleMenuAction('suspend')} 
                  title="停用" 
                  leadingIcon="pause-circle"
                />
              )}
              <Menu.Item 
                onPress={() => handleMenuAction('delete')} 
                title="删除" 
                leadingIcon="delete"
              />
            </Menu>
          )}
        </View>
      </TouchableOpacity>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginVertical: 4,
    elevation: 2
  },
  selectedCard: {
    borderColor: '#1976D2',
    borderWidth: 2
  },
  touchable: {
    borderRadius: 8
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  avatar: {
    marginLeft: 8,
    backgroundColor: '#1976D2'
  },
  userInfo: {
    flex: 1,
    marginLeft: 12
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  fullName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1
  },
  statusChip: {
    height: 24
  },
  statusText: {
    fontSize: 11
  },
  username: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2
  },
  email: {
    fontSize: 13,
    color: '#888',
    marginBottom: 4
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  lastLogin: {
    fontSize: 11,
    color: '#999'
  }
});
```

#### 1.2 用户筛选和搜索 (4小时)

**1.2.1 用户筛选组件**
```tsx
// src/components/user/UserFilterSheet.tsx
import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import {
  Modal,
  Portal,
  Text,
  Button,
  Card,
  Chip,
  DatePickerModal,
  SegmentedButtons,
  Divider
} from 'react-native-paper';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { DateRangePicker } from '@/components/ui/DateRangePicker';

interface UserFiltersProps {
  visible: boolean;
  filters: UserFilters;
  onFiltersChange: (filters: UserFilters) => void;
  onDismiss: () => void;
}

interface UserFilters {
  role?: string;
  department?: string;
  status?: string;
  dateRange?: { start: Date; end: Date };
}

export const UserFilterSheet: React.FC<UserFiltersProps> = ({
  visible,
  filters,
  onFiltersChange,
  onDismiss
}) => {
  const [localFilters, setLocalFilters] = useState<UserFilters>(filters);

  // 角色选项
  const roleOptions = [
    { value: 'factory_super_admin', label: '工厂超级管理员' },
    { value: 'permission_admin', label: '权限管理员' },
    { value: 'department_admin', label: '部门管理员' },
    { value: 'operator', label: '操作员' },
    { value: 'viewer', label: '查看者' }
  ];

  // 部门选项
  const departmentOptions = [
    { value: 'farming', label: '养殖部门' },
    { value: 'processing', label: '加工部门' },
    { value: 'logistics', label: '物流部门' },
    { value: 'quality', label: '质检部门' },
    { value: 'management', label: '管理部门' }
  ];

  // 状态选项
  const statusOptions = [
    { value: 'active', label: '正常' },
    { value: 'inactive', label: '待激活' },
    { value: 'suspended', label: '已停用' }
  ];

  const handleApplyFilters = () => {
    onFiltersChange(localFilters);
    onDismiss();
  };

  const handleResetFilters = () => {
    const emptyFilters = {};
    setLocalFilters(emptyFilters);
    onFiltersChange(emptyFilters);
    onDismiss();
  };

  const getActiveFilterCount = () => {
    return Object.keys(localFilters).filter(key => localFilters[key]).length;
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modal}
      >
        <Card style={styles.card}>
          <Card.Title 
            title="筛选用户" 
            subtitle={`${getActiveFilterCount()} 个筛选条件`}
          />
          
          <ScrollView style={styles.content}>
            {/* 用户角色筛选 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>用户角色</Text>
              <View style={styles.chipContainer}>
                {roleOptions.map(option => (
                  <Chip
                    key={option.value}
                    selected={localFilters.role === option.value}
                    onPress={() => {
                      setLocalFilters(prev => ({
                        ...prev,
                        role: prev.role === option.value ? undefined : option.value
                      }));
                    }}
                    style={styles.chip}
                  >
                    {option.label}
                  </Chip>
                ))}
              </View>
            </View>

            <Divider style={styles.divider} />

            {/* 部门筛选 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>所属部门</Text>
              <View style={styles.chipContainer}>
                {departmentOptions.map(option => (
                  <Chip
                    key={option.value}
                    selected={localFilters.department === option.value}
                    onPress={() => {
                      setLocalFilters(prev => ({
                        ...prev,
                        department: prev.department === option.value ? undefined : option.value
                      }));
                    }}
                    style={styles.chip}
                  >
                    {option.label}
                  </Chip>
                ))}
              </View>
            </View>

            <Divider style={styles.divider} />

            {/* 用户状态筛选 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>用户状态</Text>
              <SegmentedButtons
                value={localFilters.status || ''}
                onValueChange={(value) => {
                  setLocalFilters(prev => ({
                    ...prev,
                    status: value || undefined
                  }));
                }}
                buttons={[
                  { value: '', label: '全部' },
                  ...statusOptions.map(option => ({
                    value: option.value,
                    label: option.label
                  }))
                ]}
                style={styles.segmentedButtons}
              />
            </View>

            <Divider style={styles.divider} />

            {/* 创建时间筛选 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>创建时间</Text>
              <DateRangePicker
                value={localFilters.dateRange}
                onChange={(dateRange) => {
                  setLocalFilters(prev => ({
                    ...prev,
                    dateRange
                  }));
                }}
                placeholder="选择时间范围"
              />
            </View>
          </ScrollView>

          <Card.Actions style={styles.actions}>
            <Button mode="outlined" onPress={handleResetFilters}>
              重置
            </Button>
            <Button mode="contained" onPress={handleApplyFilters}>
              应用筛选
            </Button>
          </Card.Actions>
        </Card>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modal: {
    margin: 20,
    borderRadius: 8
  },
  card: {
    maxHeight: '80%'
  },
  content: {
    maxHeight: 400
  },
  section: {
    padding: 16
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333'
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  chip: {
    margin: 4
  },
  segmentedButtons: {
    marginTop: 8
  },
  divider: {
    marginVertical: 8
  },
  actions: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16
  }
});
```

### **Day 2: 权限分配和高级功能** (8小时)

#### 2.1 权限分配界面 (4小时)

**2.1.1 用户详情和权限编辑**
```tsx
// src/screens/admin/UserDetailsScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import {
  Card,
  Text,
  Avatar,
  Button,
  TextInput,
  Portal,
  Modal,
  Snackbar,
  ActivityIndicator
} from 'react-native-paper';
import { PermissionPicker } from '@/components/permission/PermissionPicker';
import { RoleIndicator } from '@/components/permission/RoleIndicator';
import { useApiRequest } from '@/hooks/useApiRequest';
import { userApi } from '@/services/api/userApi';
import { UserRole, UserType } from '@/types/auth';

interface UserDetailsScreenProps {
  route: {
    params: {
      userId: string;
    };
  };
  navigation: any;
}

export const UserDetailsScreen: React.FC<UserDetailsScreenProps> = ({
  route,
  navigation
}) => {
  const { userId } = route.params;
  const [editMode, setEditMode] = useState(false);
  const [permissionModalVisible, setPermissionModalVisible] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // 获取用户详情
  const {
    data: user,
    loading: userLoading,
    refresh: refreshUser
  } = useApiRequest(
    () => userApi.getUserById(userId),
    { immediate: true }
  );

  // 更新用户信息
  const {
    execute: updateUser,
    loading: updateLoading
  } = useApiRequest(userApi.updateUser);

  // 更新用户权限
  const {
    execute: updatePermissions,
    loading: permissionLoading
  } = useApiRequest(userApi.updateUserPermissions);

  const [editForm, setEditForm] = useState({
    fullName: '',
    email: '',
    department: '',
    position: ''
  });

  const [selectedRole, setSelectedRole] = useState<UserRole>('viewer');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      setEditForm({
        fullName: user.fullName || '',
        email: user.email || '',
        department: user.department || '',
        position: user.position || ''
      });
      setSelectedRole(user.role);
      setSelectedPermissions(user.permissions?.features || []);
    }
  }, [user]);

  const handleSaveBasicInfo = async () => {
    try {
      await updateUser(userId, editForm);
      setEditMode(false);
      refreshUser();
      showSnackbar('用户信息更新成功');
    } catch (error) {
      showSnackbar('更新失败：' + error.message);
    }
  };

  const handleSavePermissions = async () => {
    try {
      await updatePermissions(userId, {
        role: selectedRole,
        permissions: selectedPermissions
      });
      setPermissionModalVisible(false);
      refreshUser();
      showSnackbar('权限更新成功');
    } catch (error) {
      showSnackbar('权限更新失败：' + error.message);
    }
  };

  const showSnackbar = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  if (userLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text>加载用户信息...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.errorContainer}>
        <Text>用户不存在</Text>
        <Button onPress={() => navigation.goBack()}>返回</Button>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* 用户基本信息 */}
      <Card style={styles.card}>
        <Card.Title title="基本信息" />
        <Card.Content>
          <View style={styles.userHeader}>
            <Avatar.Text
              size={64}
              label={user.fullName?.charAt(0) || 'U'}
              style={styles.avatar}
            />
            <View style={styles.userMeta}>
              <Text style={styles.userName}>{user.fullName}</Text>
              <Text style={styles.userEmail}>{user.email}</Text>
              <RoleIndicator
                role={user.role}
                userType="factory_user"
                department={user.department}
                size="medium"
              />
            </View>
          </View>

          {editMode ? (
            <View style={styles.editForm}>
              <TextInput
                label="姓名"
                value={editForm.fullName}
                onChangeText={(text) => setEditForm(prev => ({ ...prev, fullName: text }))}
                style={styles.input}
              />
              <TextInput
                label="邮箱"
                value={editForm.email}
                onChangeText={(text) => setEditForm(prev => ({ ...prev, email: text }))}
                style={styles.input}
              />
              <TextInput
                label="部门"
                value={editForm.department}
                onChangeText={(text) => setEditForm(prev => ({ ...prev, department: text }))}
                style={styles.input}
              />
              <TextInput
                label="职位"
                value={editForm.position}
                onChangeText={(text) => setEditForm(prev => ({ ...prev, position: text }))}
                style={styles.input}
              />
            </View>
          ) : (
            <View style={styles.userDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>用户名:</Text>
                <Text style={styles.detailValue}>{user.username}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>部门:</Text>
                <Text style={styles.detailValue}>{user.department || '未设置'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>职位:</Text>
                <Text style={styles.detailValue}>{user.position || '未设置'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>状态:</Text>
                <Text style={[
                  styles.detailValue,
                  { color: user.status === 'active' ? '#4CAF50' : '#F44336' }
                ]}>
                  {user.status === 'active' ? '正常' : '停用'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>创建时间:</Text>
                <Text style={styles.detailValue}>
                  {new Date(user.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>最后登录:</Text>
                <Text style={styles.detailValue}>
                  {user.lastLogin 
                    ? new Date(user.lastLogin).toLocaleString()
                    : '从未登录'
                  }
                </Text>
              </View>
            </View>
          )}
        </Card.Content>
        <Card.Actions>
          {editMode ? (
            <>
              <Button onPress={() => setEditMode(false)}>取消</Button>
              <Button 
                mode="contained" 
                onPress={handleSaveBasicInfo}
                loading={updateLoading}
              >
                保存
              </Button>
            </>
          ) : (
            <Button mode="outlined" onPress={() => setEditMode(true)}>
              编辑信息
            </Button>
          )}
        </Card.Actions>
      </Card>

      {/* 权限管理 */}
      <Card style={styles.card}>
        <Card.Title title="权限管理" />
        <Card.Content>
          <View style={styles.permissionSummary}>
            <Text style={styles.permissionLabel}>当前角色:</Text>
            <RoleIndicator
              role={user.role}
              userType="factory_user"
              department={user.department}
              size="medium"
              showDetails
            />
          </View>
          
          <Text style={styles.permissionLabel}>权限数量:</Text>
          <Text style={styles.permissionCount}>
            {user.permissions?.features?.length || 0} 个权限
          </Text>

          {user.permissions?.features && user.permissions.features.length > 0 && (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.permissionChips}
            >
              {user.permissions.features.slice(0, 5).map((permission, index) => (
                <Text key={index} style={styles.permissionChip}>
                  {permission}
                </Text>
              ))}
              {user.permissions.features.length > 5 && (
                <Text style={styles.permissionChip}>
                  +{user.permissions.features.length - 5} 更多
                </Text>
              )}
            </ScrollView>
          )}
        </Card.Content>
        <Card.Actions>
          <Button 
            mode="contained" 
            onPress={() => setPermissionModalVisible(true)}
          >
            管理权限
          </Button>
        </Card.Actions>
      </Card>

      {/* 权限编辑弹窗 */}
      <Portal>
        <Modal
          visible={permissionModalVisible}
          onDismiss={() => setPermissionModalVisible(false)}
          contentContainerStyle={styles.permissionModal}
        >
          <Card>
            <Card.Title title="编辑用户权限" />
            <Card.Content>
              <PermissionPicker
                userType="factory_user"
                selectedRole={selectedRole}
                selectedPermissions={selectedPermissions}
                onRoleChange={setSelectedRole}
                onPermissionsChange={setSelectedPermissions}
              />
            </Card.Content>
            <Card.Actions>
              <Button onPress={() => setPermissionModalVisible(false)}>
                取消
              </Button>
              <Button 
                mode="contained" 
                onPress={handleSavePermissions}
                loading={permissionLoading}
              >
                保存权限
              </Button>
            </Card.Actions>
          </Card>
        </Modal>
      </Portal>

      {/* 消息提示 */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
      >
        {snackbarMessage}
      </Snackbar>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  card: {
    margin: 16,
    marginBottom: 8
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  avatar: {
    backgroundColor: '#1976D2'
  },
  userMeta: {
    marginLeft: 16,
    flex: 1
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333'
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8
  },
  editForm: {
    marginTop: 16
  },
  input: {
    marginBottom: 12
  },
  userDetails: {
    marginTop: 16
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 8
  },
  detailLabel: {
    width: 80,
    fontSize: 14,
    color: '#666'
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    color: '#333'
  },
  permissionSummary: {
    marginBottom: 16
  },
  permissionLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8
  },
  permissionCount: {
    fontSize: 16,
    color: '#1976D2',
    marginBottom: 8
  },
  permissionChips: {
    marginTop: 8
  },
  permissionChip: {
    backgroundColor: '#E3F2FD',
    color: '#1976D2',
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginRight: 8,
    borderRadius: 16,
    fontSize: 12
  },
  permissionModal: {
    margin: 20,
    maxHeight: '80%'
  }
});
```

#### 2.2 白名单管理和批量操作 (4小时)

**2.2.1 白名单管理组件**
```tsx
// src/components/user/WhitelistManagement.tsx
import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import {
  Card,
  Text,
  Button,
  FAB,
  Portal,
  Modal,
  TextInput,
  DataTable,
  IconButton,
  Chip,
  Snackbar
} from 'react-native-paper';
import { FlashList } from '@shopify/flash-list';
import DocumentPicker from 'react-native-document-picker';
import XLSX from 'xlsx';
import { useApiRequest } from '@/hooks/useApiRequest';
import { whitelistApi } from '@/services/api/whitelistApi';

interface WhitelistEntry {
  id: string;
  phoneNumber: string;
  name: string;
  department: string;
  position: string;
  status: 'pending' | 'registered' | 'expired';
  createdAt: string;
  expiresAt: string;
}

interface WhitelistManagementProps {
  factoryId: string;
}

export const WhitelistManagement: React.FC<WhitelistManagementProps> = ({
  factoryId
}) => {
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // 单个添加表单
  const [addForm, setAddForm] = useState({
    phoneNumber: '',
    name: '',
    department: '',
    position: ''
  });

  // 批量导入数据
  const [batchData, setBatchData] = useState<any[]>([]);

  // 获取白名单数据
  const {
    data: whitelistData,
    loading,
    refresh,
    execute: loadWhitelist
  } = useApiRequest(
    () => whitelistApi.getWhitelist(factoryId),
    { immediate: true }
  );

  // 添加单个白名单
  const {
    execute: addSingleWhitelist,
    loading: addLoading
  } = useApiRequest(whitelistApi.addToWhitelist);

  // 批量导入白名单
  const {
    execute: batchImportWhitelist,
    loading: batchLoading
  } = useApiRequest(whitelistApi.batchImportWhitelist);

  // 删除白名单项
  const {
    execute: removeFromWhitelist,
    loading: removeLoading
  } = useApiRequest(whitelistApi.removeFromWhitelist);

  const handleAddSingle = async () => {
    try {
      await addSingleWhitelist({
        factoryId,
        phoneNumbers: [addForm.phoneNumber],
        name: addForm.name,
        department: addForm.department,
        position: addForm.position
      });

      setAddModalVisible(false);
      setAddForm({ phoneNumber: '', name: '', department: '', position: '' });
      refresh();
      showSnackbar('添加成功');
    } catch (error) {
      showSnackbar('添加失败：' + error.message);
    }
  };

  const handleFileSelect = async () => {
    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.xlsx, DocumentPicker.types.xls],
        allowMultiSelection: false
      });

      const file = result[0];
      
      // 读取Excel文件
      const response = await fetch(file.uri);
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      // 验证数据格式
      const validatedData = jsonData.map((row: any, index) => {
        const phoneNumber = row['手机号'] || row['phoneNumber'] || '';
        const name = row['姓名'] || row['name'] || '';
        const department = row['部门'] || row['department'] || '';
        const position = row['职位'] || row['position'] || '';

        if (!phoneNumber || !/^1[3-9]\d{9}$/.test(phoneNumber)) {
          throw new Error(`第${index + 2}行手机号格式错误`);
        }

        return {
          phoneNumber,
          name,
          department,
          position,
          valid: true
        };
      });

      setBatchData(validatedData);
      setBatchModalVisible(true);
    } catch (error) {
      showSnackbar('文件读取失败：' + error.message);
    }
  };

  const handleBatchImport = async () => {
    try {
      const whitelists = batchData.map(item => ({
        identifier: item.phoneNumber,
        identifier_type: 'phone' as const,
        name: item.name,
        department: item.department,
        position: item.position
      }));

      await batchImportWhitelist({
        factory_id: factoryId,
        whitelists
      });

      setBatchModalVisible(false);
      setBatchData([]);
      refresh();
      showSnackbar(`成功导入 ${whitelists.length} 条记录`);
    } catch (error) {
      showSnackbar('批量导入失败：' + error.message);
    }
  };

  const handleRemoveItem = (id: string, phoneNumber: string) => {
    Alert.alert(
      '确认删除',
      `确定要删除手机号 ${phoneNumber} 的白名单记录吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeFromWhitelist(id);
              refresh();
              showSnackbar('删除成功');
            } catch (error) {
              showSnackbar('删除失败：' + error.message);
            }
          }
        }
      ]
    );
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: '#FF9800',
      registered: '#4CAF50',
      expired: '#F44336'
    };
    return colors[status] || '#999';
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      pending: '待注册',
      registered: '已注册',
      expired: '已过期'
    };
    return labels[status] || status;
  };

  const showSnackbar = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  const renderWhitelistItem = ({ item }: { item: WhitelistEntry }) => (
    <DataTable.Row>
      <DataTable.Cell style={styles.phoneCell}>
        {item.phoneNumber}
      </DataTable.Cell>
      <DataTable.Cell style={styles.nameCell}>
        {item.name || '-'}
      </DataTable.Cell>
      <DataTable.Cell style={styles.statusCell}>
        <Chip
          mode="outlined"
          style={[styles.statusChip, { borderColor: getStatusColor(item.status) }]}
          textStyle={[styles.statusText, { color: getStatusColor(item.status) }]}
          compact
        >
          {getStatusLabel(item.status)}
        </Chip>
      </DataTable.Cell>
      <DataTable.Cell style={styles.actionCell}>
        <IconButton
          icon="delete"
          size={20}
          iconColor="#F44336"
          onPress={() => handleRemoveItem(item.id, item.phoneNumber)}
        />
      </DataTable.Cell>
    </DataTable.Row>
  );

  return (
    <View style={styles.container}>
      {/* 统计信息 */}
      <Card style={styles.statsCard}>
        <Card.Content style={styles.statsContent}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {whitelistData?.data?.length || 0}
            </Text>
            <Text style={styles.statLabel}>白名单总数</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {whitelistData?.data?.filter(item => item.status === 'pending').length || 0}
            </Text>
            <Text style={styles.statLabel}>待注册</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {whitelistData?.data?.filter(item => item.status === 'registered').length || 0}
            </Text>
            <Text style={styles.statLabel}>已注册</Text>
          </View>
        </Card.Content>
      </Card>

      {/* 白名单列表 */}
      <Card style={styles.listCard}>
        <Card.Title title="白名单列表" />
        <Card.Content>
          <DataTable>
            <DataTable.Header>
              <DataTable.Title style={styles.phoneHeader}>手机号</DataTable.Title>
              <DataTable.Title style={styles.nameHeader}>姓名</DataTable.Title>
              <DataTable.Title style={styles.statusHeader}>状态</DataTable.Title>
              <DataTable.Title style={styles.actionHeader}>操作</DataTable.Title>
            </DataTable.Header>

            <FlashList
              data={whitelistData?.data || []}
              renderItem={renderWhitelistItem}
              keyExtractor={(item) => item.id}
              estimatedItemSize={60}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>暂无白名单记录</Text>
                </View>
              }
            />
          </DataTable>
        </Card.Content>
      </Card>

      {/* 操作按钮 */}
      <View style={styles.fabContainer}>
        <FAB
          icon="upload"
          label="批量导入"
          style={styles.batchFab}
          onPress={handleFileSelect}
        />
        <FAB
          icon="plus"
          style={styles.addFab}
          onPress={() => setAddModalVisible(true)}
        />
      </View>

      {/* 单个添加弹窗 */}
      <Portal>
        <Modal
          visible={addModalVisible}
          onDismiss={() => setAddModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <Card>
            <Card.Title title="添加白名单" />
            <Card.Content>
              <TextInput
                label="手机号 *"
                value={addForm.phoneNumber}
                onChangeText={(text) => setAddForm(prev => ({ ...prev, phoneNumber: text }))}
                keyboardType="phone-pad"
                style={styles.input}
              />
              <TextInput
                label="姓名"
                value={addForm.name}
                onChangeText={(text) => setAddForm(prev => ({ ...prev, name: text }))}
                style={styles.input}
              />
              <TextInput
                label="部门"
                value={addForm.department}
                onChangeText={(text) => setAddForm(prev => ({ ...prev, department: text }))}
                style={styles.input}
              />
              <TextInput
                label="职位"
                value={addForm.position}
                onChangeText={(text) => setAddForm(prev => ({ ...prev, position: text }))}
                style={styles.input}
              />
            </Card.Content>
            <Card.Actions>
              <Button onPress={() => setAddModalVisible(false)}>取消</Button>
              <Button 
                mode="contained" 
                onPress={handleAddSingle}
                loading={addLoading}
                disabled={!addForm.phoneNumber}
              >
                添加
              </Button>
            </Card.Actions>
          </Card>
        </Modal>
      </Portal>

      {/* 批量导入预览弹窗 */}
      <Portal>
        <Modal
          visible={batchModalVisible}
          onDismiss={() => setBatchModalVisible(false)}
          contentContainerStyle={styles.batchModal}
        >
          <Card>
            <Card.Title 
              title="批量导入预览" 
              subtitle={`共 ${batchData.length} 条记录`} 
            />
            <Card.Content>
              <DataTable>
                <DataTable.Header>
                  <DataTable.Title>手机号</DataTable.Title>
                  <DataTable.Title>姓名</DataTable.Title>
                  <DataTable.Title>部门</DataTable.Title>
                </DataTable.Header>
                
                {batchData.slice(0, 5).map((item, index) => (
                  <DataTable.Row key={index}>
                    <DataTable.Cell>{item.phoneNumber}</DataTable.Cell>
                    <DataTable.Cell>{item.name}</DataTable.Cell>
                    <DataTable.Cell>{item.department}</DataTable.Cell>
                  </DataTable.Row>
                ))}
                
                {batchData.length > 5 && (
                  <DataTable.Row>
                    <DataTable.Cell>...</DataTable.Cell>
                    <DataTable.Cell>还有 {batchData.length - 5} 条</DataTable.Cell>
                    <DataTable.Cell>...</DataTable.Cell>
                  </DataTable.Row>
                )}
              </DataTable>
            </Card.Content>
            <Card.Actions>
              <Button onPress={() => setBatchModalVisible(false)}>取消</Button>
              <Button 
                mode="contained" 
                onPress={handleBatchImport}
                loading={batchLoading}
              >
                确认导入
              </Button>
            </Card.Actions>
          </Card>
        </Modal>
      </Portal>

      {/* 提示消息 */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  statsCard: {
    margin: 16,
    marginBottom: 8
  },
  statsContent: {
    flexDirection: 'row',
    justifyContent: 'space-around'
  },
  statItem: {
    alignItems: 'center'
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1976D2'
  },
  statLabel: {
    fontSize: 12,
    color: '#666'
  },
  listCard: {
    flex: 1,
    margin: 16,
    marginTop: 8
  },
  phoneCell: {
    flex: 2
  },
  nameCell: {
    flex: 1.5
  },
  statusCell: {
    flex: 1.5
  },
  actionCell: {
    flex: 1
  },
  phoneHeader: {
    flex: 2
  },
  nameHeader: {
    flex: 1.5
  },
  statusHeader: {
    flex: 1.5
  },
  actionHeader: {
    flex: 1
  },
  statusChip: {
    height: 24
  },
  statusText: {
    fontSize: 11
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60
  },
  emptyText: {
    fontSize: 16,
    color: '#999'
  },
  fabContainer: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'column'
  },
  batchFab: {
    marginBottom: 8
  },
  addFab: {},
  modal: {
    margin: 20
  },
  batchModal: {
    margin: 20,
    maxHeight: '80%'
  },
  input: {
    marginBottom: 12
  }
});
```

## 🏆 交付物

### 技术交付物
- [ ] **用户管理主界面** (UserManagementScreen.tsx) - 完整的用户管理界面
- [ ] **用户列表组件** (UserListItem.tsx) - 用户列表项显示组件
- [ ] **用户筛选组件** (UserFilterSheet.tsx) - 高级筛选功能
- [ ] **用户详情界面** (UserDetailsScreen.tsx) - 用户信息和权限管理
- [ ] **权限分配界面** - 可视化权限配置和角色管理
- [ ] **白名单管理组件** (WhitelistManagement.tsx) - 完整白名单管理
- [ ] **批量操作组件** (BatchActionBar.tsx) - 批量用户操作

### 功能交付物
- [ ] **用户CRUD操作** - 创建、查看、编辑、删除用户
- [ ] **高级搜索筛选** - 多维度用户搜索和筛选
- [ ] **分页数据加载** - 大数据量的分页处理
- [ ] **批量用户操作** - 批量激活、停用、删除用户
- [ ] **权限可视化管理** - 直观的权限分配界面
- [ ] **白名单完整管理** - 单个添加和Excel批量导入
- [ ] **用户状态管理** - 用户激活、停用状态控制

### 用户体验交付物
- [ ] **响应式设计** - 适配不同屏幕尺寸的界面
- [ ] **流畅的交互动画** - 页面切换和操作反馈动画
- [ ] **直观的数据可视化** - 用户统计和状态可视化
- [ ] **友好的错误处理** - 清晰的错误提示和恢复指导
- [ ] **离线数据支持** - 关键数据的离线缓存和同步

## ✅ 验收标准

### 功能完整性验证
- [ ] 用户列表正确显示和分页加载
- [ ] 搜索和筛选功能准确工作
- [ ] 用户创建、编辑、删除功能正常
- [ ] 权限分配界面正确显示和更新
- [ ] 批量操作功能稳定可靠
- [ ] 白名单管理功能完整可用

### 权限安全验证
- [ ] 用户只能看到有权限的操作
- [ ] 权限变更后界面即时更新
- [ ] 批量操作受权限控制
- [ ] 敏感操作有确认机制

### 性能验证
- [ ] 大量用户数据加载流畅
- [ ] 搜索响应时间 < 500ms
- [ ] 界面切换动画流畅
- [ ] 内存使用稳定
- [ ] 批量操作性能稳定

### 用户体验验证
- [ ] 界面设计美观统一
- [ ] 操作流程直观易懂
- [ ] 错误提示友好准确
- [ ] 支持键盘和辅助功能
- [ ] 离线状态提示清晰

## 📊 时间分配

| 阶段 | 内容 | 预计时间 | 关键交付物 |
|------|------|----------|-----------|
| Day 1 上午 | 用户列表界面 | 4小时 | UserManagementScreen, UserListItem |
| Day 1 下午 | 用户筛选搜索 | 4小时 | UserFilterSheet, 搜索功能 |
| Day 2 上午 | 权限分配界面 | 4小时 | UserDetailsScreen, 权限管理 |
| Day 2 下午 | 白名单批量操作 | 4小时 | WhitelistManagement, 批量功能 |
| **总计** | **用户管理系统完整实现** | **16小时** | **完整用户管理功能** |

## 🚨 风险与对策

### 技术风险
- **风险**: 大量用户数据加载性能问题
- **对策**: 虚拟化列表、分页加载、数据缓存

- **风险**: Excel文件解析兼容性问题
- **对策**: 多格式支持、错误处理、模板提供

- **风险**: 权限界面复杂度过高
- **对策**: 分步配置、智能推荐、预设模板

### 数据安全风险
- **风险**: 批量操作误删数据
- **对策**: 多重确认、操作日志、数据备份

- **风险**: 权限配置错误
- **对策**: 权限预览、变更审计、回滚机制

### 用户体验风险
- **风险**: 界面操作复杂难用
- **对策**: 用户测试、操作指导、简化流程

- **风险**: 大数据量时界面卡顿
- **对策**: 虚拟滚动、懒加载、性能优化

## 🔄 与其他任务的接口

### 输入依赖
- **TASK-RN-005**: 权限控制系统和权限组件
- **TASK-RN-007**: API客户端和请求状态管理
- **TASK-RN-006**: 导航系统和路由保护

### 输出到后续任务
- **TASK-RN-009**: 基础组件库使用用户管理组件
- **所有业务模块**: 使用用户管理的权限和角色功能

## 📝 开发检查点

### Day 1 检查点
- [ ] 用户列表是否正确显示
- [ ] 搜索筛选功能是否准确
- [ ] 分页加载是否流畅
- [ ] 用户操作权限是否正确

### Day 2 检查点
- [ ] 权限分配是否直观易用
- [ ] 白名单管理是否完整
- [ ] 批量操作是否稳定
- [ ] 整体用户体验是否良好

## 📞 技术支持

**负责人**: [待分配]
**技术支持**: [项目技术负责人]
**参考资料**: 
- React Native Paper组件库
- Excel文件处理最佳实践
- 移动端用户界面设计指南

---

**任务创建时间**: 2025-08-05
**计划开始时间**: TASK-RN-007完成后
**计划完成时间**: 开始后2个工作日

*此任务是管理功能的核心界面，提供完整的用户和权限管理能力。*