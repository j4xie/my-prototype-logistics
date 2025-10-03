import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { usePermission } from '../../hooks/usePermission';
import { User, UserRole, USER_ROLES } from '../../types/auth';

interface UserManagementModalProps {
  visible: boolean;
  onClose: () => void;
  editingUser?: User | null;
  onUserSaved?: (user: User) => void;
}

interface UserFormData {
  username: string;
  email: string;
  phone?: string;
  fullName?: string;
  role: UserRole;
  userType: 'platform' | 'factory';
  department?: string;
  isActive: boolean;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  visible,
  onClose,
  editingUser,
  onUserSaved,
}) => {
  const { user: currentUser } = useAuthStore();
  const { hasPermission, canManageUser } = usePermission();
  
  const [formData, setFormData] = useState<UserFormData>({
    username: '',
    email: '',
    phone: '',
    fullName: '',
    role: USER_ROLES.VIEWER,
    userType: 'factory',
    department: '',
    isActive: true,
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 初始化表单数据
  useEffect(() => {
    if (editingUser) {
      setFormData({
        username: editingUser.username,
        email: editingUser.email,
        phone: editingUser.phone || '',
        fullName: editingUser.fullName || '',
        role: editingUser.userType === 'platform' && 'platformUser' in editingUser 
          ? editingUser.platformUser.role 
          : editingUser.userType === 'factory' && 'factoryUser' in editingUser
          ? editingUser.factoryUser.role
          : USER_ROLES.VIEWER,
        userType: editingUser.userType,
        department: editingUser.userType === 'factory' && 'factoryUser' in editingUser 
          ? editingUser.factoryUser.department || ''
          : '',
        isActive: editingUser.isActive,
      });
    } else {
      // 重置为默认值
      setFormData({
        username: '',
        email: '',
        phone: '',
        fullName: '',
        role: USER_ROLES.VIEWER,
        userType: 'factory',
        department: '',
        isActive: true,
      });
    }
    setErrors({});
  }, [editingUser, visible]);

  // 验证表单
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.username.trim()) {
      newErrors.username = '用户名不能为空';
    } else if (formData.username.length < 3) {
      newErrors.username = '用户名至少3个字符';
    }

    if (!formData.email.trim()) {
      newErrors.email = '邮箱不能为空';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = '邮箱格式不正确';
    }

    if (formData.phone && !/^1[3-9]\d{9}$/.test(formData.phone)) {
      newErrors.phone = '手机号格式不正确';
    }

    if (!formData.fullName?.trim()) {
      newErrors.fullName = '真实姓名不能为空';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 保存用户
  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      
      // 这里应该调用实际的API
      // const savedUser = await UserService.saveUser(formData);
      
      // 模拟保存成功
      const savedUser: User = {
        id: editingUser?.id || `user_${Date.now()}`,
        username: formData.username,
        email: formData.email,
        phone: formData.phone,
        fullName: formData.fullName,
        userType: formData.userType,
        isActive: formData.isActive,
        createdAt: editingUser?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...(formData.userType === 'platform' ? {
          platformUser: {
            role: formData.role,
            permissions: [], // 这里应该从后端获取
          }
        } : {
          factoryUser: {
            role: formData.role,
            department: formData.department,
            factoryId: 'factory_1', // 这里应该从当前用户获取
            permissions: [], // 这里应该从后端获取
          }
        })
      } as User;

      onUserSaved?.(savedUser);
      
      Alert.alert(
        '成功',
        editingUser ? '用户信息已更新' : '用户已创建',
        [{ text: '确定', onPress: onClose }]
      );
    } catch (error) {
      console.error('保存用户失败:', error);
      Alert.alert('错误', '保存用户失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 获取可选择的角色列表
  const getAvailableRoles = (): { value: UserRole; label: string }[] => {
    const roles = [
      { value: USER_ROLES.VIEWER, label: '查看者' },
      { value: USER_ROLES.OPERATOR, label: '操作员' },
      { value: USER_ROLES.DEPARTMENT_ADMIN, label: '部门管理员' },
    ];

    // 根据当前用户权限添加更高级角色
    if (hasPermission('user_manage_factory')) {
      roles.push({ value: USER_ROLES.PERMISSION_ADMIN, label: '权限管理员' });
    }

    if (hasPermission('user_manage_all')) {
      roles.push(
        { value: USER_ROLES.FACTORY_SUPER_ADMIN, label: '工厂超级管理员' },
        { value: USER_ROLES.PLATFORM_ADMIN, label: '平台管理员' },
        { value: USER_ROLES.PLATFORM_OPERATOR, label: '平台操作员' }
      );
    }

    if (currentUser && currentUser.userType === 'platform' && 'platformUser' in currentUser && 
        currentUser.platformUser.role === USER_ROLES.DEVELOPER) {
      roles.push({ value: USER_ROLES.DEVELOPER, label: '系统开发者' });
    }

    return roles;
  };

  const availableRoles = getAvailableRoles();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* 头部 */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>取消</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            {editingUser ? '编辑用户' : '新增用户'}
          </Text>
          <TouchableOpacity 
            style={[styles.saveButton, loading && styles.saveButtonDisabled]} 
            onPress={handleSave}
            disabled={loading}
          >
            <Text style={styles.saveButtonText}>
              {loading ? '保存中...' : '保存'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          
          {/* 基础信息 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>基础信息</Text>
            
            {/* 用户名 */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>用户名 *</Text>
              <TextInput
                style={[styles.input, errors.username && styles.inputError]}
                value={formData.username}
                onChangeText={(text) => setFormData({ ...formData, username: text })}
                placeholder="请输入用户名"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {errors.username && <Text style={styles.errorText}>{errors.username}</Text>}
            </View>

            {/* 邮箱 */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>邮箱 *</Text>
              <TextInput
                style={[styles.input, errors.email && styles.inputError]}
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text })}
                placeholder="请输入邮箱"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>

            {/* 真实姓名 */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>真实姓名 *</Text>
              <TextInput
                style={[styles.input, errors.fullName && styles.inputError]}
                value={formData.fullName}
                onChangeText={(text) => setFormData({ ...formData, fullName: text })}
                placeholder="请输入真实姓名"
              />
              {errors.fullName && <Text style={styles.errorText}>{errors.fullName}</Text>}
            </View>

            {/* 手机号 */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>手机号</Text>
              <TextInput
                style={[styles.input, errors.phone && styles.inputError]}
                value={formData.phone}
                onChangeText={(text) => setFormData({ ...formData, phone: text })}
                placeholder="请输入手机号"
                keyboardType="phone-pad"
              />
              {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
            </View>
          </View>

          {/* 角色信息 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>角色信息</Text>
            
            {/* 用户类型 */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>用户类型</Text>
              <View style={styles.segmentedControl}>
                <TouchableOpacity
                  style={[
                    styles.segmentedButton,
                    formData.userType === 'platform' && styles.segmentedButtonActive
                  ]}
                  onPress={() => setFormData({ ...formData, userType: 'platform', department: '' })}
                >
                  <Text style={[
                    styles.segmentedButtonText,
                    formData.userType === 'platform' && styles.segmentedButtonTextActive
                  ]}>平台用户</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentedButton,
                    formData.userType === 'factory' && styles.segmentedButtonActive
                  ]}
                  onPress={() => setFormData({ ...formData, userType: 'factory' })}
                >
                  <Text style={[
                    styles.segmentedButtonText,
                    formData.userType === 'factory' && styles.segmentedButtonTextActive
                  ]}>工厂用户</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 角色选择 */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>用户角色</Text>
              <View style={styles.roleGrid}>
                {availableRoles.map((roleOption) => (
                  <TouchableOpacity
                    key={roleOption.value}
                    style={[
                      styles.roleCard,
                      formData.role === roleOption.value && styles.roleCardActive
                    ]}
                    onPress={() => setFormData({ ...formData, role: roleOption.value })}
                  >
                    <Ionicons
                      name={formData.role === roleOption.value ? "checkmark-circle" : "ellipse-outline"}
                      size={20}
                      color={formData.role === roleOption.value ? "#3182ce" : "#9ca3af"}
                    />
                    <Text style={[
                      styles.roleCardText,
                      formData.role === roleOption.value && styles.roleCardTextActive
                    ]}>
                      {roleOption.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 工厂用户部门 */}
            {formData.userType === 'factory' && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>所属部门</Text>
                <TextInput
                  style={styles.input}
                  value={formData.department}
                  onChangeText={(text) => setFormData({ ...formData, department: text })}
                  placeholder="请输入所属部门"
                />
              </View>
            )}
          </View>

          {/* 状态设置 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>账户状态</Text>
            <TouchableOpacity 
              style={styles.statusToggle}
              onPress={() => setFormData({ ...formData, isActive: !formData.isActive })}
            >
              <View style={styles.statusToggleContent}>
                <Ionicons 
                  name={formData.isActive ? "checkmark-circle" : "close-circle"} 
                  size={24} 
                  color={formData.isActive ? "#10b981" : "#ef4444"} 
                />
                <View style={styles.statusToggleText}>
                  <Text style={styles.statusToggleTitle}>账户状态</Text>
                  <Text style={styles.statusToggleSubtitle}>
                    {formData.isActive ? '账户已激活，可以正常使用系统' : '账户已禁用，无法登录系统'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#6b7280',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  saveButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#3182ce',
    borderRadius: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    marginTop: 4,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    overflow: 'hidden',
  },
  segmentedButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  segmentedButtonActive: {
    backgroundColor: '#3182ce',
  },
  segmentedButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  segmentedButtonTextActive: {
    color: '#fff',
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  roleCard: {
    width: '50%',
    paddingHorizontal: 6,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
  },
  roleCardActive: {
    // Active styles handled by inner content
  },
  roleCardText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
    flex: 1,
  },
  roleCardTextActive: {
    color: '#3182ce',
    fontWeight: '500',
  },
  statusToggle: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
  },
  statusToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusToggleText: {
    flex: 1,
    marginLeft: 12,
  },
  statusToggleTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  statusToggleSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
});