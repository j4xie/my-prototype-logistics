/**
 * IoT 电子秤设备创建页面
 * 支持手动填写和 AI 辅助添加
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
        style={styles.aiButton}
        onPress={() => {
          Alert.alert('AI 助手', '语音/文字描述添加设备功能开发中...');
        }}
        activeOpacity={0.8}
      >
        <Icon source="robot" size={24} color="#fff" />
      </TouchableOpacity>
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
});

export default IotDeviceCreateScreen;
