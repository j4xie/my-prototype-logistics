/**
 * AI 设备输入页面
 * 支持拍照识别、语音输入、手动输入三种方式
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import formAssistantApiClient from '../../../services/api/formAssistantApiClient';
import isapiApiClient from '../../../services/api/isapiApiClient';
import { createScaleDevice } from '../../../services/api/scaleApiClient';
import { EntityType } from '../../../services/api/formTemplateApiClient';

type DeviceStackParamList = {
  AIDeviceInput: { deviceType: 'CAMERA' | 'SCALE' };
  IsapiDeviceList: undefined;
  IotDeviceList: undefined;
};

type NavigationProp = NativeStackNavigationProp<DeviceStackParamList, 'AIDeviceInput'>;
type RouteProps = RouteProp<DeviceStackParamList, 'AIDeviceInput'>;

type InputMode = 'photo' | 'voice' | 'manual';

interface DeviceFormData {
  name: string;
  ip: string;
  port: string;
  username: string;
  password: string;
  protocol: string; // For scale
}

const SCALE_PROTOCOLS = [
  { value: 'MODBUS_RTU', label: 'MODBUS RTU' },
  { value: 'TCP_SOCKET', label: 'TCP Socket' },
  { value: 'HTTP', label: 'HTTP API' },
];

export function AIDeviceInputScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { deviceType } = route.params;

  const [inputMode, setInputMode] = useState<InputMode>('photo');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form data
  const [formData, setFormData] = useState<DeviceFormData>({
    name: '',
    ip: '',
    port: deviceType === 'CAMERA' ? '80' : '502',
    username: deviceType === 'CAMERA' ? 'admin' : '',
    password: '',
    protocol: 'MODBUS_RTU',
  });

  // AI recognized fields
  const [recognizedFields, setRecognizedFields] = useState<string[]>([]);

  const isCamera = deviceType === 'CAMERA';

  // Handle photo capture
  const handleTakePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('权限不足', '需要相机权限才能拍照识别');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets?.length > 0 && result.assets[0]?.base64) {
        await processImage(result.assets[0].base64);
      }
    } catch (error) {
      console.error('拍照失败:', error);
      Alert.alert('拍照失败', '请重试');
    }
  };

  // Handle gallery selection
  const handleSelectFromGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('权限不足', '需要相册权限才能选择图片');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets?.length > 0 && result.assets[0]?.base64) {
        await processImage(result.assets[0].base64);
      }
    } catch (error) {
      console.error('选择图片失败:', error);
      Alert.alert('选择失败', '请重试');
    }
  };

  // Process image with AI
  const processImage = async (base64: string) => {
    try {
      setIsProcessing(true);

      const entityType: EntityType = isCamera ? 'ISAPI_DEVICE' : 'SCALE_DEVICE';
      const response = await formAssistantApiClient.parseFormOCR({
        imageBase64: base64,
        entityType,
      });

      if (response.success && response.fieldValues) {
        const parsed = response.fieldValues as Record<string, string>;
        const recognized: string[] = [];

        // Map recognized fields to form
        const parsedName = parsed.deviceName || parsed.name;
        if (parsedName) {
          setFormData(prev => ({ ...prev, name: parsedName }));
          recognized.push('name');
        }
        const parsedIp = parsed.ipAddress || parsed.ip;
        if (parsedIp) {
          setFormData(prev => ({ ...prev, ip: parsedIp }));
          recognized.push('ip');
        }
        if (parsed.port) {
          const parsedPort = String(parsed.port);
          setFormData(prev => ({ ...prev, port: parsedPort }));
          recognized.push('port');
        }
        if (parsed.username) {
          const parsedUsername = parsed.username;
          setFormData(prev => ({ ...prev, username: parsedUsername }));
          recognized.push('username');
        }
        if (parsed.password) {
          const parsedPassword = parsed.password;
          setFormData(prev => ({ ...prev, password: parsedPassword }));
          recognized.push('password');
        }
        if (parsed.protocol) {
          const parsedProtocol = parsed.protocol;
          setFormData(prev => ({ ...prev, protocol: parsedProtocol }));
          recognized.push('protocol');
        }

        setRecognizedFields(recognized);

        if (recognized.length > 0) {
          Alert.alert(
            '识别成功',
            `已识别 ${recognized.length} 个字段，请确认或补充其他信息`
          );
        } else {
          Alert.alert('识别结果', '未能识别到设备信息，请手动输入');
        }
      } else {
        Alert.alert('识别失败', response.message || '请尝试重新拍照或手动输入');
      }
    } catch (error) {
      console.error('AI识别失败:', error);
      Alert.alert('识别失败', '请检查网络连接或手动输入');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle voice input (placeholder)
  const handleVoiceInput = () => {
    Alert.alert(
      '语音输入',
      '请说出设备信息，例如：\n"添加一个叫东门入口的摄像头，IP是192.168.1.100，密码是admin123"',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '开始录音',
          onPress: () => {
            // TODO: Integrate with voice recognition service
            Alert.alert('提示', '语音识别功能即将上线');
          },
        },
      ]
    );
  };

  // Validate form
  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      Alert.alert('提示', '请输入设备名称');
      return false;
    }
    if (!formData.ip.trim()) {
      Alert.alert('提示', '请输入IP地址');
      return false;
    }
    // Validate IP format
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(formData.ip.trim())) {
      Alert.alert('提示', '请输入有效的IP地址');
      return false;
    }
    if (isCamera && !formData.password.trim()) {
      Alert.alert('提示', '请输入设备密码');
      return false;
    }
    if (!isCamera && !formData.port.trim()) {
      Alert.alert('提示', '请输入端口号');
      return false;
    }
    return true;
  };

  // Submit device
  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setIsSubmitting(true);

      if (isCamera) {
        // Add camera device
        await isapiApiClient.createIsapiDevice({
          deviceName: formData.name.trim(),
          deviceType: 'IPC',
          ipAddress: formData.ip.trim(),
          port: parseInt(formData.port, 10) || 80,
          protocol: 'HTTP',
          username: formData.username.trim() || 'admin',
          password: formData.password.trim(),
        });

        Alert.alert('添加成功', '摄像头已添加到设备列表', [
          {
            text: '确定',
            onPress: () => navigation.navigate('IsapiDeviceList'),
          },
        ]);
      } else {
        // Add scale device
        await createScaleDevice({
          equipmentName: formData.name.trim(),
          equipmentCode: `SCALE-${Date.now()}`,
          scaleConnectionParams: JSON.stringify({
            ip: formData.ip.trim(),
            port: parseInt(formData.port, 10) || 502,
            protocol: formData.protocol,
          }),
        });

        Alert.alert('添加成功', '电子秤已添加到设备列表', [
          {
            text: '确定',
            onPress: () => navigation.navigate('IotDeviceList'),
          },
        ]);
      }
    } catch (error: any) {
      console.error('添加设备失败:', error);
      Alert.alert(
        '添加失败',
        error.response?.data?.message || error.message || '请检查设备信息后重试'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateFormField = (field: keyof DeviceFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Remove from recognized if user edits
    if (recognizedFields.includes(field)) {
      setRecognizedFields(prev => prev.filter(f => f !== field));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f7fa" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon source="arrow-left" size={24} color="#2d3748" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          添加{isCamera ? '摄像头' : '电子秤'}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Input Mode Selector */}
          <View style={styles.modeSelector}>
            <TouchableOpacity
              style={[styles.modeButton, inputMode === 'photo' && styles.modeButtonActive]}
              onPress={() => setInputMode('photo')}
            >
              <Icon
                source="camera"
                size={20}
                color={inputMode === 'photo' ? '#ffffff' : '#718096'}
              />
              <Text
                style={[
                  styles.modeButtonText,
                  inputMode === 'photo' && styles.modeButtonTextActive,
                ]}
              >
                拍照识别
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeButton, inputMode === 'voice' && styles.modeButtonActive]}
              onPress={() => setInputMode('voice')}
            >
              <Icon
                source="microphone"
                size={20}
                color={inputMode === 'voice' ? '#ffffff' : '#718096'}
              />
              <Text
                style={[
                  styles.modeButtonText,
                  inputMode === 'voice' && styles.modeButtonTextActive,
                ]}
              >
                语音输入
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeButton, inputMode === 'manual' && styles.modeButtonActive]}
              onPress={() => setInputMode('manual')}
            >
              <Icon
                source="pencil"
                size={20}
                color={inputMode === 'manual' ? '#ffffff' : '#718096'}
              />
              <Text
                style={[
                  styles.modeButtonText,
                  inputMode === 'manual' && styles.modeButtonTextActive,
                ]}
              >
                手动输入
              </Text>
            </TouchableOpacity>
          </View>

          {/* AI Input Actions */}
          {inputMode !== 'manual' && (
            <View style={styles.aiActionsContainer}>
              {inputMode === 'photo' ? (
                <>
                  <TouchableOpacity
                    style={styles.aiActionButton}
                    onPress={handleTakePhoto}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="small" color="#3182ce" />
                    ) : (
                      <Icon source="camera" size={32} color="#3182ce" />
                    )}
                    <Text style={styles.aiActionText}>拍照识别</Text>
                    <Text style={styles.aiActionHint}>拍摄设备标签或配置文档</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.aiActionButton}
                    onPress={handleSelectFromGallery}
                    disabled={isProcessing}
                  >
                    <Icon source="image" size={32} color="#805ad5" />
                    <Text style={styles.aiActionText}>从相册选择</Text>
                    <Text style={styles.aiActionHint}>选择已有的配置图片</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.aiActionButton, styles.voiceButton]}
                  onPress={handleVoiceInput}
                >
                  <Icon source="microphone" size={48} color="#38a169" />
                  <Text style={styles.aiActionText}>点击开始语音输入</Text>
                  <Text style={styles.aiActionHint}>
                    说出设备名称、IP地址等信息
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Form Fields */}
          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>
              {inputMode === 'manual' ? '设备信息' : '确认或补充信息'}
            </Text>

            {/* Device Name */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>
                设备名称 <Text style={styles.required}>*</Text>
                {recognizedFields.includes('name') && (
                  <Text style={styles.aiTag}> AI识别</Text>
                )}
              </Text>
              <TextInput
                style={[
                  styles.formInput,
                  recognizedFields.includes('name') && styles.formInputAI,
                ]}
                value={formData.name}
                onChangeText={(v) => updateFormField('name', v)}
                placeholder="例如：东门入口摄像头"
                placeholderTextColor="#a0aec0"
              />
            </View>

            {/* IP Address */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>
                IP 地址 <Text style={styles.required}>*</Text>
                {recognizedFields.includes('ip') && (
                  <Text style={styles.aiTag}> AI识别</Text>
                )}
              </Text>
              <TextInput
                style={[
                  styles.formInput,
                  recognizedFields.includes('ip') && styles.formInputAI,
                ]}
                value={formData.ip}
                onChangeText={(v) => updateFormField('ip', v)}
                placeholder="例如：192.168.1.100"
                placeholderTextColor="#a0aec0"
                keyboardType="numeric"
              />
            </View>

            {/* Port */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>
                端口
                {recognizedFields.includes('port') && (
                  <Text style={styles.aiTag}> AI识别</Text>
                )}
              </Text>
              <TextInput
                style={[
                  styles.formInput,
                  recognizedFields.includes('port') && styles.formInputAI,
                ]}
                value={formData.port}
                onChangeText={(v) => updateFormField('port', v)}
                placeholder={isCamera ? '默认 80' : '默认 502'}
                placeholderTextColor="#a0aec0"
                keyboardType="numeric"
              />
            </View>

            {/* Camera specific fields */}
            {isCamera && (
              <>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>
                    用户名
                    {recognizedFields.includes('username') && (
                      <Text style={styles.aiTag}> AI识别</Text>
                    )}
                  </Text>
                  <TextInput
                    style={[
                      styles.formInput,
                      recognizedFields.includes('username') && styles.formInputAI,
                    ]}
                    value={formData.username}
                    onChangeText={(v) => updateFormField('username', v)}
                    placeholder="默认 admin"
                    placeholderTextColor="#a0aec0"
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>
                    密码 <Text style={styles.required}>*</Text>
                    {recognizedFields.includes('password') && (
                      <Text style={styles.aiTag}> AI识别</Text>
                    )}
                  </Text>
                  <TextInput
                    style={[
                      styles.formInput,
                      recognizedFields.includes('password') && styles.formInputAI,
                    ]}
                    value={formData.password}
                    onChangeText={(v) => updateFormField('password', v)}
                    placeholder="设备登录密码"
                    placeholderTextColor="#a0aec0"
                    secureTextEntry
                  />
                </View>
              </>
            )}

            {/* Scale specific fields */}
            {!isCamera && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  通信协议 <Text style={styles.required}>*</Text>
                </Text>
                <View style={styles.protocolSelector}>
                  {SCALE_PROTOCOLS.map((protocol) => (
                    <TouchableOpacity
                      key={protocol.value}
                      style={[
                        styles.protocolOption,
                        formData.protocol === protocol.value && styles.protocolOptionActive,
                      ]}
                      onPress={() => updateFormField('protocol', protocol.value)}
                    >
                      <Text
                        style={[
                          styles.protocolOptionText,
                          formData.protocol === protocol.value &&
                            styles.protocolOptionTextActive,
                        ]}
                      >
                        {protocol.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Icon source="check" size={20} color="#ffffff" />
                <Text style={styles.submitButtonText}>添加设备</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.bottomPadding} />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#2d3748',
  },
  headerRight: {
    width: 32,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    margin: 16,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  modeButtonActive: {
    backgroundColor: '#3182ce',
  },
  modeButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#718096',
  },
  modeButtonTextActive: {
    color: '#ffffff',
  },
  aiActionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  aiActionButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  voiceButton: {
    paddingVertical: 32,
  },
  aiActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2d3748',
    marginTop: 10,
  },
  aiActionHint: {
    fontSize: 12,
    color: '#a0aec0',
    marginTop: 4,
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4a5568',
    marginBottom: 8,
  },
  required: {
    color: '#e53e3e',
  },
  aiTag: {
    fontSize: 11,
    color: '#38a169',
    fontWeight: '400',
  },
  formInput: {
    backgroundColor: '#f7fafc',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#2d3748',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  formInputAI: {
    borderColor: '#38a169',
    backgroundColor: '#f0fff4',
  },
  protocolSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  protocolOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  protocolOptionActive: {
    borderColor: '#3182ce',
    backgroundColor: '#ebf8ff',
  },
  protocolOptionText: {
    fontSize: 13,
    color: '#718096',
    fontWeight: '500',
  },
  protocolOptionTextActive: {
    color: '#3182ce',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3182ce',
    marginHorizontal: 16,
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#a0aec0',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  bottomPadding: {
    height: 40,
  },
});

export default AIDeviceInputScreen;
