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
import { getPostLoginRoute } from '../../utils/navigationHelper';
import { useAuthStore } from '../../store/authStore';
import { NeoCard, NeoButton, ScreenWrapper } from '../../components/ui';
import { theme } from '../../theme';
import { logger } from '../../utils/logger';

// 创建LoginScreen专用logger
const loginLogger = logger.createContextLogger('EnhancedLoginScreen');

const { width } = Dimensions.get('window');

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
      const success = await biometricLogin({
        promptMessage: `使用${biometricStatus.type}快速登录`,
        cancelButtonText: '取消',
        fallbackToDevicePasscode: true,
      });

      if (success) {
        navigateToMain();
      }
    } catch (error) {
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

  const renderNetworkStatus = () => {
    if (networkStatus === 'offline') {
      return (
        <View style={styles.networkStatus}>
          <Ionicons name="cloud-offline" size={16} color={theme.colors.error} />
          <Text style={[styles.networkStatusText, { color: theme.colors.error }]}>网络离线</Text>
        </View>
      );
    }
    if (networkStatus === 'checking') {
      return (
        <View style={styles.networkStatus}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={[styles.networkStatusText, { color: theme.colors.primary }]}>检查网络...</Text>
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
    <ScreenWrapper edges={['top', 'bottom']}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerContainer}>
          <View style={styles.logoCircle}>
            <Ionicons name="leaf" size={48} color={theme.colors.primary} />
          </View>
          <Text style={styles.title}>白垩纪食品溯源</Text>
          <Text style={styles.subtitle}>移动端管理系统</Text>
        </View>

        {renderNetworkStatus()}

        <NeoCard style={styles.formCard}>
          {/* Username Input */}
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color={theme.colors.onSurfaceVariant} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="用户名"
              placeholderTextColor={theme.colors.onSurfaceVariant}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              editable={!isLoading}
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color={theme.colors.onSurfaceVariant} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="密码"
              placeholderTextColor={theme.colors.onSurfaceVariant}
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
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={theme.colors.onSurfaceVariant}
              />
            </TouchableOpacity>
          </View>

          {/* Remember Me */}
          <TouchableOpacity
            style={styles.rememberContainer}
            onPress={() => setRememberMe(!rememberMe)}
            disabled={isLoading}
          >
            <Ionicons
              name={rememberMe ? "checkbox" : "square-outline"}
              size={20}
              color={rememberMe ? theme.colors.primary : theme.colors.onSurfaceVariant}
            />
            <Text style={styles.rememberText}>记住我并启用生物识别</Text>
          </TouchableOpacity>

          {renderError()}

          <NeoButton
            variant="primary"
            size="large"
            onPress={handleLogin}
            loading={isLoading}
            disabled={isLoading}
            style={styles.loginButton}
          >
            登录
          </NeoButton>

          {biometricStatus.available && (
            <NeoButton
              variant="outline"
              size="large"
              onPress={handleBiometricLogin}
              disabled={!biometricStatus.isEnrolled || isLoading}
              style={styles.biometricButton}
              icon="finger-print"
            >
              {biometricStatus.isEnrolled ? '使用生物识别登录' : '生物识别未启用'}
            </NeoButton>
          )}

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>其他方式</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.footerActions}>
            <TouchableOpacity onPress={() => navigation.navigate('RegisterScreen')}>
              <Text style={styles.linkText}>注册账户</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
              <Text style={styles.linkText}>忘记密码</Text>
            </TouchableOpacity>
          </View>
        </NeoCard>

        <Text style={styles.versionText}>v1.0.0</Text>
      </ScrollView>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: theme.colors.background,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    ...theme.custom.shadows.medium,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
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
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.custom.borderRadius.m,
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text,
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
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.errorContainer,
    borderRadius: theme.custom.borderRadius.s,
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
    marginBottom: 16,
  },
  biometricButton: {
    marginBottom: 16,
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
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  footerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  linkText: {
    color: theme.colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  versionText: {
    textAlign: 'center',
    color: theme.colors.textTertiary,
    fontSize: 12,
  },
});

export default EnhancedLoginScreen;
