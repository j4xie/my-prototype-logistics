import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  Dimensions,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRegister } from '../../hooks/useRegister';
import { RegisterRequest } from '../../types/auth';

const { width, height } = Dimensions.get('window');

interface RegisterScreenProps {
  navigation: any;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
  // 第一步：手机验证相关状态
  const [phoneNumber, setPhoneNumber] = useState('');

  // 第二步：信息填写相关状态
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [realName, setRealName] = useState('');
  const [factoryId, setFactoryId] = useState('');
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');
  const [email, setEmail] = useState('');

  // UI状态
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // 使用注册hook
  const {
    verifyPhoneNumber,
    register,
    isLoading,
    error,
    currentStep,
    tempToken,
    clearError,
    resetForm
  } = useRegister();

  /**
   * 处理验证手机号码 - 直接提交手机号，不需要验证码
   */
  const handleVerifyPhone = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert('提示', '请输入手机号码');
      return;
    }

    const result = await verifyPhoneNumber(phoneNumber);
    if (result.success && result.tempToken) {
      // 自动切换到第二步
      clearError();
    }
  };

  /**
   * 处理完成注册
   */
  const handleRegister = async () => {
    // 验证所有必需字段
    if (!username.trim()) {
      Alert.alert('提示', '请输入用户名');
      return;
    }

    if (!password.trim()) {
      Alert.alert('提示', '请输入密码');
      return;
    }

    if (password.length < 6) {
      Alert.alert('提示', '密码长度必须至少6个字符');
      return;
    }

    if (!confirmPassword.trim()) {
      Alert.alert('提示', '请确认密码');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('提示', '两次输入的密码不一致');
      return;
    }

    if (!realName.trim()) {
      Alert.alert('提示', '请输入真实姓名');
      return;
    }

    if (!factoryId.trim()) {
      Alert.alert('提示', '请输入工厂ID');
      return;
    }

    if (!tempToken) {
      Alert.alert('错误', '手机验证信息已过期，请重新验证');
      return;
    }

    clearError();

    // 构建注册请求
    const registerRequest: RegisterRequest = {
      tempToken: tempToken,
      username: username.trim(),
      password: password.trim(),
      realName: realName.trim(),
      factoryId: factoryId.trim(),
      department: department.trim() || undefined,
      position: position.trim() || undefined,
      email: email.trim() || undefined
    };

    try {
      const success = await register(registerRequest);
      if (success) {
        // 注册成功，导航到登录页面
        navigation.navigate('LoginScreen');
      }
    } catch (err) {
      console.error('注册过程中出错:', err);
    }
  };

  /**
   * 返回登录页面
   */
  const handleBack = () => {
    if (currentStep === 'info') {
      // 在第二步时，返回第一步
      resetForm();
    } else {
      // 在第一步时，返回登录页面
      navigation.goBack();
    }
  };

  /**
   * 渲染第一步：手机验证
   */
  const renderPhoneVerification = () => {
    return (
      <View style={styles.stepContainer}>
        <View style={styles.stepHeader}>
          <Text style={styles.stepTitle}>步骤 1/2</Text>
          <Text style={styles.stepDescription}>手机验证</Text>
        </View>

        {/* 手机号输入 */}
        <View style={styles.inputContainer}>
          <Ionicons name="phone-portrait" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="请输入手机号码"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            autoComplete="tel"
            editable={!isLoading}
            onSubmitEditing={handleVerifyPhone}
            returnKeyType="done"
          />
        </View>

        {/* 提示信息 */}
        <View style={styles.hintContainer}>
          <Ionicons name="information-circle" size={16} color="#666" />
          <Text style={styles.hintText}>系统将自动验证手机号是否在白名单中</Text>
        </View>

        {/* 错误信息 */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={20} color="#FF6B6B" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* 验证按钮 */}
        <TouchableOpacity
          style={[styles.nextButton, isLoading && styles.nextButtonDisabled]}
          onPress={handleVerifyPhone}
          disabled={isLoading || !phoneNumber.trim()}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.nextButtonText}>验证手机</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  /**
   * 渲染第二步：完整信息
   */
  const renderInfoForm = () => {
    return (
      <View style={styles.stepContainer}>
        <View style={styles.stepHeader}>
          <Text style={styles.stepTitle}>步骤 2/2</Text>
          <Text style={styles.stepDescription}>填写完整信息</Text>
        </View>

        {/* 用户名 */}
        <View style={styles.inputContainer}>
          <Ionicons name="person" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="用户名"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
          />
        </View>

        {/* 真实姓名 */}
        <View style={styles.inputContainer}>
          <Ionicons name="card" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="真实姓名"
            value={realName}
            onChangeText={setRealName}
            editable={!isLoading}
          />
        </View>

        {/* 工厂ID */}
        <View style={styles.inputContainer}>
          <Ionicons name="factory" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="工厂ID (必需)"
            value={factoryId}
            onChangeText={setFactoryId}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!isLoading}
          />
        </View>

        {/* 部门 */}
        <View style={styles.inputContainer}>
          <Ionicons name="briefcase" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="部门 (可选)"
            value={department}
            onChangeText={setDepartment}
            editable={!isLoading}
          />
        </View>

        {/* 职位 */}
        <View style={styles.inputContainer}>
          <Ionicons name="shield" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="职位 (可选)"
            value={position}
            onChangeText={setPosition}
            editable={!isLoading}
          />
        </View>

        {/* 邮箱 */}
        <View style={styles.inputContainer}>
          <Ionicons name="mail" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="邮箱 (可选)"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoComplete="email"
            editable={!isLoading}
          />
        </View>

        {/* 密码 */}
        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="密码"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete="password"
            editable={!isLoading}
          />
          <TouchableOpacity
            style={styles.eyeIcon}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Ionicons
              name={showPassword ? "eye-off" : "eye"}
              size={20}
              color="#666"
            />
          </TouchableOpacity>
        </View>

        {/* 确认密码 */}
        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="确认密码"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
            autoComplete="password"
            editable={!isLoading}
          />
          <TouchableOpacity
            style={styles.eyeIcon}
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
          >
            <Ionicons
              name={showConfirmPassword ? "eye-off" : "eye"}
              size={20}
              color="#666"
            />
          </TouchableOpacity>
        </View>

        {/* 错误信息 */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={20} color="#FF6B6B" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* 注册按钮 */}
        <TouchableOpacity
          style={[styles.nextButton, isLoading && styles.nextButtonDisabled]}
          onPress={handleRegister}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.nextButtonText}>完成注册</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* 返回按钮和标题 */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBack}
            >
              <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>用户注册</Text>
            <View style={{ width: 44 }} />
          </View>

          {/* Logo和标题 */}
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Ionicons name="person-add" size={40} color="#FFFFFF" />
            </View>
            <Text style={styles.title}>创建账户</Text>
            <Text style={styles.subtitle}>加入白垩纪食品溯源系统</Text>
          </View>

          {/* 表单容器 */}
          <View style={styles.formContainer}>
            {currentStep === 'phone' ? renderPhoneVerification() : renderInfoForm()}
          </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    marginTop: 10,
  },
  backButton: {
    padding: 8,
    width: 44,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  stepContainer: {
    width: '100%',
  },
  stepHeader: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  stepTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4ECDC4',
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  eyeIcon: {
    padding: 4,
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  hintText: {
    color: '#666',
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
  },
  nextButton: {
    backgroundColor: '#4ECDC4',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#4ECDC4',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  nextButtonDisabled: {
    backgroundColor: '#CCC',
    shadowOpacity: 0,
    elevation: 0,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default RegisterScreen;
