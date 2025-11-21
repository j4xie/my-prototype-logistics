import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRegister } from '../../hooks/useRegister';
import { RegisterRequest } from '../../types/auth';
import { NeoCard, NeoButton, ScreenWrapper } from '../../components/ui';
import { theme } from '../../theme';
import { logger } from '../../utils/logger';

// 创建Register专用logger
const registerLogger = logger.createContextLogger('Register');

const { width } = Dimensions.get('window');

interface RegisterScreenProps {
  navigation: any;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
  // Step 1: Phone Verification
  const [phoneNumber, setPhoneNumber] = useState('');

  // Step 2: Info Form
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [realName, setRealName] = useState('');
  const [factoryId, setFactoryId] = useState('');
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');
  const [email, setEmail] = useState('');

  // UI State
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

  const handleVerifyPhone = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert('提示', '请输入手机号码');
      return;
    }
    const result = await verifyPhoneNumber(phoneNumber);
    if (result.success && result.tempToken) {
      clearError();
    }
  };

  const handleRegister = async () => {
    if (!username.trim() || !password.trim() || !realName.trim() || !factoryId.trim()) {
      Alert.alert('提示', '请填写所有必填项');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('提示', '两次输入的密码不一致');
      return;
    }

    if (!tempToken) {
      Alert.alert('错误', '验证信息过期');
      return;
    }

    const registerRequest: RegisterRequest = {
      tempToken,
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
        registerLogger.info('用户注册成功', {
          username: registerRequest.username,
          factoryId: registerRequest.factoryId,
        });
        navigation.navigate('LoginScreen');
      }
    } catch (err) {
      registerLogger.error('用户注册失败', err as Error, {
        username: registerRequest.username,
        factoryId: registerRequest.factoryId,
      });
    }
  };

  const handleBack = () => {
    if (currentStep === 'info') {
      resetForm();
    } else {
      navigation.goBack();
    }
  };

  const renderInput = (
    placeholder: string,
    value: string,
    onChange: (text: string) => void,
    icon: any,
    secure = false,
    showSecure = false,
    toggleSecure?: () => void,
    keyboardType: 'default' | 'email-address' | 'phone-pad' = 'default'
  ) => (
    <View style={styles.inputContainer}>
      <Ionicons name={icon} size={20} color={theme.colors.onSurfaceVariant} style={styles.inputIcon} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.onSurfaceVariant}
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure && !showSecure}
        keyboardType={keyboardType}
        autoCapitalize="none"
        editable={!isLoading}
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
  );

  const renderPhoneVerification = () => (
    <View>
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>步骤 1/2</Text>
        <Text style={styles.stepDescription}>手机验证</Text>
      </View>

      {renderInput("请输入手机号码", phoneNumber, setPhoneNumber, "phone-portrait-outline", false, false, undefined, "phone-pad")}

      <View style={styles.hintContainer}>
        <Ionicons name="information-circle-outline" size={16} color={theme.colors.primary} />
        <Text style={styles.hintText}>系统将自动验证手机号是否在白名单中</Text>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={20} color={theme.colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <NeoButton
        variant="primary"
        onPress={handleVerifyPhone}
        loading={isLoading}
        disabled={isLoading || !phoneNumber.trim()}
        style={styles.nextButton}
      >
        验证手机
      </NeoButton>
    </View>
  );

  const renderInfoForm = () => (
    <View>
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>步骤 2/2</Text>
        <Text style={styles.stepDescription}>填写完整信息</Text>
      </View>

      {renderInput("用户名 (必填)", username, setUsername, "person-outline")}
      {renderInput("真实姓名 (必填)", realName, setRealName, "card-outline")}
      {renderInput("工厂ID (必填)", factoryId, setFactoryId, "business-outline")}
      {renderInput("部门 (可选)", department, setDepartment, "briefcase-outline")}
      {renderInput("职位 (可选)", position, setPosition, "shield-checkmark-outline")}
      {renderInput("邮箱 (可选)", email, setEmail, "mail-outline", false, false, undefined, "email-address")}
      
      {renderInput("密码 (必填)", password, setPassword, "lock-closed-outline", true, showPassword, () => setShowPassword(!showPassword))}
      {renderInput("确认密码 (必填)", confirmPassword, setConfirmPassword, "lock-closed-outline", true, showConfirmPassword, () => setShowConfirmPassword(!showConfirmPassword))}

      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={20} color={theme.colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <NeoButton
        variant="primary"
        onPress={handleRegister}
        loading={isLoading}
        disabled={isLoading}
        style={styles.nextButton}
      >
        完成注册
      </NeoButton>
    </View>
  );

  return (
    <ScreenWrapper edges={['top', 'bottom']} backgroundColor={theme.colors.background}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>用户注册</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Ionicons name="person-add-outline" size={40} color={theme.colors.primary} />
          </View>
          <Text style={styles.title}>创建账户</Text>
          <Text style={styles.subtitle}>加入白垩纪食品溯源系统</Text>
        </View>

        <NeoCard style={styles.formCard}>
          {currentStep === 'phone' ? renderPhoneVerification() : renderInfoForm()}
        </NeoCard>
      </ScrollView>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.background,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  scrollContent: {
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    ...theme.custom.shadows.medium,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  formCard: {
    padding: 24,
  },
  stepHeader: {
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
    paddingBottom: 16,
  },
  stepTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary,
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.custom.borderRadius.s,
    paddingHorizontal: 16,
    height: 50,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.text,
    height: '100%',
  },
  eyeIcon: {
    padding: 8,
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceVariant, // Lighter shade
    borderRadius: theme.custom.borderRadius.s,
    padding: 12,
    marginBottom: 16,
  },
  hintText: {
    marginLeft: 8,
    color: theme.colors.textSecondary,
    fontSize: 13,
    flex: 1,
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
    marginLeft: 8,
    color: theme.colors.error,
    fontSize: 13,
    flex: 1,
  },
  nextButton: {
    marginTop: 8,
  },
});

export default RegisterScreen;
