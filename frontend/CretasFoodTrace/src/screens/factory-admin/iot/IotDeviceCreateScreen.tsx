/**
 * IoT 电子秤设备创建页面
 * 支持手动填写和 AI 辅助添加（协议文档拍照识别）
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon } from 'react-native-paper';
import { Picker } from '@react-native-picker/picker';
import scaleApiClient, {
  ScaleProtocol,
  ScaleBrandModel,
  CreateScaleDeviceRequest,
} from '../../../services/api/scaleApiClient';
import {
  useProtocolDocParser,
  ProtocolParseResult,
} from '../../../hooks/useProtocolDocParser';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 临时类型定义
type IotStackParamList = {
  IotDeviceList: undefined;
  IotDeviceDetail: { deviceId: number };
  IotDeviceCreate: undefined;
};

type NavigationProp = NativeStackNavigationProp<IotStackParamList, 'IotDeviceCreate'>;

export function IotDeviceCreateScreen() {
  const navigation = useNavigation<NavigationProp>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [protocols, setProtocols] = useState<ScaleProtocol[]>([]);
  const [brandModels, setBrandModels] = useState<ScaleBrandModel[]>([]);

  // AI 输入模态框状态
  const [showAIModal, setShowAIModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [parseResult, setParseResult] = useState<ProtocolParseResult | null>(null);

  // 协议文档解析 Hook
  const {
    loading: parsingProtocol,
    parseFromCamera,
    parseFromGallery,
    toScaleProtocol,
  } = useProtocolDocParser();

  // 表单状态
  const [formData, setFormData] = useState({
    equipmentName: '',
    equipmentCode: '',
    location: '',
    serialNumber: '',
    scaleBrandModelId: '',
    scaleProtocolId: '',
    iotDeviceCode: '',
    mqttTopic: '',
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadOptions = useCallback(async () => {
    try {
      const [protocolsData, brandModelsData] = await Promise.all([
        scaleApiClient.getAvailableProtocols(),
        scaleApiClient.getBrandModels(),
      ]);
      setProtocols(protocolsData);
      setBrandModels(brandModelsData);
    } catch (err) {
      console.error('加载选项失败:', err);
      Alert.alert('错误', '加载配置选项失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.equipmentName.trim()) {
      newErrors.equipmentName = '请输入设备名称';
    }
    if (!formData.equipmentCode.trim()) {
      newErrors.equipmentCode = '请输入设备编码';
    } else if (!/^[A-Z0-9-_]+$/i.test(formData.equipmentCode)) {
      newErrors.equipmentCode = '设备编码只能包含字母、数字、横线和下划线';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);

      const request: CreateScaleDeviceRequest = {
        equipmentName: formData.equipmentName.trim(),
        equipmentCode: formData.equipmentCode.trim(),
        location: formData.location.trim() || undefined,
        serialNumber: formData.serialNumber.trim() || undefined,
        scaleBrandModelId: formData.scaleBrandModelId || undefined,
        scaleProtocolId: formData.scaleProtocolId || undefined,
        iotDeviceCode: formData.iotDeviceCode.trim() || undefined,
        mqttTopic: formData.mqttTopic.trim() || undefined,
        notes: formData.notes.trim() || undefined,
      };

      const device = await scaleApiClient.createScaleDevice(request);
      Alert.alert('成功', '设备创建成功', [
        {
          text: '查看详情',
          onPress: () => {
            navigation.replace('IotDeviceDetail', { deviceId: device.id });
          },
        },
        {
          text: '返回列表',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (err: unknown) {
      console.error('创建设备失败:', err);
      const errorMessage = err instanceof Error ? err.message : '创建失败，请重试';
      Alert.alert('错误', errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const updateFormField = (field: keyof typeof formData, value: string) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
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

  /** 处理文字描述（暂未实现） */
  const handleTextInput = () => {
    setShowAIModal(false);
    Alert.alert('提示', '文字描述功能开发中...');
  };

  /** 应用识别结果到表单 */
  const applyParseResult = (result: ProtocolParseResult) => {
    // 如果识别到协议名称，尝试匹配现有协议
    if (result.protocolName) {
      const matchedProtocol = protocols.find(
        (p) =>
          p.protocolName.toLowerCase().includes(result.protocolName!.toLowerCase()) ||
          result.protocolName!.toLowerCase().includes(p.protocolName.toLowerCase())
      );

      if (matchedProtocol) {
        updateFormField('scaleProtocolId', String(matchedProtocol.id));
        Alert.alert(
          '匹配成功',
          `已匹配到现有协议：${matchedProtocol.protocolName}`,
          [{ text: '确定' }]
        );
      } else {
        // 如果没有匹配的协议，提示用户可以创建新协议
        Alert.alert(
          '未找到匹配协议',
          `识别到协议：${result.protocolName}\n\n建议：可在「协议管理」中创建新协议后选择`,
          [{ text: '我知道了' }]
        );
      }
    }

    setShowResultModal(false);
    setParseResult(null);
  };

  /** 创建新协议（跳转到协议创建页面） */
  const createNewProtocol = (result: ProtocolParseResult) => {
    const protocolData = toScaleProtocol(result);
    // 暂时显示协议信息，后续可跳转到协议创建页面
    Alert.alert(
      '协议信息',
      `协议名称：${protocolData.protocolName}\n` +
        `连接类型：${protocolData.connectionType}\n` +
        `波特率：${JSON.parse(protocolData.serialConfig || '{}').baudRate || '-'}\n` +
        `数据位：${JSON.parse(protocolData.serialConfig || '{}').dataBits || '-'}\n` +
        `停止位：${JSON.parse(protocolData.serialConfig || '{}').stopBits || '-'}\n` +
        `校验位：${JSON.parse(protocolData.serialConfig || '{}').parity || '-'}`,
      [
        { text: '复制信息', onPress: () => Alert.alert('提示', '请手动在协议管理中创建') },
        { text: '关闭' },
      ]
    );
    setShowResultModal(false);
    setParseResult(null);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3182ce" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* 基本信息 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>基本信息</Text>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>
              设备名称 <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.formInput, errors.equipmentName && styles.formInputError]}
              value={formData.equipmentName}
              onChangeText={(text) => updateFormField('equipmentName', text)}
              placeholder="例如：包装车间电子秤1号"
            />
            {errors.equipmentName && (
              <Text style={styles.errorText}>{errors.equipmentName}</Text>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>
              设备编码 <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.formInput, errors.equipmentCode && styles.formInputError]}
              value={formData.equipmentCode}
              onChangeText={(text) => updateFormField('equipmentCode', text.toUpperCase())}
              placeholder="例如：SCALE-001"
              autoCapitalize="characters"
            />
            {errors.equipmentCode && (
              <Text style={styles.errorText}>{errors.equipmentCode}</Text>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>位置</Text>
            <TextInput
              style={styles.formInput}
              value={formData.location}
              onChangeText={(text) => updateFormField('location', text)}
              placeholder="例如：A栋包装车间"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>序列号</Text>
            <TextInput
              style={styles.formInput}
              value={formData.serialNumber}
              onChangeText={(text) => updateFormField('serialNumber', text)}
              placeholder="设备序列号（可选）"
            />
          </View>
        </View>

        {/* 品牌型号 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>品牌型号</Text>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>选择品牌型号</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.scaleBrandModelId}
                onValueChange={(value) => updateFormField('scaleBrandModelId', value)}
                style={styles.picker}
              >
                <Picker.Item label="-- 请选择 --" value="" />
                {brandModels.map((model) => (
                  <Picker.Item
                    key={model.id}
                    label={`${model.brandName} ${model.modelCode || model.modelName || ''}`}
                    value={model.id}
                  />
                ))}
              </Picker>
            </View>
          </View>
        </View>

        {/* 通信协议 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>通信协议</Text>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>选择协议</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.scaleProtocolId}
                onValueChange={(value) => updateFormField('scaleProtocolId', value)}
                style={styles.picker}
              >
                <Picker.Item label="-- 请选择 --" value="" />
                {protocols.map((protocol) => (
                  <Picker.Item
                    key={protocol.id}
                    label={`${protocol.protocolName} (${protocol.connectionType})`}
                    value={protocol.id}
                  />
                ))}
              </Picker>
            </View>
          </View>
        </View>

        {/* IoT 配置 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>IoT 配置</Text>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>IoT 设备码</Text>
            <TextInput
              style={styles.formInput}
              value={formData.iotDeviceCode}
              onChangeText={(text) => updateFormField('iotDeviceCode', text.toUpperCase())}
              placeholder="留空自动生成"
              autoCapitalize="characters"
            />
            <Text style={styles.hintText}>唯一标识符，用于 MQTT 通信</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>MQTT Topic</Text>
            <TextInput
              style={styles.formInput}
              value={formData.mqttTopic}
              onChangeText={(text) => updateFormField('mqttTopic', text)}
              placeholder="例如：factory/scales/device-001"
            />
          </View>
        </View>

        {/* 备注 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>备注</Text>

          <View style={styles.formGroup}>
            <TextInput
              style={[styles.formInput, styles.textArea]}
              value={formData.notes}
              onChangeText={(text) => updateFormField('notes', text)}
              placeholder="添加备注信息（可选）"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* 提交按钮 */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.cancelButtonText}>取消</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitButton, saving && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon source="plus" size={20} color="#fff" />
                <Text style={styles.submitButtonText}>创建设备</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* AI 助手按钮 */}
      <TouchableOpacity
        style={[styles.aiButton, parsingProtocol && styles.aiButtonDisabled]}
        onPress={() => setShowAIModal(true)}
        activeOpacity={0.8}
        disabled={parsingProtocol}
      >
        {parsingProtocol ? (
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
                <Text style={styles.inputOptionHint}>拍摄协议文档</Text>
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
                onPress={handleTextInput}
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

      {/* 协议识别结果模态框 */}
      <Modal
        visible={showResultModal && !!parseResult}
        transparent
        animationType="fade"
        onRequestClose={() => setShowResultModal(false)}
      >
        <View style={styles.resultModalOverlay}>
          <View style={styles.resultModalContent}>
            <Text style={styles.resultModalTitle}>协议识别结果</Text>

            {parseResult && (
              <View style={styles.resultList}>
                <View style={styles.resultItem}>
                  <Text style={styles.resultLabel}>协议名称</Text>
                  <Text style={styles.resultValue}>
                    {parseResult.protocolName || '未识别'}
                  </Text>
                </View>
                <View style={styles.resultItem}>
                  <Text style={styles.resultLabel}>连接类型</Text>
                  <Text style={styles.resultValue}>
                    {parseResult.connectionType || 'RS232'}
                  </Text>
                </View>
                <View style={styles.resultItem}>
                  <Text style={styles.resultLabel}>波特率</Text>
                  <Text style={styles.resultValue}>
                    {parseResult.serialConfig?.baudRate || 9600}
                  </Text>
                </View>
                <View style={styles.resultItem}>
                  <Text style={styles.resultLabel}>数据位</Text>
                  <Text style={styles.resultValue}>
                    {parseResult.serialConfig?.dataBits || 8}
                  </Text>
                </View>
                <View style={styles.resultItem}>
                  <Text style={styles.resultLabel}>停止位</Text>
                  <Text style={styles.resultValue}>
                    {parseResult.serialConfig?.stopBits || 1}
                  </Text>
                </View>
                <View style={styles.resultItem}>
                  <Text style={styles.resultLabel}>校验位</Text>
                  <Text style={styles.resultValue}>
                    {parseResult.serialConfig?.parity === 'none'
                      ? '无'
                      : parseResult.serialConfig?.parity === 'odd'
                      ? '奇校验'
                      : parseResult.serialConfig?.parity === 'even'
                      ? '偶校验'
                      : '无'}
                  </Text>
                </View>
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
                onPress={() => parseResult && createNewProtocol(parseResult)}
              >
                <Icon source="plus" size={18} color="#805ad5" />
                <Text style={styles.resultButtonSecondaryText}>创建新协议</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.resultButtonPrimary}
                onPress={() => parseResult && applyParseResult(parseResult)}
              >
                <Icon source="check" size={18} color="#fff" />
                <Text style={styles.resultButtonPrimaryText}>匹配现有协议</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.resultCloseButton}
              onPress={() => {
                setShowResultModal(false);
                setParseResult(null);
              }}
            >
              <Text style={styles.resultCloseButtonText}>关闭</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#718096',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
  formLabel: {
    fontSize: 14,
    color: '#4a5568',
    marginBottom: 6,
    fontWeight: '500',
  },
  required: {
    color: '#e53e3e',
  },
  formInput: {
    height: 44,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#2d3748',
    backgroundColor: '#fff',
  },
  formInputError: {
    borderColor: '#fc8181',
  },
  textArea: {
    height: 88,
    paddingTop: 12,
  },
  errorText: {
    fontSize: 12,
    color: '#e53e3e',
    marginTop: 4,
  },
  hintText: {
    fontSize: 12,
    color: '#a0aec0',
    marginTop: 4,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  picker: {
    height: 44,
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 12,
    marginBottom: 80,
  },
  cancelButton: {
    flex: 1,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#edf2f7',
  },
  cancelButtonText: {
    fontSize: 15,
    color: '#4a5568',
    fontWeight: '500',
  },
  submitButton: {
    flex: 2,
    height: 48,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderRadius: 8,
    backgroundColor: '#3182ce',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
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

  // ========== 协议识别结果模态框样式 ==========
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
  },
  resultButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  resultButtonSecondary: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#805ad5',
    backgroundColor: '#fff',
  },
  resultButtonSecondaryText: {
    fontSize: 14,
    color: '#805ad5',
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
  resultCloseButton: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultCloseButtonText: {
    fontSize: 14,
    color: '#718096',
  },
});

export default IotDeviceCreateScreen;
