import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, TextInput, TouchableOpacity, StatusBar } from 'react-native';
import { Text, ProgressBar, ActivityIndicator } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { forgotPasswordAPI } from '../../services/api/forgotPasswordApiClient';
import { NeoCard, NeoButton, ScreenWrapper, StatusBadge } from '../../components/ui';
import { theme } from '../../theme';
import { getErrorMsg } from '../../utils/errorHandler';

type Step = 'phone' | 'verify' | 'reset';

interface PasswordStrength {
  score: number;
  label: string;
  color: string;
}

export default function ForgotPasswordScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation('auth');

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
      setPhoneError(t('forgotPassword.errors.phoneRequired'));
      return false;
    }
    if (!phoneRegex.test(phone)) {
      setPhoneError(t('forgotPassword.errors.phoneInvalid'));
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
        setPhoneError(response.data.message || t('forgotPassword.errors.sendCodeFailed'));
        if (response.data.retryAfter > 0) {
          setCountdown(response.data.retryAfter);
        }
      }
    } catch (error) {
      const errorMessage = getErrorMsg(error) || t('forgotPassword.errors.sendCodeFailed');
      setPhoneError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setCodeError(t('forgotPassword.errors.codeInvalid'));
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
        setCodeError(response.data.message || t('forgotPassword.errors.codeFailed'));
      }
    } catch (error) {
      setCodeError(getErrorMsg(error) || t('forgotPassword.errors.codeFailed'));
    } finally {
      setLoading(false);
    }
  };

  const calculatePasswordStrength = (pwd: string): PasswordStrength => {
    let score = 0;
    if (!pwd) return { score: 0, label: t('forgotPassword.none'), color: '#E0E0E0' };
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/\d/.test(pwd)) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) score++;

    const normalizedScore = Math.min(Math.max(Math.floor(score / 1.5), 0), 4);
    const strengthMap: PasswordStrength[] = [
      { score: 0, label: t('forgotPassword.weak'), color: theme.colors.error },
      { score: 1, label: t('forgotPassword.fair'), color: '#FF9800' },
      { score: 2, label: t('forgotPassword.medium'), color: '#FFC107' },
      { score: 3, label: t('forgotPassword.strong'), color: theme.colors.success },
      { score: 4, label: t('forgotPassword.veryStrong'), color: '#2E7D32' },
    ];
    return strengthMap[normalizedScore] ?? { score: 0, label: t('forgotPassword.weak'), color: theme.colors.error };
  };

  const passwordStrength = calculatePasswordStrength(newPassword);

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 8 || !/\d/.test(newPassword) || !/[a-zA-Z]/.test(newPassword)) {
      setPasswordError(t('forgotPassword.errors.passwordInvalid'));
      return;
    }
    setPasswordError('');

    if (newPassword !== confirmPassword) {
      setConfirmPasswordError(t('forgotPassword.errors.passwordMismatch'));
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
        Alert.alert(t('forgotPassword.alerts.success'), t('forgotPassword.alerts.resetSuccess'), [
          { text: t('forgotPassword.alerts.confirm'), onPress: () => navigation.navigate('EnhancedLogin' as never) }
        ]);
      } else {
        Alert.alert(t('forgotPassword.alerts.failed'), response.data.message || t('forgotPassword.errors.resetFailed'));
      }
    } catch (error) {
      Alert.alert(t('forgotPassword.alerts.failed'), getErrorMsg(error) || t('forgotPassword.errors.resetFailed'));
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
        <Text style={styles.headerTitle}>{t('forgotPassword.title')}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ProgressBar progress={getStepProgress()} color={theme.colors.primary} style={styles.progressBar} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <NeoCard style={styles.card}>
          {currentStep === 'phone' && (
            <>
              <View style={styles.stepHeader}>
                <Text variant="headlineSmall" style={styles.title}>{t('forgotPassword.verifyPhoneTitle')}</Text>
                <Text variant="bodyMedium" style={styles.subtitle}>{t('forgotPassword.verifyPhoneSubtitle')}</Text>
              </View>
              {renderInput(t('forgotPassword.phone'), phoneNumber, (text) => { setPhoneNumber(text); setPhoneError(''); }, "phone-portrait-outline", phoneError, "phone-pad", false, false, undefined, 11)}
              <NeoButton
                variant="primary"
                onPress={handleSendCode}
                loading={loading}
                disabled={loading || phoneNumber.length !== 11}
                style={styles.button}
              >
                {t('forgotPassword.sendCode')}
              </NeoButton>
            </>
          )}

          {currentStep === 'verify' && (
            <>
              <View style={styles.stepHeader}>
                <Text variant="headlineSmall" style={styles.title}>{t('forgotPassword.enterCodeTitle')}</Text>
                <Text variant="bodyMedium" style={styles.subtitle}>{t('forgotPassword.enterCodeSubtitle', { phone: phoneNumber })}</Text>
              </View>
              {renderInput(t('forgotPassword.verificationCode'), verificationCode, (text) => { setVerificationCode(text); setCodeError(''); }, "keypad-outline", codeError, "number-pad", false, false, undefined, 6)}

              <View style={styles.resendRow}>
                <Text style={styles.resendLabel}>{t('forgotPassword.notReceiveCode')}</Text>
                {countdown > 0 ? (
                  <Text style={styles.countdownText}>{t('forgotPassword.resendAfter', { seconds: countdown })}</Text>
                ) : (
                  <TouchableOpacity onPress={handleSendCode} disabled={loading}>
                    <Text style={styles.resendButtonText}>{t('forgotPassword.resend')}</Text>
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
                {t('forgotPassword.verifyAndContinue')}
              </NeoButton>
            </>
          )}

          {currentStep === 'reset' && (
            <>
              <View style={styles.stepHeader}>
                <Text variant="headlineSmall" style={styles.title}>{t('forgotPassword.setNewPasswordTitle')}</Text>
                <Text variant="bodyMedium" style={styles.subtitle}>{t('forgotPassword.setNewPasswordSubtitle')}</Text>
              </View>

              {renderInput(t('forgotPassword.newPassword'), newPassword, (text) => { setNewPassword(text); setPasswordError(''); }, "lock-closed-outline", passwordError, "default", true, showPassword, () => setShowPassword(!showPassword))}

              {newPassword.length > 0 && (
                <View style={styles.strengthContainer}>
                  <Text style={styles.strengthLabel}>
                    {t('forgotPassword.passwordStrength')}<Text style={{ color: passwordStrength.color, fontWeight: 'bold' }}>{passwordStrength.label}</Text>
                  </Text>
                  <View style={styles.strengthBarBg}>
                    <View style={[styles.strengthBarFill, { width: `${(passwordStrength.score + 1) * 20}%`, backgroundColor: passwordStrength.color }]} />
                  </View>
                </View>
              )}

              {renderInput(t('forgotPassword.confirmPassword'), confirmPassword, (text) => { setConfirmPassword(text); setConfirmPasswordError(''); }, "lock-closed-outline", confirmPasswordError, "default", true, showConfirmPassword, () => setShowConfirmPassword(!showConfirmPassword))}

              <NeoButton
                variant="primary"
                onPress={handleResetPassword}
                loading={loading}
                disabled={loading || !newPassword || !confirmPassword}
                style={styles.button}
              >
                {t('forgotPassword.resetButton')}
              </NeoButton>
            </>
          )}
        </NeoCard>

        <NeoCard style={styles.helpCard} padding="m">
          <Text style={styles.helpTitle}>{t('forgotPassword.tipsTitle')}</Text>
          <View style={styles.bulletPoint}><Text style={styles.helpText}>{t('forgotPassword.tip1')}</Text></View>
          <View style={styles.bulletPoint}><Text style={styles.helpText}>{t('forgotPassword.tip2')}</Text></View>
          <View style={styles.bulletPoint}><Text style={styles.helpText}>{t('forgotPassword.tip3')}</Text></View>
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
