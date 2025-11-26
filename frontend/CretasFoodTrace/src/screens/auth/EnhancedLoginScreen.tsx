import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLogin } from '../../hooks/useLogin';
import { getPostLoginRoute } from '../../utils/navigationHelper';
import { useAuthStore } from '../../store/authStore';
import { NeoButton, ScreenWrapper } from '../../components/ui';
import { theme } from '../../theme';
import { logger } from '../../utils/logger';

// 创建LoginScreen专用logger
const loginLogger = logger.createContextLogger('EnhancedLoginScreen');

interface LoginScreenProps {
  navigation: any;
}

// ========== Landing 视图组件 ==========
interface LandingViewProps {
  onLogin: () => void;
  onRegister: () => void;
}

const LandingView: React.FC<LandingViewProps> = ({ onLogin, onRegister }) => {
  return (
    <LinearGradient
      colors={['#2d5016', '#4a7c2c', '#6b9e54']}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.landingContainer}
    >
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      <View style={styles.landingContent}>
        {/* 顶部标题 */}
        <Text style={styles.landingPageTitle}>Landing{'\n'}Page</Text>

        {/* 中间品牌信息 */}
        <View style={styles.brandContainer}>
          <View style={styles.logoCircle}>
            <Ionicons name="leaf" size={56} color="#FFFFFF" />
          </View>
          <Text style={styles.brandTitle}>白垩纪食品溯源</Text>
          <Text style={styles.brandSubtitle}>移动端管理系统</Text>
        </View>

        {/* 底部按钮 */}
        <View style={styles.landingButtons}>
          <TouchableOpacity
            style={styles.landingPrimaryButton}
            onPress={onLogin}
            activeOpacity={0.8}
          >
            <Text style={styles.landingPrimaryButtonText}>登录</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.landingSecondaryButton}
            onPress={onRegister}
            activeOpacity={0.8}
          >
            <Text style={styles.landingSecondaryButtonText}>注册用户</Text>
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
};

// ========== 登录表单视图组件 ==========
interface LoginFormViewProps {
  username: string;
  password: string;
  showPassword: boolean;
  rememberMe: boolean;
  isLoading: boolean;
  error: string | null;
  retryCount: number;
  networkStatus: boolean;
  biometricStatus: { available: boolean; isEnrolled: boolean };
  onUsernameChange: (text: string) => void;
  onPasswordChange: (text: string) => void;
  onTogglePassword: () => void;
  onToggleRememberMe: () => void;
  onLogin: () => void;
  onBiometricLogin: () => void;
  onNavigateRegister: () => void;
  onNavigateForgotPassword: () => void;
  clearError: () => void;
  retry: () => void;
}

const LoginFormView: React.FC<LoginFormViewProps> = ({
  username,
  password,
  showPassword,
  rememberMe,
  isLoading,
  error,
  retryCount,
  networkStatus,
  biometricStatus,
  onUsernameChange,
  onPasswordChange,
  onTogglePassword,
  onToggleRememberMe,
  onLogin,
  onBiometricLogin,
  onNavigateRegister,
  onNavigateForgotPassword,
  clearError,
  retry,
}) => {
  const renderNetworkStatus = () => {
    if (!networkStatus) {
      return (
        <View style={styles.networkStatus}>
          <Ionicons name="cloud-offline" size={16} color={theme.colors.error} />
          <Text style={[styles.networkStatusText, { color: theme.colors.error }]}>网络离线</Text>
        </View>
      );
    }
    return null;
  };

  const renderError = () => {
    if (!error) return null;
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={20} color={theme.colors.error} />
        <Text style={styles.errorText}>{error}</Text>
        {retryCount > 0 && (
          <TouchableOpacity onPress={retry}>
            <Text style={styles.retryText}>重试</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.loginFormContainer}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />

      <ScrollView
        contentContainerStyle={styles.loginFormScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* 顶部标题 */}
        <Text style={styles.loginTitle}>登录</Text>

        {/* 网络状态 */}
        {renderNetworkStatus()}

        {/* 表单卡片 */}
        <View style={styles.formCard}>
          {/* 用户名输入 */}
          <Text style={styles.inputLabel}>用户名</Text>
          <View style={styles.inputContainer}>
            <Ionicons
              name="person-outline"
              size={20}
              color={theme.colors.onSurfaceVariant}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="abc"
              placeholderTextColor={theme.colors.onSurfaceVariant}
              value={username}
              onChangeText={onUsernameChange}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              editable={!isLoading}
            />
          </View>

          {/* 密码输入 */}
          <Text style={styles.inputLabel}>密码</Text>
          <View style={styles.inputContainer}>
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={theme.colors.onSurfaceVariant}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="abc"
              placeholderTextColor={theme.colors.onSurfaceVariant}
              value={password}
              onChangeText={onPasswordChange}
              secureTextEntry={!showPassword}
              autoComplete="password"
              editable={!isLoading}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={onTogglePassword}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={theme.colors.onSurfaceVariant}
              />
            </TouchableOpacity>
          </View>

          {/* 记住我 */}
          <TouchableOpacity
            style={styles.rememberContainer}
            onPress={onToggleRememberMe}
            disabled={isLoading}
          >
            <Ionicons
              name={rememberMe ? "checkbox" : "square-outline"}
              size={20}
              color={rememberMe ? theme.colors.primary : theme.colors.onSurfaceVariant}
            />
            <Text style={styles.rememberText}>记住我并启用生物识别登录</Text>
          </TouchableOpacity>

          {/* 错误提示 */}
          {renderError()}

          {/* 登录按钮 */}
          <TouchableOpacity
            style={[
              styles.loginButton,
              isLoading && styles.loginButtonDisabled,
            ]}
            onPress={onLogin}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.loginButtonText}>登录</Text>
            )}
          </TouchableOpacity>

          {/* 分隔线 */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>其他登录方式</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* 注册和忘记密码按钮 */}
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onNavigateRegister}
          >
            <Text style={styles.secondaryButtonText}>注册用户</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onNavigateForgotPassword}
          >
            <Text style={styles.secondaryButtonText}>忘记密码</Text>
          </TouchableOpacity>
        </View>

        {/* 版本号 */}
        <Text style={styles.versionText}>v1.0.0</Text>
      </ScrollView>
    </View>
  );
};

// ========== 主组件 ==========
export const EnhancedLoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  // 视图状态：'landing' 或 'login'
  const [currentView, setCurrentView] = useState<'landing' | 'login'>('landing');

  // 表单状态
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
    clearError,
    retry,
  } = useLogin({
    enableBiometric: true,
    enableAutoLogin: true,
    maxRetries: 3,
  });

  useEffect(() => {
    const attemptAutoLogin = async () => {
      try {
        const success = await autoLogin();
        if (success) {
          navigateToMain();
        }
      } catch (error) {
        // Silent fail
      }
    };
    attemptAutoLogin();
  }, []);

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
      loginLogger.error('用户登录失败', error, { username: username.trim() });
    }
  };

  const handleBiometricLogin = async () => {
    if (!biometricStatus.available) {
      Alert.alert('提示', '设备不支持生物识别功能');
      return;
    }

    if (!biometricStatus.isEnrolled) {
      Alert.alert('提示', '生物识别登录未启用，请先进行普通登录');
      return;
    }

    try {
      const success = await biometricLogin();

      if (success) {
        navigateToMain();
      }
    } catch (error: any) {
      Alert.alert('生物识别登录失败', error.message);
    }
  };

  const navigateToMain = () => {
    const { user } = useAuthStore.getState();
    if (!user) {
      Alert.alert('错误', '登录状态异常,请重试');
      return;
    }
    const route = getPostLoginRoute(user);
    loginLogger.info('登录成功，准备导航', {
      userId: user.id,
      userType: user.userType,
      targetRoute: route
    });
  };

  const handleShowLogin = () => {
    setCurrentView('login');
  };

  const handleShowRegister = () => {
    navigation.navigate('RegisterScreen');
  };

  const handleForgotPassword = () => {
    navigation.navigate('ForgotPassword');
  };

  // 根据当前视图渲染不同内容
  if (currentView === 'landing') {
    return (
      <ScreenWrapper edges={['top', 'bottom']}>
        <LandingView
          onLogin={handleShowLogin}
          onRegister={handleShowRegister}
        />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper edges={['top', 'bottom']}>
      <LoginFormView
        username={username}
        password={password}
        showPassword={showPassword}
        rememberMe={rememberMe}
        isLoading={isLoading}
        error={error}
        retryCount={retryCount}
        networkStatus={networkStatus}
        biometricStatus={biometricStatus}
        onUsernameChange={setUsername}
        onPasswordChange={setPassword}
        onTogglePassword={() => setShowPassword(!showPassword)}
        onToggleRememberMe={() => setRememberMe(!rememberMe)}
        onLogin={handleLogin}
        onBiometricLogin={handleBiometricLogin}
        onNavigateRegister={handleShowRegister}
        onNavigateForgotPassword={handleForgotPassword}
        clearError={clearError}
        retry={retry}
      />
    </ScreenWrapper>
  );
};

// ========== 样式 ==========
const styles = StyleSheet.create({
  // ===== Landing 视图样式 =====
  landingContainer: {
    flex: 1,
  },
  landingContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 60,
    justifyContent: 'space-between',
  },
  landingPageTitle: {
    fontSize: 48,
    fontWeight: '300',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 56,
    opacity: 0.9,
  },
  brandContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  brandSubtitle: {
    fontSize: 18,
    fontWeight: '400',
    color: '#FFFFFF',
    opacity: 0.9,
    textAlign: 'center',
  },
  landingButtons: {
    gap: 16,
  },
  landingPrimaryButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  landingPrimaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2d5016',
  },
  landingSecondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  landingSecondaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // ===== 登录表单视图样式 =====
  loginFormContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loginFormScrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  loginTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.custom.colors.text,
    marginBottom: 32,
  },
  networkStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    padding: 8,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 16,
    alignSelf: 'center',
  },
  networkStatusText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '500',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.custom.colors.text,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 20,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: theme.custom.colors.text,
    height: '100%',
  },
  eyeIcon: {
    padding: 8,
  },
  rememberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  rememberText: {
    marginLeft: 8,
    color: theme.custom.colors.textSecondary,
    fontSize: 14,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.errorContainer,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    marginLeft: 8,
    color: theme.colors.error,
    fontSize: 14,
  },
  retryText: {
    color: theme.colors.error,
    fontWeight: '600',
    fontSize: 14,
  },
  loginButton: {
    backgroundColor: '#4a7c2c',
    borderRadius: 8,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.outline,
  },
  dividerText: {
    paddingHorizontal: 16,
    color: theme.custom.colors.textSecondary,
    fontSize: 12,
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4a7c2c',
    marginBottom: 16,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4a7c2c',
  },
  versionText: {
    textAlign: 'center',
    color: theme.custom.colors.textTertiary,
    fontSize: 12,
    marginTop: 24,
  },
});

export default EnhancedLoginScreen;
