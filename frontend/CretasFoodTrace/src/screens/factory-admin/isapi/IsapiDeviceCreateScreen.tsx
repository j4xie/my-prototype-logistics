/**
 * ISAPI 摄像头设备创建页面
 * 添加海康威视 IPC/NVR/DVR 设备
 * 支持 AI 辅助添加（拍照识别设备配置）
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
  Modal,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Icon } from 'react-native-paper';
import isapiApiClient, {
  CreateIsapiDeviceRequest,
  IsapiDeviceType,
  IsapiProtocol,
  getDeviceTypeName,
} from '../../../services/api/isapiApiClient';
import {
  useIsapiConfigParser,
  IsapiConfigResult,
} from '../../../hooks/useIsapiConfigParser';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function IsapiDeviceCreateScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'failed' | null>(null);

  // AI 输入模态框状态
  const [showAIModal, setShowAIModal] = useState(false);
  const [showTextInputModal, setShowTextInputModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [parseResult, setParseResult] = useState<IsapiConfigResult | null>(null);
  const [textInput, setTextInput] = useState('');

  // 配置解析 Hook
  const {
    loading: parsingConfig,
    parseFromCamera,
    parseFromGallery,
    parseFromText,
  } = useIsapiConfigParser();

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

  // ========== AI 输入处理 ==========

  /** 处理拍照识别 */
  const handleCameraCapture = async () => {
    setShowAIModal(false);
    const result = await parseFromCamera();
    if (result) {
      setParseResult(result);
      setShowResultModal(true);
    }
  };

  /** 处理相册选择 */
  const handleGallerySelect = async () => {
    setShowAIModal(false);
    const result = await parseFromGallery();
    if (result) {
      setParseResult(result);
      setShowResultModal(true);
    }
  };

  /** 处理文字描述 */
  const handleTextInputOption = () => {
    setShowAIModal(false);
    setShowTextInputModal(true);
  };

  /** 提交文字描述 */
  const handleTextSubmit = async () => {
    if (!textInput.trim()) {
      Alert.alert('提示', '请输入设备配置信息');
      return;
    }
    setShowTextInputModal(false);
    const result = await parseFromText(textInput);
    if (result) {
      setParseResult(result);
      setShowResultModal(true);
    }
    setTextInput('');
  };

  /** 应用识别结果到表单 */
  const applyParseResult = (result: IsapiConfigResult) => {
    // 应用识别到的字段
    if (result.deviceName) {
      setDeviceName(result.deviceName);
    }
    if (result.ipAddress) {
      setIpAddress(result.ipAddress);
    }
    if (result.port) {
      setPort(String(result.port));
    }
    if (result.rtspPort) {
      setRtspPort(String(result.rtspPort));
    }
    if (result.username) {
      setUsername(result.username);
    }
    if (result.password) {
      setPassword(result.password);
    }
    if (result.deviceModel) {
      setDeviceModel(result.deviceModel);
    }
    if (result.locationDescription) {
      setLocationDescription(result.locationDescription);
    }

    setShowResultModal(false);
    setParseResult(null);

    Alert.alert('填充成功', '已自动填充识别到的设备信息，请检查并补充其他必填项');
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

      {/* AI 助手按钮 */}
      <TouchableOpacity
        style={[styles.aiButton, parsingConfig && styles.aiButtonDisabled]}
        onPress={() => setShowAIModal(true)}
        activeOpacity={0.8}
        disabled={parsingConfig}
      >
        {parsingConfig ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Icon source="robot" size={24} color="#fff" />
        )}
      </TouchableOpacity>

      {/* AI 输入选择模态框 */}
      <Modal
        visible={showAIModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAIModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAIModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>AI 智能添加设备</Text>
            <Text style={styles.modalSubtitle}>选择输入方式</Text>

            <View style={styles.inputOptionsRow}>
              <TouchableOpacity
                style={styles.inputOption}
                onPress={handleCameraCapture}
              >
                <View style={[styles.inputOptionIcon, { backgroundColor: '#ebf8ff' }]}>
                  <Icon source="camera" size={28} color="#3182ce" />
                </View>
                <Text style={styles.inputOptionLabel}>拍照识别</Text>
                <Text style={styles.inputOptionHint}>拍摄设备标签</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.inputOption}
                onPress={handleGallerySelect}
              >
                <View style={[styles.inputOptionIcon, { backgroundColor: '#faf5ff' }]}>
                  <Icon source="image" size={28} color="#805ad5" />
                </View>
                <Text style={styles.inputOptionLabel}>相册选择</Text>
                <Text style={styles.inputOptionHint}>选择已有图片</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.inputOption}
                onPress={handleTextInputOption}
              >
                <View style={[styles.inputOptionIcon, { backgroundColor: '#f0fff4' }]}>
                  <Icon source="message-text" size={28} color="#38a169" />
                </View>
                <Text style={styles.inputOptionLabel}>文字描述</Text>
                <Text style={styles.inputOptionHint}>输入设备信息</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.cancelModalButton}
              onPress={() => setShowAIModal(false)}
            >
              <Text style={styles.cancelModalButtonText}>取消</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 文字输入模态框 */}
      <Modal
        visible={showTextInputModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTextInputModal(false)}
      >
        <View style={styles.textInputModalOverlay}>
          <View style={styles.textInputModalContent}>
            <Text style={styles.textInputModalTitle}>输入设备配置信息</Text>
            <Text style={styles.textInputModalHint}>
              请输入设备的 IP 地址、端口、用户名等信息，AI 将自动解析
            </Text>
            <TextInput
              style={styles.textInputArea}
              value={textInput}
              onChangeText={setTextInput}
              placeholder="例如：IP地址192.168.1.100，端口80，用户名admin，密码123456，型号DS-2CD2T45FWD-I5"
              placeholderTextColor="#a0aec0"
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
            <View style={styles.textInputButtonRow}>
              <TouchableOpacity
                style={styles.textInputCancelBtn}
                onPress={() => {
                  setShowTextInputModal(false);
                  setTextInput('');
                }}
              >
                <Text style={styles.textInputCancelBtnText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.textInputSubmitBtn}
                onPress={handleTextSubmit}
              >
                <Icon source="robot" size={18} color="#fff" />
                <Text style={styles.textInputSubmitBtnText}>AI 解析</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 设备配置识别结果模态框 */}
      <Modal
        visible={showResultModal && !!parseResult}
        transparent
        animationType="fade"
        onRequestClose={() => setShowResultModal(false)}
      >
        <View style={styles.resultModalOverlay}>
          <View style={styles.resultModalContent}>
            <Text style={styles.resultModalTitle}>设备配置识别结果</Text>

            {parseResult && (
              <View style={styles.resultList}>
                {parseResult.deviceName && (
                  <View style={styles.resultItem}>
                    <Text style={styles.resultLabel}>设备名称</Text>
                    <Text style={styles.resultValue}>{parseResult.deviceName}</Text>
                  </View>
                )}
                {parseResult.ipAddress && (
                  <View style={styles.resultItem}>
                    <Text style={styles.resultLabel}>IP地址</Text>
                    <Text style={styles.resultValue}>{parseResult.ipAddress}</Text>
                  </View>
                )}
                {parseResult.port && (
                  <View style={styles.resultItem}>
                    <Text style={styles.resultLabel}>HTTP端口</Text>
                    <Text style={styles.resultValue}>{parseResult.port}</Text>
                  </View>
                )}
                {parseResult.rtspPort && (
                  <View style={styles.resultItem}>
                    <Text style={styles.resultLabel}>RTSP端口</Text>
                    <Text style={styles.resultValue}>{parseResult.rtspPort}</Text>
                  </View>
                )}
                {parseResult.username && (
                  <View style={styles.resultItem}>
                    <Text style={styles.resultLabel}>用户名</Text>
                    <Text style={styles.resultValue}>{parseResult.username}</Text>
                  </View>
                )}
                {parseResult.password && (
                  <View style={styles.resultItem}>
                    <Text style={styles.resultLabel}>密码</Text>
                    <Text style={styles.resultValue}>{'*'.repeat(parseResult.password.length)}</Text>
                  </View>
                )}
                {parseResult.deviceModel && (
                  <View style={styles.resultItem}>
                    <Text style={styles.resultLabel}>设备型号</Text>
                    <Text style={styles.resultValue}>{parseResult.deviceModel}</Text>
                  </View>
                )}
                {parseResult.serialNumber && (
                  <View style={styles.resultItem}>
                    <Text style={styles.resultLabel}>序列号</Text>
                    <Text style={styles.resultValue}>{parseResult.serialNumber}</Text>
                  </View>
                )}
                {parseResult.locationDescription && (
                  <View style={styles.resultItem}>
                    <Text style={styles.resultLabel}>安装位置</Text>
                    <Text style={styles.resultValue}>{parseResult.locationDescription}</Text>
                  </View>
                )}
                <View style={styles.resultItem}>
                  <Text style={styles.resultLabel}>识别置信度</Text>
                  <Text
                    style={[
                      styles.resultValue,
                      {
                        color:
                          parseResult.confidence >= 0.8
                            ? '#38a169'
                            : parseResult.confidence >= 0.5
                            ? '#d69e2e'
                            : '#e53e3e',
                      },
                    ]}
                  >
                    {Math.round(parseResult.confidence * 100)}%
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.resultButtonRow}>
              <TouchableOpacity
                style={styles.resultButtonSecondary}
                onPress={() => {
                  setShowResultModal(false);
                  setParseResult(null);
                }}
              >
                <Text style={styles.resultButtonSecondaryText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.resultButtonPrimary}
                onPress={() => parseResult && applyParseResult(parseResult)}
              >
                <Icon source="check" size={18} color="#fff" />
                <Text style={styles.resultButtonPrimaryText}>应用到表单</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    height: 100,
  },

  // ========== AI 助手按钮样式 ==========
  aiButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#805ad5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#805ad5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  aiButtonDisabled: {
    opacity: 0.7,
  },

  // ========== AI 输入选择模态框样式 ==========
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#e2e8f0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2d3748',
    textAlign: 'center',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
    marginBottom: 24,
  },
  inputOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  inputOption: {
    alignItems: 'center',
    width: (SCREEN_WIDTH - 80) / 3,
  },
  inputOptionIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputOptionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2d3748',
    marginBottom: 2,
  },
  inputOptionHint: {
    fontSize: 11,
    color: '#a0aec0',
  },
  cancelModalButton: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f7fafc',
    borderRadius: 12,
  },
  cancelModalButtonText: {
    fontSize: 15,
    color: '#4a5568',
    fontWeight: '500',
  },

  // ========== 文字输入模态框样式 ==========
  textInputModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  textInputModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  textInputModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2d3748',
    textAlign: 'center',
    marginBottom: 8,
  },
  textInputModalHint: {
    fontSize: 13,
    color: '#718096',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  textInputArea: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#2d3748',
    minHeight: 120,
    marginBottom: 16,
  },
  textInputButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  textInputCancelBtn: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#f7fafc',
  },
  textInputCancelBtnText: {
    fontSize: 15,
    color: '#4a5568',
    fontWeight: '500',
  },
  textInputSubmitBtn: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    backgroundColor: '#805ad5',
  },
  textInputSubmitBtnText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '500',
  },

  // ========== 识别结果模态框样式 ==========
  resultModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  resultModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 360,
  },
  resultModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2d3748',
    textAlign: 'center',
    marginBottom: 20,
  },
  resultList: {
    marginBottom: 20,
  },
  resultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  resultLabel: {
    fontSize: 14,
    color: '#718096',
  },
  resultValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2d3748',
    maxWidth: '60%',
    textAlign: 'right',
  },
  resultButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  resultButtonSecondary: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  resultButtonSecondaryText: {
    fontSize: 14,
    color: '#4a5568',
    fontWeight: '500',
  },
  resultButtonPrimary: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    backgroundColor: '#3182ce',
  },
  resultButtonPrimaryText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
});

export default IsapiDeviceCreateScreen;
