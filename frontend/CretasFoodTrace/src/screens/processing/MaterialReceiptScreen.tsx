import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Text,
  Appbar,
  Card,
  TextInput,
  Button,
  ActivityIndicator,
  List,
  HelperText,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import { materialBatchApiClient } from '../../services/api/materialBatchApiClient';
import { supplierApiClient } from '../../services/api/supplierApiClient';
import { useAuthStore } from '../../store/authStore';
import { handleError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建MaterialReceipt专用logger
const materialReceiptLogger = logger.createContextLogger('MaterialReceipt');

/**
 * 原材料入库页面（15字段表单）
 * 权限：所有登录用户
 * 功能：创建原材料批次，包含完整的15个字段
 */
export default function MaterialReceiptScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);

  // 15个字段表单数据
  const [formData, setFormData] = useState({
    supplierId: '',
    materialTypeId: '',
    quantity: '',
    unitPrice: '',
    totalAmount: '0.00', // 自动计算
    storageType: 'fresh',
    storageLocation: '',
    shelfLife: '',
    expiryDate: '', // 自动计算
    qualityGrade: '',
    qualityStatus: 'qualified',
    qualityScore: '',
    qualityNotes: '',
    qualityPhotos: [] as string[],
    notes: '',
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // 储存类型选项
  const storageTypeOptions = [
    { label: '新鲜', value: 'fresh' },
    { label: '冻货', value: 'frozen' },
  ];

  // 质检状态选项
  const qualityStatusOptions = [
    { label: '合格', value: 'qualified' },
    { label: '不合格', value: 'unqualified' },
  ];

  useEffect(() => {
    loadSuppliers();
  }, []);

  // 自动计算总金额
  useEffect(() => {
    const qty = parseFloat(formData.quantity) || 0;
    const price = parseFloat(formData.unitPrice) || 0;
    const total = (qty * price).toFixed(2);
    setFormData(prev => ({ ...prev, totalAmount: total }));
  }, [formData.quantity, formData.unitPrice]);

  // 自动计算到期日期
  useEffect(() => {
    if (formData.shelfLife) {
      const today = new Date();
      const shelfLifeDays = parseInt(formData.shelfLife);
      if (!isNaN(shelfLifeDays)) {
        const expiryDate = new Date(today.getTime() + shelfLifeDays * 24 * 60 * 60 * 1000);
        setFormData(prev => ({
          ...prev,
          expiryDate: expiryDate.toISOString().split('T')[0]
        }));
      }
    }
  }, [formData.shelfLife]);

  const loadSuppliers = async () => {
    try {
      setLoadingSuppliers(true);
      const response = await supplierApiClient.getActiveSuppliers(user?.factoryId);
      materialReceiptLogger.info('供应商列表加载成功', {
        factoryId: user?.factoryId,
        supplierCount: response.length,
      });
      setSuppliers(response);
    } catch (error) {
      materialReceiptLogger.error('加载供应商失败', error as Error, {
        factoryId: user?.factoryId,
      });
      Alert.alert('错误', '加载供应商列表失败');
    } finally {
      setLoadingSuppliers(false);
    }
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.supplierId) newErrors.supplierId = '请选择供应商';
    if (!formData.materialTypeId) newErrors.materialTypeId = '请输入原料类型';
    if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
      newErrors.quantity = '请输入有效的入库重量';
    }
    if (!formData.unitPrice || parseFloat(formData.unitPrice) <= 0) {
      newErrors.unitPrice = '请输入有效的单价';
    }
    if (!formData.storageLocation) newErrors.storageLocation = '请输入储存位置';
    if (!formData.shelfLife || parseInt(formData.shelfLife) <= 0) {
      newErrors.shelfLife = '请输入有效的保质期';
    }
    if (!formData.qualityGrade) newErrors.qualityGrade = '请输入质检员';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('验证失败', '请填写所有必填项');
      return;
    }

    try {
      setLoading(true);

      const batchData = {
        supplierId: formData.supplierId,
        materialTypeId: formData.materialTypeId,
        inboundQuantity: parseFloat(formData.quantity),
        unitPrice: parseFloat(formData.unitPrice),
        totalCost: parseFloat(formData.totalAmount),
        storageType: formData.storageType,
        storageLocation: formData.storageLocation,
        shelfLife: parseInt(formData.shelfLife),
        expiryDate: formData.expiryDate,
        qualityGrade: formData.qualityGrade,
        qualityStatus: formData.qualityStatus,
        qualityScore: formData.qualityScore ? parseFloat(formData.qualityScore) : undefined,
        qualityNotes: formData.qualityNotes || undefined,
        qualityPhotos: formData.qualityPhotos.length > 0 ? formData.qualityPhotos : undefined,
        notes: formData.notes || undefined,
      };

      await materialBatchApiClient.createBatch(batchData, user?.factoryId);

      materialReceiptLogger.info('原材料入库成功', {
        factoryId: user?.factoryId,
        supplierId: batchData.supplierId,
        materialType: batchData.materialTypeId,
        quantity: batchData.inboundQuantity,
        totalCost: batchData.totalCost,
      });

      Alert.alert('成功', '原材料入库成功', [
        {
          text: '确定',
          onPress: () => {
            // 重置表单
            setFormData({
              supplierId: '',
              materialTypeId: '',
              quantity: '',
              unitPrice: '',
              totalAmount: '0.00',
              storageType: 'fresh',
              storageLocation: '',
              shelfLife: '',
              expiryDate: '',
              qualityGrade: '',
              qualityStatus: 'qualified',
              qualityScore: '',
              qualityNotes: '',
              qualityPhotos: [],
              notes: '',
            });
            setErrors({});
          },
        },
      ]);
    } catch (error) {
      materialReceiptLogger.error('入库失败', error as Error, {
        factoryId: user?.factoryId,
        supplierId: formData.supplierId,
        materialType: formData.materialTypeId,
      });
      Alert.alert('错误', error.response?.data?.message || '入库操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    Alert.alert('确认取消', '确定要取消入库操作吗？已填写的数据将丢失。', [
      { text: '继续填写', style: 'cancel' },
      { text: '取消入库', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <Appbar.Header>
        <Appbar.BackAction onPress={handleCancel} />
        <Appbar.Content title="原材料入库" />
      </Appbar.Header>

      <ScrollView style={styles.content}>
        <Card style={styles.formCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>基本信息</Text>

            {/* 1. Supplier */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>供应商 *</Text>
              {loadingSuppliers ? (
                <ActivityIndicator size="small" />
              ) : (
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={formData.supplierId}
                    onValueChange={(value) => setFormData({ ...formData, supplierId: value })}
                    style={styles.picker}
                  >
                    <Picker.Item label="请选择供应商" value="" />
                    {suppliers.map(supplier => (
                      <Picker.Item
                        key={supplier.id}
                        label={`${supplier.name} (${supplier.supplierCode})`}
                        value={supplier.id}
                      />
                    ))}
                  </Picker>
                </View>
              )}
              {errors.supplierId && <HelperText type="error">{errors.supplierId}</HelperText>}
            </View>

            {/* 2. Material Type */}
            <TextInput
              label="原料类型 *"
              value={formData.materialTypeId}
              onChangeText={(text) => setFormData({ ...formData, materialTypeId: text })}
              mode="outlined"
              style={styles.input}
              placeholder="例如：三文鱼、虾仁"
              error={!!errors.materialTypeId}
            />
            {errors.materialTypeId && <HelperText type="error">{errors.materialTypeId}</HelperText>}

            {/* 3. Quantity */}
            <TextInput
              label="入库重量 (kg) *"
              value={formData.quantity}
              onChangeText={(text) => setFormData({ ...formData, quantity: text })}
              mode="outlined"
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder="例如：100.5"
              error={!!errors.quantity}
            />
            {errors.quantity && <HelperText type="error">{errors.quantity}</HelperText>}

            {/* 4. Unit Price */}
            <TextInput
              label="单价 (元/kg) *"
              value={formData.unitPrice}
              onChangeText={(text) => setFormData({ ...formData, unitPrice: text })}
              mode="outlined"
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder="例如：45.00"
              error={!!errors.unitPrice}
            />
            {errors.unitPrice && <HelperText type="error">{errors.unitPrice}</HelperText>}

            {/* 5. Total Amount (Auto-calculated) */}
            <View style={styles.calculatedField}>
              <List.Icon icon="calculator" style={styles.calculatedIcon} />
              <View style={styles.calculatedTextContainer}>
                <Text style={styles.calculatedLabel}>总金额（自动计算）</Text>
                <Text style={styles.calculatedValue}>¥ {formData.totalAmount}</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.formCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>储存信息</Text>

            {/* 6. Storage Type */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>储存类型 *</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={formData.storageType}
                  onValueChange={(value) => setFormData({ ...formData, storageType: value })}
                  style={styles.picker}
                >
                  {storageTypeOptions.map(opt => (
                    <Picker.Item key={opt.value} label={opt.label} value={opt.value} />
                  ))}
                </Picker>
              </View>
            </View>

            {/* 7. Storage Location */}
            <TextInput
              label="储存位置 *"
              value={formData.storageLocation}
              onChangeText={(text) => setFormData({ ...formData, storageLocation: text })}
              mode="outlined"
              style={styles.input}
              placeholder="例如：冷库A区-货架3"
              error={!!errors.storageLocation}
            />
            {errors.storageLocation && <HelperText type="error">{errors.storageLocation}</HelperText>}

            {/* 8. Shelf Life */}
            <TextInput
              label="保质期 (天) *"
              value={formData.shelfLife}
              onChangeText={(text) => setFormData({ ...formData, shelfLife: text })}
              mode="outlined"
              style={styles.input}
              keyboardType="number-pad"
              placeholder="例如：30"
              error={!!errors.shelfLife}
            />
            {errors.shelfLife && <HelperText type="error">{errors.shelfLife}</HelperText>}

            {/* 9. Expiry Date (Auto-calculated) */}
            {formData.expiryDate && (
              <View style={styles.calculatedField}>
                <List.Icon icon="calendar-alert" style={styles.calculatedIcon} />
                <View style={styles.calculatedTextContainer}>
                  <Text style={styles.calculatedLabel}>到期日期（自动计算）</Text>
                  <Text style={styles.calculatedValue}>{formData.expiryDate}</Text>
                </View>
              </View>
            )}
          </Card.Content>
        </Card>

        <Card style={styles.formCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>质检信息</Text>

            {/* 10. Quality Grade (Inspector) */}
            <TextInput
              label="质检员 *"
              value={formData.qualityGrade}
              onChangeText={(text) => setFormData({ ...formData, qualityGrade: text })}
              mode="outlined"
              style={styles.input}
              placeholder="例如：张三"
              error={!!errors.qualityGrade}
            />
            {errors.qualityGrade && <HelperText type="error">{errors.qualityGrade}</HelperText>}

            {/* 11. Quality Status */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>质检状态 *</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={formData.qualityStatus}
                  onValueChange={(value) => setFormData({ ...formData, qualityStatus: value })}
                  style={styles.picker}
                >
                  {qualityStatusOptions.map(opt => (
                    <Picker.Item key={opt.value} label={opt.label} value={opt.value} />
                  ))}
                </Picker>
              </View>
            </View>

            {/* 12. Quality Score */}
            <TextInput
              label="新鲜度评分 (0-100)"
              value={formData.qualityScore}
              onChangeText={(text) => setFormData({ ...formData, qualityScore: text })}
              mode="outlined"
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder="例如：95"
            />

            {/* 13. Quality Notes */}
            <TextInput
              label="质检备注"
              value={formData.qualityNotes}
              onChangeText={(text) => setFormData({ ...formData, qualityNotes: text })}
              mode="outlined"
              style={styles.input}
              multiline
              numberOfLines={3}
              placeholder="质检备注信息"
            />

            {/* 14. Quality Photos (Placeholder) */}
            <View style={styles.photoPlaceholder}>
              <List.Icon icon="camera" color="#999" />
              <Text style={styles.photoPlaceholderText}>质检照片上传（待实现）</Text>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.formCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>其他信息</Text>

            {/* 15. Notes */}
            <TextInput
              label="备注"
              value={formData.notes}
              onChangeText={(text) => setFormData({ ...formData, notes: text })}
              mode="outlined"
              style={styles.input}
              multiline
              numberOfLines={3}
              placeholder="其他备注信息"
            />
          </Card.Content>
        </Card>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <Button
            mode="outlined"
            onPress={handleCancel}
            style={styles.cancelButton}
            disabled={loading}
          >
            取消
          </Button>
          <Button
            mode="contained"
            onPress={handleSubmit}
            style={styles.submitButton}
            loading={loading}
            disabled={loading}
          >
            确认入库
          </Button>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
  },
  formCard: {
    margin: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
  },
  picker: {
    height: 50,
  },
  input: {
    marginBottom: 8,
  },
  calculatedField: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    marginBottom: 16,
  },
  calculatedIcon: {
    margin: 0,
    marginRight: 8,
  },
  calculatedTextContainer: {
    flex: 1,
  },
  calculatedLabel: {
    fontSize: 12,
    color: '#666',
  },
  calculatedValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1565C0',
    marginTop: 2,
  },
  photoPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
  },
  photoPlaceholderText: {
    fontSize: 14,
    color: '#999',
    marginLeft: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    margin: 16,
  },
  cancelButton: {
    flex: 1,
  },
  submitButton: {
    flex: 1,
  },
  bottomPadding: {
    height: 20,
  },
});
