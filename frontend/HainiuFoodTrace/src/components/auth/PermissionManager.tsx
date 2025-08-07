import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UserRole, UserPermissions } from '../../types/auth';

interface PermissionManagerProps {
  visible: boolean;
  onClose: () => void;
  userRole: UserRole;
  currentPermissions: UserPermissions;
  onSavePermissions: (permissions: UserPermissions) => void;
}

export const PermissionManager: React.FC<PermissionManagerProps> = ({
  visible,
  onClose,
  userRole,
  currentPermissions,
  onSavePermissions,
}) => {
  const [permissions, setPermissions] = useState<UserPermissions>(currentPermissions);

  // 所有可用权限列表
  const availablePermissions = {
    // 系统管理权限
    system: [
      { key: 'user_manage_all', label: '全局用户管理', description: '管理所有用户账号' },
      { key: 'factory_manage_all', label: '工厂管理', description: '管理所有工厂信息' },
      { key: 'platform_admin', label: '平台管理', description: '平台级别管理权限' },
      { key: 'system_config', label: '系统配置', description: '修改系统配置参数' },
    ],
    // 工厂管理权限
    factory: [
      { key: 'factory_manage', label: '工厂管理', description: '管理本工厂信息' },
      { key: 'user_manage_factory', label: '工厂用户管理', description: '管理工厂内用户' },
      { key: 'department_manage_all', label: '部门管理', description: '管理所有部门' },
      { key: 'department_manage', label: '部门管理', description: '管理所属部门' },
    ],
    // 权限管理
    permission: [
      { key: 'role_assign', label: '角色分配', description: '分配用户角色' },
      { key: 'permission_config', label: '权限配置', description: '配置权限设置' },
      { key: 'user_manage_department', label: '部门用户管理', description: '管理部门内用户' },
    ],
    // 业务操作权限
    operation: [
      { key: 'processing_manage', label: '生产管理', description: '管理生产流程' },
      { key: 'processing_manage_department', label: '部门生产管理', description: '管理部门生产' },
      { key: 'processing_record', label: '生产记录', description: '记录生产数据' },
      { key: 'quality_control', label: '质量控制', description: '质量管理权限' },
      { key: 'quality_record', label: '质量记录', description: '记录质量数据' },
      { key: 'equipment_operate', label: '设备操作', description: '操作生产设备' },
    ],
    // 查看权限
    view: [
      { key: 'factory_view', label: '工厂查看', description: '查看工厂信息' },
      { key: 'user_view', label: '用户查看', description: '查看用户信息' },
      { key: 'department_view', label: '部门查看', description: '查看部门信息' },
      { key: 'processing_view', label: '生产查看', description: '查看生产数据' },
      { key: 'quality_view', label: '质量查看', description: '查看质量数据' },
      { key: 'data_view', label: '数据查看', description: '查看系统数据' },
      { key: 'report_view', label: '报表查看', description: '查看报表数据' },
    ],
    // 导出和报表
    export: [
      { key: 'data_export', label: '全局数据导出', description: '导出所有数据' },
      { key: 'data_export_factory', label: '工厂数据导出', description: '导出工厂数据' },
      { key: 'report_generate', label: '报表生成', description: '生成系统报表' },
      { key: 'report_department', label: '部门报表', description: '生成部门报表' },
    ],
  };

  // 模块权限配置
  const modulePermissions = [
    { key: 'farming_access', label: '农业模块', icon: 'leaf-outline' },
    { key: 'processing_access', label: '生产模块', icon: 'cog-outline' },
    { key: 'logistics_access', label: '物流模块', icon: 'car-outline' },
    { key: 'trace_access', label: '溯源模块', icon: 'search-outline' },
    { key: 'admin_access', label: '管理模块', icon: 'settings-outline' },
    { key: 'platform_access', label: '平台模块', icon: 'server-outline' },
  ];

  // 切换功能权限
  const toggleFeaturePermission = (permissionKey: string) => {
    const currentFeatures = permissions.features || [];
    let newFeatures: string[];

    if (currentFeatures.includes(permissionKey)) {
      newFeatures = currentFeatures.filter(f => f !== permissionKey);
    } else {
      newFeatures = [...currentFeatures, permissionKey];
    }

    setPermissions(prev => ({
      ...prev,
      features: newFeatures,
    }));
  };

  // 切换模块权限
  const toggleModulePermission = (moduleKey: string) => {
    setPermissions(prev => ({
      ...prev,
      modules: {
        ...prev.modules,
        [moduleKey]: !prev.modules[moduleKey as keyof typeof prev.modules],
      },
    }));
  };

  // 保存权限配置
  const handleSave = () => {
    Alert.alert(
      '确认保存',
      '确定要保存权限配置吗？',
      [
        { text: '取消' },
        {
          text: '保存',
          onPress: () => {
            onSavePermissions(permissions);
            onClose();
          },
        },
      ]
    );
  };

  // 重置权限配置
  const handleReset = () => {
    Alert.alert(
      '确认重置',
      '确定要重置为原始权限配置吗？',
      [
        { text: '取消' },
        {
          text: '重置',
          onPress: () => {
            setPermissions(currentPermissions);
          },
        },
      ]
    );
  };

  // 渲染权限组
  const renderPermissionGroup = (groupKey: string, groupLabel: string, permissionsList: Array<{key: string; label: string; description: string}>) => (
    <View style={styles.permissionGroup}>
      <Text style={styles.groupTitle}>{groupLabel}</Text>
      {permissionsList.map(permission => (
        <TouchableOpacity
          key={permission.key}
          style={styles.permissionItem}
          onPress={() => toggleFeaturePermission(permission.key)}
        >
          <View style={styles.permissionInfo}>
            <Text style={styles.permissionLabel}>{permission.label}</Text>
            <Text style={styles.permissionDescription}>{permission.description}</Text>
          </View>
          <View style={[
            styles.checkbox,
            (permissions.features || []).includes(permission.key) && styles.checkboxActive
          ]}>
            {(permissions.features || []).includes(permission.key) && (
              <Ionicons name="checkmark" size={16} color="#fff" />
            )}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* 头部 */}
          <View style={styles.header}>
            <Text style={styles.title}>权限管理</Text>
            <Text style={styles.subtitle}>角色：{userRole}</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
            >
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {/* 模块权限 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                <Ionicons name="apps" size={18} color="#3b82f6" />
                {' '}模块访问权限
              </Text>
              <View style={styles.moduleGrid}>
                {modulePermissions.map(module => (
                  <TouchableOpacity
                    key={module.key}
                    style={[
                      styles.moduleCard,
                      permissions.modules[module.key as keyof typeof permissions.modules] && styles.moduleCardActive
                    ]}
                    onPress={() => toggleModulePermission(module.key)}
                  >
                    <Ionicons
                      name={module.icon as any}
                      size={24}
                      color={permissions.modules[module.key as keyof typeof permissions.modules] ? '#3b82f6' : '#64748b'}
                    />
                    <Text style={[
                      styles.moduleLabel,
                      permissions.modules[module.key as keyof typeof permissions.modules] && styles.moduleLabelActive
                    ]}>
                      {module.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 功能权限 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                <Ionicons name="key" size={18} color="#10b981" />
                {' '}功能权限配置
              </Text>

              {renderPermissionGroup('system', '系统管理权限', availablePermissions.system)}
              {renderPermissionGroup('factory', '工厂管理权限', availablePermissions.factory)}
              {renderPermissionGroup('permission', '权限管理', availablePermissions.permission)}
              {renderPermissionGroup('operation', '业务操作权限', availablePermissions.operation)}
              {renderPermissionGroup('view', '查看权限', availablePermissions.view)}
              {renderPermissionGroup('export', '导出和报表', availablePermissions.export)}
            </View>
          </ScrollView>

          {/* 底部操作按钮 */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={handleReset}
            >
              <Text style={styles.resetButtonText}>重置</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
            >
              <Text style={styles.saveButtonText}>保存配置</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    position: 'relative',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    maxHeight: 500,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  moduleCard: {
    width: '48%',
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  moduleCardActive: {
    backgroundColor: '#dbeafe',
    borderColor: '#3b82f6',
  },
  moduleLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
  },
  moduleLabelActive: {
    color: '#3b82f6',
    fontWeight: '500',
  },
  permissionGroup: {
    marginBottom: 20,
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    marginBottom: 8,
  },
  permissionInfo: {
    flex: 1,
  },
  permissionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
    marginBottom: 2,
  },
  permissionDescription: {
    fontSize: 12,
    color: '#64748b',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: '#3b82f6',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 12,
  },
  resetButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#64748b',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
});