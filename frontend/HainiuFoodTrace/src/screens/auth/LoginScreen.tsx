import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  Dimensions,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AuthService } from '../../services/auth/authService';
import { AuthActivationIntegration } from '../../services/auth/authActivationIntegration';
import { usePermission } from '../../hooks/usePermission';

const { width, height } = Dimensions.get('window');

interface LoginScreenProps {
  navigation: any;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [canUseBiometric, setCanUseBiometric] = useState(false);
  const [canUseDeviceLogin, setCanUseDeviceLogin] = useState(false);
  const [integrationStatus, setIntegrationStatus] = useState<any>(null);

  const { refreshPermissions } = usePermission();

  useEffect(() => {
    checkLoginOptions();
  }, []);

  // 检查可用的登录选项
  const checkLoginOptions = async () => {
    try {
      const status = await AuthActivationIntegration.getIntegrationStatus();
      setIntegrationStatus(status);
      setCanUseBiometric(status.canUseBiometric && status.isActivated);
      setCanUseDeviceLogin(status.canUseDeviceLogin);
    } catch (error) {
      console.error('检查登录选项失败:', error);
    }
  };

  // 普通登录
  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('错误', '请输入用户名和密码');
      return;
    }

    setIsLoading(true);
    try {
      const response = await AuthActivationIntegration.smartLogin({
        username: username.trim(),
        password: password.trim(),
      });

      if (response.success) {
        await refreshPermissions();
        Alert.alert('成功', '登录成功', [
          { text: '确定', onPress: () => navigation.replace('Main') }
        ]);
      } else {
        Alert.alert('登录失败', response.message || '用户名或密码错误');
      }
    } catch (error: any) {
      Alert.alert('登录失败', error.message || '网络错误，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 生物识别登录
  const handleBiometricLogin = async () => {
    setIsLoading(true);
    try {
      const response = await AuthActivationIntegration.biometricLoginWithActivation();
      
      if (response.success) {
        await refreshPermissions();
        Alert.alert('成功', '生物识别登录成功', [
          { text: '确定', onPress: () => navigation.replace('Main') }
        ]);
      } else {
        Alert.alert('登录失败', response.message || '生物识别登录失败');
      }
    } catch (error: any) {
      Alert.alert('生物识别登录失败', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 设备绑定登录
  const handleDeviceLogin = async () => {
    setIsLoading(true);
    try {
      const response = await AuthActivationIntegration.deviceBoundLogin();
      
      if (response.success) {
        await refreshPermissions();
        Alert.alert('成功', '设备登录成功', [
          { text: '确定', onPress: () => navigation.replace('Main') }
        ]);
      } else {
        Alert.alert('登录失败', response.message || '设备登录失败');
      }
    } catch (error: any) {
      Alert.alert('设备登录失败', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 跳转到注册页面
  const handleNavigateToRegister = () => {
    navigation.navigate('Register');
  };

  // 跳转到激活页面
  const handleNavigateToActivation = () => {
    navigation.navigate('Activation');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor="#1a365d" />
      
      <LinearGradient
        colors={['#1a365d', '#2c5aa0', '#3182ce']}
        style={styles.gradient}
      >
        {/* Logo 区域 */}
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Ionicons name="restaurant" size={60} color="#fff" />
          </View>
          <Text style={styles.logoText}>海牛食品溯源</Text>
          <Text style={styles.logoSubText}>安全 · 可信 · 溯源</Text>
        </View>

        {/* 登录表单 */}
        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color="#64748b" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="用户名 / 手机号"
              placeholderTextColor="#94a3b8"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#64748b" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="密码"
              placeholderTextColor="#94a3b8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color="#64748b"
              />
            </TouchableOpacity>
          </View>

          {/* 登录按钮 */}
          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            <Text style={styles.loginButtonText}>
              {isLoading ? '登录中...' : '登录'}
            </Text>
          </TouchableOpacity>

          {/* 快捷登录选项 */}
          {(canUseBiometric || canUseDeviceLogin) && (
            <View style={styles.quickLoginContainer}>
              <Text style={styles.quickLoginTitle}>快捷登录</Text>
              <View style={styles.quickLoginButtons}>
                {canUseBiometric && (
                  <TouchableOpacity
                    style={styles.quickLoginButton}
                    onPress={handleBiometricLogin}
                    disabled={isLoading}
                  >
                    <Ionicons name="finger-print" size={24} color="#3182ce" />
                    <Text style={styles.quickLoginText}>生物识别</Text>
                  </TouchableOpacity>
                )}
                
                {canUseDeviceLogin && (
                  <TouchableOpacity
                    style={styles.quickLoginButton}
                    onPress={handleDeviceLogin}
                    disabled={isLoading}
                  >
                    <Ionicons name="phone-portrait" size={24} color="#3182ce" />
                    <Text style={styles.quickLoginText}>设备登录</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* 底部操作 */}
          <View style={styles.bottomActions}>
            <TouchableOpacity onPress={handleNavigateToRegister}>
              <Text style={styles.linkText}>没有账号？立即注册</Text>
            </TouchableOpacity>
            
            {integrationStatus && !integrationStatus.isActivated && (
              <TouchableOpacity onPress={handleNavigateToActivation}>
                <Text style={[styles.linkText, styles.activationText]}>
                  应用未激活，点击激活
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 版本信息 */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>v1.0.0</Text>
        </View>
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
    paddingHorizontal: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: height * 0.1,
    marginBottom: 40,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  logoSubText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  formContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 15,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1e293b',
  },
  eyeIcon: {
    padding: 5,
  },
  loginButton: {
    backgroundColor: '#3182ce',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#3182ce',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  loginButtonDisabled: {
    backgroundColor: '#94a3b8',
    shadowOpacity: 0,
    elevation: 0,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  quickLoginContainer: {
    marginTop: 30,
    alignItems: 'center',
  },
  quickLoginTitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
  },
  quickLoginButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 30,
  },
  quickLoginButton: {
    alignItems: 'center',
    padding: 10,
  },
  quickLoginText: {
    fontSize: 12,
    color: '#3182ce',
    marginTop: 4,
  },
  bottomActions: {
    marginTop: 30,
    alignItems: 'center',
    gap: 12,
  },
  linkText: {
    fontSize: 14,
    color: '#3182ce',
  },
  activationText: {
    color: '#f59e0b',
    fontWeight: '500',
  },
  versionContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  versionText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
});