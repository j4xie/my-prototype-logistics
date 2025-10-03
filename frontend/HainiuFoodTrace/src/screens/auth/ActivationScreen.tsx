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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ActivationService } from '../../services/activation/activationService';

interface ActivationScreenProps {
  navigation: any;
}

export const ActivationScreen: React.FC<ActivationScreenProps> = ({ navigation }) => {
  const [activationCode, setActivationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activationStatus, setActivationStatus] = useState<any>(null);

  useEffect(() => {
    checkActivationStatus();
  }, []);

  // 检查激活状态
  const checkActivationStatus = async () => {
    try {
      const status = await ActivationService.checkActivationStatus();
      setActivationStatus(status);
      
      if (status.isActivated) {
        Alert.alert('提示', '应用已激活', [
          { text: '确定', onPress: () => navigation.goBack() }
        ]);
      }
    } catch (error) {
      console.error('检查激活状态失败:', error);
    }
  };

  // 激活应用
  const handleActivation = async () => {
    if (!activationCode.trim()) {
      Alert.alert('错误', '请输入激活码');
      return;
    }

    if (activationCode.trim().length < 8) {
      Alert.alert('错误', '激活码长度不足');
      return;
    }

    setIsLoading(true);
    try {
      const response = await ActivationService.activateApp(activationCode.trim());
      
      if (response.success) {
        Alert.alert('激活成功', '应用已成功激活，您现在可以正常使用所有功能', [
          { text: '确定', onPress: () => navigation.replace('Login') }
        ]);
      } else {
        Alert.alert('激活失败', response.message || '激活码无效或已过期');
      }
    } catch (error: any) {
      Alert.alert('激活失败', error.message || '网络错误，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 返回登录页面
  const handleBackToLogin = () => {
    navigation.goBack();
  };

  // 联系客服
  const handleContactSupport = () => {
    Alert.alert(
      '联系客服',
      '如需获取激活码或遇到问题，请联系：\n\n客服热线：400-123-4567\n客服微信：hainiu_support\n工作时间：9:00-18:00',
      [{ text: '确定' }]
    );
  };

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
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* 头部 */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBackToLogin}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>应用激活</Text>
            <View style={styles.headerRight} />
          </View>

          {/* 激活图标 */}
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="key" size={60} color="#3182ce" />
            </View>
          </View>

          {/* 表单内容 */}
          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>激活海牛食品溯源</Text>
            <Text style={styles.formSubtitle}>
              请输入您的激活码以开始使用所有功能
            </Text>

            {/* 设备信息显示 */}
            {activationStatus && (
              <View style={styles.deviceInfoContainer}>
                <Text style={styles.deviceInfoTitle}>设备信息</Text>
                <View style={styles.deviceInfoItem}>
                  <Text style={styles.deviceInfoLabel}>设备ID:</Text>
                  <Text style={styles.deviceInfoValue}>
                    {activationStatus.deviceId.substring(0, 20)}...
                  </Text>
                </View>
                <View style={styles.deviceInfoItem}>
                  <Text style={styles.deviceInfoLabel}>应用版本:</Text>
                  <Text style={styles.deviceInfoValue}>{activationStatus.appVersion}</Text>
                </View>
              </View>
            )}

            {/* 激活码输入 */}
            <View style={styles.inputContainer}>
              <Ionicons name="key-outline" size={20} color="#64748b" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="请输入激活码"
                placeholderTextColor="#94a3b8"
                value={activationCode}
                onChangeText={setActivationCode}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={32}
              />
            </View>

            {/* 激活码格式提示 */}
            <View style={styles.hintContainer}>
              <Ionicons name="information-circle-outline" size={16} color="#64748b" />
              <Text style={styles.hintText}>
                激活码通常为8-32位字符，包含数字和字母
              </Text>
            </View>

            {/* 激活按钮 */}
            <TouchableOpacity
              style={[styles.activationButton, isLoading && styles.activationButtonDisabled]}
              onPress={handleActivation}
              disabled={isLoading}
            >
              <Text style={styles.activationButtonText}>
                {isLoading ? '激活中...' : '激活应用'}
              </Text>
            </TouchableOpacity>

            {/* 帮助说明 */}
            <View style={styles.helpContainer}>
              <Text style={styles.helpTitle}>激活说明</Text>
              <View style={styles.helpItem}>
                <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                <Text style={styles.helpText}>激活码由管理员分配</Text>
              </View>
              <View style={styles.helpItem}>
                <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                <Text style={styles.helpText}>一个激活码只能绑定一台设备</Text>
              </View>
              <View style={styles.helpItem}>
                <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                <Text style={styles.helpText}>激活后可以使用所有功能</Text>
              </View>
            </View>

            {/* 联系客服 */}
            <TouchableOpacity style={styles.supportButton} onPress={handleContactSupport}>
              <Ionicons name="headset-outline" size={20} color="#3182ce" />
              <Text style={styles.supportButtonText}>联系客服获取激活码</Text>
            </TouchableOpacity>
          </View>

          {/* 底部说明 */}
          <View style={styles.bottomContainer}>
            <Text style={styles.bottomText}>
              激活码请妥善保管，如有问题请及时联系客服
            </Text>
          </View>
        </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerRight: {
    width: 40,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  formContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 30,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 20,
  },
  deviceInfoContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  deviceInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
  },
  deviceInfoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  deviceInfoLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  deviceInfoValue: {
    fontSize: 13,
    color: '#1e293b',
    fontFamily: 'monospace',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 15,
    marginBottom: 12,
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
    fontFamily: 'monospace',
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  hintText: {
    fontSize: 12,
    color: '#64748b',
    marginLeft: 6,
    flex: 1,
  },
  activationButton: {
    backgroundColor: '#3182ce',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#3182ce',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  activationButtonDisabled: {
    backgroundColor: '#94a3b8',
    shadowOpacity: 0,
    elevation: 0,
  },
  activationButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  helpContainer: {
    marginBottom: 20,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  helpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    color: '#64748b',
    marginLeft: 8,
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(49, 130, 206, 0.1)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(49, 130, 206, 0.3)',
  },
  supportButtonText: {
    fontSize: 14,
    color: '#3182ce',
    marginLeft: 8,
    fontWeight: '500',
  },
  bottomContainer: {
    alignItems: 'center',
    paddingBottom: 30,
  },
  bottomText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 18,
  },
});