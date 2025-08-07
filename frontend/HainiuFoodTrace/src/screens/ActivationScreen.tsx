import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ActivationService, ActivationStatus } from '../services/activation/activationService';
import { APP_CONFIG } from '../constants/config';

interface Props {
  onActivationComplete: (status: ActivationStatus) => void;
}

export const ActivationScreen: React.FC<Props> = ({ onActivationComplete }) => {
  const [activationCode, setActivationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [deviceId, setDeviceId] = useState('');

  useEffect(() => {
    loadDeviceInfo();
  }, []);

  const loadDeviceInfo = async () => {
    try {
      const status = await ActivationService.checkActivationStatus();
      setDeviceId(status.deviceId);
    } catch (error) {
      console.error('加载设备信息失败:', error);
    }
  };

  const handleActivation = async () => {
    if (!activationCode.trim()) {
      Alert.alert('错误', '请输入激活码');
      return;
    }

    setIsLoading(true);

    try {
      const result = await ActivationService.activateApp(activationCode.trim());

      if (result.success && result.data) {
        Alert.alert('成功', result.message, [
          {
            text: '确定',
            onPress: () => onActivationComplete(result.data!),
          },
        ]);
      } else {
        Alert.alert('激活失败', result.message);
      }
    } catch (error) {
      Alert.alert('错误', '激活过程中发生错误，请稍后重试');
      console.error('激活错误:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestActivation = () => {
    // 开发测试用的激活码
    setActivationCode('DEV_TEST_2024');
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{APP_CONFIG.NAME}</Text>
          <Text style={styles.subtitle}>应用激活</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>设备ID</Text>
          <Text style={styles.deviceId}>{deviceId}</Text>

          <Text style={styles.label}>激活码</Text>
          <TextInput
            style={styles.input}
            value={activationCode}
            onChangeText={setActivationCode}
            placeholder="请输入激活码"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="characters"
            maxLength={20}
            editable={!isLoading}
          />

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleActivation}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>激活应用</Text>
            )}
          </TouchableOpacity>

          {__DEV__ && (
            <TouchableOpacity
              style={styles.testButton}
              onPress={handleTestActivation}
              disabled={isLoading}
            >
              <Text style={styles.testButtonText}>使用测试激活码</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            请联系管理员获取激活码
          </Text>
          <Text style={styles.versionText}>
            Version {APP_CONFIG.VERSION}
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  form: {
    marginBottom: 48,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  deviceId: {
    fontSize: 12,
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
    fontFamily: 'monospace',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 24,
    color: '#1F2937',
  },
  button: {
    backgroundColor: '#2563EB',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  testButton: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  testButtonText: {
    color: '#6B7280',
    fontSize: 14,
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  versionText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});