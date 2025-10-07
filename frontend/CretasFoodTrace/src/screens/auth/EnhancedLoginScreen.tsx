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
  ScrollView,
  Dimensions,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLogin } from '../../hooks/useLogin';
import {
  NetworkManagerInstance as NetworkManager
} from '../../services/serviceFactory';
import { getPostLoginRoute } from '../../utils/navigationHelper';
import { useAuthStore } from '../../store/authStore';

const { width, height } = Dimensions.get('window');

interface LoginScreenProps {
  navigation: any;
}

export const EnhancedLoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const {
    login,
    biometricLogin,
    autoLogin,
    isLoading,
    error,
    retryCount,
    networkStatus,
    biometricStatus,
    userIdentification,
    clearError,
    retry,
    enableBiometricLogin,
  } = useLogin({
    enableBiometric: true,
    enableAutoLogin: true,
    maxRetries: 3,
  });

  // 组件挂载时尝试自动登录
  useEffect(() => {
    const attemptAutoLogin = async () => {
      try {
        const success = await autoLogin();
        if (success) {
          navigateToMain();
        }
      } catch (error) {
        // 自动登录失败是正常的(token过期等),静默处理
        // 不打印错误,用户可以手动登录
      }
    };

    attemptAutoLogin();
  }, []);

  // 监听用户名变化（已简化，删除了智能识别功能）
  // useEffect(() => {
  //   // 已删除UserIdentificationService
  // }, [username]);

  /**
   * 处理普通登录
   */
  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('提示', '请输入用户名和密码');
      return;
    }

    clearError();

    try {
      const success = await login({
        username: username.trim(),
        password: password.trim(),
        rememberMe,
        biometricEnabled: rememberMe && biometricStatus.available,
      });

      if (success) {
        navigateToMain();
      }
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  /**
   * 处理生物识别登录
   */
  const handleBiometricLogin = async () => {
    if (!biometricStatus.available) {
      Alert.alert('提示', '设备不支持生物识别功能');
      return;
    }

    if (!biometricStatus.enabled) {
      Alert.alert('提示', '生物识别登录未启用，请先进行普通登录');
      return;
    }

    try {
      const success = await biometricLogin({
        promptMessage: `使用${biometricStatus.type}快速登录`,
        cancelButtonText: '取消',
        fallbackToDevicePasscode: true,
      });

      if (success) {
        navigateToMain();
      }
    } catch (error: any) {
      Alert.alert('生物识别登录失败', error.message);
    }
  };

  /**
   * 导航到主界面 - 基于角色的智能路由
   */
  const navigateToMain = () => {
    // 从authStore获取当前用户信息
    const { user } = useAuthStore.getState();

    if (!user) {
      console.error('No user found after login');
      Alert.alert('错误', '登录状态异常,请重试');
      return;
    }

    // 根据用户角色获取目标路由
    const route = getPostLoginRoute(user);

    // 由于AppNavigator会根据isAuthenticated自动切换到Main
    // 这里不需要手动导航,authStore的更新会触发导航器切换
    console.log('Login successful, navigating to:', route);
  };


  /**
   * 显示网络状态指示器
   */
  const renderNetworkStatus = () => {
    if (networkStatus === 'offline') {
      return (
        <View style={styles.networkStatus}>
          <Ionicons name="cloud-offline" size={16} color="#FF6B6B" />
          <Text style={styles.networkStatusText}>网络离线</Text>
        </View>
      );
    }

    if (networkStatus === 'checking') {
      return (
        <View style={styles.networkStatus}>
          <ActivityIndicator size="small" color="#4ECDC4" />
          <Text style={styles.networkStatusText}>检查网络...</Text>
        </View>
      );
    }

    return (
      <View style={styles.networkStatus}>
        <Ionicons name="cloud-done" size={16} color="#4ECDC4" />
        <Text style={[styles.networkStatusText, { color: '#4ECDC4' }]}>网络正常</Text>
      </View>
    );
  };

  /**
   * 渲染用户识别提示
   * 已禁用 - UserIdentificationService 未实现
   */
  const renderUserIdentificationHint = () => {
    // 功能已禁用
    return null;
  };

  /**
   * 渲染错误信息
   */
  const renderError = () => {
    if (!error) return null;

    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={20} color="#FF6B6B" />
        <Text style={styles.errorText}>{error}</Text>
        {retryCount > 0 && (
          <TouchableOpacity style={styles.retryButton} onPress={retry}>
            <Text style={styles.retryText}>重试</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  /**
   * 渲染生物识别登录按钮
   */
  const renderBiometricButton = () => {
    if (!biometricStatus.available) return null;

    return (
      <TouchableOpacity
        style={[
          styles.biometricButton,
          !biometricStatus.enabled && styles.biometricButtonDisabled
        ]}
        onPress={handleBiometricLogin}
        disabled={!biometricStatus.enabled || isLoading}
      >
        <Ionicons 
          name="finger-print" 
          size={24} 
          color={biometricStatus.enabled ? '#4ECDC4' : '#999'} 
        />
        <Text style={[
          styles.biometricText,
          !biometricStatus.enabled && styles.biometricTextDisabled
        ]}>
          {biometricStatus.enabled ? `使用${biometricStatus.type}登录` : `${biometricStatus.type}未启用`}
        </Text>
      </TouchableOpacity>
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
          {/* 网络状态 */}
          {renderNetworkStatus()}

          {/* Logo和标题 */}
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Ionicons name="leaf" size={40} color="#FFFFFF" />
            </View>
            <Text style={styles.title}>白垩纪食品溯源</Text>
            <Text style={styles.subtitle}>移动端管理系统</Text>
          </View>

          {/* 登录表单 */}
          <View style={styles.formContainer}>
            {/* 用户名输入 */}
            <View style={styles.inputContainer}>
              <Ionicons name="person" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="用户名"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                editable={!isLoading}
              />
            </View>

            {/* 用户识别提示 */}
            {renderUserIdentificationHint()}

            {/* 密码输入 */}
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

            {/* 记住我选项 */}
            <TouchableOpacity
              style={styles.rememberContainer}
              onPress={() => setRememberMe(!rememberMe)}
              disabled={isLoading}
            >
              <Ionicons
                name={rememberMe ? "checkbox" : "square-outline"}
                size={20}
                color="#4ECDC4"
              />
              <Text style={styles.rememberText}>记住我并启用生物识别登录</Text>
            </TouchableOpacity>

            {/* 错误信息 */}
            {renderError()}

            {/* 登录按钮 */}
            <TouchableOpacity
              style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.loginButtonText}>登录</Text>
              )}
            </TouchableOpacity>

            {/* 生物识别登录 */}
            {renderBiometricButton()}

            {/* 分割线 */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>其他登录方式</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* 快速访问 */}
            <View style={styles.quickAccessContainer}>
              <TouchableOpacity
                style={styles.quickAccessButton}
                onPress={() => navigation.navigate('RegisterScreen')}
              >
                <Ionicons name="person-add" size={20} color="#4ECDC4" />
                <Text style={styles.quickAccessText}>注册账户</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickAccessButton}
                onPress={() => Alert.alert('提示', '请联系系统管理员重置密码')}
              >
                <Ionicons name="help-circle" size={20} color="#4ECDC4" />
                <Text style={styles.quickAccessText}>忘记密码</Text>
              </TouchableOpacity>
            </View>

            {/* 版本信息 */}
            <Text style={styles.versionText}>v1.0.0</Text>
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
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingVertical: 50,
  },
  networkStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    marginBottom: 20,
    alignSelf: 'center',
  },
  networkStatusText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginLeft: 6,
    fontWeight: '500',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 25,
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
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  eyeIcon: {
    padding: 4,
  },
  identificationHint: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
    borderRadius: 8,
    marginBottom: 16,
  },
  identificationText: {
    color: '#333',
    fontSize: 12,
    marginLeft: 6,
    fontWeight: '500',
  },
  rememberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  rememberText: {
    color: '#666',
    fontSize: 14,
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
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  retryButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  loginButton: {
    backgroundColor: '#4ECDC4',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#4ECDC4',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  loginButtonDisabled: {
    backgroundColor: '#CCC',
    shadowOpacity: 0,
    elevation: 0,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#4ECDC4',
  },
  biometricButtonDisabled: {
    backgroundColor: '#F8F9FA',
    borderColor: '#E9ECEF',
  },
  biometricText: {
    color: '#4ECDC4',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  biometricTextDisabled: {
    color: '#999',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E9ECEF',
  },
  dividerText: {
    color: '#666',
    fontSize: 12,
    paddingHorizontal: 15,
  },
  quickAccessContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickAccessButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
  },
  quickAccessText: {
    color: '#4ECDC4',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
  },
  versionText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 12,
    marginTop: 20,
  },
});

export default EnhancedLoginScreen;