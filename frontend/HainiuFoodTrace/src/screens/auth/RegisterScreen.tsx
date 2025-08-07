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
  StatusBar,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AuthService } from '../../services/auth/authService';
import { RegisterPhaseOneRequest, RegisterPhaseTwoRequest } from '../../types/auth';

interface RegisterScreenProps {
  navigation: any;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
  // 第一阶段状态
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  
  // 第二阶段状态
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [realName, setRealName] = useState('');
  const [email, setEmail] = useState('');
  const [factoryId, setFactoryId] = useState('');
  const [department, setDepartment] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // 通用状态
  const [isLoading, setIsLoading] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<1 | 2>(1);

  // 倒计时效果
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  // 发送验证码
  const handleSendCode = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert('错误', '请输入手机号');
      return;
    }

    if (!/^1[3-9]\d{9}$/.test(phoneNumber.trim())) {
      Alert.alert('错误', '请输入正确的手机号格式');
      return;
    }

    setIsLoading(true);
    try {
      // 模拟发送验证码
      // 实际应调用后端API发送验证码
      Alert.alert('成功', '验证码已发送到您的手机');
      setIsCodeSent(true);
      setCountdown(60);
    } catch (error: any) {
      Alert.alert('发送失败', error.message || '验证码发送失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 第一阶段：手机验证
  const handlePhaseOne = async () => {
    if (!phoneNumber.trim() || !verificationCode.trim()) {
      Alert.alert('错误', '请输入手机号和验证码');
      return;
    }

    setIsLoading(true);
    try {
      const request: RegisterPhaseOneRequest = {
        phone: phoneNumber.trim(),
        verificationCode: verificationCode.trim(),
      };

      const response = await AuthService.registerPhaseOne(request);

      if (response.success) {
        Alert.alert('成功', '手机验证成功，请完善您的信息', [
          { text: '确定', onPress: () => setCurrentPhase(2) }
        ]);
      } else {
        Alert.alert('验证失败', response.message || '手机验证失败');
      }
    } catch (error: any) {
      Alert.alert('验证失败', error.message || '手机验证失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 第二阶段：完整注册
  const handlePhaseTwo = async () => {
    // 验证必填字段
    if (!username.trim() || !password.trim() || !realName.trim()) {
      Alert.alert('错误', '请填写所有必填信息');
      return;
    }

    // 验证密码
    if (password !== confirmPassword) {
      Alert.alert('错误', '两次输入的密码不一致');
      return;
    }

    if (password.length < 6) {
      Alert.alert('错误', '密码长度至少6位');
      return;
    }

    // 验证邮箱格式（如果填写了）
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      Alert.alert('错误', '请输入正确的邮箱格式');
      return;
    }

    setIsLoading(true);
    try {
      const request: RegisterPhaseTwoRequest = {
        username: username.trim(),
        password: password.trim(),
        fullName: realName.trim(),
        email: email.trim() || undefined,
        factoryId: factoryId.trim() || undefined,
        department: department.trim() || undefined,
      };

      const response = await AuthService.registerPhaseTwo(request);

      if (response.success) {
        Alert.alert(
          '注册成功',
          '您已成功注册，请等待管理员激活您的账号',
          [
            { 
              text: '去登录', 
              onPress: () => navigation.replace('Login')
            }
          ]
        );
      } else {
        Alert.alert('注册失败', response.message || '注册失败，请重试');
      }
    } catch (error: any) {
      Alert.alert('注册失败', error.message || '网络错误，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 渲染第一阶段：手机验证
  const renderPhaseOne = () => (
    <View style={styles.formContainer}>
      <Text style={styles.phaseTitle}>手机验证</Text>
      <Text style={styles.phaseDescription}>请输入您的手机号进行验证</Text>

      <View style={styles.inputContainer}>
        <Ionicons name="phone-portrait-outline" size={20} color="#64748b" style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="手机号码"
          placeholderTextColor="#94a3b8"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          keyboardType="phone-pad"
          maxLength={11}
          editable={!isCodeSent}
        />
      </View>

      <View style={styles.codeContainer}>
        <View style={[styles.inputContainer, styles.codeInput]}>
          <Ionicons name="keypad-outline" size={20} color="#64748b" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="验证码"
            placeholderTextColor="#94a3b8"
            value={verificationCode}
            onChangeText={setVerificationCode}
            keyboardType="number-pad"
            maxLength={6}
          />
        </View>
        
        <TouchableOpacity
          style={[styles.codeButton, countdown > 0 && styles.codeButtonDisabled]}
          onPress={handleSendCode}
          disabled={countdown > 0 || isLoading}
        >
          <Text style={[styles.codeButtonText, countdown > 0 && styles.codeButtonTextDisabled]}>
            {countdown > 0 ? `${countdown}秒后重试` : '获取验证码'}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
        onPress={handlePhaseOne}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>下一步</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  // 渲染第二阶段：完整资料
  const renderPhaseTwo = () => (
    <ScrollView style={styles.scrollView}>
      <View style={styles.formContainer}>
        <Text style={styles.phaseTitle}>完善信息</Text>
        <Text style={styles.phaseDescription}>请填写您的基本信息完成注册</Text>

        {/* 必填信息 */}
        <Text style={styles.sectionTitle}>必填信息</Text>
        
        <View style={styles.inputContainer}>
          <Ionicons name="person-outline" size={20} color="#64748b" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="用户名 *"
            placeholderTextColor="#94a3b8"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="person-circle-outline" size={20} color="#64748b" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="真实姓名 *"
            placeholderTextColor="#94a3b8"
            value={realName}
            onChangeText={setRealName}
          />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" size={20} color="#64748b" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="密码 * (至少6位)"
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

        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" size={20} color="#64748b" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="确认密码 *"
            placeholderTextColor="#94a3b8"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.eyeIcon}
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
          >
            <Ionicons
              name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
              size={20}
              color="#64748b"
            />
          </TouchableOpacity>
        </View>

        {/* 选填信息 */}
        <Text style={styles.sectionTitle}>选填信息</Text>

        <View style={styles.inputContainer}>
          <Ionicons name="mail-outline" size={20} color="#64748b" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="邮箱地址"
            placeholderTextColor="#94a3b8"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="business-outline" size={20} color="#64748b" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="工厂ID (工厂用户填写)"
            placeholderTextColor="#94a3b8"
            value={factoryId}
            onChangeText={setFactoryId}
          />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="briefcase-outline" size={20} color="#64748b" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="部门"
            placeholderTextColor="#94a3b8"
            value={department}
            onChangeText={setDepartment}
          />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
          onPress={handlePhaseTwo}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>完成注册</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setCurrentPhase(1)}
        >
          <Text style={styles.backButtonText}>返回上一步</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

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
            <Ionicons name="person-add" size={50} color="#fff" />
          </View>
          <Text style={styles.logoText}>用户注册</Text>
          <Text style={styles.logoSubText}>
            {currentPhase === 1 ? '步骤 1/2: 手机验证' : '步骤 2/2: 完善信息'}
          </Text>
        </View>

        {/* 表单区域 */}
        {currentPhase === 1 ? renderPhaseOne() : renderPhaseTwo()}

        {/* 底部操作 */}
        <View style={styles.bottomActions}>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.linkText}>已有账号？立即登录</Text>
          </TouchableOpacity>
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
  },
  scrollView: {
    flex: 1,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 30,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  logoSubText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  formContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  phaseTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  phaseDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginTop: 20,
    marginBottom: 12,
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
  codeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  codeInput: {
    flex: 1,
  },
  codeButton: {
    backgroundColor: '#3182ce',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 15,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 120,
  },
  codeButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  codeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  codeButtonTextDisabled: {
    color: '#fff',
  },
  submitButton: {
    backgroundColor: '#3182ce',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#3182ce',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  submitButtonDisabled: {
    backgroundColor: '#94a3b8',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  backButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  backButtonText: {
    color: '#3182ce',
    fontSize: 14,
  },
  bottomActions: {
    marginTop: 20,
    marginBottom: 30,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
});