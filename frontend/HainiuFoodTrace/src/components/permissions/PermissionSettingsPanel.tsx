import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
  Modal,
  Alert,
  ActivityIndicator,
  TextInput,
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePermission } from '../../hooks/usePermission';

// 权限类型定义
export interface Permission {
  key: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  level: number;
  isRequired?: boolean;
  dependencies?: string[];
  riskLevel: 'low' | 'medium' | 'high';
  moduleAccess?: string[];
}

// 权限分组定义
export interface PermissionGroup {
  key: string;
  name: string;
  displayName: string;
  description: string;
  color: string;
  icon: string;
  permissions: Permission[];
}

// 预定义权限配置
export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    key: 'system',
    name: 'system',
    displayName: '系统管理',
    description: '系统级别的管理权限',
    color: '#E74C3C',
    icon: 'settings',
    permissions: [
      {
        key: 'system.admin',
        name: 'system.admin',
        displayName: '系统管理',
        description: '完整的系统管理权限',
        category: 'system',
        level: 0,
        isRequired: false,
        riskLevel: 'high',
        moduleAccess: ['admin', 'system']
      },
      {
        key: 'system.config',
        name: 'system.config',
        displayName: '系统配置',
        description: '修改系统配置参数',
        category: 'system',
        level: 1,
        riskLevel: 'high',
        moduleAccess: ['config']
      },
      {
        key: 'system.logs',
        name: 'system.logs',
        displayName: '系统日志',
        description: '查看和管理系统日志',
        category: 'system',
        level: 2,
        riskLevel: 'medium',
        moduleAccess: ['logs']
      }
    ]
  },
  {
    key: 'user',
    name: 'user',
    displayName: '用户管理',
    description: '用户和角色管理权限',
    color: '#3498DB',
    icon: 'people',
    permissions: [
      {
        key: 'user.manage',
        name: 'user.manage',
        displayName: '用户管理',
        description: '创建、编辑、删除用户',
        category: 'user',
        level: 0,
        riskLevel: 'high',
        moduleAccess: ['user', 'management']
      },
      {
        key: 'user.view',
        name: 'user.view',
        displayName: '查看用户',
        description: '查看用户信息和列表',
        category: 'user',
        level: 1,
        riskLevel: 'low',
        moduleAccess: ['user']
      },
      {
        key: 'user.assign_roles',
        name: 'user.assign_roles',
        displayName: '分配角色',
        description: '为用户分配和修改角色',
        category: 'user',
        level: 1,
        riskLevel: 'high',
        moduleAccess: ['user', 'roles']
      }
    ]
  },
  {
    key: 'processing',
    name: 'processing',
    displayName: '加工管理',
    description: '食品加工相关权限',
    color: '#27AE60',
    icon: 'restaurant',
    permissions: [
      {
        key: 'processing.manage',
        name: 'processing.manage',
        displayName: '加工管理',
        description: '管理加工流程和设备',
        category: 'processing',
        level: 0,
        riskLevel: 'medium',
        moduleAccess: ['processing', 'equipment']
      },
      {
        key: 'processing.operate',
        name: 'processing.operate',
        displayName: '加工操作',
        description: '执行加工操作和记录',
        category: 'processing',
        level: 1,
        riskLevel: 'medium',
        moduleAccess: ['processing']
      },
      {
        key: 'processing.quality_control',
        name: 'processing.quality_control',
        displayName: '质量控制',
        description: '质量检测和控制权限',
        category: 'processing',
        level: 1,
        riskLevel: 'high',
        moduleAccess: ['processing', 'quality']
      }
    ]
  },
  {
    key: 'data',
    name: 'data',
    displayName: '数据管理',
    description: '数据访问和管理权限',
    color: '#9B59B6',
    icon: 'analytics',
    permissions: [
      {
        key: 'data.export',
        name: 'data.export',
        displayName: '数据导出',
        description: '导出系统数据',
        category: 'data',
        level: 0,
        riskLevel: 'high',
        moduleAccess: ['data', 'export']
      },
      {
        key: 'data.view',
        name: 'data.view',
        displayName: '查看数据',
        description: '查看系统数据',
        category: 'data',
        level: 1,
        riskLevel: 'low',
        moduleAccess: ['data']
      },
      {
        key: 'data.input',
        name: 'data.input',
        displayName: '数据录入',
        description: '录入和修改数据',
        category: 'data',
        level: 1,
        riskLevel: 'medium',
        moduleAccess: ['data', 'input']
      }
    ]
  },
  {
    key: 'reports',
    name: 'reports',
    displayName: '报告分析',
    description: '报告和分析功能权限',
    color: '#F39C12',
    icon: 'bar-chart',
    permissions: [
      {
        key: 'report.view',
        name: 'report.view',
        displayName: '查看报告',
        description: '查看系统报告',
        category: 'reports',
        level: 1,
        riskLevel: 'low',
        moduleAccess: ['reports']
      },
      {
        key: 'report.generate',
        name: 'report.generate',
        displayName: '生成报告',
        description: '生成定制报告',
        category: 'reports',
        level: 0,
        riskLevel: 'medium',
        moduleAccess: ['reports', 'generate']
      },
      {
        key: 'report.analytics',
        name: 'report.analytics',
        displayName: '数据分析',
        description: '高级数据分析功能',
        category: 'reports',
        level: 0,
        riskLevel: 'medium',
        moduleAccess: ['reports', 'analytics']
      }
    ]
  }
];

interface PermissionSettingsPanelProps {
  selectedPermissions?: string[];
  onPermissionsChange?: (permissions: string[]) => void;
  userRole?: string;
  readonly?: boolean;
  showDescription?: boolean;
  groupByCategory?: boolean;
  allowSelectAll?: boolean;
  showRiskLevels?: boolean;
  maxSelections?: number;
  requiredPermissions?: string[];
}

/**
 * 权限设置面板组件
 * 支持可视化权限管理和分组显示
 */
export const PermissionSettingsPanel: React.FC<PermissionSettingsPanelProps> = ({
  selectedPermissions = [],
  onPermissionsChange,
  userRole,
  readonly = false,
  showDescription = true,
  groupByCategory = true,
  allowSelectAll = true,
  showRiskLevels = true,
  maxSelections,
  requiredPermissions = []
}) => {
  const [searchText, setSearchText] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const { hasPermission, user } = usePermission();

  // 初始化展开的组
  useEffect(() => {
    if (groupByCategory) {
      setExpandedGroups(PERMISSION_GROUPS.map(group => group.key));
    }
  }, [groupByCategory]);

  // 过滤权限
  const filteredGroups = useMemo(() => {
    return PERMISSION_GROUPS.map(group => ({
      ...group,
      permissions: group.permissions.filter(permission =>
        searchText === '' ||
        permission.displayName.toLowerCase().includes(searchText.toLowerCase()) ||
        permission.description.toLowerCase().includes(searchText.toLowerCase()) ||
        permission.name.toLowerCase().includes(searchText.toLowerCase())
      )
    })).filter(group => group.permissions.length > 0);
  }, [searchText]);

  // 计算权限统计
  const permissionStats = useMemo(() => {
    const allPermissions = PERMISSION_GROUPS.flatMap(group => group.permissions);
    const totalPermissions = allPermissions.length;
    const selectedCount = selectedPermissions.length;
    const highRiskCount = selectedPermissions
      .map(key => allPermissions.find(p => p.key === key))
      .filter(p => p?.riskLevel === 'high').length;

    return {
      total: totalPermissions,
      selected: selectedCount,
      highRisk: highRiskCount,
      percentage: totalPermissions > 0 ? Math.round((selectedCount / totalPermissions) * 100) : 0
    };
  }, [selectedPermissions]);

  // 处理权限切换
  const handlePermissionToggle = useCallback((permissionKey: string) => {
    if (readonly) return;

    setIsLoading(true);
    
    const newPermissions = selectedPermissions.includes(permissionKey)
      ? selectedPermissions.filter(key => key !== permissionKey)
      : [...selectedPermissions, permissionKey];

    // 检查最大选择数限制
    if (maxSelections && newPermissions.length > maxSelections) {
      Alert.alert('选择限制', `最多只能选择 ${maxSelections} 个权限`);
      setIsLoading(false);
      return;
    }

    // 检查依赖权限
    const allPermissions = PERMISSION_GROUPS.flatMap(group => group.permissions);
    const permission = allPermissions.find(p => p.key === permissionKey);
    
    if (permission?.dependencies) {
      const missingDependencies = permission.dependencies.filter(
        dep => !newPermissions.includes(dep)
      );
      
      if (missingDependencies.length > 0 && newPermissions.includes(permissionKey)) {
        Alert.alert(
          '依赖权限',
          `此权限需要以下依赖权限：${missingDependencies.join(', ')}`,
          [
            { text: '取消', style: 'cancel' },
            {
              text: '自动添加',
              onPress: () => {
                onPermissionsChange?.([...newPermissions, ...missingDependencies]);
              }
            }
          ]
        );
        setIsLoading(false);
        return;
      }
    }

    onPermissionsChange?.(newPermissions);
    setIsLoading(false);
  }, [selectedPermissions, readonly, maxSelections, onPermissionsChange]);

  // 处理组展开/折叠
  const toggleGroupExpansion = useCallback((groupKey: string) => {
    setExpandedGroups(prev => 
      prev.includes(groupKey)
        ? prev.filter(key => key !== groupKey)
        : [...prev, groupKey]
    );
  }, []);

  // 处理全选组权限
  const handleGroupSelectAll = useCallback((groupKey: string, select: boolean) => {
    const group = PERMISSION_GROUPS.find(g => g.key === groupKey);
    if (!group) return;

    const groupPermissionKeys = group.permissions.map(p => p.key);
    let newPermissions: string[];

    if (select) {
      newPermissions = [...new Set([...selectedPermissions, ...groupPermissionKeys])];
    } else {
      newPermissions = selectedPermissions.filter(key => !groupPermissionKeys.includes(key));
    }

    onPermissionsChange?.(newPermissions);
  }, [selectedPermissions, onPermissionsChange]);

  // 获取风险等级颜色
  const getRiskLevelColor = useCallback((riskLevel: string) => {
    switch (riskLevel) {
      case 'high': return '#E74C3C';
      case 'medium': return '#F39C12';
      case 'low': return '#27AE60';
      default: return '#95A5A6';
    }
  }, []);

  // 获取风险等级名称
  const getRiskLevelName = useCallback((riskLevel: string) => {
    switch (riskLevel) {
      case 'high': return '高风险';
      case 'medium': return '中风险';
      case 'low': return '低风险';
      default: return '未知';
    }
  }, []);

  // 渲染权限项
  const renderPermissionItem = useCallback((permission: Permission, groupColor: string) => {
    const isSelected = selectedPermissions.includes(permission.key);
    const isRequired = requiredPermissions.includes(permission.key);
    const canModify = !readonly && !isRequired;

    return (
      <View
        key={permission.key}
        style={[
          styles.permissionItem,
          isSelected && styles.permissionItemSelected,
          isRequired && styles.permissionItemRequired
        ]}
      >
        <TouchableOpacity
          style={styles.permissionHeader}
          onPress={() => canModify && handlePermissionToggle(permission.key)}
          disabled={!canModify}
        >
          <View style={styles.permissionInfo}>
            <View style={styles.permissionTitleRow}>
              <Switch
                value={isSelected}
                onValueChange={() => canModify && handlePermissionToggle(permission.key)}
                disabled={!canModify}
                trackColor={{ false: '#E9ECEF', true: groupColor }}
                thumbColor={isSelected ? '#FFFFFF' : '#F4F3F4'}
              />
              
              <View style={styles.permissionTextContainer}>
                <Text style={[styles.permissionDisplayName, isRequired && styles.requiredText]}>
                  {permission.displayName}
                  {isRequired && <Text style={styles.requiredIndicator}> *</Text>}
                </Text>
                <Text style={styles.permissionName}>({permission.name})</Text>
              </View>
            </View>

            {showRiskLevels && (
              <View style={[
                styles.riskBadge,
                { backgroundColor: getRiskLevelColor(permission.riskLevel) }
              ]}>
                <Text style={styles.riskText}>
                  {getRiskLevelName(permission.riskLevel)}
                </Text>
              </View>
            )}
          </View>

          {showDescription && (
            <Text style={styles.permissionDescription} numberOfLines={2}>
              {permission.description}
            </Text>
          )}

          {/* 模块访问信息 */}
          {permission.moduleAccess && permission.moduleAccess.length > 0 && (
            <View style={styles.moduleAccess}>
              <Text style={styles.moduleAccessLabel}>模块访问:</Text>
              {permission.moduleAccess.map((module, index) => (
                <Text key={index} style={styles.moduleAccessTag}>
                  {module}
                </Text>
              ))}
            </View>
          )}

          {/* 依赖权限 */}
          {permission.dependencies && permission.dependencies.length > 0 && (
            <View style={styles.dependencies}>
              <Text style={styles.dependenciesLabel}>依赖权限:</Text>
              <Text style={styles.dependenciesText}>
                {permission.dependencies.join(', ')}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  }, [selectedPermissions, requiredPermissions, readonly, showDescription, showRiskLevels, handlePermissionToggle, getRiskLevelColor, getRiskLevelName]);

  // 渲染权限组
  const renderPermissionGroup = useCallback((group: PermissionGroup) => {
    const isExpanded = expandedGroups.includes(group.key);
    const groupPermissions = group.permissions;
    const selectedInGroup = groupPermissions.filter(p => selectedPermissions.includes(p.key)).length;
    const totalInGroup = groupPermissions.length;
    const isAllSelected = selectedInGroup === totalInGroup && totalInGroup > 0;

    return (
      <View key={group.key} style={styles.permissionGroup}>
        {/* 组头部 */}
        <TouchableOpacity
          style={[styles.groupHeader, { backgroundColor: group.color + '15' }]}
          onPress={() => toggleGroupExpansion(group.key)}
        >
          <View style={styles.groupInfo}>
            <Ionicons 
              name={group.icon as any} 
              size={24} 
              color={group.color} 
              style={styles.groupIcon}
            />
            <View style={styles.groupTextContainer}>
              <Text style={[styles.groupDisplayName, { color: group.color }]}>
                {group.displayName}
              </Text>
              <Text style={styles.groupDescription}>{group.description}</Text>
            </View>
          </View>

          <View style={styles.groupActions}>
            <View style={styles.groupStats}>
              <Text style={styles.groupStatsText}>
                {selectedInGroup}/{totalInGroup}
              </Text>
            </View>
            
            {allowSelectAll && !readonly && (
              <TouchableOpacity
                style={styles.selectAllButton}
                onPress={() => handleGroupSelectAll(group.key, !isAllSelected)}
              >
                <Text style={[styles.selectAllText, { color: group.color }]}>
                  {isAllSelected ? '取消全选' : '全选'}
                </Text>
              </TouchableOpacity>
            )}

            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#666"
            />
          </View>
        </TouchableOpacity>

        {/* 组权限列表 */}
        {isExpanded && (
          <View style={styles.groupPermissions}>
            {groupPermissions.map(permission => renderPermissionItem(permission, group.color))}
          </View>
        )}
      </View>
    );
  }, [expandedGroups, selectedPermissions, allowSelectAll, readonly, toggleGroupExpansion, handleGroupSelectAll, renderPermissionItem]);

  return (
    <View style={styles.container}>
      {/* 统计信息头部 */}
      <View style={styles.statsHeader}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{permissionStats.selected}</Text>
          <Text style={styles.statLabel}>已选择</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{permissionStats.total}</Text>
          <Text style={styles.statLabel}>总权限</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#E74C3C' }]}>
            {permissionStats.highRisk}
          </Text>
          <Text style={styles.statLabel}>高风险</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{permissionStats.percentage}%</Text>
          <Text style={styles.statLabel}>覆盖率</Text>
        </View>
      </View>

      {/* 搜索栏 */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="搜索权限..."
          value={searchText}
          onChangeText={setSearchText}
          editable={!readonly}
        />
        {searchText.length > 0 && (
          <TouchableOpacity
            style={styles.clearSearch}
            onPress={() => setSearchText('')}
          >
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {/* 权限列表 */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4ECDC4" />
          <Text style={styles.loadingText}>更新权限中...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.permissionsList}
          showsVerticalScrollIndicator={false}
        >
          {filteredGroups.map(renderPermissionGroup)}
          
          {/* 底部间距 */}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}

      {/* 必需权限提示 */}
      {requiredPermissions.length > 0 && (
        <View style={styles.requiredNotice}>
          <Ionicons name="information-circle" size={16} color="#F39C12" />
          <Text style={styles.requiredNoticeText}>
            标有 * 的权限为必需权限，无法取消
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  statsHeader: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4ECDC4',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  statDivider: {
    width: 1,
    height: '60%',
    backgroundColor: '#E9ECEF',
    alignSelf: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  clearSearch: {
    padding: 4,
  },
  permissionsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  permissionGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  groupInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupIcon: {
    marginRight: 12,
  },
  groupTextContainer: {
    flex: 1,
  },
  groupDisplayName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  groupDescription: {
    fontSize: 12,
    color: '#666',
  },
  groupActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupStats: {
    backgroundColor: '#F8F9FA',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 12,
  },
  groupStatsText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  selectAllButton: {
    marginRight: 12,
  },
  selectAllText: {
    fontSize: 14,
    fontWeight: '500',
  },
  groupPermissions: {
    paddingVertical: 8,
  },
  permissionItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA',
  },
  permissionItemSelected: {
    backgroundColor: '#F0FDFC',
  },
  permissionItemRequired: {
    backgroundColor: '#FFF8E1',
  },
  permissionHeader: {
    flex: 1,
  },
  permissionInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  permissionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  permissionTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  permissionDisplayName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  requiredText: {
    color: '#F39C12',
  },
  requiredIndicator: {
    color: '#E74C3C',
    fontWeight: 'bold',
  },
  permissionName: {
    fontSize: 12,
    color: '#999',
  },
  riskBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  riskText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  permissionDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 8,
  },
  moduleAccess: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 4,
  },
  moduleAccessLabel: {
    fontSize: 12,
    color: '#666',
    marginRight: 6,
  },
  moduleAccessTag: {
    fontSize: 10,
    color: '#4ECDC4',
    backgroundColor: '#F0FDFC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 4,
    marginBottom: 2,
  },
  dependencies: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  dependenciesLabel: {
    fontSize: 12,
    color: '#F39C12',
    marginRight: 6,
  },
  dependenciesText: {
    fontSize: 12,
    color: '#F39C12',
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
  },
  bottomSpacer: {
    height: 20,
  },
  requiredNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
  },
  requiredNoticeText: {
    fontSize: 12,
    color: '#F39C12',
    marginLeft: 6,
  },
});

export default PermissionSettingsPanel;