import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { usePermission } from '../../hooks/usePermission';
import { User, UserRole } from '../../types/auth';
import { UserManagementModal } from '../modals/UserManagementModal';
import { getUserRole } from '../../utils/roleMapping';
import { UserApiClient } from '../../services/api/userApiClient';
import { NetworkManager } from '../../services/networkManager';

interface UserListComponentProps {
  onUserPress?: (user: User) => void;
}

export const UserListComponent: React.FC<UserListComponentProps> = ({ onUserPress }) => {
  const { user: currentUser } = useAuthStore();
  const { hasPermission, canManageUser } = usePermission();
  
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserType, setSelectedUserType] = useState<'all' | 'platform' | 'factory'>('all');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);

  // 分页和筛选状态
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0
  });
  const [error, setError] = useState<string | null>(null);

  // 加载用户列表
  const loadUsers = async (page: number = 1, clearPrevious: boolean = false) => {
    try {
      setLoading(true);
      setError(null);

      // 检查网络连接
      const isConnected = await NetworkManager.isConnected();
      if (!isConnected) {
        throw new Error('网络连接不可用，请检查网络设置');
      }

      // 调用真实的用户API
      const response = await NetworkManager.executeWithRetry(
        () => UserApiClient.getUserList({
          page,
          pageSize: pagination.pageSize,
          userType: selectedUserType === 'all' ? undefined : selectedUserType,
          search: searchQuery.trim() || undefined,
        }),
        { maxRetries: 2, baseDelay: 1000 }
      );

      if (response.success && response.data) {
        const { users: newUsers, pagination: newPagination } = response.data;
        
        // 转换用户数据为前端格式
        const transformedUsers: User[] = newUsers.map(user => ({
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          phone: user.phone,
          userType: user.userType,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          // 基于userType添加相应的用户信息
          ...(user.userType === 'platform' ? {
            platformUser: {
              role: user.role as any,
              permissions: []
            }
          } : {
            factoryUser: {
              role: user.role as any,
              department: user.department,
              factoryId: 'unknown', // 需要从API获取
              permissions: []
            }
          })
        }));

        if (clearPrevious || page === 1) {
          setUsers(transformedUsers);
        } else {
          setUsers(prev => [...prev, ...transformedUsers]);
        }

        setPagination({
          page: newPagination.page,
          pageSize: newPagination.pageSize,
          total: newPagination.total,
          totalPages: newPagination.totalPages
        });

        console.log('用户列表加载成功:', { 
          count: transformedUsers.length, 
          total: newPagination.total,
          page: newPagination.page
        });
      } else {
        throw new Error(response.message || '获取用户列表失败');
      }
    } catch (error) {
      console.error('加载用户列表失败:', error);
      setError(error.message || '加载失败');
      
      // 如果是首次加载失败，显示错误提示
      if (page === 1) {
        Alert.alert('加载失败', error.message || '无法获取用户列表，请检查网络连接后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  // 初始加载和搜索/筛选变化时重新加载
  useEffect(() => {
    loadUsers(1, true);
  }, [selectedUserType]);

  // 搜索延迟执行
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim().length > 0 || searchQuery.trim().length === 0) {
        loadUsers(1, true);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // 刷新列表
  const onRefresh = async () => {
    setRefreshing(true);
    await loadUsers(1, true);
    setRefreshing(false);
  };

  // 加载更多数据
  const loadMoreUsers = async () => {
    if (pagination.page < pagination.totalPages && !loading) {
      await loadUsers(pagination.page + 1, false);
    }
  };

  // 由于搜索和筛选现在在服务器端处理，这里直接使用users数组
  const filteredUsers = users;

  // 获取角色显示名称
  const getRoleDisplayName = (user: User): string => {
    const role = getUserRole(user);
    const roleNames: Record<string, string> = {
      'system_developer': '系统开发者',
      'platform_super_admin': '平台超级管理员',
      'platform_operator': '平台操作员',
      'factory_super_admin': '工厂超级管理员',
      'permission_admin': '权限管理员',
      'department_admin': '部门管理员',
      'operator': '操作员',
      'viewer': '查看者',
    };
    return roleNames[role] || role;
  };

  // 删除用户
  const handleDeleteUser = (user: User) => {
    if (!canManageUser(user.id)) {
      Alert.alert('权限不足', '您没有权限删除此用户');
      return;
    }

    Alert.alert(
      '确认删除',
      `您确定要删除用户 "${user.fullName || user.username}" 吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              // 这里应该调用实际的删除API
              // await UserService.deleteUser(user.id);
              setUsers(users.filter(u => u.id !== user.id));
              Alert.alert('成功', '用户已删除');
            } catch (error) {
              Alert.alert('错误', '删除用户失败');
            }
          }
        }
      ]
    );
  };

  // 切换用户状态
  const handleToggleUserStatus = async (user: User) => {
    if (!canManageUser(user.id)) {
      Alert.alert('权限不足', '您没有权限修改此用户状态');
      return;
    }

    try {
      // 这里应该调用实际的API
      // await UserService.updateUserStatus(user.id, !user.isActive);
      
      const updatedUsers = users.map(u => 
        u.id === user.id ? { ...u, isActive: !u.isActive } : u
      );
      setUsers(updatedUsers);
      
      Alert.alert(
        '成功', 
        user.isActive ? '用户已禁用' : '用户已启用'
      );
    } catch (error) {
      Alert.alert('错误', '修改用户状态失败');
    }
  };

  // 编辑用户
  const handleEditUser = (user: User) => {
    if (!canManageUser(user.id)) {
      Alert.alert('权限不足', '您没有权限编辑此用户');
      return;
    }
    setEditingUser(user);
    setShowUserModal(true);
  };

  // 用户保存回调
  const handleUserSaved = (savedUser: User) => {
    if (editingUser) {
      // 更新现有用户
      const updatedUsers = users.map(u => 
        u.id === savedUser.id ? savedUser : u
      );
      setUsers(updatedUsers);
    } else {
      // 添加新用户
      setUsers([...users, savedUser]);
    }
    setShowUserModal(false);
    setEditingUser(null);
  };

  // 渲染用户卡片
  const renderUserCard = ({ item: user }: { item: User }) => (
    <TouchableOpacity
      style={styles.userCard}
      onPress={() => onUserPress?.(user)}
      activeOpacity={0.7}
    >
      {/* 用户头像和基础信息 */}
      <View style={styles.userCardHeader}>
        <View style={styles.avatarContainer}>
          <Ionicons 
            name="person" 
            size={24} 
            color={user.isActive ? "#3182ce" : "#9ca3af"} 
          />
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user.fullName || user.username}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
          <Text style={styles.userRole}>{getRoleDisplayName(user)}</Text>
        </View>
        <View style={styles.userStatus}>
          <View style={[
            styles.statusIndicator,
            { backgroundColor: user.isActive ? '#10b981' : '#ef4444' }
          ]} />
          <Text style={styles.statusText}>
            {user.isActive ? '正常' : '禁用'}
          </Text>
        </View>
      </View>

      {/* 用户详细信息 */}
      <View style={styles.userCardDetails}>
        <View style={styles.detailItem}>
          <Ionicons name="business-outline" size={16} color="#6b7280" />
          <Text style={styles.detailText}>
            {user.userType === 'platform' ? '平台用户' : '工厂用户'}
          </Text>
        </View>
        {user.phone && (
          <View style={styles.detailItem}>
            <Ionicons name="call-outline" size={16} color="#6b7280" />
            <Text style={styles.detailText}>{user.phone}</Text>
          </View>
        )}
        {user.userType === 'factory' && 'factoryUser' in user && user.factoryUser.department && (
          <View style={styles.detailItem}>
            <Ionicons name="location-outline" size={16} color="#6b7280" />
            <Text style={styles.detailText}>{user.factoryUser.department}</Text>
          </View>
        )}
      </View>

      {/* 操作按钮 */}
      <View style={styles.userCardActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleEditUser(user)}
        >
          <Ionicons name="create-outline" size={18} color="#3182ce" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleToggleUserStatus(user)}
        >
          <Ionicons 
            name={user.isActive ? "pause-outline" : "play-outline"} 
            size={18} 
            color={user.isActive ? "#f59e0b" : "#10b981"} 
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDeleteUser(user)}
        >
          <Ionicons name="trash-outline" size={18} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* 搜索和过滤 */}
      <View style={styles.filterContainer}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#9ca3af" />
          <TextInput
            style={styles.searchInput}
            placeholder="搜索用户..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        
        <View style={styles.typeFilter}>
          {['all', 'platform', 'factory'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.filterButton,
                selectedUserType === type && styles.filterButtonActive
              ]}
              onPress={() => setSelectedUserType(type as any)}
            >
              <Text style={[
                styles.filterButtonText,
                selectedUserType === type && styles.filterButtonTextActive
              ]}>
                {type === 'all' ? '全部' : type === 'platform' ? '平台' : '工厂'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 添加用户按钮 */}
      {hasPermission('user_create') && (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            setEditingUser(null);
            setShowUserModal(true);
          }}
        >
          <Ionicons name="add" size={24} color="#fff" />
          <Text style={styles.addButtonText}>添加用户</Text>
        </TouchableOpacity>
      )}

      {/* 用户列表 */}
      <FlatList
        data={filteredUsers}
        renderItem={renderUserCard}
        keyExtractor={(item) => item.id}
        style={styles.userList}
        contentContainerStyle={styles.userListContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3182ce"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyTitle}>暂无用户</Text>
            <Text style={styles.emptyDescription}>
              {searchQuery ? '没有找到匹配的用户' : '还没有添加任何用户'}
            </Text>
          </View>
        }
      />

      {/* 用户管理弹窗 */}
      <UserManagementModal
        visible={showUserModal}
        editingUser={editingUser}
        onClose={() => {
          setShowUserModal(false);
          setEditingUser(null);
        }}
        onUserSaved={handleUserSaved}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  filterContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    marginLeft: 12,
  },
  typeFilter: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    overflow: 'hidden',
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#3182ce',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3182ce',
    marginHorizontal: 20,
    marginVertical: 16,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#3182ce',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  userList: {
    flex: 1,
  },
  userListContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  userCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  userRole: {
    fontSize: 12,
    color: '#8b5cf6',
    fontWeight: '500',
  },
  userStatus: {
    alignItems: 'center',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  userCardDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 6,
  },
  userCardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 16,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
    paddingBottom: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#9ca3af',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#d1d5db',
    textAlign: 'center',
  },
});