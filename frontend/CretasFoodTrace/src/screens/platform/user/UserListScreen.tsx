import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  Text,
  Card,
  Chip,
  Searchbar,
  IconButton,
  ActivityIndicator,
  FAB,
  Portal,
  Modal,
  Button,
  TextInput,
  Menu,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { userApiClient, UserDTO } from '../../../services/api/userApiClient';

// Types - Using UserDTO from API client and extending with UI properties
interface User {
  id: string;
  username: string;
  realName: string;
  phone: string;
  role: string;
  roleCode: string;
  factoryName?: string;
  department?: string;
  status: 'active' | 'disabled';
  avatarColor: string;
  lastLogin?: string;
}

type RoleFilter = 'all' | 'platform_admin' | 'factory_super_admin' | 'department_admin' | 'operator';
type StatusFilter = 'all' | 'active' | 'disabled';

type UserManagementStackParamList = {
  UserList: undefined;
  UserDetail: { userId: string };
  RoleList: undefined;
  RoleEdit: { roleId?: string };
};

type NavigationProp = NativeStackNavigationProp<UserManagementStackParamList, 'UserList'>;

// Helper function to generate avatar color from username
const generateAvatarColor = (username: string): string => {
  const colors = ['#1a1a2e', '#ff6b6b', '#4facfe', '#a8edea', '#667eea', '#f093fb', '#52c41a', '#faad14'];
  const hash = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length] ?? '#1a1a2e';
};

// Helper function to convert UserDTO to User UI type
const convertUserDTOToUser = (dto: UserDTO): User => {
  const roleDisplayMap: Record<string, string> = {
    'PLATFORM_ADMIN': '平台管理员',
    'FACTORY_SUPER_ADMIN': '工厂超级管理员',
    'DEPARTMENT_ADMIN': '部门管理员',
    'OPERATOR': '操作员',
  };

  return {
    id: dto.id.toString(),
    username: dto.username,
    realName: dto.realName || dto.fullName || dto.username,
    phone: dto.phone || '',
    role: dto.roleDisplayName || roleDisplayMap[dto.roleCode] || dto.roleCode,
    roleCode: dto.roleCode.toLowerCase(),
    department: dto.departmentDisplayName || dto.department,
    status: dto.isActive ? 'active' : 'disabled',
    avatarColor: generateAvatarColor(dto.username),
    lastLogin: dto.updatedAt ? new Date(dto.updatedAt).toLocaleDateString('zh-CN') : undefined,
  };
};

// Static role filter labels
const ROLE_FILTER_LABELS: Record<string, string> = {
  all: '全部',
  platform_admin: '平台管理员',
  factory_super_admin: '工厂超管',
  department_admin: '部门管理员',
  operator: '操作员',
};

export default function UserListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation('platform');

  // State
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addUserModalVisible, setAddUserModalVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [totalElements, setTotalElements] = useState(0);

  // Stats
  const activeCount = users.filter(u => u.status === 'active').length;
  const disabledCount = users.filter(u => u.status === 'disabled').length;

  // Calculate role counts for filters
  const roleFilters = [
    { key: 'all', label: ROLE_FILTER_LABELS.all, count: users.length },
    { key: 'platform_admin', label: ROLE_FILTER_LABELS.platform_admin, count: users.filter(u => u.roleCode === 'platform_admin').length },
    { key: 'factory_super_admin', label: ROLE_FILTER_LABELS.factory_super_admin, count: users.filter(u => u.roleCode === 'factory_super_admin').length },
    { key: 'department_admin', label: ROLE_FILTER_LABELS.department_admin, count: users.filter(u => u.roleCode === 'department_admin').length },
    { key: 'operator', label: ROLE_FILTER_LABELS.operator, count: users.filter(u => u.roleCode === 'operator').length },
  ].filter(f => f.key === 'all' || f.count > 0);

  // Load users from API
  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await userApiClient.getUsers({ size: 100 });
      const convertedUsers = response.content.map(convertUserDTOToUser);
      setUsers(convertedUsers);
      setTotalElements(response.totalElements);
    } catch (error) {
      if (isAxiosError(error)) {
        Alert.alert('加载失败', error.response?.data?.message || '获取用户列表失败');
      } else {
        Alert.alert('加载失败', '网络错误，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Filter users
  useEffect(() => {
    let result = [...users];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        u =>
          u.username.toLowerCase().includes(query) ||
          u.realName.toLowerCase().includes(query) ||
          u.phone.includes(query)
      );
    }

    // Role filter
    if (roleFilter !== 'all') {
      result = result.filter(u => u.roleCode === roleFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(u => u.status === statusFilter);
    }

    setFilteredUsers(result);
  }, [users, searchQuery, roleFilter, statusFilter]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  }, [loadUsers]);

  const handleUserPress = (user: User) => {
    navigation.navigate('UserDetail', { userId: user.id });
  };

  const getRoleChipStyle = (roleCode: string) => {
    switch (roleCode) {
      case 'platform_admin':
        return { bg: '#f6ffed', color: '#52c41a' };
      case 'factory_super_admin':
        return { bg: '#e6f7ff', color: '#1890ff' };
      case 'department_admin':
        return { bg: '#fff7e6', color: '#faad14' };
      default:
        return { bg: '#f5f5f5', color: '#595959' };
    }
  };

  const renderUserCard = (user: User) => {
    const chipStyle = getRoleChipStyle(user.roleCode);
    const isDisabled = user.status === 'disabled';

    return (
      <TouchableOpacity
        key={user.id}
        style={styles.userCard}
        onPress={() => handleUserPress(user)}
        activeOpacity={0.7}
      >
        <View style={styles.userCardContent}>
          <View
            style={[
              styles.avatar,
              { backgroundColor: isDisabled ? '#d9d9d9' : user.avatarColor },
            ]}
          >
            <Text style={[styles.avatarText, isDisabled && styles.avatarTextDisabled]}>
              {user.realName.charAt(0)}
            </Text>
          </View>

          <View style={styles.userInfo}>
            <View style={styles.userNameRow}>
              <Text style={[styles.userName, isDisabled && styles.textDisabled]}>
                {user.realName}
              </Text>
              <Chip
                mode="flat"
                style={[styles.roleChip, { backgroundColor: chipStyle.bg }]}
                textStyle={[styles.roleChipText, { color: chipStyle.color }]}
              >
                {user.role}
              </Chip>
            </View>
            <Text style={[styles.userMeta, isDisabled && styles.textMuted]}>
              {user.username} | {user.factoryName || user.department || user.phone}
            </Text>
          </View>

          <View style={styles.statusContainer}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isDisabled ? '#d9d9d9' : '#52c41a' },
              ]}
            />
            <Text style={[styles.statusText, { color: isDisabled ? '#8c8c8c' : '#52c41a' }]}>
              {isDisabled ? '禁用' : '启用'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={['#1a1a2e', '#16213e']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <IconButton
            icon="arrow-left"
            iconColor="#fff"
            size={24}
            onPress={() => navigation.goBack()}
          />
          <Text style={styles.headerTitle}>用户管理</Text>
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <IconButton
                icon="dots-vertical"
                iconColor="#fff"
                size={24}
                onPress={() => setMenuVisible(true)}
              />
            }
          >
            <Menu.Item
              onPress={() => {
                setMenuVisible(false);
                navigation.navigate('RoleList');
              }}
              title="角色管理"
              leadingIcon="shield-account"
            />
            <Menu.Item
              onPress={() => setMenuVisible(false)}
              title="导出用户"
              leadingIcon="download"
            />
          </Menu>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Search Bar */}
        <Searchbar
          placeholder="搜索用户名、姓名、手机号"
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
          inputStyle={styles.searchInput}
        />

        {/* Role Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContainer}
        >
          {roleFilters.map(filter => (
            <TouchableOpacity
              key={filter.key}
              onPress={() => setRoleFilter(filter.key as RoleFilter)}
            >
              <Chip
                mode="flat"
                selected={roleFilter === filter.key}
                style={[
                  styles.filterChip,
                  roleFilter === filter.key && styles.filterChipSelected,
                ]}
                textStyle={[
                  styles.filterChipText,
                  roleFilter === filter.key && styles.filterChipTextSelected,
                ]}
              >
                {filter.label} ({filter.count})
              </Chip>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Status Filter */}
        <View style={styles.statusFilterRow}>
          <TouchableOpacity
            style={[
              styles.statusFilterCard,
              statusFilter === 'active' && styles.statusFilterCardActive,
            ]}
            onPress={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
          >
            <Text style={styles.statusFilterValue}>{activeCount}</Text>
            <Text style={styles.statusFilterLabel}>启用中</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.statusFilterCard,
              statusFilter === 'disabled' && styles.statusFilterCardActive,
            ]}
            onPress={() => setStatusFilter(statusFilter === 'disabled' ? 'all' : 'disabled')}
          >
            <Text style={styles.statusFilterValue}>{disabledCount}</Text>
            <Text style={styles.statusFilterLabel}>已禁用</Text>
          </TouchableOpacity>
        </View>

        {/* User List */}
        <Card style={styles.listCard} mode="elevated">
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" />
            </View>
          ) : filteredUsers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>未找到匹配的用户</Text>
            </View>
          ) : (
            filteredUsers.map(renderUserCard)
          )}
        </Card>

        {/* Stats Summary */}
        <View style={styles.statsSummary}>
          <View style={styles.statsRow}>
            <View style={styles.statsItem}>
              <Text style={styles.statsValue}>{totalElements || users.length}</Text>
              <Text style={styles.statsLabel}>总用户数</Text>
            </View>
            <View style={styles.statsDivider} />
            <View style={styles.statsItem}>
              <Text style={[styles.statsValue, { color: '#52c41a' }]}>{activeCount}</Text>
              <Text style={styles.statsLabel}>启用用户</Text>
            </View>
            <View style={styles.statsDivider} />
            <View style={styles.statsItem}>
              <Text style={[styles.statsValue, { color: '#8c8c8c' }]}>{disabledCount}</Text>
              <Text style={styles.statsLabel}>禁用用户</Text>
            </View>
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* FAB */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => setAddUserModalVisible(true)}
      />

      {/* Add User Modal */}
      <Portal>
        <Modal
          visible={addUserModalVisible}
          onDismiss={() => setAddUserModalVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.modalTitle}>添加用户</Text>
          <TextInput
            label="用户名"
            mode="outlined"
            style={styles.modalInput}
          />
          <TextInput
            label="真实姓名"
            mode="outlined"
            style={styles.modalInput}
          />
          <TextInput
            label="手机号"
            mode="outlined"
            keyboardType="phone-pad"
            style={styles.modalInput}
          />
          <TextInput
            label="初始密码"
            mode="outlined"
            secureTextEntry
            style={styles.modalInput}
          />
          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setAddUserModalVisible(false)}
              style={styles.modalButton}
            >
              取消
            </Button>
            <Button
              mode="contained"
              onPress={() => setAddUserModalVisible(false)}
              style={styles.modalButton}
            >
              创建
            </Button>
          </View>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  searchBar: {
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  searchInput: {
    fontSize: 14,
  },
  filterScroll: {
    marginBottom: 16,
  },
  filterContainer: {
    gap: 8,
  },
  filterChip: {
    backgroundColor: '#f5f5f5',
  },
  filterChipSelected: {
    backgroundColor: '#1a1a2e',
  },
  filterChipText: {
    color: '#595959',
    fontSize: 13,
  },
  filterChipTextSelected: {
    color: '#fff',
  },
  statusFilterRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statusFilterCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  statusFilterCardActive: {
    borderColor: '#1a1a2e',
    borderWidth: 2,
  },
  statusFilterValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#262626',
  },
  statusFilterLabel: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 2,
  },
  listCard: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  userCard: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  userCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  avatarTextDisabled: {
    color: '#fff',
  },
  userInfo: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  userName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#262626',
  },
  textDisabled: {
    color: '#8c8c8c',
  },
  textMuted: {
    color: '#bfbfbf',
  },
  roleChip: {
    height: 22,
  },
  roleChipText: {
    fontSize: 11,
    fontWeight: '500',
  },
  userMeta: {
    fontSize: 12,
    color: '#8c8c8c',
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  statusText: {
    fontSize: 11,
  },
  loadingContainer: {
    padding: 48,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 48,
    alignItems: 'center',
  },
  emptyText: {
    color: '#8c8c8c',
    fontSize: 14,
  },
  statsSummary: {
    backgroundColor: 'rgba(26,26,46,0.05)',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statsItem: {
    alignItems: 'center',
  },
  statsValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#262626',
  },
  statsLabel: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 4,
  },
  statsDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#d9d9d9',
  },
  bottomPadding: {
    height: 80,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#1a1a2e',
  },
  modalContent: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  modalInput: {
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    minWidth: 80,
  },
});
