/**
 * ISAPI 摄像头设备创建页面
 * 添加海康威视 IPC/NVR/DVR 设备
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Icon } from 'react-native-paper';
import isapiApiClient, {
  CreateIsapiDeviceRequest,
  IsapiDeviceType,
  IsapiProtocol,
  getDeviceTypeName,
} from '../../../services/api/isapiApiClient';

export function IsapiDeviceCreateScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'failed' | null>(null);

  // 表单状态
  const [deviceName, setDeviceName] = useState('');
  const [deviceType, setDeviceType] = useState<IsapiDeviceType>('IPC');
  const [deviceModel, setDeviceModel] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [port, setPort] = useState('80');
  const [rtspPort, setRtspPort] = useState('554');
  const [protocol, setProtocol] = useState<IsapiProtocol>('HTTP');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [locationDescription, setLocationDescription] = useState('');

  // 验证IP地址
  const isValidIp = (ip: string): boolean => {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  };

  // 验证表单
  const validateForm = (): boolean => {
    if (!deviceName.trim()) {
      Alert.alert('验证失败', '请输入设备名称');
      return false;
    }
    if (!ipAddress.trim()) {
      Alert.alert('验证失败', '请输入IP地址');
      return false;
    }
    if (!isValidIp(ipAddress)) {
      Alert.alert('验证失败', 'IP地址格式不正确');
      return false;
    }
    if (!username.trim()) {
      Alert.alert('验证失败', '请输入用户名');
      return false;
    }
    if (!password.trim()) {
      Alert.alert('验证失败', '请输入密码');
      return false;
    }
    return true;
  };

  // 测试连接
  const handleTestConnection = async () => {
    if (!isValidIp(ipAddress)) {
      Alert.alert('验证失败', '请输入有效的IP地址');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      // 创建临时设备进行测试
      const tempDevice = await isapiApiClient.createIsapiDevice({
        deviceName: `test-${Date.now()}`,
        deviceType,
        ipAddress,
        port: parseInt(port) || 80,
        rtspPort: parseInt(rtspPort) || 554,
        protocol,
        username,
        password,
      });

      // 测试连接
      const result = await isapiApiClient.testConnection(tempDevice.id);

      // 删除临时设备
      await isapiApiClient.deleteIsapiDevice(tempDevice.id);

      setTestResult(result.connected ? 'success' : 'failed');
      Alert.alert(
        result.connected ? '连接成功' : '连接失败',
        result.connected ? '设备连接正常，可以保存' : '无法连接到设备，请检查配置'
      );
    } catch (err) {
      setTestResult('failed');
      Alert.alert('测试失败', '连接测试时发生错误');
    } finally {
      setTesting(false);
    }
  };

  // 提交表单
  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const request: CreateIsapiDeviceRequest = {
        deviceName: deviceName.trim(),
        deviceType,
        deviceModel: deviceModel.trim() || undefined,
        ipAddress: ipAddress.trim(),
        port: parseInt(port) || 80,
        rtspPort: parseInt(rtspPort) || 554,
        protocol,
        username: username.trim(),
        password: password,
        locationDescription: locationDescription.trim() || undefined,
      };

      await isapiApiClient.createIsapiDevice(request);
      Alert.alert('成功', '设备添加成功', [
        { text: '确定', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      console.error('添加设备失败:', err);
      Alert.alert('添加失败', '添加设备时发生错误');
    } finally {
      setLoading(false);
    }
  };

  const deviceTypes: IsapiDeviceType[] = ['IPC', 'NVR', 'DVR', 'ENCODER'];
  const protocols: IsapiProtocol[] = ['HTTP', 'HTTPS'];

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* 基本信息 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>基本信息</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>设备名称 *</Text>
              <TextInput
                style={styles.input}
                value={deviceName}
                onChangeText={setDeviceName}
                placeholder="如：东门入口摄像头"
                placeholderTextColor="#a0aec0"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>设备类型 *</Text>
              <View style={styles.typeSelector}>
                {deviceTypes.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeBtn, deviceType === type && styles.typeBtnActive]}
                    onPress={() => setDeviceType(type)}
                  >
                    <Text style={[styles.typeBtnText, deviceType === type && styles.typeBtnTextActive]}>
                      {getDeviceTypeName(type)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>设备型号</Text>
              <TextInput
                style={styles.input}
                value={deviceModel}
                onChangeText={setDeviceModel}
                placeholder="如：DS-2CD2T45FWD-I5"
                placeholderTextColor="#a0aec0"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>安装位置</Text>
              <TextInput
                style={styles.input}
                value={locationDescription}
                onChangeText={setLocationDescription}
                placeholder="如：东门入口、生产车间A区"
                placeholderTextColor="#a0aec0"
              />
            </View>
          </View>

          {/* 网络配置 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>网络配置</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>IP地址 *</Text>
              <TextInput
                style={styles.input}
                value={ipAddress}
                onChangeText={setIpAddress}
                placeholder="192.168.1.100"
                placeholderTextColor="#a0aec0"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.label}>HTTP端口</Text>
                <TextInput
                  style={styles.input}
                  value={port}
                  onChangeText={setPort}
                  placeholder="80"
                  placeholderTextColor="#a0aec0"
                  keyboardType="numeric"
                />
              </View>
              <View style={{ width: 12 }} />
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.label}>RTSP端口</Text>
                <TextInput
                  style={styles.input}
                  value={rtspPort}
                  onChangeText={setRtspPort}
                  placeholder="554"
                  placeholderTextColor="#a0aec0"
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>协议</Text>
              <View style={styles.protocolSelector}>
                {protocols.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.protocolBtn, protocol === p && styles.protocolBtnActive]}
                    onPress={() => setProtocol(p)}
                  >
                    <Text style={[styles.protocolBtnText, protocol === p && styles.protocolBtnTextActive]}>
                      {p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* 认证信息 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>认证信息</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>用户名 *</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="admin"
                placeholderTextColor="#a0aec0"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>密码 *</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="输入设备密码"
                placeholderTextColor="#a0aec0"
                secureTextEntry
              />
            </View>
          </View>

          {/* 连接测试 */}
          <View style={styles.section}>
            <TouchableOpacity
              style={[
                styles.testBtn,
                testing && styles.testBtnDisabled,
                testResult === 'success' && styles.testBtnSuccess,
                testResult === 'failed' && styles.testBtnFailed,
              ]}
              onPress={handleTestConnection}
              disabled={testing}
            >
              {testing ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Icon
                  source={testResult === 'success' ? 'check-circle' : testResult === 'failed' ? 'close-circle' : 'lan-connect'}
                  size={20}
                  color="#ffffff"
                />
              )}
              <Text style={styles.testBtnText}>
                {testing ? '测试中...' : testResult === 'success' ? '连接成功' : testResult === 'failed' ? '连接失败' : '测试连接'}
              </Text>
            </TouchableOpacity>

            <View style={styles.testHint}>
              <Icon source="information-outline" size={16} color="#718096" />
              <Text style={styles.testHintText}>
                建议先测试连接，确保设备配置正确后再保存
              </Text>
            </View>
          </View>

          {/* 提交按钮 */}
          <View style={styles.submitSection}>
            <TouchableOpacity
              style={[styles.cancelBtn]}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.cancelBtnText}>取消</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Icon source="check" size={20} color="#ffffff" />
              )}
              <Text style={styles.submitBtnText}>{loading ? '保存中...' : '保存设备'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  formRow: {
    flexDirection: 'row',
  },
  label: {
    fontSize: 14,
    color: '#4a5568',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f7fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#2d3748',
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f7fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  typeBtnActive: {
    backgroundColor: '#3182ce',
    borderColor: '#3182ce',
  },
  typeBtnText: {
    fontSize: 14,
    color: '#4a5568',
  },
  typeBtnTextActive: {
    color: '#ffffff',
    fontWeight: '500',
  },
  protocolSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  protocolBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f7fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  protocolBtnActive: {
    backgroundColor: '#3182ce',
    borderColor: '#3182ce',
  },
  protocolBtnText: {
    fontSize: 14,
    color: '#4a5568',
  },
  protocolBtnTextActive: {
    color: '#ffffff',
    fontWeight: '500',
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4a5568',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  testBtnDisabled: {
    opacity: 0.6,
  },
  testBtnSuccess: {
    backgroundColor: '#48bb78',
  },
  testBtnFailed: {
    backgroundColor: '#e53e3e',
  },
  testBtnText: {
    fontSize: 15,
    color: '#ffffff',
    fontWeight: '500',
  },
  testHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  testHintText: {
    fontSize: 12,
    color: '#718096',
    flex: 1,
  },
  submitSection: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 24,
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#e2e8f0',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    color: '#4a5568',
    fontWeight: '500',
  },
  submitBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3182ce',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: 15,
    color: '#ffffff',
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 40,
  },
});

export default IsapiDeviceCreateScreen;
