import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import {
  Text,
  TextInput,
  Button,
  Card,
  Switch,
  Divider,
  ActivityIndicator
} from 'react-native-paper';
import { useAuthStore } from '@food-trace/core';

export default function LoginScreen() {
  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
    rememberMe: false
  });
  const [showPassword, setShowPassword] = useState(false);
  
  const { login, isLoading } = useAuthStore();

  const handleLogin = async () => {
    if (!credentials.username || !credentials.password) {
      Alert.alert('错误', '请输入用户名和密码');
      return;
    }

    try {
      await login(credentials);
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('登录失败', error.message || '登录过程中发生错误');
    }
  };

  const handleForgotPassword = () => {
    router.push('/(auth)/forgot-password');
  };

  const handleRegister = () => {
    router.push('/(auth)/register');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="headlineMedium" style={styles.title}>
              食品溯源系统
            </Text>
            <Text variant="bodyMedium" style={styles.subtitle}>
              请登录您的账户
            </Text>

            <View style={styles.form}>
              <TextInput
                label="用户名"
                value={credentials.username}
                onChangeText={(text) => 
                  setCredentials(prev => ({ ...prev, username: text }))
                }
                mode="outlined"
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                disabled={isLoading}
              />

              <TextInput
                label="密码"
                value={credentials.password}
                onChangeText={(text) => 
                  setCredentials(prev => ({ ...prev, password: text }))
                }
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

              <View style={styles.rememberRow}>
                <Text variant="bodyMedium">记住我</Text>
                <Switch
                  value={credentials.rememberMe}
                  onValueChange={(value) => 
                    setCredentials(prev => ({ ...prev, rememberMe: value }))
                  }
                  disabled={isLoading}
                />
              </View>

              <Button
                mode="contained"
                onPress={handleLogin}
                style={styles.loginButton}
                disabled={isLoading}
                loading={isLoading}
              >
                {isLoading ? '登录中...' : '登录'}
              </Button>

              <Button
                mode="text"
                onPress={handleForgotPassword}
                style={styles.forgotButton}
                disabled={isLoading}
              >
                忘记密码？
              </Button>

              <Divider style={styles.divider} />

              <Button
                mode="outlined"
                onPress={handleRegister}
                style={styles.registerButton}
                disabled={isLoading}
              >
                注册新账户
              </Button>
            </View>
          </Card.Content>
        </Card>

        {__DEV__ && (
          <Card style={styles.debugCard}>
            <Card.Content>
              <Text variant="titleSmall" style={styles.debugTitle}>
                开发模式测试账户
              </Text>
              <Text variant="bodySmall">
                管理员: admin / admin123{'\n'}
                经理: manager / manager123{'\n'}
                用户: user / user123
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
    minHeight: '100%',
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
  input: {
    backgroundColor: 'transparent',
  },
  rememberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
  },
  loginButton: {
    marginTop: 8,
  },
  forgotButton: {
    marginTop: 8,
  },
  divider: {
    marginVertical: 16,
  },
  registerButton: {
    marginBottom: 8,
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