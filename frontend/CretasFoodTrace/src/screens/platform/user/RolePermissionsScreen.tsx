import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import {
  Text,
  Card,
  Chip,
  IconButton,
  Button,
  Switch,
  ActivityIndicator,
  Divider,
  Searchbar,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';

// Enable layout animation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Types
interface Permission {
  id: string;
  name: string;
  code: string;
  description: string;
  enabled: boolean;
}

interface PermissionGroup {
  id: string;
  name: string;
  code: string;
  description: string;
  icon: string;
  color: string;
  permissions: Permission[];
  expanded: boolean;
}

interface RoleDetail {
  id: string;
  name: string;
  code: string;
  description: string;
  isBuiltIn: boolean;
  iconColor: string;
  iconGradient: [string, string];
}

type UserManagementStackParamList = {
  UserList: undefined;
  UserDetail: { userId: string };
  RoleList: undefined;
  RoleEdit: { roleId?: string };
  RolePermissions: { roleId: string };
};

type NavigationProp = NativeStackNavigationProp<UserManagementStackParamList, 'RolePermissions'>;
type RolePermissionsRouteProp = RouteProp<UserManagementStackParamList, 'RolePermissions'>;

// System-defined roles (static configuration)
const SYSTEM_ROLES: Record<string, RoleDetail> = {
  'PLATFORM_ADMIN': {
    id: 'PLATFORM_ADMIN',
    name: '平台管理员',
    code: 'PLATFORM_ADMIN',
    description: '拥有系统最高权限，管理所有工厂、蓝图、规则和配额',
    isBuiltIn: true,
    iconColor: '#1a1a2e',
    iconGradient: ['#1a1a2e', '#16213e'],
  },
  'FACTORY_SUPER_ADMIN': {
    id: 'FACTORY_SUPER_ADMIN',
    name: '工厂超级管理员',
    code: 'FACTORY_SUPER_ADMIN',
    description: '管理单个工厂的所有业务，包括蓝图配置、生产调度、质量检验和人员管理',
    isBuiltIn: true,
    iconColor: '#ff6b6b',
    iconGradient: ['#ff6b6b', '#ee5a52'],
  },
  'DEPARTMENT_ADMIN': {
    id: 'DEPARTMENT_ADMIN',
    name: '部门管理员',
    code: 'DEPARTMENT_ADMIN',
    description: '管理特定部门业务，如调度中心、质检部、数据分析部',
    isBuiltIn: true,
    iconColor: '#667eea',
    iconGradient: ['#667eea', '#764ba2'],
  },
  'OPERATOR': {
    id: 'OPERATOR',
    name: '操作员',
    code: 'OPERATOR',
    description: '执行具体操作任务，如生产、质检、设备维护等',
    isBuiltIn: true,
    iconColor: '#4facfe',
    iconGradient: ['#4facfe', '#00f2fe'],
  },
};

// Get permission groups for a role with role-specific enabled states
const getPermissionGroupsForRole = (roleCode: string): PermissionGroup[] => {
  const isPlatformAdmin = roleCode === 'PLATFORM_ADMIN';
  const isFactoryAdmin = roleCode === 'FACTORY_SUPER_ADMIN';
  const isDeptAdmin = roleCode === 'DEPARTMENT_ADMIN';

  return [
    {
      id: 'system',
      name: '系统管理',
      code: 'system_management',
      description: '系统级别的配置和管理权限',
      icon: 'cog',
      color: '#f5222d',
      expanded: false,
      permissions: [
        { id: 'sys_1', name: '系统参数配置', code: 'system.config', description: '修改系统全局参数', enabled: isPlatformAdmin },
        { id: 'sys_2', name: '安全策略管理', code: 'system.security', description: '配置密码策略、登录限制等', enabled: isPlatformAdmin },
        { id: 'sys_3', name: '审计日志查看', code: 'system.audit', description: '查看系统操作日志', enabled: isPlatformAdmin || isFactoryAdmin },
        { id: 'sys_4', name: '数据备份管理', code: 'system.backup', description: '执行和管理数据备份', enabled: isPlatformAdmin },
      ],
    },
    {
      id: 'factory',
      name: '工厂管理',
      code: 'factory_management',
      description: '工厂基础信息和配置管理',
      icon: 'factory',
      color: '#667eea',
      expanded: true,
      permissions: [
        { id: 'fac_1', name: '查看工厂信息', code: 'factory.view', description: '查看工厂基本信息和统计数据', enabled: isPlatformAdmin || isFactoryAdmin || isDeptAdmin },
        { id: 'fac_2', name: '编辑工厂信息', code: 'factory.edit', description: '修改工厂基本配置', enabled: isPlatformAdmin || isFactoryAdmin },
        { id: 'fac_3', name: '创建工厂', code: 'factory.create', description: '新建工厂', enabled: isPlatformAdmin },
        { id: 'fac_4', name: '删除工厂', code: 'factory.delete', description: '永久删除工厂数据', enabled: isPlatformAdmin },
        { id: 'fac_5', name: '工厂状态管理', code: 'factory.status', description: '激活或停用工厂', enabled: isPlatformAdmin || isFactoryAdmin },
      ],
    },
    {
      id: 'production',
      name: '生产管理',
      code: 'production_management',
      description: '生产计划和调度相关权限',
      icon: 'clipboard-list',
      color: '#52c41a',
      expanded: false,
      permissions: [
        { id: 'prod_1', name: '查看生产计划', code: 'production.view', description: '查看生产计划列表和详情', enabled: true },
        { id: 'prod_2', name: '创建生产任务', code: 'production.create', description: '新建生产任务', enabled: isPlatformAdmin || isFactoryAdmin || isDeptAdmin },
        { id: 'prod_3', name: '编辑生产计划', code: 'production.edit', description: '修改生产计划', enabled: isPlatformAdmin || isFactoryAdmin || isDeptAdmin },
        { id: 'prod_4', name: '审批生产计划', code: 'production.approve', description: '审批生产计划', enabled: isPlatformAdmin || isFactoryAdmin || isDeptAdmin },
        { id: 'prod_5', name: '删除生产任务', code: 'production.delete', description: '删除生产任务', enabled: isPlatformAdmin || isFactoryAdmin },
        { id: 'prod_6', name: '生产调度', code: 'production.schedule', description: '调整生产排程', enabled: isPlatformAdmin || isFactoryAdmin || isDeptAdmin },
      ],
    },
    {
      id: 'quality',
      name: '质检管理',
      code: 'quality_management',
      description: '质量检验和控制相关权限',
      icon: 'clipboard-check',
      color: '#faad14',
      expanded: false,
      permissions: [
        { id: 'qc_1', name: '查看质检记录', code: 'quality.view', description: '查看质检报告和记录', enabled: true },
        { id: 'qc_2', name: '执行质检', code: 'quality.execute', description: '执行质检任务', enabled: isPlatformAdmin || isFactoryAdmin || isDeptAdmin },
        { id: 'qc_3', name: '审批质检结果', code: 'quality.approve', description: '审批质检报告', enabled: isPlatformAdmin || isFactoryAdmin || isDeptAdmin },
        { id: 'qc_4', name: '质检规则配置', code: 'quality.config', description: '配置质检标准和规则', enabled: isPlatformAdmin || isFactoryAdmin },
        { id: 'qc_5', name: '不合格处置', code: 'quality.dispose', description: '处理不合格品', enabled: isPlatformAdmin || isFactoryAdmin || isDeptAdmin },
      ],
    },
    {
      id: 'material',
      name: '物料管理',
      code: 'material_management',
      description: '原料和物料相关权限',
      icon: 'package-variant-closed',
      color: '#1890ff',
      expanded: false,
      permissions: [
        { id: 'mat_1', name: '查看物料信息', code: 'material.view', description: '查看物料库存和批次', enabled: true },
        { id: 'mat_2', name: '物料入库', code: 'material.inbound', description: '执行物料入库操作', enabled: isPlatformAdmin || isFactoryAdmin || isDeptAdmin },
        { id: 'mat_3', name: '物料出库', code: 'material.outbound', description: '执行物料出库操作', enabled: isPlatformAdmin || isFactoryAdmin || isDeptAdmin },
        { id: 'mat_4', name: '库存调整', code: 'material.adjust', description: '调整库存数量', enabled: isPlatformAdmin || isFactoryAdmin },
        { id: 'mat_5', name: '物料类型管理', code: 'material.type', description: '管理物料分类', enabled: isPlatformAdmin || isFactoryAdmin },
      ],
    },
    {
      id: 'user',
      name: '用户管理',
      code: 'user_management',
      description: '用户和权限相关管理',
      icon: 'account-group',
      color: '#722ed1',
      expanded: false,
      permissions: [
        { id: 'usr_1', name: '查看用户列表', code: 'user.view', description: '查看用户信息', enabled: isPlatformAdmin || isFactoryAdmin || isDeptAdmin },
        { id: 'usr_2', name: '创建用户', code: 'user.create', description: '新建用户账号', enabled: isPlatformAdmin || isFactoryAdmin },
        { id: 'usr_3', name: '编辑用户', code: 'user.edit', description: '修改用户信息', enabled: isPlatformAdmin || isFactoryAdmin },
        { id: 'usr_4', name: '禁用用户', code: 'user.disable', description: '禁用用户账号', enabled: isPlatformAdmin || isFactoryAdmin },
        { id: 'usr_5', name: '删除用户', code: 'user.delete', description: '永久删除用户', enabled: isPlatformAdmin },
        { id: 'usr_6', name: '角色分配', code: 'user.role', description: '为用户分配角色', enabled: isPlatformAdmin || isFactoryAdmin },
        { id: 'usr_7', name: '重置密码', code: 'user.password', description: '重置用户密码', enabled: isPlatformAdmin || isFactoryAdmin },
      ],
    },
    {
      id: 'report',
      name: '报表查看',
      code: 'report_management',
      description: '各类报表和数据分析',
      icon: 'chart-bar',
      color: '#13c2c2',
      expanded: false,
      permissions: [
        { id: 'rpt_1', name: '生产报表', code: 'report.production', description: '查看生产统计报表', enabled: true },
        { id: 'rpt_2', name: '质检报表', code: 'report.quality', description: '查看质检数据报表', enabled: true },
        { id: 'rpt_3', name: '库存报表', code: 'report.inventory', description: '查看库存统计报表', enabled: true },
        { id: 'rpt_4', name: '财务报表', code: 'report.financial', description: '查看成本和收益分析', enabled: isPlatformAdmin },
        { id: 'rpt_5', name: '导出报表', code: 'report.export', description: '导出报表数据', enabled: isPlatformAdmin || isFactoryAdmin || isDeptAdmin },
      ],
    },
  ];
};

export default function RolePermissionsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RolePermissionsRouteProp>();
  const { t } = useTranslation('platform');
  const { roleId } = route.params;

  // State
  const [role, setRole] = useState<RoleDetail | null>(null);
  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandAll, setExpandAll] = useState(false);

  const loadRolePermissions = useCallback(async () => {
    try {
      setLoading(true);

      // Get role from static configuration
      const roleCode = roleId?.toUpperCase() || 'FACTORY_SUPER_ADMIN';
      const roleData = SYSTEM_ROLES[roleCode] || SYSTEM_ROLES['FACTORY_SUPER_ADMIN'];

      setRole(roleData ?? null);
      setPermissionGroups(getPermissionGroupsForRole(roleCode));

      // TODO: Load actual permissions from API when backend supports it
      // const permissions = await roleApiClient.getRolePermissions(roleId);
    } catch (error) {
      // If error occurs, still show role with default data
      const roleCode = roleId?.toUpperCase() || 'FACTORY_SUPER_ADMIN';
      const roleData = SYSTEM_ROLES[roleCode] || SYSTEM_ROLES['FACTORY_SUPER_ADMIN'];
      setRole(roleData ?? null);
      setPermissionGroups(getPermissionGroupsForRole(roleCode));

      if (isAxiosError(error)) {
        console.warn('Failed to load role permissions:', error.message);
      }
    } finally {
      setLoading(false);
    }
  }, [roleId]);

  useEffect(() => {
    loadRolePermissions();
  }, [loadRolePermissions]);

  const toggleGroupExpanded = (groupId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPermissionGroups(groups =>
      groups.map(g =>
        g.id === groupId ? { ...g, expanded: !g.expanded } : g
      )
    );
  };

  const toggleExpandAll = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const newExpandState = !expandAll;
    setExpandAll(newExpandState);
    setPermissionGroups(groups =>
      groups.map(g => ({ ...g, expanded: newExpandState }))
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

  const toggleGroupAllPermissions = (groupId: string, enabled: boolean) => {
    setPermissionGroups(groups =>
      groups.map(g =>
        g.id === groupId
          ? {
              ...g,
              permissions: g.permissions.map(p => ({ ...p, enabled })),
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

  const getTotalPermissionCount = () => {
    return permissionGroups.reduce((sum, g) => sum + g.permissions.length, 0);
  };

  const isGroupAllEnabled = (group: PermissionGroup) => {
    return group.permissions.every(p => p.enabled);
  };

  const isGroupPartiallyEnabled = (group: PermissionGroup) => {
    const enabled = getEnabledCount(group);
    return enabled > 0 && enabled < group.permissions.length;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // TODO: Implement role permission update API when backend supports it
      // For now, simulate the save operation
      await new Promise(resolve => setTimeout(resolve, 500));

      // Collect enabled permissions for API call
      // const enabledPermissions = permissionGroups.flatMap(g =>
      //   g.permissions.filter(p => p.enabled).map(p => p.code)
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

  // Filter permissions based on search
  const filteredGroups = searchQuery.trim()
    ? permissionGroups.map(group => ({
        ...group,
        expanded: true, // Expand all when searching
        permissions: group.permissions.filter(
          p =>
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.code.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter(group => group.permissions.length > 0)
    : permissionGroups;

  const renderPermissionGroup = (group: PermissionGroup) => {
    const enabledCount = getEnabledCount(group);
    const allEnabled = isGroupAllEnabled(group);
    const partiallyEnabled = isGroupPartiallyEnabled(group);

    return (
      <Card key={group.id} style={styles.groupCard} mode="elevated">
        {/* Group Header */}
        <TouchableOpacity
          style={styles.groupHeader}
          onPress={() => toggleGroupExpanded(group.id)}
        >
          <View style={[styles.groupIcon, { backgroundColor: group.color }]}>
            <IconButton icon={group.icon} iconColor="#fff" size={20} />
          </View>
          <View style={styles.groupInfo}>
            <Text style={styles.groupName}>{group.name}</Text>
            <Text style={styles.groupDescription}>{group.description}</Text>
          </View>
          <View style={styles.groupControls}>
            <Text style={[styles.groupCount, { color: group.color }]}>
              {enabledCount}/{group.permissions.length}
            </Text>
            <IconButton
              icon={group.expanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              iconColor="#8c8c8c"
            />
          </View>
        </TouchableOpacity>

        {/* Group Actions (when expanded) */}
        {group.expanded && (
          <>
            <View style={styles.groupActions}>
              <TouchableOpacity
                style={styles.groupActionButton}
                onPress={() => toggleGroupAllPermissions(group.id, true)}
              >
                <Text style={styles.groupActionText}>全选</Text>
              </TouchableOpacity>
              <View style={styles.groupActionDivider} />
              <TouchableOpacity
                style={styles.groupActionButton}
                onPress={() => toggleGroupAllPermissions(group.id, false)}
              >
                <Text style={styles.groupActionText}>取消全选</Text>
              </TouchableOpacity>
            </View>
            <Divider />
          </>
        )}

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
                  <View style={styles.permissionHeader}>
                    <Text style={styles.permissionName}>{permission.name}</Text>
                    <Text style={styles.permissionCode}>{permission.code}</Text>
                  </View>
                  <Text style={styles.permissionDescription}>{permission.description}</Text>
                </View>
                <Switch
                  value={permission.enabled}
                  onValueChange={() => togglePermission(group.id, permission.id)}
                  trackColor={{ false: '#d9d9d9', true: group.color }}
                />
              </View>
            ))}
          </View>
        )}
      </Card>
    );
  };

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
            <Text style={styles.headerTitle}>角色权限配置</Text>
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
          <Text style={styles.headerTitle}>角色权限配置</Text>
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
            {role.isBuiltIn && (
              <Chip mode="flat" style={styles.builtInChip} textStyle={styles.builtInChipText}>
                系统内置
              </Chip>
            )}
          </View>

          <View style={styles.roleStatsRow}>
            <View style={styles.roleStat}>
              <Text style={[styles.roleStatValue, { color: '#1890ff' }]}>
                {getTotalEnabledCount()}
              </Text>
              <Text style={styles.roleStatLabel}>已启用权限</Text>
            </View>
            <View style={styles.roleStatDivider} />
            <View style={styles.roleStat}>
              <Text style={[styles.roleStatValue, { color: '#8c8c8c' }]}>
                {getTotalPermissionCount()}
              </Text>
              <Text style={styles.roleStatLabel}>总权限数</Text>
            </View>
            <View style={styles.roleStatDivider} />
            <View style={styles.roleStat}>
              <Text style={[styles.roleStatValue, { color: '#52c41a' }]}>
                {permissionGroups.length}
              </Text>
              <Text style={styles.roleStatLabel}>权限分组</Text>
            </View>
          </View>
        </Card>

        {/* Search and Controls */}
        <View style={styles.controlsRow}>
          <Searchbar
            placeholder="搜索权限..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.searchBar}
            inputStyle={styles.searchInput}
          />
          <TouchableOpacity style={styles.expandButton} onPress={toggleExpandAll}>
            <IconButton
              icon={expandAll ? 'unfold-less-horizontal' : 'unfold-more-horizontal'}
              size={20}
              iconColor="#1890ff"
            />
          </TouchableOpacity>
        </View>

        {/* Permission Groups */}
        {filteredGroups.length > 0 ? (
          filteredGroups.map(renderPermissionGroup)
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>未找到匹配的权限</Text>
          </View>
        )}

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
    marginRight: 12,
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
  builtInChip: {
    backgroundColor: '#f6ffed',
  },
  builtInChipText: {
    color: '#52c41a',
    fontSize: 11,
  },
  roleStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
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
    height: 30,
    backgroundColor: '#e0e0e0',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  searchBar: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 0,
  },
  searchInput: {
    fontSize: 14,
  },
  expandButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  groupCard: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(26,26,46,0.02)',
  },
  groupIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
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
  groupControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupCount: {
    fontSize: 13,
    fontWeight: '600',
  },
  groupActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fafafa',
  },
  groupActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  groupActionText: {
    fontSize: 12,
    color: '#1890ff',
  },
  groupActionDivider: {
    width: 1,
    height: 12,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 8,
  },
  permissionsList: {
    padding: 12,
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
  permissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  permissionName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#262626',
  },
  permissionCode: {
    fontSize: 10,
    color: '#bfbfbf',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  permissionDescription: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 2,
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
