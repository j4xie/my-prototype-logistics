import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

interface EmployeeInputScreenProps {
  navigation: any;
}

interface EmployeeFormData {
  // 基本信息
  employeeId: string;
  fullName: string;
  position: string;
  department: string;
  shift: string;
  
  // 工作记录
  workDate: string;
  workHours: string;
  workDescription: string;
  qualityCheck: 'pass' | 'fail' | 'pending';
  
  // 设备使用
  equipmentUsed: string[];
  equipmentStatus: 'normal' | 'maintenance' | 'error';
  
  // 地理位置
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  } | null;
  
  // 图片附件
  photos: string[];
  
  // 备注
  notes: string;
}

export const EmployeeInputScreen: React.FC<EmployeeInputScreenProps> = ({ navigation }) => {
  const [formData, setFormData] = useState<EmployeeFormData>({
    employeeId: '',
    fullName: '',
    position: '',
    department: '',
    shift: '',
    workDate: new Date().toISOString().split('T')[0],
    workHours: '',
    workDescription: '',
    qualityCheck: 'pending',
    equipmentUsed: [],
    equipmentStatus: 'normal',
    location: null,
    photos: [],
    notes: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const [isEquipmentModalVisible, setIsEquipmentModalVisible] = useState(false);

  // 部门选项
  const departments = [
    { label: '请选择部门', value: '' },
    { label: '生产部', value: 'production' },
    { label: '质检部', value: 'quality' },
    { label: '仓储部', value: 'warehouse' },
    { label: '包装部', value: 'packaging' },
    { label: '物流部', value: 'logistics' },
  ];

  // 班次选项
  const shifts = [
    { label: '请选择班次', value: '' },
    { label: '早班 (06:00-14:00)', value: 'morning' },
    { label: '中班 (14:00-22:00)', value: 'afternoon' },
    { label: '晚班 (22:00-06:00)', value: 'night' },
    { label: '长白班 (08:00-17:00)', value: 'day' },
  ];

  // 设备选项
  const availableEquipment = [
    '生产线A', '生产线B', '质检设备', '包装机器', 
    '冷藏设备', '运输工具', '清洁设备', '安全设备'
  ];

  // 获取当前位置
  const getCurrentLocation = async () => {
    try {
      setIsLocationLoading(true);
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('权限错误', '需要位置权限才能记录工作地点');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      
      // 获取地址信息（可选）
      try {
        const addressData = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        
        const address = addressData[0] ? 
          `${addressData[0].region || ''} ${addressData[0].city || ''} ${addressData[0].street || ''}` : 
          undefined;

        setFormData(prev => ({
          ...prev,
          location: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            address,
          },
        }));

        Alert.alert('成功', '位置信息已获取');
      } catch (addressError) {
        // 即使地址解析失败，也保存坐标
        setFormData(prev => ({
          ...prev,
          location: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          },
        }));
        Alert.alert('提示', '位置坐标已获取，地址解析失败');
      }
    } catch (error) {
      console.error('获取位置失败:', error);
      Alert.alert('错误', '无法获取当前位置');
    } finally {
      setIsLocationLoading(false);
    }
  };

  // 选择图片
  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('权限错误', '需要相册权限才能选择图片');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setFormData(prev => ({
          ...prev,
          photos: [...prev.photos, result.assets[0].uri],
        }));
      }
    } catch (error) {
      console.error('选择图片失败:', error);
      Alert.alert('错误', '无法选择图片');
    }
  };

  // 拍照
  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('权限错误', '需要相机权限才能拍照');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setFormData(prev => ({
          ...prev,
          photos: [...prev.photos, result.assets[0].uri],
        }));
      }
    } catch (error) {
      console.error('拍照失败:', error);
      Alert.alert('错误', '无法拍照');
    }
  };

  // 删除图片
  const removePhoto = (index: number) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }));
  };

  // 切换设备选择
  const toggleEquipment = (equipment: string) => {
    setFormData(prev => ({
      ...prev,
      equipmentUsed: prev.equipmentUsed.includes(equipment)
        ? prev.equipmentUsed.filter(e => e !== equipment)
        : [...prev.equipmentUsed, equipment],
    }));
  };

  // 表单验证
  const validateForm = (): boolean => {
    if (!formData.employeeId) {
      Alert.alert('提示', '请输入工号');
      return false;
    }
    if (!formData.fullName) {
      Alert.alert('提示', '请输入姓名');
      return false;
    }
    if (!formData.department) {
      Alert.alert('提示', '请选择部门');
      return false;
    }
    if (!formData.workDescription) {
      Alert.alert('提示', '请输入工作内容');
      return false;
    }
    return true;
  };

  // 提交表单
  const submitForm = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      // 模拟API调用
      console.log('提交员工录入数据:', formData);
      
      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      Alert.alert(
        '提交成功',
        '员工工作记录已成功提交',
        [
          {
            text: '继续录入',
            onPress: () => {
              // 重置表单但保留员工基本信息
              setFormData(prev => ({
                ...prev,
                workDate: new Date().toISOString().split('T')[0],
                workHours: '',
                workDescription: '',
                qualityCheck: 'pending',
                equipmentUsed: [],
                equipmentStatus: 'normal',
                location: null,
                photos: [],
                notes: '',
              }));
            },
          },
          {
            text: '返回',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('提交失败:', error);
      Alert.alert('错误', '提交失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const updateFormData = (key: keyof EmployeeFormData, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  return (
    <LinearGradient
      colors={['#f8fafc', '#e2e8f0']}
      style={styles.container}
    >
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>员工工作录入</Text>
        <TouchableOpacity style={styles.helpButton}>
          <Ionicons name="help-circle-outline" size={24} color="#64748b" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* 员工基本信息 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="person" size={18} color="#3b82f6" />
            {' '}员工基本信息
          </Text>
          
          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={styles.label}>工号 *</Text>
              <TextInput
                style={styles.input}
                placeholder="请输入工号"
                value={formData.employeeId}
                onChangeText={(value) => updateFormData('employeeId', value)}
              />
            </View>
            
            <View style={styles.halfInput}>
              <Text style={styles.label}>姓名 *</Text>
              <TextInput
                style={styles.input}
                placeholder="请输入姓名"
                value={formData.fullName}
                onChangeText={(value) => updateFormData('fullName', value)}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={styles.label}>部门 *</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={formData.department}
                  onValueChange={(value) => updateFormData('department', value)}
                  style={styles.picker}
                >
                  {departments.map((dept) => (
                    <Picker.Item key={dept.value} label={dept.label} value={dept.value} />
                  ))}
                </Picker>
              </View>
            </View>
            
            <View style={styles.halfInput}>
              <Text style={styles.label}>班次</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={formData.shift}
                  onValueChange={(value) => updateFormData('shift', value)}
                  style={styles.picker}
                >
                  {shifts.map((shift) => (
                    <Picker.Item key={shift.value} label={shift.label} value={shift.value} />
                  ))}
                </Picker>
              </View>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>职位</Text>
            <TextInput
              style={styles.input}
              placeholder="请输入职位"
              value={formData.position}
              onChangeText={(value) => updateFormData('position', value)}
            />
          </View>
        </View>

        {/* 工作记录 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="clipboard" size={18} color="#10b981" />
            {' '}工作记录
          </Text>

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={styles.label}>工作日期</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                value={formData.workDate}
                onChangeText={(value) => updateFormData('workDate', value)}
              />
            </View>
            
            <View style={styles.halfInput}>
              <Text style={styles.label}>工作时长</Text>
              <TextInput
                style={styles.input}
                placeholder="小时"
                value={formData.workHours}
                onChangeText={(value) => updateFormData('workHours', value)}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>工作内容 *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="详细描述工作内容..."
              value={formData.workDescription}
              onChangeText={(value) => updateFormData('workDescription', value)}
              multiline
              numberOfLines={4}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>质量检查</Text>
            <View style={styles.qualityButtons}>
              {[
                { key: 'pass', label: '通过', color: '#10b981' },
                { key: 'fail', label: '未通过', color: '#ef4444' },
                { key: 'pending', label: '待检查', color: '#f59e0b' },
              ].map((status) => (
                <TouchableOpacity
                  key={status.key}
                  style={[
                    styles.qualityButton,
                    { backgroundColor: formData.qualityCheck === status.key ? status.color : '#f1f5f9' }
                  ]}
                  onPress={() => updateFormData('qualityCheck', status.key)}
                >
                  <Text style={[
                    styles.qualityButtonText,
                    { color: formData.qualityCheck === status.key ? '#fff' : '#64748b' }
                  ]}>
                    {status.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* 设备使用 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="construct" size={18} color="#8b5cf6" />
            {' '}设备使用
          </Text>

          <TouchableOpacity
            style={styles.equipmentSelector}
            onPress={() => setIsEquipmentModalVisible(true)}
          >
            <Text style={styles.equipmentText}>
              {formData.equipmentUsed.length > 0 
                ? `已选择 ${formData.equipmentUsed.length} 台设备`
                : '选择使用的设备'}
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#64748b" />
          </TouchableOpacity>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>设备状态</Text>
            <View style={styles.statusButtons}>
              {[
                { key: 'normal', label: '正常', color: '#10b981' },
                { key: 'maintenance', label: '维护中', color: '#f59e0b' },
                { key: 'error', label: '故障', color: '#ef4444' },
              ].map((status) => (
                <TouchableOpacity
                  key={status.key}
                  style={[
                    styles.statusButton,
                    { backgroundColor: formData.equipmentStatus === status.key ? status.color : '#f1f5f9' }
                  ]}
                  onPress={() => updateFormData('equipmentStatus', status.key)}
                >
                  <Text style={[
                    styles.statusButtonText,
                    { color: formData.equipmentStatus === status.key ? '#fff' : '#64748b' }
                  ]}>
                    {status.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* 位置和图片 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="location" size={18} color="#ef4444" />
            {' '}位置和图片记录
          </Text>

          <TouchableOpacity
            style={styles.locationButton}
            onPress={getCurrentLocation}
            disabled={isLocationLoading}
          >
            {isLocationLoading ? (
              <ActivityIndicator size="small" color="#3b82f6" />
            ) : (
              <Ionicons name="location-outline" size={20} color="#3b82f6" />
            )}
            <Text style={styles.locationButtonText}>
              {formData.location ? '位置已记录' : '获取当前位置'}
            </Text>
          </TouchableOpacity>

          {formData.location && (
            <Text style={styles.locationInfo}>
              {formData.location.address || 
               `纬度: ${formData.location.latitude.toFixed(6)}, 经度: ${formData.location.longitude.toFixed(6)}`}
            </Text>
          )}

          <View style={styles.photoActions}>
            <TouchableOpacity style={styles.photoButton} onPress={takePhoto}>
              <Ionicons name="camera-outline" size={20} color="#10b981" />
              <Text style={styles.photoButtonText}>拍照</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.photoButton} onPress={pickImage}>
              <Ionicons name="image-outline" size={20} color="#8b5cf6" />
              <Text style={styles.photoButtonText}>选择图片</Text>
            </TouchableOpacity>
          </View>

          {formData.photos.length > 0 && (
            <View style={styles.photoGrid}>
              {formData.photos.map((photo, index) => (
                <View key={index} style={styles.photoItem}>
                  <Image source={{ uri: photo }} style={styles.photo} />
                  <TouchableOpacity
                    style={styles.deletePhoto}
                    onPress={() => removePhoto(index)}
                  >
                    <Ionicons name="close-circle" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* 备注 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="chatbubble-outline" size={18} color="#64748b" />
            {' '}备注信息
          </Text>

          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="添加备注信息..."
            value={formData.notes}
            onChangeText={(value) => updateFormData('notes', value)}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* 提交按钮 */}
        <View style={styles.submitSection}>
          <TouchableOpacity
            style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
            onPress={submitForm}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.submitButtonText}>提交记录</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* 设备选择模态框 */}
      <Modal
        visible={isEquipmentModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsEquipmentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>选择设备</Text>
              <TouchableOpacity
                onPress={() => setIsEquipmentModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              {availableEquipment.map((equipment) => (
                <TouchableOpacity
                  key={equipment}
                  style={styles.equipmentOption}
                  onPress={() => toggleEquipment(equipment)}
                >
                  <Text style={styles.equipmentOptionText}>{equipment}</Text>
                  <View style={[
                    styles.checkbox,
                    formData.equipmentUsed.includes(equipment) && styles.checkboxSelected
                  ]}>
                    {formData.equipmentUsed.includes(equipment) && (
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  helpButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    height: 48,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#1e293b',
  },
  textArea: {
    height: 96,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  pickerContainer: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 48,
  },
  qualityButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  qualityButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  qualityButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  statusButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  equipmentSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    marginBottom: 16,
  },
  equipmentText: {
    fontSize: 16,
    color: '#1e293b',
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#dbeafe',
    borderRadius: 8,
    marginBottom: 8,
  },
  locationButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#3b82f6',
    marginLeft: 8,
  },
  locationInfo: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 16,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  photoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
  },
  photoButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginLeft: 8,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoItem: {
    position: 'relative',
  },
  photo: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  deletePhoto: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  submitSection: {
    paddingVertical: 24,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 16,
  },
  submitButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBody: {
    padding: 20,
  },
  equipmentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  equipmentOptionText: {
    fontSize: 16,
    color: '#1e293b',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#3b82f6',
  },
});