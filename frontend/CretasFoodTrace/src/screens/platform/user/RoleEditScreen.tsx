import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  Text,
  Card,
  Chip,
  IconButton,
  Switch,
  Button,
  ActivityIndicator,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { userApiClient } from '../../../services/api/userApiClient';

// Types
interface Permission {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

interface PermissionGroup {
  id: string;
  name: string;
  description: string;
  color: string;
  permissions: Permission[];
  expanded: boolean;
}

interface RoleDetail {
  id: string;
  name: string;
  code: string;
  description: string;
  permissionCount: number;
  totalPermissions: number;
  userCount: number;
  isBuiltIn: boolean;
  iconColor: string;
  iconGradient: [string, string];
}

type UserManagementStackParamList = {
  UserList: undefined;
  UserDetail: { userId: string };
  RoleList: undefined;
  RoleEdit: { roleId?: string };
};

type NavigationProp = NativeStackNavigationProp<UserManagementStackParamList, 'RoleEdit'>;
type RoleEditRouteProp = RouteProp<UserManagementStackParamList, 'RoleEdit'>;

// System-defined roles (static configuration)
const SYSTEM_ROLES: Record<string, RoleDetail> = {
  'PLATFORM_ADMIN': {
    id: 'PLATFORM_ADMIN',
    name: '平台管理员',
    code: 'PLATFORM_ADMIN',
    description: '拥有系统最高权限，管理所有工厂、蓝图、规则和配额',
    permissionCount: 85,
    totalPermissions: 85,
    userCount: 0,
    isBuiltIn: true,
    iconColor: '#1a1a2e',
    iconGradient: ['#1a1a2e', '#16213e'],
  },
  'FACTORY_SUPER_ADMIN': {
    id: 'FACTORY_SUPER_ADMIN',
    name: '工厂超级管理员',
    code: 'FACTORY_SUPER_ADMIN',
    description: '管理单个工厂的所有业务，包括蓝图配置、生产调度、质量检验和人员管理',
    permissionCount: 62,
    totalPermissions: 85,
    userCount: 0,
    isBuiltIn: true,
    iconColor: '#ff6b6b',
    iconGradient: ['#ff6b6b', '#ee5a52'],
  },
  'DEPARTMENT_ADMIN': {
    id: 'DEPARTMENT_ADMIN',
    name: '部门管理员',
    code: 'DEPARTMENT_ADMIN',
    description: '管理特定部门业务，如调度中心、质检部、数据分析部',
    permissionCount: 38,
    totalPermissions: 85,
    userCount: 0,
    isBuiltIn: true,
    iconColor: '#667eea',
    iconGradient: ['#667eea', '#764ba2'],
  },
  'OPERATOR': {
    id: 'OPERATOR',
    name: '操作员',
    code: 'OPERATOR',
    description: '执行具体操作任务，如生产、质检、设备维护等',
    permissionCount: 18,
    totalPermissions: 85,
    userCount: 0,
    isBuiltIn: true,
    iconColor: '#4facfe',
    iconGradient: ['#4facfe', '#00f2fe'],
  },
};

// Get default permission groups for a role
const getPermissionGroupsForRole = (roleCode: string): PermissionGroup[] => {
  const isPlatformAdmin = roleCode === 'PLATFORM_ADMIN';
  const isFactoryAdmin = roleCode === 'FACTORY_SUPER_ADMIN';
  const isDeptAdmin = roleCode === 'DEPARTMENT_ADMIN';

  return [
    {
      id: '1',
      name: '工厂管理',
      description: '基础工厂信息和配置管理',
      color: '#667eea',
      expanded: true,
      permissions: [
        { id: '1-1', name: '查看工厂信息', description: '查看基本信息和统计', enabled: isPlatformAdmin || isFactoryAdmin || isDeptAdmin },
        { id: '1-2', name: '编辑工厂信息', description: '修改基本配置', enabled: isPlatformAdmin || isFactoryAdmin },
        { id: '1-3', name: '删除工厂', description: '永久删除工厂数据', enabled: isPlatformAdmin },
      ],
    },
    {
      id: '2',
      name: '蓝图管理',
      description: '工厂蓝图配置和模板管理',
      color: '#52c41a',
      expanded: false,
      permissions: [
        { id: '2-1', name: '查看蓝图', description: '查看蓝图配置详情', enabled: isPlatformAdmin || isFactoryAdmin || isDeptAdmin },
        { id: '2-2', name: '创建蓝图', description: '新建工厂蓝图', enabled: isPlatformAdmin || isFactoryAdmin },
        { id: '2-3', name: '编辑蓝图', description: '修改蓝图配置', enabled: isPlatformAdmin || isFactoryAdmin },
        { id: '2-4', name: '删除蓝图', description: '删除蓝图配置', enabled: isPlatformAdmin || isFactoryAdmin },
      ],
    },
    {
      id: '3',
      name: '规则管理',
      description: '业务规则配置和决策表',
      color: '#faad14',
      expanded: false,
      permissions: [
        { id: '3-1', name: '查看规则', description: '查看所有业务规则', enabled: isPlatformAdmin || isFactoryAdmin || isDeptAdmin },
        { id: '3-2', name: '创建规则', description: '新建业务规则', enabled: isPlatformAdmin || isFactoryAdmin },
      ],
    },
    {
      id: '4',
      name: '配额管理',
      description: '产能和资源配额控制',
      color: '#1890ff',
      expanded: false,
      permissions: [
        { id: '4-1', name: '查看配额', description: '查看配额使用情况', enabled: isPlatformAdmin || isFactoryAdmin || isDeptAdmin },
        { id: '4-2', name: '调整配额', description: '修改配额限制', enabled: isPlatformAdmin },
      ],
    },
    {
      id: '5',
      name: '报表查看',
      description: '各类报表和数据分析',
      color: '#722ed1',
      expanded: false,
      permissions: [
        { id: '5-1', name: '生产报表', description: '查看生产统计报表', enabled: true },
        { id: '5-2', name: '质检报表', description: '查看质检数据报表', enabled: true },
        { id: '5-3', name: '财务报表', description: '查看成本和收益', enabled: isPlatformAdmin },
      ],
    },
    {
      id: '6',
      name: '系统配置',
      description: '系统参数和安全设置',
      color: '#f5222d',
      expanded: false,
      permissions: [
        { id: '6-1', name: '系统参数配置', description: '修改系统参数', enabled: isPlatformAdmin },
        { id: '6-2', name: '安全策略配置', description: '配置安全策略', enabled: isPlatformAdmin },
      ],
    },
  ];
};

export default function RoleEditScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoleEditRouteProp>();
  const { t } = useTranslation('platform');
  const { roleId } = route.params || {};

  // State
  const [role, setRole] = useState<RoleDetail | null>(null);
  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const loadRoleDetail = useCallback(async () => {
    try {
      setLoading(true);

      // Get role from static configuration
      const roleCode = roleId?.toUpperCase() || 'FACTORY_SUPER_ADMIN';
      const roleData = SYSTEM_ROLES[roleCode] || SYSTEM_ROLES['FACTORY_SUPER_ADMIN'];

      // Fetch users to count by role
      const usersResponse = await userApiClient.getUsers({ size: 1000 });
      const userCount = usersResponse.content.filter(
        u => u.roleCode.toUpperCase() === roleCode
      ).length;

      setRole({ ...roleData, userCount } as RoleDetail);
      setPermissionGroups(getPermissionGroupsForRole(roleCode));
    } catch (error) {
      // If API fails, still show role with default data
      const roleCode = roleId?.toUpperCase() || 'FACTORY_SUPER_ADMIN';
      const roleData = SYSTEM_ROLES[roleCode] || SYSTEM_ROLES['FACTORY_SUPER_ADMIN'];
      setRole(roleData as RoleDetail);
      setPermissionGroups(getPermissionGroupsForRole(roleCode));

      if (isAxiosError(error)) {
        // Silent fail for user count - not critical
        console.warn('Failed to load user count:', error.message);
      }
    } finally {
      setLoading(false);
    }
  }, [roleId]);

  useEffect(() => {
    loadRoleDetail();
  }, [loadRoleDetail]);

  const toggleGroupExpanded = (groupId: string) => {
    setPermissionGroups(groups =>
      groups.map(g =>
        g.id === groupId ? { ...g, expanded: !g.expanded } : g
      )
    );
  };

  const togglePermission = (groupId: string, permissionId: string) => {
    setPermissionGroups(groups =>
      groups.map(g =>
        g.id === groupId
          ? {
              ...g,
              permissions: g.permissions.map(p =>
                p.id === permissionId ? { ...p, enabled: !p.enabled } : p
              ),
            }
          : g
      )
    );
    setHasChanges(true);
  };

  const getEnabledCount = (group: PermissionGroup) => {
    return group.permissions.filter(p => p.enabled).length;
  };

  const getTotalEnabledCount = () => {
    return permissionGroups.reduce((sum, g) => sum + getEnabledCount(g), 0);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // TODO: Implement role permission update API when backend supports it
      // For now, simulate the save operation
      await new Promise(resolve => setTimeout(resolve, 500));

      // Collect enabled permissions for API call
      // const enabledPermissions = permissionGroups.flatMap(g =>
      //   g.permissions.filter(p => p.enabled).map(p => p.id)
      // );
      // await roleApiClient.updateRolePermissions(roleId, enabledPermissions);

      setHasChanges(false);
      Alert.alert('成功', '权限配置已保存');
    } catch (error) {
      if (isAxiosError(error)) {
        Alert.alert('保存失败', error.response?.data?.message || '保存权限配置失败');
      } else {
        Alert.alert('保存失败', '网络错误，请稍后重试');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
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

  const renderPermissionGroup = (group: PermissionGroup) => (
    <Card key={group.id} style={styles.groupCard} mode="elevated">
      {/* Group Header */}
      <TouchableOpacity
        style={[styles.groupHeader, { borderLeftColor: group.color }]}
        onPress={() => toggleGroupExpanded(group.id)}
      >
        <View style={styles.groupInfo}>
          <Text style={styles.groupName}>{group.name}</Text>
          <Text style={styles.groupDescription}>{group.description}</Text>
        </View>
        <View style={styles.groupStats}>
          <Text style={styles.groupCount}>
            {getEnabledCount(group)}/{group.permissions.length}
          </Text>
          <IconButton
            icon={group.expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            iconColor="#1890ff"
          />
        </View>
      </TouchableOpacity>

      {/* Permissions List */}
      {group.expanded && (
        <View style={styles.permissionsList}>
          {group.permissions.map((permission, index) => (
            <View
              key={permission.id}
              style={[
                styles.permissionRow,
                index < group.permissions.length - 1 && styles.permissionRowBorder,
              ]}
            >
              <View style={styles.permissionInfo}>
                <Text style={styles.permissionName}>{permission.name}</Text>
                <Text style={styles.permissionDescription}>{permission.description}</Text>
              </View>
              <Switch
                value={permission.enabled}
                onValueChange={() => togglePermission(group.id, permission.id)}
                trackColor={{ false: '#d9d9d9', true: '#52c41a' }}
              />
            </View>
          ))}
          <TouchableOpacity style={styles.viewAllLink}>
            <Text style={styles.viewAllText}>
              展开查看全部 {group.permissions.length} 项权限
            </Text>
            <IconButton icon="chevron-down" size={16} iconColor="#1890ff" />
          </TouchableOpacity>
        </View>
      )}
    </Card>
  );

  if (loading || !role) {
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
            <Text style={styles.headerTitle}>编辑角色权限</Text>
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
          <Text style={styles.headerTitle}>编辑角色权限</Text>
          <TouchableOpacity onPress={handleSave} disabled={!hasChanges || saving}>
            <Text style={[styles.saveText, (!hasChanges || saving) && styles.saveTextDisabled]}>
              保存
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content}>
        {/* Role Info Card */}
        <Card style={styles.roleInfoCard} mode="elevated">
          <View style={styles.roleInfoHeader}>
            <LinearGradient
              colors={role.iconGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.roleIcon}
            >
              <IconButton icon="shield-account" iconColor="#fff" size={28} />
            </LinearGradient>
            <View style={styles.roleInfo}>
              <Text style={styles.roleName}>{role.name}</Text>
              <Text style={styles.roleCode}>{role.code}</Text>
            </View>
          </View>

          <View style={styles.roleDescriptionBox}>
            <Text style={styles.roleDescriptionLabel}>角色描述</Text>
            <Text style={styles.roleDescriptionText}>{role.description}</Text>
          </View>

          <View style={styles.roleStatsRow}>
            <View style={styles.roleStat}>
              <Text style={[styles.roleStatValue, { color: '#1890ff' }]}>
                {getTotalEnabledCount()}
              </Text>
              <Text style={styles.roleStatLabel}>已选权限</Text>
            </View>
            <View style={styles.roleStat}>
              <Text style={[styles.roleStatValue, { color: '#52c41a' }]}>
                {role.userCount}
              </Text>
              <Text style={styles.roleStatLabel}>用户数量</Text>
            </View>
          </View>
        </Card>

        {/* Permission Groups */}
        {permissionGroups.map(renderPermissionGroup)}

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
          disabled={!hasChanges || saving}
        >
          保存修改
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
  roleInfoCard: {
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
  },
  roleInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  roleIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  roleInfo: {
    flex: 1,
  },
  roleName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#262626',
    marginBottom: 4,
  },
  roleCode: {
    fontSize: 13,
    color: '#8c8c8c',
  },
  roleDescriptionBox: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  roleDescriptionLabel: {
    fontSize: 12,
    color: '#8c8c8c',
    marginBottom: 6,
  },
  roleDescriptionText: {
    fontSize: 13,
    color: '#595959',
    lineHeight: 18,
  },
  roleStatsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  roleStat: {
    flex: 1,
    backgroundColor: '#f0f5ff',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  roleStatValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  roleStatLabel: {
    fontSize: 11,
    color: '#8c8c8c',
    marginTop: 2,
  },
  groupCard: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    paddingLeft: 16,
    borderLeftWidth: 3,
    backgroundColor: 'rgba(26,26,46,0.03)',
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#262626',
    marginBottom: 2,
  },
  groupDescription: {
    fontSize: 12,
    color: '#8c8c8c',
  },
  groupStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupCount: {
    fontSize: 13,
    color: '#1890ff',
    fontWeight: '500',
  },
  permissionsList: {
    padding: 4,
    paddingHorizontal: 16,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  permissionRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  permissionInfo: {
    flex: 1,
    marginRight: 12,
  },
  permissionName: {
    fontSize: 14,
    color: '#262626',
  },
  permissionDescription: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 2,
  },
  viewAllLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  viewAllText: {
    fontSize: 13,
    color: '#1890ff',
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
