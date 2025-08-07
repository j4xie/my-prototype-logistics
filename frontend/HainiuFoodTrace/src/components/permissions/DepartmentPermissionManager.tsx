import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
  TextInput,
  FlatList,
  Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RoleSelector, { USER_ROLE_CONFIG, EnhancedUserRole } from './RoleSelector';
import { usePermission } from '../../hooks/usePermission';

// 部门定义类型
export interface Department {
  id: string;
  name: string;
  displayName: string;
  description: string;
  parentId?: string;
  level: number;
  color: string;
  icon: string;
  path: string[];
  employeeCount: number;
  isActive: boolean;
}

// 部门权限配置
export interface DepartmentPermission {
  departmentId: string;
  userId: string;
  userRole: string;
  permissions: string[];
  inheritFromParent: boolean;
  customPermissions: string[];
  restrictedPermissions: string[];
  effectiveFrom: Date;
  effectiveTo?: Date;
  isActive: boolean;
}

// 权限继承规则
export interface PermissionInheritanceRule {
  fromLevel: number;
  toLevel: number;
  inheritedPermissions: string[];
  blockedPermissions: string[];
  required: boolean;
}

// 预定义部门数据
export const DEPARTMENTS: Department[] = [
  {
    id: 'processing',
    name: 'processing',
    displayName: '加工部门',
    description: '负责食品加工和生产',
    level: 1,
    color: '#27AE60',
    icon: 'restaurant',
    path: ['processing'],
    employeeCount: 15,
    isActive: true
  },
  {
    id: 'processing_qa',
    name: 'processing_qa',
    displayName: '质量控制',
    description: '加工质量检测和控制',
    parentId: 'processing',
    level: 2,
    color: '#E74C3C',
    icon: 'checkmark-circle',
    path: ['processing', 'processing_qa'],
    employeeCount: 5,
    isActive: true
  },
  {
    id: 'processing_production',
    name: 'processing_production',
    displayName: '生产作业',
    description: '具体生产操作执行',
    parentId: 'processing',
    level: 2,
    color: '#3498DB',
    icon: 'build',
    path: ['processing', 'processing_production'],
    employeeCount: 10,
    isActive: true
  },
  {
    id: 'logistics',
    name: 'logistics',
    displayName: '物流部门',
    description: '产品运输和仓储管理',
    level: 1,
    color: '#9B59B6',
    icon: 'car',
    path: ['logistics'],
    employeeCount: 8,
    isActive: true
  },
  {
    id: 'logistics_warehouse',
    name: 'logistics_warehouse',
    displayName: '仓储管理',
    description: '库存管理和仓储操作',
    parentId: 'logistics',
    level: 2,
    color: '#34495E',
    icon: 'archive',
    path: ['logistics', 'logistics_warehouse'],
    employeeCount: 4,
    isActive: true
  },
  {
    id: 'sales',
    name: 'sales',
    displayName: '销售部门',
    description: '产品销售和客户管理',
    level: 1,
    color: '#F39C12',
    icon: 'storefront',
    path: ['sales'],
    employeeCount: 6,
    isActive: true
  }
];

// 预定义继承规则
export const INHERITANCE_RULES: PermissionInheritanceRule[] = [
  {
    fromLevel: 1,
    toLevel: 2,
    inheritedPermissions: ['data.view', 'report.view'],
    blockedPermissions: ['user.manage', 'system.admin'],
    required: true
  },
  {
    fromLevel: 2,
    toLevel: 3,
    inheritedPermissions: ['data.input', 'processing.operate'],
    blockedPermissions: ['user.assign_roles', 'data.export'],
    required: false
  }
];

interface DepartmentPermissionManagerProps {
  selectedDepartment?: string;
  onDepartmentChange?: (department: Department) => void;
  selectedUser?: string;
  onUserChange?: (userId: string) => void;
  permissions?: DepartmentPermission[];
  onPermissionsChange?: (permissions: DepartmentPermission[]) => void;
  readonly?: boolean;
  showInheritance?: boolean;
  allowBulkOperations?: boolean;
}

/**
 * 部门权限管理器组件
 * 支持部门级别的权限分配和继承管理
 */
export const DepartmentPermissionManager: React.FC<DepartmentPermissionManagerProps> = ({
  selectedDepartment,
  onDepartmentChange,
  selectedUser,
  onUserChange,
  permissions = [],
  onPermissionsChange,
  readonly = false,
  showInheritance = true,
  allowBulkOperations = true
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [inheritanceEnabled, setInheritanceEnabled] = useState(true);
  const [expandedDepartments, setExpandedDepartments] = useState<string[]>(['processing', 'logistics', 'sales']);
  const [bulkOperationMode, setBulkOperationMode] = useState(false);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);

  const { hasPermission, user } = usePermission();

  // 过滤部门
  const filteredDepartments = useMemo(() => {
    return DEPARTMENTS.filter(dept =>
      searchText === '' ||
      dept.displayName.toLowerCase().includes(searchText.toLowerCase()) ||
      dept.description.toLowerCase().includes(searchText.toLowerCase()) ||
      dept.name.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [searchText]);

  // 构建部门树结构
  const departmentTree = useMemo(() => {
    const buildTree = (parentId?: string): Department[] => {
      return filteredDepartments
        .filter(dept => dept.parentId === parentId)
        .sort((a, b) => a.level - b.level);
    };

    const addChildren = (dept: Department): Department & { children: any[] } => {
      const children = buildTree(dept.id).map(addChildren);
      return { ...dept, children };
    };

    return buildTree().map(addChildren);
  }, [filteredDepartments]);

  // 获取当前部门权限
  const getCurrentDepartmentPermissions = useCallback((departmentId: string, userId?: string) => {
    return permissions.filter(p => 
      p.departmentId === departmentId &&
      (!userId || p.userId === userId) &&
      p.isActive
    );
  }, [permissions]);

  // 计算继承权限
  const calculateInheritedPermissions = useCallback((department: Department) => {
    if (!showInheritance || !inheritanceEnabled) return [];

    const inheritedPerms: string[] = [];
    const parentDept = DEPARTMENTS.find(d => d.id === department.parentId);
    
    if (parentDept) {
      const parentPermissions = getCurrentDepartmentPermissions(parentDept.id);
      const applicableRules = INHERITANCE_RULES.filter(rule =>
        rule.fromLevel === parentDept.level && rule.toLevel === department.level
      );

      applicableRules.forEach(rule => {
        inheritedPerms.push(...rule.inheritedPermissions);
      });
    }

    return [...new Set(inheritedPerms)];
  }, [showInheritance, inheritanceEnabled, getCurrentDepartmentPermissions]);

  // 计算有效权限
  const calculateEffectivePermissions = useCallback((
    department: Department, 
    userId?: string
  ): string[] => {
    const directPermissions = getCurrentDepartmentPermissions(department.id, userId)
      .flatMap(p => p.permissions);
    const inheritedPermissions = calculateInheritedPermissions(department);
    
    return [...new Set([...directPermissions, ...inheritedPermissions])];
  }, [getCurrentDepartmentPermissions, calculateInheritedPermissions]);

  // 处理部门选择
  const handleDepartmentSelect = useCallback((department: Department) => {
    if (bulkOperationMode) {
      const isSelected = selectedDepartments.includes(department.id);
      const newSelection = isSelected
        ? selectedDepartments.filter(id => id !== department.id)
        : [...selectedDepartments, department.id];
      
      setSelectedDepartments(newSelection);
    } else {
      onDepartmentChange?.(department);
    }
  }, [bulkOperationMode, selectedDepartments, onDepartmentChange]);

  // 处理权限更新
  const handlePermissionUpdate = useCallback(async (
    departmentId: string,
    userId: string,
    newPermissions: string[]
  ) => {
    if (readonly) return;

    setIsLoading(true);

    try {
      const existingPermission = permissions.find(p =>
        p.departmentId === departmentId &&
        p.userId === userId
      );

      const updatedPermissions = [...permissions];

      if (existingPermission) {
        const index = updatedPermissions.indexOf(existingPermission);
        updatedPermissions[index] = {
          ...existingPermission,
          permissions: newPermissions,
          effectiveFrom: new Date()
        };
      } else {
        updatedPermissions.push({
          departmentId,
          userId,
          userRole: selectedRole || 'operator',
          permissions: newPermissions,
          inheritFromParent: inheritanceEnabled,
          customPermissions: [],
          restrictedPermissions: [],
          effectiveFrom: new Date(),
          isActive: true
        });
      }

      onPermissionsChange?.(updatedPermissions);
    } catch (error) {
      Alert.alert('错误', '权限更新失败，请重试');
    } finally {
      setIsLoading(false);
    }
  }, [readonly, permissions, selectedRole, inheritanceEnabled, onPermissionsChange]);

  // 处理批量权限操作
  const handleBulkPermissionOperation = useCallback(async (
    operation: 'assign' | 'remove' | 'inherit',
    targetPermissions: string[]
  ) => {
    if (!allowBulkOperations || selectedDepartments.length === 0) return;

    const confirmMessage = `确定要对 ${selectedDepartments.length} 个部门执行${
      operation === 'assign' ? '分配' : operation === 'remove' ? '移除' : '继承'
    }权限操作吗？`;

    Alert.alert('批量操作确认', confirmMessage, [
      { text: '取消', style: 'cancel' },
      {
        text: '确定',
        onPress: async () => {
          setIsLoading(true);
          try {
            // 实现批量操作逻辑
            for (const departmentId of selectedDepartments) {
              if (selectedUser) {
                const currentPerms = getCurrentDepartmentPermissions(departmentId, selectedUser);
                const currentPermList = currentPerms.flatMap(p => p.permissions);
                
                let newPermissions: string[];
                
                switch (operation) {
                  case 'assign':
                    newPermissions = [...new Set([...currentPermList, ...targetPermissions])];
                    break;
                  case 'remove':
                    newPermissions = currentPermList.filter(p => !targetPermissions.includes(p));
                    break;
                  case 'inherit':
                    const dept = DEPARTMENTS.find(d => d.id === departmentId);
                    newPermissions = dept ? calculateInheritedPermissions(dept) : [];
                    break;
                  default:
                    newPermissions = currentPermList;
                }

                await handlePermissionUpdate(departmentId, selectedUser, newPermissions);
              }
            }
            
            setBulkOperationMode(false);
            setSelectedDepartments([]);
          } catch (error) {
            Alert.alert('错误', '批量操作失败，请重试');
          } finally {
            setIsLoading(false);
          }
        }
      }
    ]);
  }, [allowBulkOperations, selectedDepartments, selectedUser, getCurrentDepartmentPermissions, calculateInheritedPermissions, handlePermissionUpdate]);

  // 处理部门展开/折叠
  const toggleDepartmentExpansion = useCallback((departmentId: string) => {
    setExpandedDepartments(prev =>
      prev.includes(departmentId)
        ? prev.filter(id => id !== departmentId)
        : [...prev, departmentId]
    );
  }, []);

  // 渲染部门项
  const renderDepartmentItem = useCallback((department: Department & { children: any[] }, isChild = false) => {
    const isSelected = selectedDepartment === department.id;
    const isBulkSelected = selectedDepartments.includes(department.id);
    const isExpanded = expandedDepartments.includes(department.id);
    const hasChildren = department.children && department.children.length > 0;
    
    const effectivePermissions = selectedUser 
      ? calculateEffectivePermissions(department, selectedUser)
      : [];
    
    const inheritedPermissions = calculateInheritedPermissions(department);

    return (
      <View key={department.id}>
        {/* 部门项 */}
        <TouchableOpacity
          style={[
            styles.departmentItem,
            isChild && styles.childDepartmentItem,
            isSelected && styles.departmentItemSelected,
            isBulkSelected && styles.departmentItemBulkSelected
          ]}
          onPress={() => handleDepartmentSelect(department)}
        >
          <View style={styles.departmentHeader}>
            {/* 展开/折叠按钮 */}
            {hasChildren && (
              <TouchableOpacity
                style={styles.expandButton}
                onPress={() => toggleDepartmentExpansion(department.id)}
              >
                <Ionicons
                  name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                  size={16}
                  color="#666"
                />
              </TouchableOpacity>
            )}

            {/* 部门信息 */}
            <View style={styles.departmentInfo}>
              <View style={styles.departmentIconContainer}>
                <Ionicons
                  name={department.icon as any}
                  size={24}
                  color={department.color}
                />
                {bulkOperationMode && (
                  <View style={styles.selectionIndicator}>
                    <Ionicons
                      name={isBulkSelected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={16}
                      color={isBulkSelected ? '#4ECDC4' : '#CCC'}
                    />
                  </View>
                )}
              </View>

              <View style={styles.departmentDetails}>
                <View style={styles.departmentTitleRow}>
                  <Text style={styles.departmentDisplayName}>
                    {department.displayName}
                  </Text>
                  <View style={[styles.levelBadge, { backgroundColor: department.color }]}>
                    <Text style={styles.levelText}>L{department.level}</Text>
                  </View>
                </View>
                
                <Text style={styles.departmentDescription} numberOfLines={1}>
                  {department.description}
                </Text>

                <View style={styles.departmentMetadata}>
                  <Text style={styles.employeeCount}>
                    {department.employeeCount} 员工
                  </Text>
                  <Text style={styles.permissionCount}>
                    {effectivePermissions.length} 权限
                  </Text>
                  {inheritedPermissions.length > 0 && (
                    <Text style={styles.inheritedCount}>
                      ({inheritedPermissions.length} 继承)
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* 状态指示器 */}
            <View style={styles.departmentActions}>
              {!department.isActive && (
                <View style={styles.inactiveIndicator}>
                  <Text style={styles.inactiveText}>停用</Text>
                </View>
              )}
              
              {isSelected && !bulkOperationMode && (
                <Ionicons name="checkmark-circle" size={20} color="#4ECDC4" />
              )}
            </View>
          </View>

          {/* 权限摘要 */}
          {(isSelected || isBulkSelected) && selectedUser && (
            <View style={styles.permissionSummary}>
              <View style={styles.permissionTags}>
                {effectivePermissions.slice(0, 3).map(permission => (
                  <View key={permission} style={styles.permissionTag}>
                    <Text style={styles.permissionTagText}>{permission}</Text>
                  </View>
                ))}
                {effectivePermissions.length > 3 && (
                  <View style={styles.permissionMore}>
                    <Text style={styles.permissionMoreText}>
                      +{effectivePermissions.length - 3}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </TouchableOpacity>

        {/* 子部门 */}
        {hasChildren && isExpanded && (
          <View style={styles.childDepartments}>
            {department.children.map(child => renderDepartmentItem(child, true))}
          </View>
        )}
      </View>
    );
  }, [
    selectedDepartment,
    selectedDepartments,
    expandedDepartments,
    selectedUser,
    bulkOperationMode,
    calculateEffectivePermissions,
    calculateInheritedPermissions,
    handleDepartmentSelect,
    toggleDepartmentExpansion
  ]);

  return (
    <View style={styles.container}>
      {/* 头部控制栏 */}
      <View style={styles.headerControls}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="搜索部门..."
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>

        {allowBulkOperations && (
          <TouchableOpacity
            style={[styles.bulkModeButton, bulkOperationMode && styles.bulkModeButtonActive]}
            onPress={() => setBulkOperationMode(!bulkOperationMode)}
          >
            <Ionicons
              name={bulkOperationMode ? 'checkmark-circle' : 'copy'}
              size={20}
              color={bulkOperationMode ? '#FFFFFF' : '#4ECDC4'}
            />
            <Text style={[
              styles.bulkModeText,
              bulkOperationMode && styles.bulkModeTextActive
            ]}>
              {bulkOperationMode ? '退出批量' : '批量操作'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 设置栏 */}
      <View style={styles.settingsBar}>
        {/* 角色选择器 */}
        <View style={styles.roleSelector}>
          <Text style={styles.settingLabel}>角色:</Text>
          <RoleSelector
            selectedRole={selectedRole}
            onRoleChange={(role) => setSelectedRole(role.key)}
            placeholder="选择角色"
            filterByUserType="factory"
          />
        </View>

        {/* 继承开关 */}
        {showInheritance && (
          <View style={styles.inheritanceToggle}>
            <Text style={styles.settingLabel}>权限继承:</Text>
            <Switch
              value={inheritanceEnabled}
              onValueChange={setInheritanceEnabled}
              trackColor={{ false: '#E9ECEF', true: '#4ECDC4' }}
            />
          </View>
        )}
      </View>

      {/* 统计信息 */}
      <View style={styles.statsBar}>
        <Text style={styles.statsText}>
          {filteredDepartments.length} 个部门
        </Text>
        {bulkOperationMode && (
          <Text style={styles.selectionStats}>
            已选择: {selectedDepartments.length}
          </Text>
        )}
      </View>

      {/* 部门列表 */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4ECDC4" />
          <Text style={styles.loadingText}>更新权限中...</Text>
        </View>
      ) : (
        <ScrollView style={styles.departmentsList} showsVerticalScrollIndicator={false}>
          {departmentTree.map(department => renderDepartmentItem(department))}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}

      {/* 批量操作栏 */}
      {bulkOperationMode && selectedDepartments.length > 0 && (
        <View style={styles.bulkActions}>
          <TouchableOpacity
            style={styles.bulkActionButton}
            onPress={() => handleBulkPermissionOperation('assign', ['data.view', 'report.view'])}
          >
            <Text style={styles.bulkActionText}>分配基础权限</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.bulkActionButton}
            onPress={() => handleBulkPermissionOperation('inherit', [])}
          >
            <Text style={styles.bulkActionText}>启用继承</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.bulkActionButton, styles.bulkActionButtonDanger]}
            onPress={() => handleBulkPermissionOperation('remove', [])}
          >
            <Text style={styles.bulkActionText}>清除权限</Text>
          </TouchableOpacity>
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
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  bulkModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#4ECDC4',
  },
  bulkModeButtonActive: {
    backgroundColor: '#4ECDC4',
  },
  bulkModeText: {
    color: '#4ECDC4',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  bulkModeTextActive: {
    color: '#FFFFFF',
  },
  settingsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  roleSelector: {
    flex: 2,
    marginRight: 16,
  },
  inheritanceToggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  statsText: {
    fontSize: 12,
    color: '#666',
  },
  selectionStats: {
    fontSize: 12,
    color: '#4ECDC4',
    fontWeight: '500',
  },
  departmentsList: {
    flex: 1,
    paddingTop: 8,
  },
  departmentItem: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  childDepartmentItem: {
    marginLeft: 32,
    backgroundColor: '#F8F9FA',
  },
  departmentItemSelected: {
    borderColor: '#4ECDC4',
    borderWidth: 2,
    backgroundColor: '#F0FDFC',
  },
  departmentItemBulkSelected: {
    borderColor: '#4ECDC4',
    borderWidth: 2,
  },
  departmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expandButton: {
    padding: 4,
    marginRight: 8,
  },
  departmentInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  departmentIconContainer: {
    position: 'relative',
    marginRight: 12,
  },
  selectionIndicator: {
    position: 'absolute',
    top: -4,
    right: -4,
  },
  departmentDetails: {
    flex: 1,
  },
  departmentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  departmentDisplayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  levelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  levelText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  departmentDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  departmentMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  employeeCount: {
    fontSize: 11,
    color: '#999',
    marginRight: 12,
  },
  permissionCount: {
    fontSize: 11,
    color: '#4ECDC4',
    fontWeight: '500',
    marginRight: 8,
  },
  inheritedCount: {
    fontSize: 11,
    color: '#F39C12',
    fontStyle: 'italic',
  },
  departmentActions: {
    alignItems: 'center',
  },
  inactiveIndicator: {
    backgroundColor: '#E9ECEF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  inactiveText: {
    fontSize: 10,
    color: '#666',
  },
  permissionSummary: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  permissionTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  permissionTag: {
    backgroundColor: '#F0FDFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 6,
    marginBottom: 4,
  },
  permissionTagText: {
    fontSize: 10,
    color: '#4ECDC4',
    fontWeight: '500',
  },
  permissionMore: {
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  permissionMoreText: {
    fontSize: 10,
    color: '#999',
  },
  childDepartments: {
    marginTop: 8,
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
  bulkActions: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
  },
  bulkActionButton: {
    flex: 1,
    backgroundColor: '#4ECDC4',
    borderRadius: 6,
    paddingVertical: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  bulkActionButtonDanger: {
    backgroundColor: '#E74C3C',
  },
  bulkActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
});

export default DepartmentPermissionManager;