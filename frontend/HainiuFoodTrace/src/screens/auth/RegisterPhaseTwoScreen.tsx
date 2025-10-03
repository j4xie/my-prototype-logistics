import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { AuthService } from '../../services/auth/authService';
import { useAuthStore } from '../../store/authStore';

interface RegisterPhaseTwoScreenProps {
  navigation: any;
  route: any;
}

export const RegisterPhaseTwoScreen: React.FC<RegisterPhaseTwoScreenProps> = ({ navigation, route }) => {
  const { login } = useAuthStore();
  const { phoneNumber, tempToken, factoryId, whitelistInfo } = route.params;

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    email: '',
    department: '',
    position: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // 部门列表（实际应该从后端获取）
  const departments = [
    { label: '请选择部门', value: '' },
    { label: '生产部', value: 'production' },
    { label: '质检部', value: 'quality' },
    { label: '仓储部', value: 'warehouse' },
    { label: '采购部', value: 'procurement' },
    { label: '销售部', value: 'sales' },
    { label: '行政部', value: 'admin' },
  ];

  // 验证表单
  const validateForm = (): boolean => {
    if (!formData.username || formData.username.length < 3) {
      Alert.alert('提示', '用户名至少需要3个字符');
      return false;
    }

    if (!formData.password || formData.password.length < 6) {
      Alert.alert('提示', '密码至少需要6个字符');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert('提示', '两次输入的密码不一致');
      return false;
    }

    if (!formData.fullName) {
      Alert.alert('提示', '请输入真实姓名');
      return false;
    }

    if (!formData.email || !/^\S+@\S+\.\S+$/.test(formData.email)) {
      Alert.alert('提示', '请输入有效的邮箱地址');
      return false;
    }

    if (!formData.department) {
      Alert.alert('提示', '请选择所属部门');
      return false;
    }

    return true;
  };

  // 提交注册
  const handleRegister = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      // 调用注册第二阶段API
      const result = await AuthService.registerPhaseTwo({
        tempToken,
        phoneNumber,
        ...formData,
        factoryId,
      });

      if (result.success) {
        Alert.alert(
          '注册成功',
          '您的账号已创建成功，将自动为您登录',
          [
            {
              text: '确定',
              onPress: async () => {
                // 自动登录
                if (result.user && result.tokens) {
                  await login(result.user, result.tokens);
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Main' }],
                  });
                } else {
                  // 如果没有返回登录信息，跳转到登录页
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Login' }],
                  });
                }
              },
            },
          ],
        );
      } else {
        Alert.alert('注册失败', result.message || '注册失败，请稍后重试');
      }
    } catch (error) {
      console.error('注册失败:', error);
      Alert.alert('错误', '网络请求失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const updateFormData = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  return (
    <LinearGradient
      colors={['#1a365d', '#2c5aa0', '#3182ce']}
      style={styles.container}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* 头部 */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.logoContainer}>
              <Ionicons name="person-add" size={60} color="#fff" />
            </View>
            <Text style={styles.title}>完善信息</Text>
            <Text style={styles.subtitle}>第二步：填写账号信息</Text>
          </View>

          {/* 白名单信息提示 */}
          {whitelistInfo && (
            <View style={styles.whitelistInfo}>
              <Ionicons name="shield-checkmark" size={20} color="#10b981" />
              <Text style={styles.whitelistText}>
                您已通过白名单验证，角色：{whitelistInfo.role}
              </Text>
            </View>
          )}

          {/* 表单区域 */}
          <View style={styles.formContainer}>
            {/* 用户名 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>用户名 *</Text>
              <TextInput
                style={styles.input}
                placeholder="请输入用户名"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={formData.username}
                onChangeText={(value) => updateFormData('username', value)}
                autoCapitalize="none"
              />
            </View>

            {/* 密码 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>密码 *</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="请输入密码（至少6位）"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  value={formData.password}
                  onChangeText={(value) => updateFormData('password', value)}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color="rgba(255,255,255,0.7)"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* 确认密码 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>确认密码 *</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="请再次输入密码"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  value={formData.confirmPassword}
                  onChangeText={(value) => updateFormData('confirmPassword', value)}
                  secureTextEntry={!showConfirmPassword}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color="rgba(255,255,255,0.7)"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* 真实姓名 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>真实姓名 *</Text>
              <TextInput
                style={styles.input}
                placeholder="请输入真实姓名"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={formData.fullName}
                onChangeText={(value) => updateFormData('fullName', value)}
              />
            </View>

            {/* 邮箱 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>邮箱 *</Text>
              <TextInput
                style={styles.input}
                placeholder="请输入邮箱地址"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={formData.email}
                onChangeText={(value) => updateFormData('email', value)}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* 部门选择 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>所属部门 *</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={formData.department}
                  onValueChange={(value) => updateFormData('department', value)}
                  style={styles.picker}
                  dropdownIconColor="rgba(255,255,255,0.7)"
                >
                  {departments.map((dept) => (
                    <Picker.Item
                      key={dept.value}
                      label={dept.label}
                      value={dept.value}
                      color="#1a365d"
                    />
                  ))}
                </Picker>
              </View>
            </View>

            {/* 职位 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>职位</Text>
              <TextInput
                style={styles.input}
                placeholder="请输入职位（选填）"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={formData.position}
                onChangeText={(value) => updateFormData('position', value)}
              />
            </View>

            {/* 注册按钮 */}
            <TouchableOpacity
              style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#1a365d" />
              ) : (
                <Text style={styles.buttonText}>完成注册</Text>
              )}
            </TouchableOpacity>

            {/* 提示信息 */}
            <Text style={styles.tipText}>
              注册即表示您同意我们的服务条款和隐私政策
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  backButton: {
    position: 'absolute',
    left: 20,
    top: 50,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
  },
  whitelistInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    marginHorizontal: 30,
    marginBottom: 20,
    padding: 12,
    borderRadius: 8,
  },
  whitelistText: {
    flex: 1,
    fontSize: 14,
    color: '#fff',
    marginLeft: 8,
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: 30,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 8,
  },
  input: {
    height: 50,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#fff',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  passwordInput: {
    flex: 1,
    height: 50,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#fff',
  },
  eyeButton: {
    padding: 12,
  },
  pickerContainer: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    color: '#1a365d',
  },
  primaryButton: {
    height: 50,
    backgroundColor: '#fff',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a365d',
  },
  tipText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 18,
  },
});