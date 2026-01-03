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
import { useTranslation } from 'react-i18next';

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

const getRoles = (t: any): Role[] => [
  { code: 'worker', name: t('staff.add.roles.worker') },
  { code: 'team_leader', name: t('staff.add.roles.teamLeader') },
  { code: 'department_admin', name: t('staff.add.roles.departmentAdmin') },
  { code: 'quality_inspector', name: t('staff.add.roles.qualityInspector') },
  { code: 'warehouse_keeper', name: t('staff.add.roles.warehouseKeeper') },
];

export default function StaffAddScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation('hr');
  const ROLES = getRoles(t);
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
    roleName: t('staff.add.roles.worker'),
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
      newErrors.username = t('staff.add.validation.usernameRequired');
    } else if (formData.username.length < 3) {
      newErrors.username = t('staff.add.validation.usernameMinLength');
    }

    if (!formData.fullName.trim()) {
      newErrors.fullName = t('staff.add.validation.nameRequired');
    }

    if (!formData.phone.trim()) {
      newErrors.phone = t('staff.add.validation.phoneRequired');
    } else if (!/^1\d{10}$/.test(formData.phone)) {
      newErrors.phone = t('staff.add.validation.phoneInvalid');
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('staff.add.validation.emailInvalid');
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
        Alert.alert(t('messages.success'), t('staff.add.successMessage'), [
          { text: t('common.confirm'), onPress: () => navigation.goBack() },
        ]);
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : t('staff.add.failed');
      Alert.alert(t('messages.error'), errMsg);
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
        <Text style={styles.headerTitle}>{t('staff.add.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('staff.add.sections.basicInfo')}</Text>

            <TextInput
              label={t('staff.add.fields.username')}
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
              label={t('staff.add.fields.fullName')}
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
              label={t('staff.add.fields.phone')}
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
              label={t('staff.add.fields.email')}
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
            <Text style={styles.sectionTitle}>{t('staff.add.sections.workInfo')}</Text>

            <Menu
              visible={deptMenuVisible}
              onDismiss={() => setDeptMenuVisible(false)}
              anchor={
                <TouchableOpacity
                  style={styles.selectButton}
                  onPress={() => setDeptMenuVisible(true)}
                >
                  <Text style={formData.departmentName ? styles.selectText : styles.selectPlaceholder}>
                    {formData.departmentName || t('staff.add.selectDepartment')}
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
              label={t('staff.add.fields.position')}
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
              {t('staff.add.submit')}
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
