import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, TextInput, TouchableOpacity, StatusBar } from 'react-native';
import { Text, ProgressBar, ActivityIndicator } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { forgotPasswordAPI } from '../../services/api/forgotPasswordApiClient';
import { NeoCard, NeoButton, ScreenWrapper, StatusBadge } from '../../components/ui';
import { theme } from '../../theme';

type Step = 'phone' | 'verify' | 'reset';

interface PasswordStrength {
  score: number;
  label: string;
  color: string;
}

export default function ForgotPasswordScreen() {
  const navigation = useNavigation();

  // Step control
  const [currentStep, setCurrentStep] = useState<Step>('phone');

  // Form data
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');

  // UI State
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Error State
  const [phoneError, setPhoneError] = useState('');
  const [codeError, setCodeError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

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
      } else {
        setPhoneError(response.data.message || '发送验证码失败');
        if (response.data.retryAfter > 0) {
          setCountdown(response.data.retryAfter);
        }
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || '发送验证码失败';
      setPhoneError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

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
        setResetToken(response.data.resetToken);
        setCurrentStep('reset');
      } else {
        setCodeError(response.data.message || '验证码错误');
      }
    } catch (error) {
      setCodeError(error.response?.data?.message || '验证码错误');
    } finally {
      setLoading(false);
    }
  };

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
      { score: 0, label: '弱', color: theme.colors.error },
      { score: 1, label: '较弱', color: '#FF9800' },
      { score: 2, label: '中等', color: '#FFC107' },
      { score: 3, label: '强', color: theme.colors.success },
      { score: 4, label: '很强', color: '#2E7D32' },
    ];
    return strengthMap[normalizedScore];
  };

  const passwordStrength = calculatePasswordStrength(newPassword);

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 8 || !/\d/.test(newPassword) || !/[a-zA-Z]/.test(newPassword)) {
      setPasswordError('密码至少8个字符，且包含字母和数字');
      return;
    }
    setPasswordError('');

    if (newPassword !== confirmPassword) {
      setConfirmPasswordError('两次密码输入不一致');
      return;
    }
    setConfirmPasswordError('');

    if (!resetToken) {
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
        Alert.alert('成功', '密码重置成功，请登录', [
          { text: '确定', onPress: () => navigation.navigate('EnhancedLogin' as never) }
        ]);
      } else {
        Alert.alert('失败', response.data.message || '重置失败');
      }
    } catch (error) {
      Alert.alert('失败', error.response?.data?.message || '重置失败');
    } finally {
      setLoading(false);
    }
  };

  const getStepProgress = (): number => {
    const stepMap = { phone: 0.33, verify: 0.66, reset: 1 };
    return stepMap[currentStep];
  };

  const renderInput = (
    placeholder: string,
    value: string,
    onChange: (text: string) => void,
    icon: any,
    error?: string,
    keyboardType: 'default' | 'number-pad' | 'phone-pad' = 'default',
    secure = false,
    showSecure = false,
    toggleSecure?: () => void,
    maxLength?: number,
  ) => (
    <View style={styles.inputGroup}>
      <View style={[styles.inputContainer, error ? { borderColor: theme.colors.error } : {}]}>
        <Ionicons name={icon} size={20} color={theme.colors.onSurfaceVariant} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.onSurfaceVariant}
          value={value}
          onChangeText={onChange}
          keyboardType={keyboardType}
          maxLength={maxLength}
          secureTextEntry={secure && !showSecure}
          autoCapitalize="none"
          editable={!loading}
        />
        {toggleSecure && (
          <TouchableOpacity style={styles.eyeIcon} onPress={toggleSecure}>
            <Ionicons
              name={showSecure ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={theme.colors.onSurfaceVariant}
            />
          </TouchableOpacity>
        )}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );

  return (
    <ScreenWrapper edges={['top', 'bottom']} backgroundColor={theme.colors.background}>
       <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>忘记密码</Text>
        <View style={{ width: 44 }} />
      </View>

      <ProgressBar progress={getStepProgress()} color={theme.colors.primary} style={styles.progressBar} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <NeoCard style={styles.card}>
          {currentStep === 'phone' && (
            <>
              <View style={styles.stepHeader}>
                <Text variant="headlineSmall" style={styles.title}>验证手机号</Text>
                <Text variant="bodyMedium" style={styles.subtitle}>请输入注册时使用的手机号</Text>
              </View>
              {renderInput("手机号", phoneNumber, (t) => { setPhoneNumber(t); setPhoneError(''); }, "phone-portrait-outline", phoneError, "phone-pad", false, false, undefined, 11)}
              <NeoButton
                variant="primary"
                onPress={handleSendCode}
                loading={loading}
                disabled={loading || phoneNumber.length !== 11}
                style={styles.button}
              >
                发送验证码
              </NeoButton>
            </>
          )}

          {currentStep === 'verify' && (
            <>
              <View style={styles.stepHeader}>
                <Text variant="headlineSmall" style={styles.title}>输入验证码</Text>
                <Text variant="bodyMedium" style={styles.subtitle}>验证码已发送至 {phoneNumber}</Text>
              </View>
              {renderInput("验证码", verificationCode, (t) => { setVerificationCode(t); setCodeError(''); }, "keypad-outline", codeError, "number-pad", false, false, undefined, 6)}
              
              <View style={styles.resendRow}>
                <Text style={styles.resendLabel}>未收到验证码？</Text>
                {countdown > 0 ? (
                  <Text style={styles.countdownText}>{countdown}秒后重新发送</Text>
                ) : (
                  <TouchableOpacity onPress={handleSendCode} disabled={loading}>
                    <Text style={styles.resendButtonText}>重新发送</Text>
                  </TouchableOpacity>
                )}
              </View>

              <NeoButton
                variant="primary"
                onPress={handleVerifyCode}
                loading={loading}
                disabled={loading || verificationCode.length !== 6}
                style={styles.button}
              >
                验证并继续
              </NeoButton>
            </>
          )}

          {currentStep === 'reset' && (
            <>
              <View style={styles.stepHeader}>
                <Text variant="headlineSmall" style={styles.title}>设置新密码</Text>
                <Text variant="bodyMedium" style={styles.subtitle}>请设置新的登录密码</Text>
              </View>

              {renderInput("新密码", newPassword, (t) => { setNewPassword(t); setPasswordError(''); }, "lock-closed-outline", passwordError, "default", true, showPassword, () => setShowPassword(!showPassword))}
              
              {newPassword.length > 0 && (
                <View style={styles.strengthContainer}>
                  <Text style={styles.strengthLabel}>
                    密码强度：<Text style={{ color: passwordStrength.color, fontWeight: 'bold' }}>{passwordStrength.label}</Text>
                  </Text>
                  <View style={styles.strengthBarBg}>
                    <View style={[styles.strengthBarFill, { width: `${(passwordStrength.score + 1) * 20}%`, backgroundColor: passwordStrength.color }]} />
                  </View>
                </View>
              )}

              {renderInput("确认新密码", confirmPassword, (t) => { setConfirmPassword(t); setConfirmPasswordError(''); }, "lock-closed-outline", confirmPasswordError, "default", true, showConfirmPassword, () => setShowConfirmPassword(!showConfirmPassword))}

              <NeoButton
                variant="primary"
                onPress={handleResetPassword}
                loading={loading}
                disabled={loading || !newPassword || !confirmPassword}
                style={styles.button}
              >
                重置密码
              </NeoButton>
            </>
          )}
        </NeoCard>

        <NeoCard style={styles.helpCard} padding="m">
          <Text style={styles.helpTitle}>温馨提示</Text>
          <View style={styles.bulletPoint}><Text style={styles.helpText}>• 密码至少8个字符</Text></View>
          <View style={styles.bulletPoint}><Text style={styles.helpText}>• 必须包含字母和数字</Text></View>
          <View style={styles.bulletPoint}><Text style={styles.helpText}>• 建议包含大小写字母和特殊字符</Text></View>
        </NeoCard>

      </ScrollView>
      
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.background,
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: theme.colors.text },
  progressBar: { height: 2 },
  scrollContent: { padding: 24 },
  card: { marginBottom: 24 },
  stepHeader: { marginBottom: 24 },
  title: { fontWeight: '700', color: theme.colors.text, marginBottom: 8 },
  subtitle: { color: theme.colors.textSecondary },
  inputGroup: { marginBottom: 16 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.custom.borderRadius.s,
    paddingHorizontal: 16,
    height: 50,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 15, color: theme.colors.text, height: '100%' },
  eyeIcon: { padding: 8 },
  errorText: { color: theme.colors.error, fontSize: 12, marginTop: 4, marginLeft: 4 },
  button: { marginTop: 8 },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  resendLabel: { fontSize: 13, color: theme.colors.textSecondary },
  countdownText: { fontSize: 13, color: theme.colors.textTertiary },
  resendButtonText: { fontSize: 13, color: theme.colors.primary, fontWeight: '600' },
  strengthContainer: { marginBottom: 16 },
  strengthLabel: { fontSize: 12, color: theme.colors.textSecondary, marginBottom: 4 },
  strengthBarBg: { height: 4, backgroundColor: theme.colors.surfaceVariant, borderRadius: 2, overflow: 'hidden' },
  strengthBarFill: { height: '100%' },
  helpCard: { backgroundColor: theme.colors.surfaceVariant, borderWidth: 0 },
  helpTitle: { fontSize: 14, fontWeight: '600', color: theme.colors.text, marginBottom: 8 },
  bulletPoint: { marginBottom: 4 },
  helpText: { fontSize: 12, color: theme.colors.textSecondary },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
});
