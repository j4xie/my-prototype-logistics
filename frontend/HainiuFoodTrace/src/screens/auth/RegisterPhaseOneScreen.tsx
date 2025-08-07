import React, { useState, useRef } from 'react';
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
import { AuthService } from '../../services/auth/authService';
import { NetworkManager } from '../../services/networkManager';

interface RegisterPhaseOneScreenProps {
  navigation: any;
}

export const RegisterPhaseOneScreen: React.FC<RegisterPhaseOneScreenProps> = ({ navigation }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // 验证手机号格式
  const validatePhoneNumber = (phone: string): boolean => {
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(phone);
  };

  // 发送验证码
  const handleSendCode = async () => {
    if (!phoneNumber) {
      Alert.alert('提示', '请输入手机号');
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      Alert.alert('提示', '请输入正确的手机号格式');
      return;
    }

    // 检查网络状态
    const networkState = await NetworkManager.checkNetworkState();
    if (!networkState.isConnected) {
      Alert.alert('网络错误', '请检查您的网络连接');
      return;
    }

    setIsLoading(true);

    try {
      // 调用发送验证码API
      const result = await AuthService.sendVerificationCode(phoneNumber);
      
      if (result.success) {
        setCodeSent(true);
        startCountdown();
        Alert.alert('成功', '验证码已发送到您的手机');
      } else {
        Alert.alert('发送失败', result.message || '验证码发送失败，请稍后重试');
      }
    } catch (error) {
      console.error('发送验证码失败:', error);
      Alert.alert('错误', '网络请求失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 开始倒计时
  const startCountdown = () => {
    setCountdown(60);
    
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // 验证验证码并进入第二阶段
  const handleVerifyCode = async () => {
    if (!phoneNumber || !verificationCode) {
      Alert.alert('提示', '请输入手机号和验证码');
      return;
    }

    if (verificationCode.length !== 6) {
      Alert.alert('提示', '请输入6位验证码');
      return;
    }

    setIsLoading(true);

    try {
      // 验证手机号和验证码
      const result = await AuthService.verifyPhoneNumber({
        phoneNumber,
        verificationCode,
        verificationType: 'registration',
      });

      if (result.success) {
        // 验证成功，跳转到第二阶段
        navigation.navigate('RegisterPhaseTwo', {
          phoneNumber,
          tempToken: result.tempToken,
          factoryId: result.factoryId,
          whitelistInfo: result.whitelistInfo,
        });
      } else {
        Alert.alert('验证失败', result.message || '验证码错误或已过期');
      }
    } catch (error) {
      console.error('验证失败:', error);
      Alert.alert('错误', '网络请求失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 清理定时器
  React.useEffect(() => {
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, []);

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
            <Text style={styles.title}>新用户注册</Text>
            <Text style={styles.subtitle}>第一步：验证手机号</Text>
          </View>

          {/* 表单区域 */}
          <View style={styles.formContainer}>
            {/* 手机号输入 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>手机号</Text>
              <View style={styles.phoneInputContainer}>
                <Text style={styles.countryCode}>+86</Text>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="请输入手机号"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                  maxLength={11}
                  editable={!codeSent}
                />
              </View>
            </View>

            {/* 验证码输入 */}
            {codeSent && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>验证码</Text>
                <View style={styles.codeInputContainer}>
                  <TextInput
                    style={styles.codeInput}
                    placeholder="请输入6位验证码"
                    placeholderTextColor="rgba(255,255,255,0.5)"
                    value={verificationCode}
                    onChangeText={setVerificationCode}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  <TouchableOpacity
                    style={[
                      styles.resendButton,
                      countdown > 0 && styles.resendButtonDisabled,
                    ]}
                    onPress={handleSendCode}
                    disabled={countdown > 0 || isLoading}
                  >
                    <Text style={styles.resendButtonText}>
                      {countdown > 0 ? `${countdown}秒后重发` : '重新发送'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* 提示信息 */}
            <View style={styles.infoContainer}>
              <Ionicons name="information-circle" size={20} color="rgba(255,255,255,0.7)" />
              <Text style={styles.infoText}>
                请确保手机号已在系统白名单中，否则无法注册
              </Text>
            </View>

            {/* 操作按钮 */}
            {!codeSent ? (
              <TouchableOpacity
                style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
                onPress={handleSendCode}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>获取验证码</Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
                onPress={handleVerifyCode}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>下一步</Text>
                )}
              </TouchableOpacity>
            )}

            {/* 底部链接 */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>已有账号？</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.linkText}>立即登录</Text>
              </TouchableOpacity>
            </View>
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
    paddingBottom: 30,
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
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: 30,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 8,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  countryCode: {
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#fff',
  },
  phoneInput: {
    flex: 1,
    height: 50,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#fff',
  },
  codeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  codeInput: {
    flex: 1,
    height: 50,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#fff',
    marginRight: 12,
  },
  resendButton: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
  },
  resendButtonDisabled: {
    opacity: 0.6,
  },
  resendButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 30,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginLeft: 8,
    lineHeight: 20,
  },
  primaryButton: {
    height: 50,
    backgroundColor: '#fff',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a365d',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  linkText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
    marginLeft: 5,
  },
});