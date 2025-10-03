import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { User, UserRole, UserPermissions } from '../../types/auth';
import { useAuthStore } from '../../store/authStore';
import { UserApiClient, UserListItem as ApiUserListItem } from '../../services/api/userApiClient';
import { PermissionManager } from '../../components/auth/PermissionManager';

interface UserManagementScreenProps {
  navigation: any;
}

interface UserListItem {
  id: string;
  username: string;
  fullName: string;
  phone: string;
  email: string;
  role: UserRole;
  department: string;
  isActive: boolean;
  userType: 'platform' | 'factory';
  createdAt: string;
}

export const UserManagementScreen: React.FC<UserManagementScreenProps> = ({ navigation }) => {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isPermissionModalVisible, setIsPermissionModalVisible] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // 角色选项
  const roleOptions = [
    { value: 'system_developer', label: '系统开发者' },
    { value: 'platform_super_admin', label: '平台超级管理员' },
    { value: 'platform_operator', label: '平台操作员' },
    { value: 'factory_super_admin', label: '工厂超级管理员' },
    { value: 'permission_admin', label: '权限管理员' },
    { value: 'department_admin', label: '部门管理员' },
    { value: 'operator', label: '操作员' },
    { value: 'viewer', label: '查看者' },
  ];

  // 加载用户列表
  const loadUsers = async () => {
    try {
      setIsLoading(true);
      
      // 使用真实API获取用户数据
      const response = await UserApiClient.getUserList({
        page: 1,
        pageSize: 50, // 一次性加载更多用户
        isActive: activeFilter === 'all' ? undefined : activeFilter === 'active'
      });

      if (response.success && response.data?.users) {
        const userList: UserListItem[] = response.data.users.map(apiUser => ({
          id: apiUser.id,
          username: apiUser.username,
          fullName: apiUser.fullName || apiUser.username,
          phone: apiUser.phone || '',
          email: apiUser.email || '',
          role: apiUser.role,
          department: apiUser.department || '',
          isActive: apiUser.isActive,
          userType: apiUser.userType,
          createdAt: apiUser.createdAt,
        }));

        setUsers(userList);
        setFilteredUsers(userList);
      } else {
        throw new Error(response.message || '获取用户列表失败');
      }
    } catch (error) {
      console.error('加载用户列表失败:', error);
      Alert.alert('错误', '加载用户列表失败，请检查网络连接');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // 搜索和筛选
  useEffect(() => {
    let filtered = users;

    // 搜索筛选
    if (searchQuery) {
      filtered = filtered.filter(user =>
        user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.phone.includes(searchQuery) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // 状态筛选
    if (activeFilter === 'active') {
      filtered = filtered.filter(user => user.isActive);
    } else if (activeFilter === 'inactive') {
      filtered = filtered.filter(user => !user.isActive);
    }

    setFilteredUsers(filtered);
  }, [users, searchQuery, activeFilter]);

  // 获取角色显示文本
  const getRoleLabel = (role: UserRole): string => {
    const option = roleOptions.find(opt => opt.value === role);
    return option?.label || role;
  };

  // 获取用户状态颜色
  const getStatusColor = (isActive: boolean, userType: 'platform' | 'factory') => {
    if (!isActive) return '#ef4444';
    return userType === 'platform' ? '#3b82f6' : '#10b981';
  };

  // 切换用户状态
  const toggleUserStatus = async (userId: string) => {
    try {
      const user = users.find(u => u.id === userId);
      if (!user) return;

      Alert.alert(
        '确认操作',
        `确定要${user.isActive ? '禁用' : '启用'}用户 ${user.username} 吗？`,
        [
          { text: '取消' },
          {
            text: '确定',
            onPress: async () => {
              // 模拟API调用
              console.log(`${user.isActive ? '禁用' : '启用'}用户:`, userId);
              
              // 更新本地状态
              const updatedUsers = users.map(u =>
                u.id === userId ? { ...u, isActive: !u.isActive } : u
              );
              setUsers(updatedUsers);

              Alert.alert('成功', `用户已${user.isActive ? '禁用' : '启用'}`);
            },
          },
        ]
      );
    } catch (error) {
      console.error('切换用户状态失败:', error);
      Alert.alert('错误', '操作失败，请稍后重试');
    }
  };

  // 编辑用户
  const editUser = (user: UserListItem) => {
    setSelectedUser(user);
    setIsModalVisible(true);
  };

  // 管理用户权限
  const manageUserPermissions = (user: UserListItem) => {
    setSelectedUser(user);
    setIsPermissionModalVisible(true);
  };

  // 保存用户权限
  const saveUserPermissions = async (permissions: UserPermissions) => {
    if (!selectedUser) return;

    try {
      console.log('保存用户权限:', { userId: selectedUser.id, permissions });
      
      // 使用真实API更新用户权限
      const response = await UserApiClient.updateUserPermissions(
        selectedUser.id, 
        permissions.features
      );

      if (response.success) {
        Alert.alert('成功', '用户权限已更新');
        // 刷新用户列表以获取最新数据
        await loadUsers();
      } else {
        throw new Error(response.message || '权限更新失败');
      }
    } catch (error) {
      console.error('保存用户权限失败:', error);
      Alert.alert('错误', '权限保存失败，请稍后重试');
    }
  };

  // 保存用户修改
  const saveUserChanges = async () => {
    if (!selectedUser) return;

    try {
      // 模拟API调用
      console.log('保存用户修改:', selectedUser);

      // 更新本地状态
      const updatedUsers = users.map(u =>
        u.id === selectedUser.id ? selectedUser : u
      );
      setUsers(updatedUsers);

      setIsModalVisible(false);
      setSelectedUser(null);
      Alert.alert('成功', '用户信息已更新');
    } catch (error) {
      console.error('保存用户修改失败:', error);
      Alert.alert('错误', '保存失败，请稍后重试');
    }
  };

  // 渲染用户列表项
  const renderUserItem = ({ item }: { item: UserListItem }) => (
    <View style={styles.userCard}>
      <View style={styles.userInfo}>
        <View style={styles.userHeader}>
          <Text style={styles.userName}>{item.username}</Text>
          <View style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(item.isActive, item.userType) }
          ]}>
            <Text style={styles.statusText}>
              {item.isActive ? '活跃' : '禁用'}
            </Text>
          </View>
        </View>
        
        <Text style={styles.userDetail}>
          <Ionicons name="person-outline" size={14} color="#64748b" />
          {' '}{getRoleLabel(item.role)}
        </Text>
        
        <Text style={styles.userDetail}>
          <Ionicons name="business-outline" size={14} color="#64748b" />
          {' '}{item.department}
        </Text>
        
        <Text style={styles.userDetail}>
          <Ionicons name="mail-outline" size={14} color="#64748b" />
          {' '}{item.email}
        </Text>
        
        <Text style={styles.userDetail}>
          <Ionicons name="call-outline" size={14} color="#64748b" />
          {' '}{item.phone}
        </Text>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => editUser(item)}
        >
          <Ionicons name="create-outline" size={18} color="#3b82f6" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.permissionButton]}
          onPress={() => manageUserPermissions(item)}
        >
          <Ionicons name="key-outline" size={18} color="#8b5cf6" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.toggleButton]}
          onPress={() => toggleUserStatus(item.id)}
        >
          <Ionicons 
            name={item.isActive ? "pause-outline" : "play-outline"} 
            size={18} 
            color={item.isActive ? "#ef4444" : "#10b981"} 
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  // 渲染编辑用户模态框
  const renderEditModal = () => (
    <Modal
      visible={isModalVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setIsModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>编辑用户</Text>
            <TouchableOpacity
              onPress={() => setIsModalVisible(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          {selectedUser && (
            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>用户名</Text>
                <TextInput
                  style={styles.input}
                  value={selectedUser.username}
                  onChangeText={(text) =>
                    setSelectedUser({ ...selectedUser, username: text })
                  }
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>真实姓名</Text>
                <TextInput
                  style={styles.input}
                  value={selectedUser.fullName}
                  onChangeText={(text) =>
                    setSelectedUser({ ...selectedUser, fullName: text })
                  }
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>邮箱</Text>
                <TextInput
                  style={styles.input}
                  value={selectedUser.email}
                  onChangeText={(text) =>
                    setSelectedUser({ ...selectedUser, email: text })
                  }
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>手机号</Text>
                <TextInput
                  style={styles.input}
                  value={selectedUser.phone}
                  onChangeText={(text) =>
                    setSelectedUser({ ...selectedUser, phone: text })
                  }
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>部门</Text>
                <TextInput
                  style={styles.input}
                  value={selectedUser.department}
                  onChangeText={(text) =>
                    setSelectedUser({ ...selectedUser, department: text })
                  }
                />
              </View>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={saveUserChanges}
              >
                <Text style={styles.saveButtonText}>保存修改</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4ECDC4" />
        <Text style={styles.loadingText}>加载用户列表...</Text>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={['#f8fafc', '#e2e8f0']}
      style={styles.container}
    >
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>用户管理</Text>
        <TouchableOpacity style={styles.addButton}>
          <Ionicons name="add" size={24} color="#3b82f6" />
        </TouchableOpacity>
      </View>

      {/* 搜索和筛选 */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#64748b" />
          <TextInput
            style={styles.searchInput}
            placeholder="搜索用户名、邮箱、手机号..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View style={styles.filterButtons}>
          {[
            { key: 'all', label: '全部' },
            { key: 'active', label: '活跃' },
            { key: 'inactive', label: '禁用' },
          ].map(filter => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterButton,
                activeFilter === filter.key && styles.filterButtonActive
              ]}
              onPress={() => setActiveFilter(filter.key as typeof activeFilter)}
            >
              <Text style={[
                styles.filterButtonText,
                activeFilter === filter.key && styles.filterButtonTextActive
              ]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 用户统计 */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{users.length}</Text>
          <Text style={styles.statLabel}>总用户</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#10b981' }]}>
            {users.filter(u => u.isActive).length}
          </Text>
          <Text style={styles.statLabel}>活跃用户</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#ef4444' }]}>
            {users.filter(u => !u.isActive).length}
          </Text>
          <Text style={styles.statLabel}>禁用用户</Text>
        </View>
      </View>

      {/* 用户列表 */}
      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        renderItem={renderUserItem}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color="#94a3b8" />
            <Text style={styles.emptyText}>暂无用户数据</Text>
          </View>
        }
      />

      {/* 编辑模态框 */}
      {renderEditModal()}

      {/* 权限管理模态框 */}
      {selectedUser && (
        <PermissionManager
          visible={isPermissionModalVisible}
          onClose={() => {
            setIsPermissionModalVisible(false);
            setSelectedUser(null);
          }}
          userRole={selectedUser.role}
          currentPermissions={{
            modules: {
              farming_access: true,
              processing_access: true,
              logistics_access: true,
              trace_access: true,
              admin_access: selectedUser.role === 'factory_super_admin' || selectedUser.role === 'permission_admin',
              platform_access: selectedUser.userType === 'platform',
            },
            features: [],
            role: selectedUser.role,
            userType: selectedUser.userType,
          }}
          onSavePermissions={saveUserPermissions}
        />
      )}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    height: 44,
    marginLeft: 8,
    fontSize: 16,
    color: '#1e293b',
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  filterButtonActive: {
    backgroundColor: '#3b82f6',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  userInfo: {
    flex: 1,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#fff',
  },
  userDetail: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#dbeafe',
  },
  permissionButton: {
    backgroundColor: '#f3e8ff',
  },
  toggleButton: {
    backgroundColor: '#f1f5f9',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#94a3b8',
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBody: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    height: 44,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});