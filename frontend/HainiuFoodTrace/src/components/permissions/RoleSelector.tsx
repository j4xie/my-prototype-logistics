import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UserRole as AuthUserRole } from '../../types/auth';

// 扩展角色定义类型（用于UI显示）
export interface EnhancedUserRole {
  key: string;
  name: string;
  displayName: string;
  level: number;
  color: string;
  icon: string;
  description: string;
  permissions: string[];
  userType: 'platform' | 'factory';
}

// 7种用户角色配置
export const USER_ROLE_CONFIG: Record<string, EnhancedUserRole> = {
  system_developer: {
    key: 'system_developer',
    name: 'system_developer',
    displayName: '系统开发者',
    level: -1,
    color: '#E74C3C',
    icon: 'code-slash',
    description: '系统最高权限，可以访问所有功能和数据',
    permissions: ['*'],
    userType: 'platform'
  },
  platform_super_admin: {
    key: 'platform_super_admin', 
    name: 'platform_super_admin',
    displayName: '平台超级管理员',
    level: 0,
    color: '#9B59B6',
    icon: 'shield',
    description: '平台最高管理权限，可以管理所有平台功能',
    permissions: ['platform.*', 'admin.*', 'user.*'],
    userType: 'platform'
  },
  platform_operator: {
    key: 'platform_operator',
    name: 'platform_operator', 
    displayName: '平台操作员',
    level: 1,
    color: '#3498DB',
    icon: 'settings',
    description: '平台日常操作权限，可以处理平台事务',
    permissions: ['platform.operate', 'platform.view'],
    userType: 'platform'
  },
  factory_super_admin: {
    key: 'factory_super_admin',
    name: 'factory_super_admin',
    displayName: '工厂超级管理员',
    level: 0,
    color: '#E67E22',
    icon: 'business',
    description: '工厂最高管理权限，可以管理工厂所有功能',
    permissions: ['factory.*', 'processing.*', 'employee.*'],
    userType: 'factory'
  },
  permission_admin: {
    key: 'permission_admin',
    name: 'permission_admin',
    displayName: '权限管理员',
    level: 5,
    color: '#F39C12',
    icon: 'key',
    description: '负责用户权限分配和角色管理',
    permissions: ['permission.*', 'user.manage', 'role.assign'],
    userType: 'factory'
  },
  department_admin: {
    key: 'department_admin',
    name: 'department_admin',
    displayName: '部门管理员',
    level: 10,
    color: '#27AE60',
    icon: 'people',
    description: '部门级别管理权限，可以管理部门内事务',
    permissions: ['department.*', 'employee.view', 'processing.manage'],
    userType: 'factory'
  },
  operator: {
    key: 'operator',
    name: 'operator',
    displayName: '操作员',
    level: 30,
    color: '#16A085',
    icon: 'person-circle',
    description: '基本操作权限，可以执行日常工作任务',
    permissions: ['processing.operate', 'data.input', 'record.create'],
    userType: 'factory'
  },
  viewer: {
    key: 'viewer',
    name: 'viewer',
    displayName: '查看者',
    level: 50,
    color: '#95A5A6',
    icon: 'eye',
    description: '只读权限，可以查看相关数据和报告',
    permissions: ['data.view', 'report.view'],
    userType: 'factory'
  }
};

interface RoleSelectorProps {
  selectedRole?: string;
  onRoleChange?: (role: EnhancedUserRole | null) => void;
  disabled?: boolean;
  showDescription?: boolean;
  filterByUserType?: 'platform' | 'factory';
  multiSelect?: boolean;
  selectedRoles?: string[];
  onMultiRoleChange?: (roles: EnhancedUserRole[]) => void;
  placeholder?: string;
  allowClear?: boolean;
  showPermissionCount?: boolean;
  sortByLevel?: boolean;
}

/**
 * 角色选择器组件
 * 支持7种用户角色的选择和显示
 */
export const RoleSelector: React.FC<RoleSelectorProps> = ({
  selectedRole,
  onRoleChange,
  disabled = false,
  showDescription = true,
  filterByUserType,
  multiSelect = false,
  selectedRoles = [],
  onMultiRoleChange,
  placeholder = '请选择角色',
  allowClear = true,
  showPermissionCount = true,
  sortByLevel = true
}) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');

  // 过滤和排序角色
  const filteredRoles = useMemo(() => {
    let roles = Object.values(USER_ROLE_CONFIG);
    
    // 按用户类型过滤
    if (filterByUserType) {
      roles = roles.filter(role => role.userType === filterByUserType);
    }
    
    // 按搜索文本过滤
    if (searchText) {
      roles = roles.filter(role => 
        role.displayName.includes(searchText) ||
        role.description.includes(searchText) ||
        role.name.includes(searchText.toLowerCase())
      );
    }
    
    // 排序
    if (sortByLevel) {
      roles = roles.sort((a, b) => a.level - b.level);
    }
    
    return roles;
  }, [filterByUserType, searchText, sortByLevel]);

  // 获取选中角色的显示信息
  const getSelectedRoleDisplay = useCallback(() => {
    if (multiSelect) {
      const selected = selectedRoles
        .map(roleKey => USER_ROLE_CONFIG[roleKey])
        .filter(Boolean);
      
      if (selected.length === 0) return placeholder;
      if (selected.length === 1) return selected[0].displayName;
      return `已选择 ${selected.length} 个角色`;
    } else {
      if (!selectedRole) return placeholder;
      const role = USER_ROLE_CONFIG[selectedRole];
      return role ? role.displayName : placeholder;
    }
  }, [selectedRole, selectedRoles, multiSelect, placeholder]);

  // 获取选中角色的颜色
  const getSelectedRoleColor = useCallback(() => {
    if (multiSelect) {
      return selectedRoles.length > 0 ? '#4ECDC4' : '#999';
    } else {
      if (!selectedRole) return '#999';
      const role = USER_ROLE_CONFIG[selectedRole];
      return role ? role.color : '#999';
    }
  }, [selectedRole, selectedRoles, multiSelect]);

  // 处理角色选择
  const handleRoleSelect = useCallback((role: EnhancedUserRole) => {
    if (multiSelect) {
      const currentSelected = [...selectedRoles];
      const existingIndex = currentSelected.indexOf(role.key);
      
      if (existingIndex >= 0) {
        // 取消选择
        currentSelected.splice(existingIndex, 1);
      } else {
        // 添加选择
        currentSelected.push(role.key);
      }
      
      const selectedRoleObjects = currentSelected
        .map(roleKey => USER_ROLE_CONFIG[roleKey])
        .filter(Boolean);
      
      onMultiRoleChange?.(selectedRoleObjects);
    } else {
      onRoleChange?.(role);
      setIsModalVisible(false);
    }
  }, [multiSelect, selectedRoles, onRoleChange, onMultiRoleChange]);

  // 清除选择
  const handleClear = useCallback(() => {
    if (multiSelect) {
      onMultiRoleChange?.([]);
    } else {
      onRoleChange?.(null);
    }
  }, [multiSelect, onRoleChange, onMultiRoleChange]);

  // 渲染角色项
  const renderRoleItem = useCallback(({ item: role }: { item: EnhancedUserRole }) => {
    const isSelected = multiSelect 
      ? selectedRoles.includes(role.key)
      : selectedRole === role.key;

    return (
      <TouchableOpacity
        style={[
          styles.roleItem,
          isSelected && styles.roleItemSelected,
          { borderLeftColor: role.color }
        ]}
        onPress={() => handleRoleSelect(role)}
        disabled={disabled}
      >
        <View style={styles.roleHeader}>
          <View style={styles.roleIconContainer}>
            <Ionicons 
              name={role.icon as any} 
              size={24} 
              color={role.color} 
            />
            <View style={[styles.levelBadge, { backgroundColor: role.color }]}>
              <Text style={styles.levelText}>
                {role.level === -1 ? '∞' : role.level}
              </Text>
            </View>
          </View>
          
          <View style={styles.roleInfo}>
            <View style={styles.roleTitleRow}>
              <Text style={styles.roleDisplayName}>{role.displayName}</Text>
              <Text style={styles.roleName}>({role.name})</Text>
              {multiSelect && isSelected && (
                <Ionicons name="checkmark-circle" size={20} color="#4ECDC4" />
              )}
            </View>
            
            <View style={styles.roleMetadata}>
              <View style={[styles.userTypeBadge, 
                role.userType === 'platform' ? styles.platformBadge : styles.factoryBadge
              ]}>
                <Text style={styles.userTypeText}>
                  {role.userType === 'platform' ? '平台' : '工厂'}
                </Text>
              </View>
              
              {showPermissionCount && (
                <Text style={styles.permissionCount}>
                  {role.permissions.length} 项权限
                </Text>
              )}
            </View>
            
            {showDescription && (
              <Text style={styles.roleDescription} numberOfLines={2}>
                {role.description}
              </Text>
            )}
            
            {/* 权限预览 */}
            <View style={styles.permissionPreview}>
              {role.permissions.slice(0, 3).map((permission, index) => (
                <Text key={index} style={styles.permissionTag}>
                  {permission}
                </Text>
              ))}
              {role.permissions.length > 3 && (
                <Text style={styles.permissionMore}>
                  +{role.permissions.length - 3}
                </Text>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [selectedRole, selectedRoles, multiSelect, handleRoleSelect, disabled, showDescription, showPermissionCount]);

  return (
    <>
      {/* 选择器触发器 */}
      <TouchableOpacity
        style={[
          styles.selectorTrigger,
          disabled && styles.selectorTriggerDisabled
        ]}
        onPress={() => !disabled && setIsModalVisible(true)}
        disabled={disabled}
      >
        <View style={styles.triggerContent}>
          <View style={[styles.colorIndicator, { backgroundColor: getSelectedRoleColor() }]} />
          <Text style={[
            styles.triggerText,
            disabled && styles.triggerTextDisabled
          ]}>
            {getSelectedRoleDisplay()}
          </Text>
        </View>
        
        <View style={styles.triggerActions}>
          {allowClear && (selectedRole || selectedRoles.length > 0) && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClear}
              disabled={disabled}
            >
              <Ionicons name="close-circle" size={18} color="#999" />
            </TouchableOpacity>
          )}
          
          <Ionicons 
            name="chevron-down" 
            size={20} 
            color={disabled ? '#CCC' : '#666'} 
            style={styles.chevronIcon}
          />
        </View>
      </TouchableOpacity>

      {/* 角色选择模态框 */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          {/* 模态框头部 */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {multiSelect ? '选择角色（多选）' : '选择角色'}
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setIsModalVisible(false)}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* 统计信息 */}
          <View style={styles.statsContainer}>
            <Text style={styles.statsText}>
              共 {filteredRoles.length} 个角色
              {filterByUserType && ` (${filterByUserType === 'platform' ? '平台' : '工厂'})`}
            </Text>
            {multiSelect && selectedRoles.length > 0 && (
              <Text style={styles.selectedStats}>
                已选择: {selectedRoles.length}
              </Text>
            )}
          </View>

          {/* 角色列表 */}
          <FlatList
            data={filteredRoles}
            renderItem={renderRoleItem}
            keyExtractor={(role) => role.key}
            style={styles.roleList}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />

          {/* 底部操作 */}
          {multiSelect && (
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.clearAllButton}
                onPress={() => onMultiRoleChange?.([])}
              >
                <Text style={styles.clearAllText}>清除所有</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={() => setIsModalVisible(false)}
              >
                <Text style={styles.confirmText}>
                  确定 ({selectedRoles.length})
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  selectorTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
  },
  selectorTriggerDisabled: {
    backgroundColor: '#F8F9FA',
    opacity: 0.6,
  },
  triggerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  colorIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  triggerText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  triggerTextDisabled: {
    color: '#999',
  },
  triggerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearButton: {
    padding: 4,
    marginRight: 8,
  },
  chevronIcon: {
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  statsText: {
    fontSize: 14,
    color: '#666',
  },
  selectedStats: {
    fontSize: 14,
    color: '#4ECDC4',
    fontWeight: '500',
  },
  roleList: {
    flex: 1,
    padding: 16,
  },
  roleItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  roleItemSelected: {
    borderColor: '#4ECDC4',
    backgroundColor: '#F0FDFC',
  },
  roleHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  roleIconContainer: {
    position: 'relative',
    marginRight: 12,
  },
  levelBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#4ECDC4',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  roleInfo: {
    flex: 1,
  },
  roleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  roleDisplayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  roleName: {
    fontSize: 12,
    color: '#999',
    flex: 1,
  },
  roleMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  userTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  platformBadge: {
    backgroundColor: '#E8F4FD',
  },
  factoryBadge: {
    backgroundColor: '#FFF3E0',
  },
  userTypeText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#666',
  },
  permissionCount: {
    fontSize: 12,
    color: '#4ECDC4',
    fontWeight: '500',
  },
  roleDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  permissionPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  permissionTag: {
    fontSize: 10,
    color: '#666',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 4,
    marginBottom: 2,
  },
  permissionMore: {
    fontSize: 10,
    color: '#4ECDC4',
    fontWeight: '500',
  },
  separator: {
    height: 12,
  },
  modalActions: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
  },
  clearAllButton: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginRight: 12,
  },
  clearAllText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  confirmButton: {
    flex: 2,
    backgroundColor: '#4ECDC4',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default RoleSelector;