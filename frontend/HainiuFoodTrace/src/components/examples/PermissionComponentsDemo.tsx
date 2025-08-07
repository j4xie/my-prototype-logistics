import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  RoleSelector,
  PermissionSettingsPanel,
  DepartmentPermissionManager,
  UserPermissionDisplay,
  UserRole,
  Department,
  DepartmentPermission
} from '../permissions';

/**
 * 权限组件演示页面
 * 展示所有权限UI组件的功能和集成使用
 */
export const PermissionComponentsDemo: React.FC = () => {
  const [selectedDemo, setSelectedDemo] = useState<string>('role-selector');
  const [modalVisible, setModalVisible] = useState(false);
  const [demoData, setDemoData] = useState({
    selectedRole: 'operator',
    selectedRoles: ['operator', 'viewer'],
    selectedPermissions: ['processing.operate', 'data.input', 'report.view'],
    selectedDepartment: 'processing',
    selectedUser: 'demo_user',
    departmentPermissions: [] as DepartmentPermission[]
  });

  // 演示项目配置
  const demoItems = [
    {
      key: 'role-selector',
      title: '角色选择器',
      description: '支持7种角色选择，单选和多选模式',
      icon: 'people-circle',
      color: '#4ECDC4'
    },
    {
      key: 'permission-settings',
      title: '权限设置面板',
      description: '可视化权限管理，支持分组和搜索',
      icon: 'key',
      color: '#9B59B6'
    },
    {
      key: 'department-manager',
      title: '部门权限管理',
      description: '部门级权限分配和继承管理',
      icon: 'business',
      color: '#E67E22'
    },
    {
      key: 'user-display',
      title: '用户权限展示',
      description: '全面的用户权限可视化和分析',
      icon: 'analytics',
      color: '#27AE60'
    }
  ];

  // 处理角色选择
  const handleRoleChange = useCallback((role: UserRole) => {
    setDemoData(prev => ({
      ...prev,
      selectedRole: role.key
    }));
    Alert.alert('角色选择', `已选择角色: ${role.displayName}`);
  }, []);

  // 处理多角色选择
  const handleMultiRoleChange = useCallback((roles: UserRole[]) => {
    setDemoData(prev => ({
      ...prev,
      selectedRoles: roles.map(r => r.key)
    }));
    Alert.alert('多角色选择', `已选择 ${roles.length} 个角色`);
  }, []);

  // 处理权限变更
  const handlePermissionsChange = useCallback((permissions: string[]) => {
    setDemoData(prev => ({
      ...prev,
      selectedPermissions: permissions
    }));
    Alert.alert('权限更新', `当前权限数量: ${permissions.length}`);
  }, []);

  // 处理部门选择
  const handleDepartmentChange = useCallback((department: Department) => {
    setDemoData(prev => ({
      ...prev,
      selectedDepartment: department.id
    }));
    Alert.alert('部门选择', `已选择部门: ${department.displayName}`);
  }, []);

  // 处理部门权限变更
  const handleDepartmentPermissionsChange = useCallback((permissions: DepartmentPermission[]) => {
    setDemoData(prev => ({
      ...prev,
      departmentPermissions: permissions
    }));
    Alert.alert('部门权限', `权限记录数: ${permissions.length}`);
  }, []);

  // 渲染角色选择器演示
  const renderRoleSelectorDemo = useCallback(() => (
    <View style={styles.demoSection}>
      <Text style={styles.sectionTitle}>角色选择器演示</Text>
      
      <View style={styles.demoItem}>
        <Text style={styles.itemTitle}>单选模式 - 工厂角色</Text>
        <RoleSelector
          selectedRole={demoData.selectedRole}
          onRoleChange={handleRoleChange}
          filterByUserType="factory"
          placeholder="选择工厂角色"
        />
      </View>

      <View style={styles.demoItem}>
        <Text style={styles.itemTitle}>多选模式 - 平台角色</Text>
        <RoleSelector
          multiSelect
          selectedRoles={demoData.selectedRoles}
          onMultiRoleChange={handleMultiRoleChange}
          filterByUserType="platform"
          placeholder="选择平台角色（多选）"
        />
      </View>

      <View style={styles.demoItem}>
        <Text style={styles.itemTitle}>完整模式 - 所有角色</Text>
        <RoleSelector
          selectedRole={demoData.selectedRole}
          onRoleChange={handleRoleChange}
          showDescription={true}
          showPermissionCount={true}
          placeholder="选择任意角色"
        />
      </View>
    </View>
  ), [demoData.selectedRole, demoData.selectedRoles, handleRoleChange, handleMultiRoleChange]);

  // 渲染权限设置面板演示
  const renderPermissionSettingsDemo = useCallback(() => (
    <View style={styles.demoSection}>
      <Text style={styles.sectionTitle}>权限设置面板演示</Text>
      
      <View style={styles.demoItem}>
        <Text style={styles.itemTitle}>标准权限设置</Text>
        <View style={styles.permissionPanelContainer}>
          <PermissionSettingsPanel
            selectedPermissions={demoData.selectedPermissions}
            onPermissionsChange={handlePermissionsChange}
            userRole={demoData.selectedRole}
            showDescription={true}
            showRiskLevels={true}
            allowSelectAll={true}
          />
        </View>
      </View>

      <View style={styles.demoItem}>
        <Text style={styles.itemTitle}>只读模式</Text>
        <View style={styles.permissionPanelContainer}>
          <PermissionSettingsPanel
            selectedPermissions={demoData.selectedPermissions}
            readonly={true}
            showDescription={false}
            showRiskLevels={true}
          />
        </View>
      </View>
    </View>
  ), [demoData.selectedPermissions, demoData.selectedRole, handlePermissionsChange]);

  // 渲染部门权限管理器演示
  const renderDepartmentManagerDemo = useCallback(() => (
    <View style={styles.demoSection}>
      <Text style={styles.sectionTitle}>部门权限管理器演示</Text>
      
      <View style={styles.demoItem}>
        <Text style={styles.itemTitle}>部门权限管理</Text>
        <View style={styles.departmentManagerContainer}>
          <DepartmentPermissionManager
            selectedDepartment={demoData.selectedDepartment}
            onDepartmentChange={handleDepartmentChange}
            selectedUser={demoData.selectedUser}
            permissions={demoData.departmentPermissions}
            onPermissionsChange={handleDepartmentPermissionsChange}
            showInheritance={true}
            allowBulkOperations={true}
          />
        </View>
      </View>
    </View>
  ), [
    demoData.selectedDepartment,
    demoData.selectedUser,
    demoData.departmentPermissions,
    handleDepartmentChange,
    handleDepartmentPermissionsChange
  ]);

  // 渲染用户权限展示演示
  const renderUserDisplayDemo = useCallback(() => (
    <View style={styles.demoSection}>
      <Text style={styles.sectionTitle}>用户权限展示演示</Text>
      
      <View style={styles.demoItem}>
        <Text style={styles.itemTitle}>完整权限展示</Text>
        <View style={styles.userDisplayContainer}>
          <UserPermissionDisplay
            userId={demoData.selectedUser}
            userRole={demoData.selectedRole}
            showAnalytics={true}
            showHistory={true}
            allowExport={true}
            refreshable={true}
            onPermissionClick={(permission) => 
              Alert.alert('权限详情', `权限: ${permission}`)
            }
            onRoleClick={(role) => 
              Alert.alert('角色详情', `角色: ${role}`)
            }
          />
        </View>
      </View>

      <View style={styles.demoItem}>
        <Text style={styles.itemTitle}>紧凑模式</Text>
        <View style={styles.userDisplayContainer}>
          <UserPermissionDisplay
            userId={demoData.selectedUser}
            userRole={demoData.selectedRole}
            compactMode={true}
            showAnalytics={false}
            showHistory={false}
            allowExport={false}
            refreshable={false}
          />
        </View>
      </View>
    </View>
  ), [demoData.selectedUser, demoData.selectedRole]);

  // 渲染演示内容
  const renderDemoContent = useCallback(() => {
    switch (selectedDemo) {
      case 'role-selector':
        return renderRoleSelectorDemo();
      case 'permission-settings':
        return renderPermissionSettingsDemo();
      case 'department-manager':
        return renderDepartmentManagerDemo();
      case 'user-display':
        return renderUserDisplayDemo();
      default:
        return null;
    }
  }, [selectedDemo, renderRoleSelectorDemo, renderPermissionSettingsDemo, renderDepartmentManagerDemo, renderUserDisplayDemo]);

  // 只在开发环境显示
  if (!__DEV__) {
    return null;
  }

  return (
    <>
      {/* 浮动按钮 */}
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="library" size={24} color="#FFFFFF" />
        <Text style={styles.buttonText}>权限组件</Text>
      </TouchableOpacity>

      {/* 演示模态框 */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          {/* 头部 */}
          <View style={styles.header}>
            <Text style={styles.title}>权限组件演示</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.contentContainer}>
            {/* 侧边导航 */}
            <View style={styles.sidebar}>
              <Text style={styles.sidebarTitle}>组件列表</Text>
              {demoItems.map(item => (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.navItem,
                    selectedDemo === item.key && styles.navItemActive
                  ]}
                  onPress={() => setSelectedDemo(item.key)}
                >
                  <Ionicons
                    name={item.icon as any}
                    size={20}
                    color={selectedDemo === item.key ? '#FFFFFF' : item.color}
                  />
                  <View style={styles.navItemContent}>
                    <Text style={[
                      styles.navItemTitle,
                      selectedDemo === item.key && styles.navItemTitleActive
                    ]}>
                      {item.title}
                    </Text>
                    <Text style={[
                      styles.navItemDescription,
                      selectedDemo === item.key && styles.navItemDescriptionActive
                    ]}>
                      {item.description}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* 主要内容区域 */}
            <View style={styles.mainContent}>
              <ScrollView
                style={styles.demoScrollView}
                showsVerticalScrollIndicator={false}
              >
                {renderDemoContent()}
                <View style={styles.bottomSpacer} />
              </ScrollView>
            </View>
          </View>

          {/* 状态栏 */}
          <View style={styles.statusBar}>
            <Text style={styles.statusText}>
              当前演示: {demoItems.find(item => item.key === selectedDemo)?.title}
            </Text>
            <View style={styles.dataDisplay}>
              <Text style={styles.dataText}>
                角色: {demoData.selectedRole} | 权限: {demoData.selectedPermissions.length} | 部门: {demoData.selectedDepartment}
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    top: 150,
    right: 20,
    backgroundColor: '#6C5CE7',
    borderRadius: 25,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 9997,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 8,
  },
  contentContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 200,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E9ECEF',
    paddingVertical: 16,
  },
  sidebarTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 8,
    borderRadius: 8,
  },
  navItemActive: {
    backgroundColor: '#4ECDC4',
  },
  navItemContent: {
    marginLeft: 12,
    flex: 1,
  },
  navItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  navItemTitleActive: {
    color: '#FFFFFF',
  },
  navItemDescription: {
    fontSize: 11,
    color: '#666',
    lineHeight: 14,
  },
  navItemDescriptionActive: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  mainContent: {
    flex: 1,
  },
  demoScrollView: {
    flex: 1,
  },
  demoSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  demoItem: {
    marginBottom: 24,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  permissionPanelContainer: {
    height: 300,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  departmentManagerContainer: {
    height: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  userDisplayContainer: {
    height: 500,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  bottomSpacer: {
    height: 100,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
  },
  statusText: {
    fontSize: 12,
    color: '#4ECDC4',
    fontWeight: '500',
  },
  dataDisplay: {
    flex: 1,
    alignItems: 'flex-end',
  },
  dataText: {
    fontSize: 10,
    color: '#999',
    fontFamily: 'monospace',
  },
});

export default PermissionComponentsDemo;