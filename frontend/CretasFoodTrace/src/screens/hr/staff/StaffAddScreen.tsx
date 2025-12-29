/**
 * 添加员工
 *
 * 功能:
 * - 员工信息表单
 * - 部门选择
 * - 角色分配
 *
 * 对应原型: /docs/prd/prototype/hr-admin/staff-add.html
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text, TextInput, Button, ActivityIndicator, Menu } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { userApiClient } from '../../../services/api/userApiClient';
import { departmentApiClient } from '../../../services/api/departmentApiClient';
import { HR_THEME } from '../../../types/hrNavigation';

interface Department {
  id: string;
  name: string;
}

interface Role {
  code: string;
  name: string;
}

const ROLES: Role[] = [
  { code: 'worker', name: '普通员工' },
  { code: 'team_leader', name: '班组长' },
  { code: 'department_admin', name: '部门管理员' },
  { code: 'quality_inspector', name: '质检员' },
  { code: 'warehouse_keeper', name: '仓库管理员' },
];

export default function StaffAddScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptMenuVisible, setDeptMenuVisible] = useState(false);
  const [roleMenuVisible, setRoleMenuVisible] = useState(false);

  const [formData, setFormData] = useState({
    username: '',
    fullName: '',
    phone: '',
    email: '',
    departmentId: '',
    departmentName: '',
    roleCode: 'worker',
    roleName: '普通员工',
    position: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      const res = await departmentApiClient.getDepartments();
      // getDepartments returns ApiResponse<PagedResponse<DepartmentDTO>>
      if (res?.data?.content) {
        setDepartments(res.data.content
          .filter((d) => d.id !== undefined)
          .map((d) => ({ id: String(d.id), name: d.name }))
        );
      }
    } catch (error) {
      console.error('加载部门列表失败:', error);
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.username.trim()) {
      newErrors.username = '请输入用户名';
    } else if (formData.username.length < 3) {
      newErrors.username = '用户名至少3个字符';
    }

    if (!formData.fullName.trim()) {
      newErrors.fullName = '请输入姓名';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = '请输入手机号';
    } else if (!/^1\d{10}$/.test(formData.phone)) {
      newErrors.phone = '请输入有效的手机号';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = '请输入有效的邮箱';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await userApiClient.createUser({
        username: formData.username,
        realName: formData.fullName, // API uses realName
        phone: formData.phone,
        email: formData.email || undefined,
        department: formData.departmentId || undefined, // API uses 'department' string field
        role: formData.roleCode,
        position: formData.position || undefined,
        password: '123456', // 默认密码
      });

      // API 直接返回 UserDTO，创建成功即返回数据
      if (res) {
        Alert.alert('成功', '员工添加成功，默认密码为 123456', [
          { text: '确定', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : '添加失败，请重试';
      Alert.alert('错误', errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={HR_THEME.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>添加员工</Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>基本信息</Text>

            <TextInput
              label="用户名 *"
              value={formData.username}
              onChangeText={(text) => setFormData({ ...formData, username: text })}
              mode="outlined"
              style={styles.input}
              error={!!errors.username}
              outlineColor={HR_THEME.border}
              activeOutlineColor={HR_THEME.primary}
            />
            {errors.username && <Text style={styles.errorText}>{errors.username}</Text>}

            <TextInput
              label="姓名 *"
              value={formData.fullName}
              onChangeText={(text) => setFormData({ ...formData, fullName: text })}
              mode="outlined"
              style={styles.input}
              error={!!errors.fullName}
              outlineColor={HR_THEME.border}
              activeOutlineColor={HR_THEME.primary}
            />
            {errors.fullName && <Text style={styles.errorText}>{errors.fullName}</Text>}

            <TextInput
              label="手机号 *"
              value={formData.phone}
              onChangeText={(text) => setFormData({ ...formData, phone: text })}
              mode="outlined"
              keyboardType="phone-pad"
              style={styles.input}
              error={!!errors.phone}
              outlineColor={HR_THEME.border}
              activeOutlineColor={HR_THEME.primary}
            />
            {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}

            <TextInput
              label="邮箱"
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              mode="outlined"
              keyboardType="email-address"
              style={styles.input}
              error={!!errors.email}
              outlineColor={HR_THEME.border}
              activeOutlineColor={HR_THEME.primary}
            />
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>工作信息</Text>

            <Menu
              visible={deptMenuVisible}
              onDismiss={() => setDeptMenuVisible(false)}
              anchor={
                <TouchableOpacity
                  style={styles.selectButton}
                  onPress={() => setDeptMenuVisible(true)}
                >
                  <Text style={formData.departmentName ? styles.selectText : styles.selectPlaceholder}>
                    {formData.departmentName || '选择部门'}
                  </Text>
                  <MaterialCommunityIcons name="chevron-down" size={20} color={HR_THEME.textSecondary} />
                </TouchableOpacity>
              }
            >
              {departments.map((dept) => (
                <Menu.Item
                  key={dept.id}
                  onPress={() => {
                    setFormData({
                      ...formData,
                      departmentId: dept.id,
                      departmentName: dept.name,
                    });
                    setDeptMenuVisible(false);
                  }}
                  title={dept.name}
                />
              ))}
            </Menu>

            <Menu
              visible={roleMenuVisible}
              onDismiss={() => setRoleMenuVisible(false)}
              anchor={
                <TouchableOpacity
                  style={styles.selectButton}
                  onPress={() => setRoleMenuVisible(true)}
                >
                  <Text style={styles.selectText}>{formData.roleName}</Text>
                  <MaterialCommunityIcons name="chevron-down" size={20} color={HR_THEME.textSecondary} />
                </TouchableOpacity>
              }
            >
              {ROLES.map((role) => (
                <Menu.Item
                  key={role.code}
                  onPress={() => {
                    setFormData({
                      ...formData,
                      roleCode: role.code,
                      roleName: role.name,
                    });
                    setRoleMenuVisible(false);
                  }}
                  title={role.name}
                />
              ))}
            </Menu>

            <TextInput
              label="职位"
              value={formData.position}
              onChangeText={(text) => setFormData({ ...formData, position: text })}
              mode="outlined"
              style={styles.input}
              outlineColor={HR_THEME.border}
              activeOutlineColor={HR_THEME.primary}
            />
          </View>

          <View style={styles.buttonContainer}>
            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={loading}
              disabled={loading}
              style={styles.submitButton}
              buttonColor={HR_THEME.primary}
            >
              添加员工
            </Button>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: HR_THEME.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: HR_THEME.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: HR_THEME.border,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: HR_THEME.textPrimary,
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: HR_THEME.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: HR_THEME.textPrimary,
    marginBottom: 16,
  },
  input: {
    marginBottom: 12,
    backgroundColor: HR_THEME.cardBackground,
  },
  errorText: {
    color: HR_THEME.danger,
    fontSize: 12,
    marginTop: -8,
    marginBottom: 8,
    marginLeft: 4,
  },
  selectButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: HR_THEME.border,
    borderRadius: 4,
    padding: 16,
    marginBottom: 12,
  },
  selectText: {
    fontSize: 16,
    color: HR_THEME.textPrimary,
  },
  selectPlaceholder: {
    fontSize: 16,
    color: HR_THEME.textMuted,
  },
  buttonContainer: {
    marginTop: 8,
  },
  submitButton: {
    paddingVertical: 6,
    borderRadius: 8,
  },
  bottomSpacer: {
    height: 40,
  },
});
