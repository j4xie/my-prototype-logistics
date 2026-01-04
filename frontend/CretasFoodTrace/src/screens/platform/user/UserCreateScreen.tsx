import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  Text,
  Card,
  Chip,
  IconButton,
  Button,
  TextInput,
  ActivityIndicator,
  HelperText,
  Portal,
  Modal,
  Searchbar,
  Checkbox,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { userApiClient } from '../../../services/api/userApiClient';
import { platformAPI, FactoryDTO } from '../../../services/api/platformApiClient';

// Types
interface Role {
  id: string;
  name: string;
  code: string;
  description: string;
  iconColor: string;
}

interface Factory {
  id: string;
  name: string;
  address: string;
  status: 'active' | 'inactive';
}

interface FormData {
  username: string;
  password: string;
  confirmPassword: string;
  realName: string;
  phone: string;
  email: string;
  selectedRoles: string[];
  selectedFactories: string[];
}

interface FormErrors {
  username?: string;
  password?: string;
  confirmPassword?: string;
  realName?: string;
  phone?: string;
  email?: string;
  roles?: string;
  factories?: string;
}

type UserManagementStackParamList = {
  UserList: undefined;
  UserDetail: { userId: string };
  UserCreate: undefined;
  RoleList: undefined;
  RoleEdit: { roleId?: string };
};

type NavigationProp = NativeStackNavigationProp<UserManagementStackParamList, 'UserCreate'>;

// Static role definitions (roles are system-defined)
const SYSTEM_ROLES: Role[] = [
  {
    id: 'PLATFORM_ADMIN',
    name: '平台管理员',
    code: 'PLATFORM_ADMIN',
    description: '拥有系统最高权限',
    iconColor: '#1a1a2e',
  },
  {
    id: 'FACTORY_SUPER_ADMIN',
    name: '工厂超级管理员',
    code: 'FACTORY_SUPER_ADMIN',
    description: '管理单个工厂的所有业务',
    iconColor: '#ff6b6b',
  },
  {
    id: 'DEPARTMENT_ADMIN',
    name: '部门管理员',
    code: 'DEPARTMENT_ADMIN',
    description: '管理特定部门业务',
    iconColor: '#667eea',
  },
  {
    id: 'OPERATOR',
    name: '操作员',
    code: 'OPERATOR',
    description: '执行具体操作任务',
    iconColor: '#4facfe',
  },
];

// Helper function to convert FactoryDTO to Factory UI type
const convertFactoryDTOToFactory = (dto: FactoryDTO): Factory => ({
  id: dto.id,
  name: dto.factoryName || dto.name || '',
  address: dto.address || '',
  status: dto.status === 'active' || dto.isActive ? 'active' : 'inactive',
});

export default function UserCreateScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation('platform');

  // State
  const [formData, setFormData] = useState<FormData>({
    username: '',
    password: '',
    confirmPassword: '',
    realName: '',
    phone: '',
    email: '',
    selectedRoles: [],
    selectedFactories: [],
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [factoryModalVisible, setFactoryModalVisible] = useState(false);
  const [factorySearchQuery, setFactorySearchQuery] = useState('');

  // Available data
  const [roles, setRoles] = useState<Role[]>([]);
  const [factories, setFactories] = useState<Factory[]>([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      // Use static roles (system-defined)
      setRoles(SYSTEM_ROLES);

      // Load factories from API
      const response = await platformAPI.getFactories();
      if (response.success && response.data) {
        const convertedFactories = response.data.map(convertFactoryDTOToFactory);
        setFactories(convertedFactories);
      }
    } catch (error) {
      if (isAxiosError(error)) {
        Alert.alert('加载失败', error.response?.data?.message || '获取数据失败');
      } else {
        Alert.alert('加载失败', '网络错误，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const validateField = (field: keyof FormData, value: string | string[]) => {
    const newErrors = { ...errors };

    switch (field) {
      case 'username':
        if (!value || (typeof value === 'string' && value.trim().length < 3)) {
          newErrors.username = '用户名至少3个字符';
        } else if (typeof value === 'string' && !/^[a-zA-Z0-9_]+$/.test(value)) {
          newErrors.username = '用户名只能包含字母、数字和下划线';
        } else {
          delete newErrors.username;
        }
        break;
      case 'password':
        if (!value || (typeof value === 'string' && value.length < 6)) {
          newErrors.password = '密码至少6个字符';
        } else {
          delete newErrors.password;
        }
        // Also validate confirmPassword if it has value
        if (formData.confirmPassword && value !== formData.confirmPassword) {
          newErrors.confirmPassword = '两次密码不一致';
        } else if (formData.confirmPassword) {
          delete newErrors.confirmPassword;
        }
        break;
      case 'confirmPassword':
        if (value !== formData.password) {
          newErrors.confirmPassword = '两次密码不一致';
        } else {
          delete newErrors.confirmPassword;
        }
        break;
      case 'realName':
        if (!value || (typeof value === 'string' && value.trim().length < 2)) {
          newErrors.realName = '请输入真实姓名';
        } else {
          delete newErrors.realName;
        }
        break;
      case 'phone':
        if (value && typeof value === 'string' && !/^1[3-9]\d{9}$/.test(value)) {
          newErrors.phone = '请输入有效的手机号';
        } else {
          delete newErrors.phone;
        }
        break;
      case 'email':
        if (value && typeof value === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          newErrors.email = '请输入有效的邮箱地址';
        } else {
          delete newErrors.email;
        }
        break;
      case 'selectedRoles':
        if (!Array.isArray(value) || value.length === 0) {
          newErrors.roles = '请至少选择一个角色';
        } else {
          delete newErrors.roles;
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    validateField(field, value);
  };

  const toggleRole = (roleId: string) => {
    setFormData(prev => {
      const newRoles = prev.selectedRoles.includes(roleId)
        ? prev.selectedRoles.filter(r => r !== roleId)
        : [...prev.selectedRoles, roleId];
      validateField('selectedRoles', newRoles);
      return { ...prev, selectedRoles: newRoles };
    });
  };

  const toggleFactory = (factoryId: string) => {
    setFormData(prev => {
      const newFactories = prev.selectedFactories.includes(factoryId)
        ? prev.selectedFactories.filter(f => f !== factoryId)
        : [...prev.selectedFactories, factoryId];
      return { ...prev, selectedFactories: newFactories };
    });
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.username || formData.username.trim().length < 3) {
      newErrors.username = '用户名至少3个字符';
    }
    if (!formData.password || formData.password.length < 6) {
      newErrors.password = '密码至少6个字符';
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = '两次密码不一致';
    }
    if (!formData.realName || formData.realName.trim().length < 2) {
      newErrors.realName = '请输入真实姓名';
    }
    if (formData.phone && !/^1[3-9]\d{9}$/.test(formData.phone)) {
      newErrors.phone = '请输入有效的手机号';
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = '请输入有效的邮箱地址';
    }
    if (formData.selectedRoles.length === 0) {
      newErrors.roles = '请至少选择一个角色';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('表单错误', '请检查并修正表单中的错误');
      return;
    }

    setSubmitting(true);
    try {
      // Get the primary role (first selected role)
      const primaryRole = formData.selectedRoles[0];

      await userApiClient.createUser({
        username: formData.username,
        password: formData.password,
        realName: formData.realName,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        role: primaryRole ?? '',
        // TODO: Add factory assignment support when API supports it
      });

      Alert.alert('成功', '用户创建成功', [
        { text: '确定', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      if (isAxiosError(error)) {
        Alert.alert('创建失败', error.response?.data?.message || '创建用户失败');
      } else {
        Alert.alert('创建失败', '网络错误，请稍后重试');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    const hasData = formData.username || formData.realName || formData.selectedRoles.length > 0;
    if (hasData) {
      Alert.alert(
        '确认取消',
        '您已填写部分信息，确定要取消吗？',
        [
          { text: '继续编辑', style: 'cancel' },
          { text: '放弃', onPress: () => navigation.goBack() },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  const filteredFactories = factories.filter(f =>
    f.name.toLowerCase().includes(factorySearchQuery.toLowerCase()) ||
    f.address.toLowerCase().includes(factorySearchQuery.toLowerCase())
  );

  const getSelectedRoleNames = () => {
    return roles
      .filter(r => formData.selectedRoles.includes(r.id))
      .map(r => r.name)
      .join('、');
  };

  const getSelectedFactoryNames = () => {
    return factories
      .filter(f => formData.selectedFactories.includes(f.id))
      .map(f => f.name)
      .join('、');
  };

  if (loading) {
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
            <Text style={styles.headerTitle}>创建用户</Text>
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
          <Text style={styles.headerTitle}>创建用户</Text>
          <View style={{ width: 48 }} />
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {/* Basic Info Card */}
        <Card style={styles.sectionCard} mode="elevated">
          <Text style={styles.sectionTitle}>基本信息</Text>

          <TextInput
            label="用户名 *"
            value={formData.username}
            onChangeText={v => handleInputChange('username', v)}
            mode="outlined"
            style={styles.input}
            error={!!errors.username}
            autoCapitalize="none"
            left={<TextInput.Icon icon="account" />}
          />
          <HelperText type="error" visible={!!errors.username}>
            {errors.username}
          </HelperText>

          <TextInput
            label="密码 *"
            value={formData.password}
            onChangeText={v => handleInputChange('password', v)}
            mode="outlined"
            style={styles.input}
            error={!!errors.password}
            secureTextEntry={!showPassword}
            left={<TextInput.Icon icon="lock" />}
            right={
              <TextInput.Icon
                icon={showPassword ? 'eye-off' : 'eye'}
                onPress={() => setShowPassword(!showPassword)}
              />
            }
          />
          <HelperText type="error" visible={!!errors.password}>
            {errors.password}
          </HelperText>

          <TextInput
            label="确认密码 *"
            value={formData.confirmPassword}
            onChangeText={v => handleInputChange('confirmPassword', v)}
            mode="outlined"
            style={styles.input}
            error={!!errors.confirmPassword}
            secureTextEntry={!showConfirmPassword}
            left={<TextInput.Icon icon="lock-check" />}
            right={
              <TextInput.Icon
                icon={showConfirmPassword ? 'eye-off' : 'eye'}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              />
            }
          />
          <HelperText type="error" visible={!!errors.confirmPassword}>
            {errors.confirmPassword}
          </HelperText>

          <TextInput
            label="真实姓名 *"
            value={formData.realName}
            onChangeText={v => handleInputChange('realName', v)}
            mode="outlined"
            style={styles.input}
            error={!!errors.realName}
            left={<TextInput.Icon icon="badge-account-horizontal" />}
          />
          <HelperText type="error" visible={!!errors.realName}>
            {errors.realName}
          </HelperText>

          <TextInput
            label="手机号"
            value={formData.phone}
            onChangeText={v => handleInputChange('phone', v)}
            mode="outlined"
            style={styles.input}
            error={!!errors.phone}
            keyboardType="phone-pad"
            left={<TextInput.Icon icon="phone" />}
          />
          <HelperText type="error" visible={!!errors.phone}>
            {errors.phone}
          </HelperText>

          <TextInput
            label="邮箱"
            value={formData.email}
            onChangeText={v => handleInputChange('email', v)}
            mode="outlined"
            style={styles.input}
            error={!!errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            left={<TextInput.Icon icon="email" />}
          />
          <HelperText type="error" visible={!!errors.email}>
            {errors.email}
          </HelperText>
        </Card>

        {/* Role Selection Card */}
        <Card style={styles.sectionCard} mode="elevated">
          <Text style={styles.sectionTitle}>角色分配 *</Text>

          <TouchableOpacity
            style={[styles.selectionButton, errors.roles && styles.selectionButtonError]}
            onPress={() => setRoleModalVisible(true)}
          >
            <View style={styles.selectionContent}>
              <IconButton icon="shield-account" size={20} iconColor="#1890ff" />
              <View style={styles.selectionInfo}>
                <Text style={styles.selectionLabel}>选择角色</Text>
                <Text
                  style={[
                    styles.selectionValue,
                    !formData.selectedRoles.length && styles.selectionPlaceholder,
                  ]}
                  numberOfLines={2}
                >
                  {formData.selectedRoles.length
                    ? getSelectedRoleNames()
                    : '请选择用户角色'}
                </Text>
              </View>
            </View>
            <IconButton icon="chevron-right" size={20} iconColor="#8c8c8c" />
          </TouchableOpacity>
          <HelperText type="error" visible={!!errors.roles}>
            {errors.roles}
          </HelperText>

          {/* Selected Roles Preview */}
          {formData.selectedRoles.length > 0 && (
            <View style={styles.selectedItems}>
              {roles
                .filter(r => formData.selectedRoles.includes(r.id))
                .map(role => (
                  <Chip
                    key={role.id}
                    mode="flat"
                    style={[styles.selectedChip, { backgroundColor: `${role.iconColor}15` }]}
                    textStyle={{ color: role.iconColor, fontSize: 12 }}
                    onClose={() => toggleRole(role.id)}
                  >
                    {role.name}
                  </Chip>
                ))}
            </View>
          )}
        </Card>

        {/* Factory Assignment Card */}
        <Card style={styles.sectionCard} mode="elevated">
          <Text style={styles.sectionTitle}>工厂分配</Text>

          <TouchableOpacity
            style={styles.selectionButton}
            onPress={() => setFactoryModalVisible(true)}
          >
            <View style={styles.selectionContent}>
              <IconButton icon="factory" size={20} iconColor="#52c41a" />
              <View style={styles.selectionInfo}>
                <Text style={styles.selectionLabel}>选择工厂</Text>
                <Text
                  style={[
                    styles.selectionValue,
                    !formData.selectedFactories.length && styles.selectionPlaceholder,
                  ]}
                  numberOfLines={2}
                >
                  {formData.selectedFactories.length
                    ? getSelectedFactoryNames()
                    : '可选，分配用户到指定工厂'}
                </Text>
              </View>
            </View>
            <IconButton icon="chevron-right" size={20} iconColor="#8c8c8c" />
          </TouchableOpacity>

          {/* Selected Factories Preview */}
          {formData.selectedFactories.length > 0 && (
            <View style={styles.selectedItems}>
              {factories
                .filter(f => formData.selectedFactories.includes(f.id))
                .map(factory => (
                  <Chip
                    key={factory.id}
                    mode="flat"
                    style={styles.factoryChip}
                    textStyle={styles.factoryChipText}
                    onClose={() => toggleFactory(factory.id)}
                  >
                    {factory.name}
                  </Chip>
                ))}
            </View>
          )}
        </Card>

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
          onPress={handleSubmit}
          style={[styles.actionButton, styles.submitButton]}
          loading={submitting}
          disabled={submitting}
        >
          创建用户
        </Button>
      </View>

      {/* Role Selection Modal */}
      <Portal>
        <Modal
          visible={roleModalVisible}
          onDismiss={() => setRoleModalVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.modalTitle}>选择角色</Text>
          <Text style={styles.modalSubtitle}>可多选，用户将获得所选角色的权限</Text>

          <ScrollView style={styles.modalList}>
            {roles.map(role => (
              <TouchableOpacity
                key={role.id}
                style={styles.modalItem}
                onPress={() => toggleRole(role.id)}
              >
                <View style={styles.modalItemContent}>
                  <View style={[styles.roleIcon, { backgroundColor: role.iconColor }]}>
                    <Text style={styles.roleIconText}>{role.name.charAt(0)}</Text>
                  </View>
                  <View style={styles.modalItemInfo}>
                    <Text style={styles.modalItemTitle}>{role.name}</Text>
                    <Text style={styles.modalItemDesc}>{role.description}</Text>
                  </View>
                </View>
                <Checkbox
                  status={formData.selectedRoles.includes(role.id) ? 'checked' : 'unchecked'}
                  onPress={() => toggleRole(role.id)}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Button
            mode="contained"
            onPress={() => setRoleModalVisible(false)}
            style={styles.modalButton}
          >
            确定 ({formData.selectedRoles.length})
          </Button>
        </Modal>
      </Portal>

      {/* Factory Selection Modal */}
      <Portal>
        <Modal
          visible={factoryModalVisible}
          onDismiss={() => setFactoryModalVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.modalTitle}>选择工厂</Text>
          <Text style={styles.modalSubtitle}>可多选，分配用户到指定工厂</Text>

          <Searchbar
            placeholder="搜索工厂名称或地址"
            onChangeText={setFactorySearchQuery}
            value={factorySearchQuery}
            style={styles.modalSearchBar}
            inputStyle={styles.modalSearchInput}
          />

          <ScrollView style={styles.modalList}>
            {filteredFactories.map(factory => (
              <TouchableOpacity
                key={factory.id}
                style={styles.modalItem}
                onPress={() => toggleFactory(factory.id)}
              >
                <View style={styles.modalItemContent}>
                  <View style={[styles.factoryIcon, factory.status === 'inactive' && styles.factoryIconInactive]}>
                    <Text style={styles.factoryIconText}>{factory.name.charAt(0)}</Text>
                  </View>
                  <View style={styles.modalItemInfo}>
                    <View style={styles.factoryNameRow}>
                      <Text style={styles.modalItemTitle}>{factory.name}</Text>
                      {factory.status === 'inactive' && (
                        <Chip
                          mode="flat"
                          style={styles.inactiveChip}
                          textStyle={styles.inactiveChipText}
                        >
                          已停用
                        </Chip>
                      )}
                    </View>
                    <Text style={styles.modalItemDesc}>{factory.address}</Text>
                  </View>
                </View>
                <Checkbox
                  status={formData.selectedFactories.includes(factory.id) ? 'checked' : 'unchecked'}
                  onPress={() => toggleFactory(factory.id)}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Button
            mode="contained"
            onPress={() => setFactoryModalVisible(false)}
            style={styles.modalButton}
          >
            确定 ({formData.selectedFactories.length})
          </Button>
        </Modal>
      </Portal>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionCard: {
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#262626',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  input: {
    marginBottom: 4,
    backgroundColor: '#fff',
  },
  selectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 8,
    paddingRight: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectionButtonError: {
    borderColor: '#ff4d4f',
  },
  selectionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectionInfo: {
    flex: 1,
  },
  selectionLabel: {
    fontSize: 12,
    color: '#8c8c8c',
  },
  selectionValue: {
    fontSize: 14,
    color: '#262626',
    marginTop: 2,
  },
  selectionPlaceholder: {
    color: '#bfbfbf',
  },
  selectedItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  selectedChip: {
    height: 28,
  },
  factoryChip: {
    backgroundColor: '#f6ffed',
    height: 28,
  },
  factoryChipText: {
    color: '#52c41a',
    fontSize: 12,
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
  submitButton: {
    flex: 2,
    backgroundColor: '#1a1a2e',
  },
  modalContent: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#8c8c8c',
    marginBottom: 16,
  },
  modalSearchBar: {
    marginBottom: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    elevation: 0,
  },
  modalSearchInput: {
    fontSize: 14,
  },
  modalList: {
    maxHeight: 400,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  roleIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  roleIconText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  factoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#52c41a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  factoryIconInactive: {
    backgroundColor: '#d9d9d9',
  },
  factoryIconText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  modalItemInfo: {
    flex: 1,
  },
  factoryNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalItemTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#262626',
  },
  modalItemDesc: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 2,
  },
  inactiveChip: {
    backgroundColor: '#f5f5f5',
    height: 20,
  },
  inactiveChipText: {
    color: '#8c8c8c',
    fontSize: 10,
  },
  modalButton: {
    marginTop: 16,
    backgroundColor: '#1a1a2e',
  },
});
