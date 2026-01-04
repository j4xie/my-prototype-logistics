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
  IconButton,
  ActivityIndicator,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { userApiClient } from '../../../services/api/userApiClient';

// Types
interface Role {
  id: string;
  name: string;
  code: string;
  description: string;
  permissionCount: number;
  userCount: number;
  isBuiltIn: boolean;
  iconColor: string;
  iconGradient: [string, string];
}

interface PermissionCategory {
  name: string;
  count: number;
  percentage: number;
}

type UserManagementStackParamList = {
  UserList: undefined;
  UserDetail: { userId: string };
  RoleList: undefined;
  RoleEdit: { roleId?: string };
};

type NavigationProp = NativeStackNavigationProp<UserManagementStackParamList, 'RoleList'>;

// System-defined roles (static configuration)
const SYSTEM_ROLES: Role[] = [
  {
    id: 'PLATFORM_ADMIN',
    name: '平台管理员',
    code: 'PLATFORM_ADMIN',
    description: '拥有系统最高权限，管理所有工厂、蓝图、规则和配额',
    permissionCount: 85,
    userCount: 0, // Will be updated from API
    isBuiltIn: true,
    iconColor: '#1a1a2e',
    iconGradient: ['#1a1a2e', '#16213e'],
  },
  {
    id: 'FACTORY_SUPER_ADMIN',
    name: '工厂超级管理员',
    code: 'FACTORY_SUPER_ADMIN',
    description: '管理单个工厂的所有业务，包括蓝图、调度、质检和人员',
    permissionCount: 62,
    userCount: 0,
    isBuiltIn: true,
    iconColor: '#ff6b6b',
    iconGradient: ['#ff6b6b', '#ee5a52'],
  },
  {
    id: 'DEPARTMENT_ADMIN',
    name: '部门管理员',
    code: 'DEPARTMENT_ADMIN',
    description: '管理特定部门业务，如调度中心、质检部、数据分析部',
    permissionCount: 38,
    userCount: 0,
    isBuiltIn: true,
    iconColor: '#667eea',
    iconGradient: ['#667eea', '#764ba2'],
  },
  {
    id: 'OPERATOR',
    name: '操作员',
    code: 'OPERATOR',
    description: '执行具体操作任务，如生产、质检、设备维护等',
    permissionCount: 18,
    userCount: 0,
    isBuiltIn: true,
    iconColor: '#4facfe',
    iconGradient: ['#4facfe', '#00f2fe'],
  },
];

// Permission categories (static configuration)
const PERMISSION_CATEGORIES: PermissionCategory[] = [
  { name: '工厂管理', count: 12, percentage: 75 },
  { name: '蓝图管理', count: 18, percentage: 90 },
  { name: '规则管理', count: 15, percentage: 65 },
  { name: '配额管理', count: 10, percentage: 50 },
  { name: '报表查看', count: 20, percentage: 100 },
  { name: '系统配置', count: 10, percentage: 40 },
];

export default function RoleListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation('platform');

  // State
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Stats
  const totalRoles = roles.length;
  const totalUsers = roles.reduce((sum, r) => sum + r.userCount, 0);
  const totalPermissions = 85; // Max permissions

  const loadRoles = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch users to count by role
      const usersResponse = await userApiClient.getUsers({ size: 1000 });
      const usersByRole: Record<string, number> = {};

      usersResponse.content.forEach(user => {
        const roleCode = user.roleCode.toUpperCase();
        usersByRole[roleCode] = (usersByRole[roleCode] || 0) + 1;
      });

      // Update role user counts from API data
      const updatedRoles = SYSTEM_ROLES.map(role => ({
        ...role,
        userCount: usersByRole[role.code] || 0,
      }));

      setRoles(updatedRoles);
    } catch (error) {
      // If API fails, still show roles with 0 counts
      setRoles(SYSTEM_ROLES);
      if (isAxiosError(error)) {
        Alert.alert('加载用户数失败', error.response?.data?.message || '获取用户统计失败');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRoles();
    setRefreshing(false);
  }, [loadRoles]);

  const handleRolePress = (role: Role) => {
    navigation.navigate('RoleEdit', { roleId: role.id });
  };

  const renderRoleCard = (role: Role) => (
    <TouchableOpacity
      key={role.id}
      style={styles.roleCard}
      onPress={() => handleRolePress(role)}
      activeOpacity={0.7}
    >
      <Card style={styles.roleCardInner} mode="elevated">
        <View style={styles.roleHeader}>
          <LinearGradient
            colors={role.iconGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.roleIcon}
          >
            <IconButton
              icon="shield-account"
              iconColor="#fff"
              size={24}
            />
          </LinearGradient>
          <View style={styles.roleInfo}>
            <Text style={styles.roleName}>{role.name}</Text>
            <Text style={styles.roleCode}>{role.code}</Text>
            <Text style={styles.roleDescription} numberOfLines={2}>
              {role.description}
            </Text>
          </View>
        </View>

        <View style={styles.roleStats}>
          <View style={styles.roleStat}>
            <Text style={[styles.roleStatValue, { color: '#1890ff' }]}>
              {role.permissionCount}
            </Text>
            <Text style={styles.roleStatLabel}>权限数</Text>
          </View>
          <View style={styles.roleStatDivider} />
          <View style={styles.roleStat}>
            <Text style={[styles.roleStatValue, { color: '#52c41a' }]}>
              {role.userCount}
            </Text>
            <Text style={styles.roleStatLabel}>用户数</Text>
          </View>
          <View style={styles.roleStatDivider} />
          <View style={styles.roleStat}>
            {role.isBuiltIn && (
              <Chip
                mode="flat"
                style={styles.builtInChip}
                textStyle={styles.builtInChipText}
              >
                系统内置
              </Chip>
            )}
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );

  const renderPermissionBar = (category: PermissionCategory) => (
    <View key={category.name} style={styles.permissionBar}>
      <View style={styles.permissionBarHeader}>
        <Text style={styles.permissionBarLabel}>{category.name}</Text>
        <Text style={styles.permissionBarCount}>{category.count} 项</Text>
      </View>
      <View style={styles.permissionBarTrack}>
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.permissionBarFill, { width: `${category.percentage}%` }]}
        />
      </View>
    </View>
  );

  if (loading) {
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
            <Text style={styles.headerTitle}>角色管理</Text>
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
            onPress={() => navigation.goBack()}
          />
          <Text style={styles.headerTitle}>角色管理</Text>
          <View style={{ width: 48 }} />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <View style={styles.statsCard}>
            <Text style={styles.statsValue}>{totalRoles}</Text>
            <Text style={styles.statsLabel}>系统角色</Text>
          </View>
          <View style={styles.statsCard}>
            <Text style={[styles.statsValue, { color: '#1890ff' }]}>{totalUsers}</Text>
            <Text style={styles.statsLabel}>总用户数</Text>
          </View>
          <View style={styles.statsCard}>
            <Text style={[styles.statsValue, { color: '#52c41a' }]}>{totalPermissions}</Text>
            <Text style={styles.statsLabel}>权限项</Text>
          </View>
        </View>

        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            系统内置角色，不可删除。可编辑角色权限以适应业务需求。
          </Text>
        </View>

        {/* Role List */}
        {roles.map(renderRoleCard)}

        {/* Permission Distribution */}
        <View style={styles.permissionDistribution}>
          <Text style={styles.permissionDistributionTitle}>权限类别分布</Text>
          {PERMISSION_CATEGORIES.map(renderPermissionBar)}
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statsCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
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
  infoBanner: {
    backgroundColor: '#e6f7ff',
    borderLeftWidth: 3,
    borderLeftColor: '#1890ff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  infoBannerText: {
    fontSize: 13,
    color: '#1890ff',
    lineHeight: 20,
  },
  roleCard: {
    marginBottom: 16,
  },
  roleCardInner: {
    borderRadius: 12,
    padding: 16,
  },
  roleHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  roleIcon: {
    width: 48,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  roleInfo: {
    flex: 1,
  },
  roleName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#262626',
    marginBottom: 4,
  },
  roleCode: {
    fontSize: 12,
    color: '#8c8c8c',
    marginBottom: 8,
  },
  roleDescription: {
    fontSize: 13,
    color: '#595959',
    lineHeight: 18,
  },
  roleStats: {
    flexDirection: 'row',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 16,
  },
  roleStat: {
    flex: 1,
    alignItems: 'center',
  },
  roleStatValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  roleStatLabel: {
    fontSize: 11,
    color: '#8c8c8c',
    marginTop: 2,
  },
  roleStatDivider: {
    width: 1,
    backgroundColor: '#f0f0f0',
  },
  builtInChip: {
    backgroundColor: '#f6ffed',
  },
  builtInChipText: {
    color: '#52c41a',
    fontSize: 11,
    fontWeight: '500',
  },
  permissionDistribution: {
    backgroundColor: 'rgba(26,26,46,0.05)',
    borderRadius: 12,
    padding: 16,
  },
  permissionDistributionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#262626',
    marginBottom: 16,
  },
  permissionBar: {
    marginBottom: 12,
  },
  permissionBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  permissionBarLabel: {
    fontSize: 13,
    color: '#595959',
  },
  permissionBarCount: {
    fontSize: 13,
    color: '#262626',
    fontWeight: '500',
  },
  permissionBarTrack: {
    height: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  permissionBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  bottomPadding: {
    height: 32,
  },
});
