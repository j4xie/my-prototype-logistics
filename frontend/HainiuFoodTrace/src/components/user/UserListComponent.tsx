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

  // 模拟用户数据
  const mockUsers: User[] = [
    {
      id: 'user_1',
      username: 'admin',
      email: 'admin@heiniu.com',
      fullName: '系统管理员',
      phone: '13800138001',
      userType: 'platform',
      isActive: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      platformUser: {
        role: 'platform_super_admin',
        permissions: [],
      }
    },
    {
      id: 'user_2',
      username: 'factory_admin',
      email: 'factory@heiniu.com',
      fullName: '工厂管理员',
      phone: '13800138002',
      userType: 'factory',
      isActive: true,
      createdAt: '2024-01-02T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
      factoryUser: {
        role: 'factory_super_admin',
        department: '管理部',
        factoryId: 'factory_1',
        permissions: [],
      }
    },
    {
      id: 'user_3',
      username: 'operator1',
      email: 'operator1@heiniu.com',
      fullName: '操作员张三',
      phone: '13800138003',
      userType: 'factory',
      isActive: true,
      createdAt: '2024-01-03T00:00:00.000Z',
      updatedAt: '2024-01-03T00:00:00.000Z',
      factoryUser: {
        role: 'operator',
        department: '加工部',
        factoryId: 'factory_1',
        permissions: [],
      }
    },
    {
      id: 'user_4',
      username: 'viewer1',
      email: 'viewer1@heiniu.com',
      fullName: '查看员李四',
      userType: 'factory',
      isActive: false,
      createdAt: '2024-01-04T00:00:00.000Z',
      updatedAt: '2024-01-04T00:00:00.000Z',
      factoryUser: {
        role: 'viewer',
        department: '质检部',
        factoryId: 'factory_1',
        permissions: [],
      }
    }
  ];

  // 加载用户列表
  const loadUsers = async () => {
    try {
      setLoading(true);
      // 这里应该调用实际的API
      // const userData = await UserService.getUsers();
      // setUsers(userData);
      
      // 模拟API延迟
      setTimeout(() => {
        setUsers(mockUsers);
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('加载用户列表失败:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // 刷新列表
  const onRefresh = async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  };

  // 过滤用户
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      // 搜索过滤
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          user.username.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query) ||
          (user.fullName && user.fullName.toLowerCase().includes(query)) ||
          (user.phone && user.phone.includes(query));
        
        if (!matchesSearch) return false;
      }

      // 用户类型过滤
      if (selectedUserType !== 'all' && user.userType !== selectedUserType) {
        return false;
      }

      return true;
    });
  }, [users, searchQuery, selectedUserType]);

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