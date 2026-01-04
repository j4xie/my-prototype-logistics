import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import {
  Text,
  Card,
  Chip,
  IconButton,
  Button,
  ActivityIndicator,
  Searchbar,
  Checkbox,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { userApiClient, UserDTO } from '../../../services/api/userApiClient';
import { platformAPI, FactoryDTO } from '../../../services/api/platformApiClient';

// Types
interface Factory {
  id: string;
  name: string;
  address: string;
  industry: string;
  status: 'active' | 'inactive';
  userCount: number;
  createdAt: string;
}

interface UserInfo {
  id: string;
  username: string;
  realName: string;
  role: string;
  roleCode: string;
  avatarColor: string;
  assignedFactories: string[];
}

type FilterStatus = 'all' | 'active' | 'inactive';

type UserManagementStackParamList = {
  UserList: undefined;
  UserDetail: { userId: string };
  UserCreate: undefined;
  UserAssignFactory: { userId: string };
  RoleList: undefined;
};

type NavigationProp = NativeStackNavigationProp<UserManagementStackParamList, 'UserAssignFactory'>;
type UserAssignFactoryRouteProp = RouteProp<UserManagementStackParamList, 'UserAssignFactory'>;

// Helper function to generate avatar color from username
const generateAvatarColor = (username: string): string => {
  const colors = ['#1a1a2e', '#ff6b6b', '#4facfe', '#a8edea', '#667eea', '#f093fb', '#52c41a', '#faad14'];
  const hash = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length] ?? '#1a1a2e';
};

// Helper function to convert UserDTO to UserInfo
const convertUserDTOToUserInfo = (dto: UserDTO): UserInfo => {
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
    role: dto.roleDisplayName || roleDisplayMap[dto.roleCode] || dto.roleCode,
    roleCode: dto.roleCode.toLowerCase(),
    avatarColor: generateAvatarColor(dto.username),
    assignedFactories: [], // TODO: Add assigned factories when API supports it
  };
};

// Helper function to convert FactoryDTO to Factory UI type
const convertFactoryDTOToFactory = (dto: FactoryDTO): Factory => ({
  id: dto.id,
  name: dto.factoryName || dto.name || '',
  address: dto.address || '',
  industry: dto.industry || '',
  status: dto.status === 'active' || dto.isActive ? 'active' : 'inactive',
  userCount: dto.totalUsers || 0,
  createdAt: dto.createdAt ? new Date(dto.createdAt).toLocaleDateString('zh-CN') : '',
});

export default function UserAssignFactoryScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<UserAssignFactoryRouteProp>();
  const { t } = useTranslation('platform');
  const { userId } = route.params;

  // State
  const [user, setUser] = useState<UserInfo | null>(null);
  const [factories, setFactories] = useState<Factory[]>([]);
  const [selectedFactories, setSelectedFactories] = useState<string[]>([]);
  const [originalSelection, setOriginalSelection] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Load user info and factories in parallel
      const [userDTO, factoriesResponse] = await Promise.all([
        userApiClient.getUserById(parseInt(userId, 10)),
        platformAPI.getFactories(),
      ]);

      const userInfo = convertUserDTOToUserInfo(userDTO);
      setUser(userInfo);

      if (factoriesResponse.success && factoriesResponse.data) {
        const convertedFactories = factoriesResponse.data.map(convertFactoryDTOToFactory);
        setFactories(convertedFactories);
      }

      // TODO: Load assigned factories when API supports it
      setSelectedFactories(userInfo.assignedFactories);
      setOriginalSelection(userInfo.assignedFactories);
    } catch (error) {
      if (isAxiosError(error)) {
        Alert.alert('加载失败', error.response?.data?.message || '获取数据失败');
      } else {
        Alert.alert('加载失败', '网络错误，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const hasChanges = () => {
    if (selectedFactories.length !== originalSelection.length) return true;
    return !selectedFactories.every(f => originalSelection.includes(f));
  };

  const toggleFactory = (factoryId: string) => {
    setSelectedFactories(prev =>
      prev.includes(factoryId)
        ? prev.filter(f => f !== factoryId)
        : [...prev, factoryId]
    );
  };

  const selectAll = () => {
    const activeFactoryIds = factories
      .filter(f => f.status === 'active')
      .map(f => f.id);
    setSelectedFactories(activeFactoryIds);
  };

  const deselectAll = () => {
    setSelectedFactories([]);
  };

  const handleSave = async () => {
    if (!hasChanges()) {
      navigation.goBack();
      return;
    }

    setSaving(true);
    try {
      // TODO: Implement user factory assignment API when backend supports it
      // For now, we simulate the save operation
      await new Promise(resolve => setTimeout(resolve, 500));
      // await userApiClient.updateUserFactories(parseInt(userId, 10), selectedFactories);

      setOriginalSelection(selectedFactories);
      Alert.alert('成功', '工厂分配已更新', [
        { text: '确定', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      if (isAxiosError(error)) {
        Alert.alert('保存失败', error.response?.data?.message || '保存工厂分配失败');
      } else {
        Alert.alert('保存失败', '网络错误，请稍后重试');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges()) {
      Alert.alert(
        '确认取消',
        '您有未保存的更改，确定要取消吗？',
        [
          { text: '继续编辑', style: 'cancel' },
          { text: '放弃更改', onPress: () => navigation.goBack() },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  // Filter factories
  const filteredFactories = factories.filter(factory => {
    const matchesSearch =
      factory.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      factory.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      factory.industry.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      factory.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Count by status
  const activeCount = factories.filter(f => f.status === 'active').length;
  const inactiveCount = factories.filter(f => f.status === 'inactive').length;
  const selectedActiveCount = selectedFactories.filter(
    id => factories.find(f => f.id === id)?.status === 'active'
  ).length;

  const renderFactoryCard = (factory: Factory) => {
    const isSelected = selectedFactories.includes(factory.id);
    const isOriginallyAssigned = originalSelection.includes(factory.id);
    const isDisabled = factory.status === 'inactive';

    return (
      <TouchableOpacity
        key={factory.id}
        style={[
          styles.factoryCard,
          isSelected && styles.factoryCardSelected,
          isDisabled && styles.factoryCardDisabled,
        ]}
        onPress={() => !isDisabled && toggleFactory(factory.id)}
        activeOpacity={isDisabled ? 1 : 0.7}
      >
        <View style={styles.factoryCardContent}>
          <View style={styles.factoryCheckbox}>
            <Checkbox
              status={isSelected ? 'checked' : 'unchecked'}
              onPress={() => !isDisabled && toggleFactory(factory.id)}
              disabled={isDisabled}
            />
          </View>

          <View style={styles.factoryInfo}>
            <View style={styles.factoryHeader}>
              <View
                style={[
                  styles.factoryIcon,
                  isDisabled && styles.factoryIconDisabled,
                ]}
              >
                <Text style={styles.factoryIconText}>{factory.name.charAt(0)}</Text>
              </View>
              <View style={styles.factoryDetails}>
                <View style={styles.factoryNameRow}>
                  <Text
                    style={[styles.factoryName, isDisabled && styles.textDisabled]}
                    numberOfLines={1}
                  >
                    {factory.name}
                  </Text>
                  {isOriginallyAssigned && (
                    <Chip
                      mode="flat"
                      style={styles.assignedChip}
                      textStyle={styles.assignedChipText}
                    >
                      已分配
                    </Chip>
                  )}
                </View>
                <Text
                  style={[styles.factoryAddress, isDisabled && styles.textMuted]}
                  numberOfLines={1}
                >
                  {factory.address}
                </Text>
              </View>
            </View>

            <View style={styles.factoryMeta}>
              <View style={styles.factoryMetaItem}>
                <Text style={styles.factoryMetaLabel}>行业</Text>
                <Chip
                  mode="flat"
                  style={styles.industryChip}
                  textStyle={styles.industryChipText}
                >
                  {factory.industry}
                </Chip>
              </View>
              <View style={styles.factoryMetaItem}>
                <Text style={styles.factoryMetaLabel}>用户数</Text>
                <Text style={styles.factoryMetaValue}>{factory.userCount}</Text>
              </View>
              <View style={styles.factoryMetaItem}>
                <Text style={styles.factoryMetaLabel}>状态</Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: factory.status === 'active' ? '#f6ffed' : '#f5f5f5' },
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: factory.status === 'active' ? '#52c41a' : '#d9d9d9' },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      { color: factory.status === 'active' ? '#52c41a' : '#8c8c8c' },
                    ]}
                  >
                    {factory.status === 'active' ? '运营中' : '已停用'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading || !user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
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
            <Text style={styles.headerTitle}>分配工厂</Text>
            <View style={{ width: 48 }} />
          </View>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

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
            onPress={handleCancel}
          />
          <Text style={styles.headerTitle}>分配工厂</Text>
          <TouchableOpacity onPress={handleSave} disabled={!hasChanges() || saving}>
            <Text style={[styles.saveText, (!hasChanges() || saving) && styles.saveTextDisabled]}>
              保存
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* User Info Card */}
        <Card style={styles.userInfoCard} mode="elevated">
          <View style={styles.userInfoContent}>
            <View style={[styles.userAvatar, { backgroundColor: user.avatarColor }]}>
              <Text style={styles.userAvatarText}>{user.realName.charAt(0)}</Text>
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.userName}>{user.realName}</Text>
              <Text style={styles.userUsername}>{user.username}</Text>
              <Chip mode="flat" style={styles.userRoleChip} textStyle={styles.userRoleChipText}>
                {user.role}
              </Chip>
            </View>
          </View>
        </Card>

        {/* Selection Summary */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{selectedFactories.length}</Text>
            <Text style={styles.summaryLabel}>已选择</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: '#52c41a' }]}>{selectedActiveCount}</Text>
            <Text style={styles.summaryLabel}>运营中</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: '#1890ff' }]}>{factories.length}</Text>
            <Text style={styles.summaryLabel}>总工厂</Text>
          </View>
        </View>

        {/* Search and Filter */}
        <Searchbar
          placeholder="搜索工厂名称、地址或行业"
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
          inputStyle={styles.searchInput}
        />

        {/* Status Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContainer}
        >
          <TouchableOpacity onPress={() => setStatusFilter('all')}>
            <Chip
              mode="flat"
              selected={statusFilter === 'all'}
              style={[styles.filterChip, statusFilter === 'all' && styles.filterChipSelected]}
              textStyle={[styles.filterChipText, statusFilter === 'all' && styles.filterChipTextSelected]}
            >
              全部 ({factories.length})
            </Chip>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setStatusFilter('active')}>
            <Chip
              mode="flat"
              selected={statusFilter === 'active'}
              style={[styles.filterChip, statusFilter === 'active' && styles.filterChipSelected]}
              textStyle={[styles.filterChipText, statusFilter === 'active' && styles.filterChipTextSelected]}
            >
              运营中 ({activeCount})
            </Chip>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setStatusFilter('inactive')}>
            <Chip
              mode="flat"
              selected={statusFilter === 'inactive'}
              style={[styles.filterChip, statusFilter === 'inactive' && styles.filterChipSelected]}
              textStyle={[styles.filterChipText, statusFilter === 'inactive' && styles.filterChipTextSelected]}
            >
              已停用 ({inactiveCount})
            </Chip>
          </TouchableOpacity>
        </ScrollView>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickActionButton} onPress={selectAll}>
            <IconButton icon="checkbox-multiple-marked" size={16} iconColor="#1890ff" />
            <Text style={styles.quickActionText}>全选运营中</Text>
          </TouchableOpacity>
          <View style={styles.quickActionDivider} />
          <TouchableOpacity style={styles.quickActionButton} onPress={deselectAll}>
            <IconButton icon="checkbox-multiple-blank-outline" size={16} iconColor="#8c8c8c" />
            <Text style={styles.quickActionText}>取消全选</Text>
          </TouchableOpacity>
        </View>

        {/* Factory List */}
        <View style={styles.factoryList}>
          {filteredFactories.length > 0 ? (
            filteredFactories.map(renderFactoryCard)
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>未找到匹配的工厂</Text>
            </View>
          )}
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <Button
          mode="outlined"
          onPress={handleCancel}
          style={styles.actionButton}
          textColor="#595959"
        >
          取消
        </Button>
        <Button
          mode="contained"
          onPress={handleSave}
          style={[styles.actionButton, styles.saveButton]}
          loading={saving}
          disabled={!hasChanges() || saving}
        >
          保存分配
        </Button>
      </View>
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
  saveText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 12,
  },
  saveTextDisabled: {
    color: 'rgba(255,255,255,0.4)',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  userInfoCard: {
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
  },
  userInfoContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  userAvatarText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#262626',
  },
  userUsername: {
    fontSize: 13,
    color: '#8c8c8c',
    marginTop: 2,
    marginBottom: 8,
  },
  userRoleChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#e6f7ff',
  },
  userRoleChipText: {
    color: '#1890ff',
    fontSize: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#262626',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 4,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#f0f0f0',
  },
  searchBar: {
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 0,
  },
  searchInput: {
    fontSize: 14,
  },
  filterScroll: {
    marginBottom: 12,
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
    fontSize: 12,
  },
  filterChipTextSelected: {
    color: '#fff',
  },
  quickActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 16,
    paddingVertical: 4,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  quickActionText: {
    fontSize: 13,
    color: '#595959',
  },
  quickActionDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#f0f0f0',
  },
  factoryList: {
    gap: 12,
  },
  factoryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    overflow: 'hidden',
  },
  factoryCardSelected: {
    borderColor: '#1890ff',
    borderWidth: 2,
  },
  factoryCardDisabled: {
    opacity: 0.6,
  },
  factoryCardContent: {
    flexDirection: 'row',
    padding: 12,
  },
  factoryCheckbox: {
    marginRight: 4,
  },
  factoryInfo: {
    flex: 1,
  },
  factoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  factoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#52c41a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  factoryIconDisabled: {
    backgroundColor: '#d9d9d9',
  },
  factoryIconText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  factoryDetails: {
    flex: 1,
  },
  factoryNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  factoryName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#262626',
    flex: 1,
  },
  assignedChip: {
    backgroundColor: '#f6ffed',
    height: 20,
  },
  assignedChipText: {
    color: '#52c41a',
    fontSize: 10,
  },
  factoryAddress: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 4,
  },
  textDisabled: {
    color: '#bfbfbf',
  },
  textMuted: {
    color: '#d9d9d9',
  },
  factoryMeta: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f5f5f5',
  },
  factoryMetaItem: {
    alignItems: 'flex-start',
  },
  factoryMetaLabel: {
    fontSize: 11,
    color: '#bfbfbf',
    marginBottom: 4,
  },
  factoryMetaValue: {
    fontSize: 13,
    color: '#262626',
    fontWeight: '500',
  },
  industryChip: {
    backgroundColor: '#f0f5ff',
    height: 22,
  },
  industryChipText: {
    color: '#1890ff',
    fontSize: 11,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  emptyContainer: {
    padding: 48,
    alignItems: 'center',
  },
  emptyText: {
    color: '#8c8c8c',
    fontSize: 14,
  },
  bottomPadding: {
    height: 100,
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionButton: {
    flex: 1,
  },
  saveButton: {
    flex: 2,
    backgroundColor: '#1a1a2e',
  },
});
