import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  Alert,
  Switch,
  Modal
} from 'react-native';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { usePermission } from '../hooks/usePermission';
import { useLogin } from '../hooks/useLogin';
import { USER_ROLE_CONFIG } from '../components/permissions/RoleSelector';
import { MenuItem } from './types';

/**
 * 权限感知菜单组件
 * 根据用户权限动态显示菜单项
 */
export const PermissionBasedMenu: React.FC<DrawerContentComponentProps> = ({
  navigation,
  state,
  descriptors
}) => {
  const [isLogoutModalVisible, setIsLogoutModalVisible] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(['main']);

  const { user, hasPermission, hasRole, hasAnyRole, refreshPermissions } = usePermission();
  const { 
    logout, 
    biometricStatus, 
    enableBiometricLogin, 
    clearPermissionCache 
  } = useLogin({
    enableBiometric: true,
    enableAutoLogin: true,
    maxRetries: 3
  });

  // 获取用户角色信息
  const currentRole = useMemo(() => {
    if (!user?.role) return null;
    return USER_ROLE_CONFIG[user.role];
  }, [user?.role]);

  // 菜单配置
  const menuSections = useMemo((): Array<{
    key: string;
    title: string;
    icon: string;
    items: MenuItem[];
  }> => [
    {
      key: 'main',
      title: '主要功能',
      icon: 'home',
      items: [
        {
          key: 'dashboard',
          title: '仪表板',
          icon: 'speedometer',
          route: 'Home',
          color: '#4ECDC4'
        },
        {
          key: 'processing',
          title: '加工管理',
          icon: 'restaurant',
          route: 'Processing',
          color: '#27AE60',
          permission: {
            routeName: 'Processing',
            requiredRoles: ['factory_super_admin', 'department_admin', 'operator'],
            requiredPermissions: ['processing.view']
          }
        },
        {
          key: 'logistics',
          title: '物流管理',
          icon: 'car',
          route: 'Logistics', 
          color: '#9B59B6',
          permission: {
            routeName: 'Logistics',
            requiredRoles: ['factory_super_admin'],
            requiredPermissions: ['logistics.view']
          }
        },
        {
          key: 'sales',
          title: '销售管理',
          icon: 'storefront',
          route: 'Sales',
          color: '#F39C12',
          permission: {
            routeName: 'Sales',
            requiredRoles: ['factory_super_admin', 'department_admin'],
            requiredPermissions: ['sales.view']
          }
        },
        {
          key: 'reports',
          title: '报告分析',
          icon: 'bar-chart',
          route: 'Reports',
          color: '#E74C3C',
          permission: {
            routeName: 'Reports',
            requiredPermissions: ['report.view']
          }
        }
      ]
    },
    {
      key: 'admin',
      title: '管理功能',
      icon: 'settings',
      items: [
        {
          key: 'platform_management',
          title: '平台管理',
          icon: 'shield',
          route: 'Platform',
          color: '#9B59B6',
          platformOnly: true,
          permission: {
            routeName: 'Platform',
            requiredRoles: ['platform_super_admin', 'platform_operator']
          }
        },
        {
          key: 'factory_management',
          title: '工厂管理', 
          icon: 'business',
          route: 'Factory',
          color: '#E67E22',
          factoryOnly: true,
          permission: {
            routeName: 'Factory',
            requiredRoles: ['factory_super_admin']
          }
        },
        {
          key: 'user_management',
          title: '用户管理',
          icon: 'people',
          route: 'UserManagement',
          color: '#3498DB',
          permission: {
            routeName: 'UserManagement',
            requiredPermissions: ['user.manage']
          }
        },
        {
          key: 'permission_management',
          title: '权限管理',
          icon: 'key',
          route: 'PermissionManagement',
          color: '#F39C12',
          permission: {
            routeName: 'PermissionManagement',
            requiredRoles: ['permission_admin', 'factory_super_admin']
          }
        }
      ]
    },
    {
      key: 'tools',
      title: '工具和设置',
      icon: 'construct',
      items: [
        {
          key: 'profile',
          title: '个人资料',
          icon: 'person',
          route: 'Profile',
          color: '#95A5A6'
        },
        {
          key: 'security',
          title: '安全设置',
          icon: 'lock-closed',
          route: 'SecuritySettings',
          color: '#34495E'
        },
        {
          key: 'notifications',
          title: '通知设置',
          icon: 'notifications',
          route: 'NotificationSettings',
          color: '#16A085'
        }
      ]
    }
  ], []);

  // 检查菜单项权限
  const checkMenuPermission = useCallback((item: MenuItem): boolean => {
    // 开发环境特殊项目
    if (item.hideInProduction && !__DEV__) {
      return false;
    }

    // 平台专用检查
    if (item.platformOnly && !hasAnyRole(['platform_super_admin', 'platform_operator'])) {
      return false;
    }

    // 工厂专用检查
    if (item.factoryOnly && !hasAnyRole(['factory_super_admin', 'permission_admin', 'department_admin', 'operator', 'viewer'])) {
      return false;
    }

    // 权限检查
    if (item.permission) {
      const { requiredRoles, requiredPermissions, customCheck } = item.permission;

      // 自定义权限检查
      if (customCheck) {
        return customCheck(user);
      }

      // 角色检查
      if (requiredRoles && requiredRoles.length > 0) {
        if (!hasAnyRole(requiredRoles)) {
          return false;
        }
      }

      // 权限检查
      if (requiredPermissions && requiredPermissions.length > 0) {
        const hasAllPermissions = requiredPermissions.every(permission => 
          hasPermission(permission)
        );
        if (!hasAllPermissions) {
          return false;
        }
      }
    }

    return true;
  }, [hasPermission, hasAnyRole, user]);

  // 过滤可见菜单项
  const visibleMenuSections = useMemo(() => {
    return menuSections.map(section => ({
      ...section,
      items: section.items.filter(checkMenuPermission)
    })).filter(section => section.items.length > 0);
  }, [menuSections, checkMenuPermission]);

  // 处理菜单项点击
  const handleMenuItemPress = useCallback((item: MenuItem) => {
    if (item.route) {
      navigation.navigate(item.route as any, item.params);
    }
    
    // 关闭抽屉
    navigation.closeDrawer();
  }, [navigation]);

  // 切换分组展开状态
  const toggleSectionExpansion = useCallback((sectionKey: string) => {
    setExpandedSections(prev => 
      prev.includes(sectionKey)
        ? prev.filter(key => key !== sectionKey)
        : [...prev, sectionKey]
    );
  }, []);

  // 处理退出登录
  const handleLogout = useCallback(async () => {
    try {
      await logout();
      setIsLogoutModalVisible(false);
      // 导航会自动重置到登录页面
    } catch (error) {
      Alert.alert('错误', '退出登录失败，请重试');
    }
  }, [logout]);

  // 刷新权限
  const handleRefreshPermissions = useCallback(async () => {
    try {
      await refreshPermissions();
      Alert.alert('成功', '权限信息已刷新');
    } catch (error) {
      Alert.alert('错误', '权限刷新失败');
    }
  }, [refreshPermissions]);

  // 渲染用户信息头部
  const renderUserHeader = useCallback(() => (
    <View style={styles.userHeader}>
      <View style={styles.avatarContainer}>
        <View style={[styles.avatar, { backgroundColor: currentRole?.color || '#4ECDC4' }]}>
          <Ionicons 
            name={currentRole?.icon as any || 'person'} 
            size={32} 
            color="#FFFFFF" 
          />
        </View>
        {currentRole && (
          <View style={[styles.roleBadge, { backgroundColor: currentRole.color }]}>
            <Text style={styles.roleLevelText}>
              {currentRole.level === -1 ? '∞' : currentRole.level}
            </Text>
          </View>
        )}
      </View>
      
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{user?.username || '用户'}</Text>
        <Text style={styles.userRole}>
          {currentRole?.displayName || user?.role || '未知角色'}
        </Text>
        <Text style={styles.userCompany}>
          {user?.companyName || '海牛食品溯源系统'}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.refreshButton}
        onPress={handleRefreshPermissions}
      >
        <Ionicons name="refresh" size={20} color="#666" />
      </TouchableOpacity>
    </View>
  ), [currentRole, user, handleRefreshPermissions]);

  // 渲染菜单项
  const renderMenuItem = useCallback((item: MenuItem) => (
    <TouchableOpacity
      key={item.key}
      style={styles.menuItem}
      onPress={() => handleMenuItemPress(item)}
    >
      <View style={styles.menuItemContent}>
        <View style={[styles.menuIcon, { backgroundColor: item.color + '20' }]}>
          <Ionicons 
            name={item.icon as any} 
            size={20} 
            color={item.color || '#4ECDC4'} 
          />
        </View>
        
        <Text style={styles.menuItemText}>{item.title}</Text>
        
        {item.badge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.badge}</Text>
          </View>
        )}
      </View>
      
      <Ionicons name="chevron-forward" size={16} color="#999" />
    </TouchableOpacity>
  ), [handleMenuItemPress]);

  // 渲染菜单分组
  const renderMenuSection = useCallback((section: typeof visibleMenuSections[0]) => {
    const isExpanded = expandedSections.includes(section.key);

    return (
      <View key={section.key} style={styles.menuSection}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => toggleSectionExpansion(section.key)}
        >
          <View style={styles.sectionHeaderContent}>
            <Ionicons name={section.icon as any} size={18} color="#666" />
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
          <Ionicons 
            name={isExpanded ? 'chevron-up' : 'chevron-down'} 
            size={16} 
            color="#999" 
          />
        </TouchableOpacity>
        
        {isExpanded && (
          <View style={styles.sectionContent}>
            {section.items.map(renderMenuItem)}
          </View>
        )}
      </View>
    );
  }, [expandedSections, toggleSectionExpansion, renderMenuItem]);

  // 渲染底部操作区
  const renderFooter = useCallback(() => (
    <View style={styles.footer}>
      {/* 生物识别开关 */}
      {biometricStatus.available && (
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Ionicons name="finger-print" size={20} color="#4ECDC4" />
            <Text style={styles.settingText}>生物识别登录</Text>
          </View>
          <Switch
            value={biometricStatus.enabled}
            onValueChange={enableBiometricLogin}
            trackColor={{ false: '#E9ECEF', true: '#4ECDC4' }}
          />
        </View>
      )}

      {/* 版本信息 */}
      <View style={styles.versionInfo}>
        <Text style={styles.versionText}>v1.0.0</Text>
        <Text style={styles.versionSubtext}>海牛食品溯源系统</Text>
      </View>

      {/* 退出按钮 */}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={() => setIsLogoutModalVisible(true)}
      >
        <Ionicons name="log-out" size={20} color="#E74C3C" />
        <Text style={styles.logoutText}>退出登录</Text>
      </TouchableOpacity>
    </View>
  ), [biometricStatus, enableBiometricLogin]);

  return (
    <View style={styles.container}>
      {/* 用户头部 */}
      {renderUserHeader()}

      {/* 菜单内容 */}
      <ScrollView style={styles.menuContent} showsVerticalScrollIndicator={false}>
        {visibleMenuSections.map(renderMenuSection)}
      </ScrollView>

      {/* 底部操作区 */}
      {renderFooter()}

      {/* 退出确认模态框 */}
      <Modal
        visible={isLogoutModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLogoutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>确认退出</Text>
            <Text style={styles.modalMessage}>
              您确定要退出登录吗？退出后需要重新登录。
            </Text>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setIsLogoutModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleLogout}
              >
                <Text style={styles.confirmButtonText}>退出</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleLevelText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  userRole: {
    fontSize: 13,
    color: '#4ECDC4',
    fontWeight: '500',
    marginBottom: 2,
  },
  userCompany: {
    fontSize: 11,
    color: '#999',
  },
  refreshButton: {
    padding: 8,
  },
  menuContent: {
    flex: 1,
  },
  menuSection: {
    marginVertical: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
  },
  sectionHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginLeft: 8,
  },
  sectionContent: {
    backgroundColor: '#FFFFFF',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuItemText: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  badge: {
    backgroundColor: '#E74C3C',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 8,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
    paddingVertical: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  versionInfo: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  versionText: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  versionSubtext: {
    fontSize: 10,
    color: '#CCC',
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginHorizontal: 20,
    backgroundColor: '#FFF5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E74C3C',
  },
  logoutText: {
    fontSize: 14,
    color: '#E74C3C',
    fontWeight: '500',
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    margin: 20,
    minWidth: 280,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F8F9FA',
    marginRight: 8,
  },
  confirmButton: {
    backgroundColor: '#E74C3C',
    marginLeft: 8,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default PermissionBasedMenu;