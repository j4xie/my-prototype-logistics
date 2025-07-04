import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import {
  Text,
  TextInput,
  Button,
  Card,
  Divider
} from 'react-native-paper';

enum ResetStep {
  SendCode = 'send',
  VerifyCode = 'verify',
  ResetPassword = 'reset'
}

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<ResetStep>(ResetStep.SendCode);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSendCode = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert('错误', '请输入有效的邮箱地址');
      return;
    }

    setIsLoading(true);
    try {
      // 模拟发送重置码
      await new Promise(resolve => setTimeout(resolve, 1500));
      Alert.alert(
        '验证码已发送',
        '请查看您的邮箱，验证码有效期为10分钟。',
        [{ text: '确定', onPress: () => setStep(ResetStep.VerifyCode) }]
      );
    } catch (error) {
      Alert.alert('发送失败', '请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code || code.length !== 6) {
      Alert.alert('错误', '请输入6位验证码');
      return;
    }

    setIsLoading(true);
    try {
      // 模拟验证码验证
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 模拟验证失败（示例）
      if (code !== '123456') {
        Alert.alert('验证失败', '验证码错误或已过期');
        return;
      }

      setStep(ResetStep.ResetPassword);
    } catch (error) {
      Alert.alert('验证失败', '请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('错误', '密码至少6个字符');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('错误', '两次输入的密码不一致');
      return;
    }

    setIsLoading(true);
    try {
      // 模拟密码重置
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      Alert.alert(
        '密码重置成功',
        '您的密码已成功重置，请使用新密码登录。',
        [
          {
            text: '去登录',
            onPress: () => router.replace('/(auth)/login')
          }
        ]
      );
    } catch (error) {
      Alert.alert('重置失败', '请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (step === ResetStep.SendCode) {
      router.back();
    } else if (step === ResetStep.VerifyCode) {
      setStep(ResetStep.SendCode);
    } else {
      setStep(ResetStep.VerifyCode);
    }
  };

  const renderSendCodeStep = () => (
    <>
      <Text variant="bodyMedium" style={styles.description}>
        请输入您注册时使用的邮箱地址，我们将向您发送密码重置验证码。
      </Text>

      <TextInput
        label="邮箱地址"
        value={email}
        onChangeText={setEmail}
        mode="outlined"
        style={styles.input}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        disabled={isLoading}
      />

      <Button
        mode="contained"
        onPress={handleSendCode}
        style={styles.actionButton}
        disabled={isLoading}
        loading={isLoading}
      >
        {isLoading ? '发送中...' : '发送验证码'}
      </Button>
    </>
  );

  const renderVerifyCodeStep = () => (
    <>
      <Text variant="bodyMedium" style={styles.description}>
        验证码已发送至 {email}，请输入收到的6位验证码。
      </Text>

      <TextInput
        label="验证码"
        value={code}
        onChangeText={setCode}
        mode="outlined"
        style={styles.input}
        keyboardType="number-pad"
        maxLength={6}
        disabled={isLoading}
      />

      <Button
        mode="contained"
        onPress={handleVerifyCode}
        style={styles.actionButton}
        disabled={isLoading}
        loading={isLoading}
      >
        {isLoading ? '验证中...' : '验证码码'}
      </Button>

      <Button
        mode="text"
        onPress={handleSendCode}
        disabled={isLoading}
      >
        没收到验证码？重新发送
      </Button>
    </>
  );

  const renderResetPasswordStep = () => (
    <>
      <Text variant="bodyMedium" style={styles.description}>
        请设置您的新密码，密码至少6个字符。
      </Text>

      <TextInput
        label="新密码"
        value={newPassword}
        onChangeText={setNewPassword}
        mode="outlined"
        style={styles.input}
        secureTextEntry={!showPassword}
        right={
          <TextInput.Icon
            icon={showPassword ? "eye-off" : "eye"}
            onPress={() => setShowPassword(!showPassword)}
          />
        }
        disabled={isLoading}
      />

      <TextInput
        label="确认新密码"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        mode="outlined"
        style={styles.input}
        secureTextEntry={!showPassword}
        disabled={isLoading}
      />

      <Button
        mode="contained"
        onPress={handleResetPassword}
        style={styles.actionButton}
        disabled={isLoading}
        loading={isLoading}
      >
        {isLoading ? '重置中...' : '重置密码'}
      </Button>
    </>
  );

  const getStepTitle = () => {
    switch (step) {
      case ResetStep.SendCode:
        return '忘记密码';
      case ResetStep.VerifyCode:
        return '验证邮箱';
      case ResetStep.ResetPassword:
        return '重置密码';
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="headlineMedium" style={styles.title}>
              {getStepTitle()}
            </Text>

            <View style={styles.stepIndicator}>
              <View style={[
                styles.stepDot, 
                step === ResetStep.SendCode && styles.activeStep
              ]} />
              <View style={styles.stepLine} />
              <View style={[
                styles.stepDot, 
                step === ResetStep.VerifyCode && styles.activeStep
              ]} />
              <View style={styles.stepLine} />
              <View style={[
                styles.stepDot, 
                step === ResetStep.ResetPassword && styles.activeStep
              ]} />
            </View>

            <View style={styles.form}>
              {step === ResetStep.SendCode && renderSendCodeStep()}
              {step === ResetStep.VerifyCode && renderVerifyCodeStep()}
              {step === ResetStep.ResetPassword && renderResetPasswordStep()}

              <Divider style={styles.divider} />

              <Button
                mode="outlined"
                onPress={handleBack}
                disabled={isLoading}
              >
                {step === ResetStep.SendCode ? '返回登录' : '上一步'}
              </Button>
            </View>
          </Card.Content>
        </Card>

        {__DEV__ && (
          <Card style={styles.debugCard}>
            <Card.Content>
              <Text variant="titleSmall" style={styles.debugTitle}>
                开发模式提示
              </Text>
              <Text variant="bodySmall">
                测试验证码: 123456{'\n'}
                当前步骤: {step}
              </Text>
            </Card.Content>
          </Card>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  card: {
    marginBottom: 16,
  },
  title: {
    textAlign: 'center',
    marginBottom: 24,
    fontWeight: 'bold',
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e0e0e0',
  },
  activeStep: {
    backgroundColor: '#2196F3',
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 8,
  },
  description: {
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.7,
    lineHeight: 20,
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: 'transparent',
  },
  actionButton: {
    marginTop: 8,
  },
  divider: {
    marginVertical: 16,
  },
  debugCard: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
    borderWidth: 1,
  },
  debugTitle: {
    marginBottom: 8,
    fontWeight: 'bold',
  },
});