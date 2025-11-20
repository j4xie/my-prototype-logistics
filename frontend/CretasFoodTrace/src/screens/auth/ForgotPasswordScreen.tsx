import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Card,
  HelperText,
  ActivityIndicator,
  Appbar,
  ProgressBar,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { forgotPasswordAPI } from '../../services/api/forgotPasswordApiClient';
import { handleError } from '../../utils/errorHandler';

type Step = 'phone' | 'verify' | 'reset';

interface PasswordStrength {
  score: number;
  label: string;
  color: string;
}

/**
 * 忘记密码页面
 * 功能：
 * - 手机号验证
 * - 验证码发送和验证
 * - 重置密码（新密码 + 确认密码）
 * - 密码强度指示
 */
export default function ForgotPasswordScreen() {
  const navigation = useNavigation();

  // 步骤控制
  const [currentStep, setCurrentStep] = useState<Step>('phone');

  // 表单数据
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState(''); // 存储重置令牌

  // UI状态
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // 错误状态
  const [phoneError, setPhoneError] = useState('');
  const [codeError, setCodeError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  // 倒计时效果
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  /**
   * 验证手机号
   */
  const validatePhoneNumber = (phone: string): boolean => {
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phone) {
      setPhoneError('请输入手机号');
      return false;
    }
    if (!phoneRegex.test(phone)) {
      setPhoneError('请输入有效的手机号');
      return false;
    }
    setPhoneError('');
    return true;
  };

  /**
   * 发送验证码
   */
  const handleSendCode = async () => {
    if (!validatePhoneNumber(phoneNumber)) return;

    setLoading(true);
    try {
      const response = await forgotPasswordAPI.sendVerificationCode({
        phoneNumber: '+86' + phoneNumber,
        verificationType: 'password_reset',
      });

      if (response.success && response.data.success) {
        setCountdown(response.data.retryAfter || 60);
        setCurrentStep('verify');
        Alert.alert('验证码已发送', response.data.message || '请查收短信验证码');
      } else {
        // 发送过于频繁
        setPhoneError(response.data.message || '发送验证码失败');
        if (response.data.retryAfter > 0) {
          setCountdown(response.data.retryAfter);
        }
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || '发送验证码失败，请稍后重试';
      setPhoneError(errorMessage);
      Alert.alert('发送失败', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 验证验证码
   */
  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setCodeError('请输入6位验证码');
      return;
    }
    setCodeError('');

    setLoading(true);
    try {
      const response = await forgotPasswordAPI.verifyResetCode({
        phoneNumber: '+86' + phoneNumber,
        verificationCode,
      });

      if (response.success && response.data.success) {
        // 保存重置令牌，用于后续密码重置
        setResetToken(response.data.resetToken);
        setCurrentStep('reset');
      } else {
        setCodeError(response.data.message || '验证码错误');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || '验证码错误，请重试';
      setCodeError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 计算密码强度
   */
  const calculatePasswordStrength = (pwd: string): PasswordStrength => {
    let score = 0;
    if (!pwd) return { score: 0, label: '无', color: '#E0E0E0' };

    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/\d/.test(pwd)) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) score++;

    const normalizedScore = Math.min(Math.floor(score / 1.5), 4);
    const strengthMap = [
      { score: 0, label: '弱', color: '#F44336' },
      { score: 1, label: '较弱', color: '#FF9800' },
      { score: 2, label: '中等', color: '#FFC107' },
      { score: 3, label: '强', color: '#4CAF50' },
      { score: 4, label: '很强', color: '#2E7D32' },
    ];
    return strengthMap[normalizedScore];
  };

  const passwordStrength = calculatePasswordStrength(newPassword);

  /**
   * 重置密码
   */
  const handleResetPassword = async () => {
    // 验证新密码
    if (!newPassword) {
      setPasswordError('请输入新密码');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('密码至少8个字符');
      return;
    }
    if (!/\d/.test(newPassword) || !/[a-zA-Z]/.test(newPassword)) {
      setPasswordError('密码必须包含字母和数字');
      return;
    }
    setPasswordError('');

    // 验证确认密码
    if (newPassword !== confirmPassword) {
      setConfirmPasswordError('两次密码输入不一致');
      return;
    }
    setConfirmPasswordError('');

    // 验证重置令牌
    if (!resetToken) {
      Alert.alert('错误', '重置令牌无效，请重新验证');
      setCurrentStep('phone');
      return;
    }

    setLoading(true);
    try {
      const response = await forgotPasswordAPI.forgotPassword({
        phoneNumber: '+86' + phoneNumber,
        resetToken,
        newPassword,
      });

      if (response.success && response.data.success) {
        Alert.alert(
          '密码重置成功',
          response.data.message || '请使用新密码登录',
          [
            {
              text: '前往登录',
              onPress: () => navigation.navigate('EnhancedLogin' as never),
            },
          ]
        );
      } else {
        Alert.alert('重置失败', response.data.message || '密码重置失败，请重试');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || '密码重置失败，请重试';
      Alert.alert('重置失败', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 获取步骤进度
   */
  const getStepProgress = (): number => {
    const stepMap = { phone: 0, verify: 0.5, reset: 1 };
    return stepMap[currentStep];
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="忘记密码" />
      </Appbar.Header>

      {/* 进度条 */}
      <ProgressBar progress={getStepProgress()} color="#2196F3" />

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            {/* 步骤1: 手机号验证 */}
            {currentStep === 'phone' && (
              <>
                <Text variant="headlineSmall" style={styles.title}>
                  验证手机号
                </Text>
                <Text variant="bodyMedium" style={styles.subtitle}>
                  请输入注册时使用的手机号
                </Text>

                <TextInput
                  label="手机号"
                  value={phoneNumber}
                  onChangeText={(text) => {
                    setPhoneNumber(text);
                    setPhoneError('');
                  }}
                  keyboardType="phone-pad"
                  maxLength={11}
                  mode="outlined"
                  left={<TextInput.Affix text="+86" />}
                  error={!!phoneError}
                  style={styles.input}
                />
                <HelperText type="error" visible={!!phoneError}>
                  {phoneError}
                </HelperText>

                <Button
                  mode="contained"
                  onPress={handleSendCode}
                  loading={loading}
                  disabled={loading || phoneNumber.length !== 11}
                  style={styles.button}
                >
                  发送验证码
                </Button>
              </>
            )}

            {/* 步骤2: 验证码验证 */}
            {currentStep === 'verify' && (
              <>
                <Text variant="headlineSmall" style={styles.title}>
                  输入验证码
                </Text>
                <Text variant="bodyMedium" style={styles.subtitle}>
                  验证码已发送至 {phoneNumber}
                </Text>

                <TextInput
                  label="验证码"
                  value={verificationCode}
                  onChangeText={(text) => {
                    setVerificationCode(text);
                    setCodeError('');
                  }}
                  keyboardType="number-pad"
                  maxLength={6}
                  mode="outlined"
                  error={!!codeError}
                  style={styles.input}
                />
                <HelperText type="error" visible={!!codeError}>
                  {codeError}
                </HelperText>

                {/* 重新发送 */}
                <View style={styles.resendRow}>
                  <Text variant="bodySmall">未收到验证码？</Text>
                  {countdown > 0 ? (
                    <Text variant="bodySmall" style={styles.countdownText}>
                      {countdown}秒后重新发送
                    </Text>
                  ) : (
                    <Button
                      mode="text"
                      compact
                      onPress={handleSendCode}
                      disabled={loading}
                    >
                      重新发送
                    </Button>
                  )}
                </View>

                <Button
                  mode="contained"
                  onPress={handleVerifyCode}
                  loading={loading}
                  disabled={loading || verificationCode.length !== 6}
                  style={styles.button}
                >
                  验证并继续
                </Button>
              </>
            )}

            {/* 步骤3: 重置密码 */}
            {currentStep === 'reset' && (
              <>
                <Text variant="headlineSmall" style={styles.title}>
                  设置新密码
                </Text>
                <Text variant="bodyMedium" style={styles.subtitle}>
                  请设置新的登录密码
                </Text>

                <TextInput
                  label="新密码"
                  value={newPassword}
                  onChangeText={(text) => {
                    setNewPassword(text);
                    setPasswordError('');
                  }}
                  secureTextEntry={!showPassword}
                  mode="outlined"
                  right={
                    <TextInput.Icon
                      icon={showPassword ? 'eye-off' : 'eye'}
                      onPress={() => setShowPassword(!showPassword)}
                    />
                  }
                  error={!!passwordError}
                  autoCapitalize="none"
                  style={styles.input}
                />
                <HelperText type="error" visible={!!passwordError}>
                  {passwordError}
                </HelperText>

                {/* 密码强度指示 */}
                {newPassword.length > 0 && (
                  <View style={styles.strengthContainer}>
                    <Text variant="bodySmall" style={styles.strengthLabel}>
                      密码强度：
                      <Text style={{ color: passwordStrength.color, fontWeight: 'bold' }}>
                        {passwordStrength.label}
                      </Text>
                    </Text>
                    <ProgressBar
                      progress={(passwordStrength.score + 1) / 5}
                      color={passwordStrength.color}
                      style={styles.strengthBar}
                    />
                  </View>
                )}

                <TextInput
                  label="确认新密码"
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    setConfirmPasswordError('');
                  }}
                  secureTextEntry={!showConfirmPassword}
                  mode="outlined"
                  right={
                    <TextInput.Icon
                      icon={showConfirmPassword ? 'eye-off' : 'eye'}
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    />
                  }
                  error={!!confirmPasswordError}
                  autoCapitalize="none"
                  style={styles.input}
                />
                <HelperText type="error" visible={!!confirmPasswordError}>
                  {confirmPasswordError}
                </HelperText>

                <Button
                  mode="contained"
                  onPress={handleResetPassword}
                  loading={loading}
                  disabled={loading || !newPassword || !confirmPassword}
                  style={styles.button}
                >
                  {loading ? '重置中...' : '重置密码'}
                </Button>
              </>
            )}
          </Card.Content>
        </Card>

        {/* 提示信息 */}
        <Card style={styles.helpCard} mode="outlined">
          <Card.Content>
            <Text variant="bodySmall" style={styles.helpTitle}>
              温馨提示
            </Text>
            <Text variant="bodySmall" style={styles.helpText}>
              • 密码至少8个字符
            </Text>
            <Text variant="bodySmall" style={styles.helpText}>
              • 必须包含字母和数字
            </Text>
            <Text variant="bodySmall" style={styles.helpText}>
              • 建议包含大小写字母和特殊字符
            </Text>
          </Card.Content>
        </Card>
      </ScrollView>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  title: {
    marginBottom: 8,
    fontWeight: 'bold',
  },
  subtitle: {
    marginBottom: 24,
    color: '#666',
  },
  input: {
    marginBottom: 8,
  },
  button: {
    marginTop: 16,
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  countdownText: {
    color: '#2196F3',
  },
  strengthContainer: {
    marginBottom: 16,
  },
  strengthLabel: {
    marginBottom: 8,
    color: '#666',
  },
  strengthBar: {
    height: 6,
    borderRadius: 3,
  },
  helpCard: {
    borderColor: '#E0E0E0',
  },
  helpTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  helpText: {
    color: '#666',
    marginBottom: 4,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
