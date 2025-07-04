import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import {
  Text,
  TextInput,
  Button,
  Card,
  Checkbox,
  Divider,
  Chip
} from 'react-native-paper';
import { useAuthStore } from '@food-trace/core';

interface RegisterForm {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  realName: string;
  phone: string;
  department: string;
  role: string;
  agreeTerms: boolean;
}

const departments = [
  '农业部', '加工部', '物流部', '质检部', '管理部'
];

const roles = [
  'farmer', 'processor', 'logistics', 'inspector', 'admin'
];

const roleNames = {
  farmer: '农户',
  processor: '加工商',
  logistics: '物流商',
  inspector: '检验员',
  admin: '管理员'
};

export default function RegisterScreen() {
  const [form, setForm] = useState<RegisterForm>({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    realName: '',
    phone: '',
    department: '农业部',
    role: 'farmer',
    agreeTerms: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const { register, isLoading } = useAuthStore();

  const handleRegister = async () => {
    // 验证表单
    if (!validateForm()) {
      return;
    }

    try {
      await register({
        username: form.username,
        email: form.email,
        password: form.password,
        realName: form.realName,
        phone: form.phone,
        department: form.department,
        role: form.role
      });
      
      Alert.alert(
        '注册成功',
        '您的账户已创建成功，请使用新账户登录。',
        [
          {
            text: '去登录',
            onPress: () => router.replace('/(auth)/login')
          }
        ]
      );
    } catch (error: any) {
      Alert.alert('注册失败', error.message || '注册过程中发生错误');
    }
  };

  const validateForm = (): boolean => {
    if (!form.username || form.username.length < 3) {
      Alert.alert('错误', '用户名至少3个字符');
      return false;
    }

    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      Alert.alert('错误', '请输入有效的邮箱地址');
      return false;
    }

    if (!form.password || form.password.length < 6) {
      Alert.alert('错误', '密码至少6个字符');
      return false;
    }

    if (form.password !== form.confirmPassword) {
      Alert.alert('错误', '两次输入的密码不一致');
      return false;
    }

    if (!form.realName) {
      Alert.alert('错误', '请输入真实姓名');
      return false;
    }

    if (!form.phone || !/^1[3-9]\d{9}$/.test(form.phone)) {
      Alert.alert('错误', '请输入有效的手机号');
      return false;
    }

    if (!form.agreeTerms) {
      Alert.alert('错误', '请同意用户协议和隐私政策');
      return false;
    }

    return true;
  };

  const handleLogin = () => {
    router.replace('/(auth)/login');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="headlineMedium" style={styles.title}>
              创建账户
            </Text>
            <Text variant="bodyMedium" style={styles.subtitle}>
              加入食品溯源系统
            </Text>

            <View style={styles.form}>
              {/* 基本信息 */}
              <Text variant="titleMedium" style={styles.sectionTitle}>
                基本信息
              </Text>

              <TextInput
                label="用户名 *"
                value={form.username}
                onChangeText={(text) => setForm(prev => ({ ...prev, username: text }))}
                mode="outlined"
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                disabled={isLoading}
              />

              <TextInput
                label="邮箱 *"
                value={form.email}
                onChangeText={(text) => setForm(prev => ({ ...prev, email: text }))}
                mode="outlined"
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                disabled={isLoading}
              />

              <TextInput
                label="真实姓名 *"
                value={form.realName}
                onChangeText={(text) => setForm(prev => ({ ...prev, realName: text }))}
                mode="outlined"
                style={styles.input}
                disabled={isLoading}
              />

              <TextInput
                label="手机号 *"
                value={form.phone}
                onChangeText={(text) => setForm(prev => ({ ...prev, phone: text }))}
                mode="outlined"
                style={styles.input}
                keyboardType="phone-pad"
                disabled={isLoading}
              />

              {/* 密码设置 */}
              <Text variant="titleMedium" style={styles.sectionTitle}>
                密码设置
              </Text>

              <TextInput
                label="密码 *"
                value={form.password}
                onChangeText={(text) => setForm(prev => ({ ...prev, password: text }))}
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
                label="确认密码 *"
                value={form.confirmPassword}
                onChangeText={(text) => setForm(prev => ({ ...prev, confirmPassword: text }))}
                mode="outlined"
                style={styles.input}
                secureTextEntry={!showConfirmPassword}
                right={
                  <TextInput.Icon
                    icon={showConfirmPassword ? "eye-off" : "eye"}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  />
                }
                disabled={isLoading}
              />

              {/* 组织信息 */}
              <Text variant="titleMedium" style={styles.sectionTitle}>
                组织信息
              </Text>

              <Text variant="bodyMedium" style={styles.label}>
                部门
              </Text>
              <View style={styles.chipContainer}>
                {departments.map((dept) => (
                  <Chip
                    key={dept}
                    selected={form.department === dept}
                    onPress={() => setForm(prev => ({ ...prev, department: dept }))}
                    style={styles.chip}
                    disabled={isLoading}
                  >
                    {dept}
                  </Chip>
                ))}
              </View>

              <Text variant="bodyMedium" style={[styles.label, styles.roleLabel]}>
                角色
              </Text>
              <View style={styles.chipContainer}>
                {roles.map((role) => (
                  <Chip
                    key={role}
                    selected={form.role === role}
                    onPress={() => setForm(prev => ({ ...prev, role }))}
                    style={styles.chip}
                    disabled={isLoading}
                  >
                    {roleNames[role as keyof typeof roleNames]}
                  </Chip>
                ))}
              </View>

              {/* 协议同意 */}
              <View style={styles.agreementRow}>
                <Checkbox
                  status={form.agreeTerms ? 'checked' : 'unchecked'}
                  onPress={() => setForm(prev => ({ ...prev, agreeTerms: !prev.agreeTerms }))}
                  disabled={isLoading}
                />
                <Text variant="bodyMedium" style={styles.agreementText}>
                  我已阅读并同意{' '}
                  <Text style={styles.linkText}>用户协议</Text>
                  {' '}和{' '}
                  <Text style={styles.linkText}>隐私政策</Text>
                </Text>
              </View>

              <Button
                mode="contained"
                onPress={handleRegister}
                style={styles.registerButton}
                disabled={isLoading}
                loading={isLoading}
              >
                {isLoading ? '注册中...' : '立即注册'}
              </Button>

              <Divider style={styles.divider} />

              <Button
                mode="text"
                onPress={handleLogin}
                style={styles.loginButton}
                disabled={isLoading}
              >
                已有账户？立即登录
              </Button>
            </View>
          </Card.Content>
        </Card>
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
  },
  card: {
    marginBottom: 16,
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: 'bold',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.7,
  },
  form: {
    gap: 16,
  },
  sectionTitle: {
    marginTop: 16,
    marginBottom: 8,
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: 'transparent',
  },
  label: {
    marginBottom: 8,
    fontWeight: '500',
  },
  roleLabel: {
    marginTop: 16,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    marginBottom: 4,
  },
  agreementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  agreementText: {
    flex: 1,
    marginLeft: 8,
  },
  linkText: {
    color: '#2196F3',
    textDecorationLine: 'underline',
  },
  registerButton: {
    marginTop: 16,
  },
  divider: {
    marginVertical: 16,
  },
  loginButton: {
    marginBottom: 8,
  },
});