import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Appbar, TextInput, Button, Card, List } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { ProcessingScreenProps } from '../../types/navigation';
import { processingAPI } from '../../services/api/processingApiClient';
import { MaterialTypeSelector, SupervisorSelector } from '../../components/processing';
import { SupplierSelector } from '../../components/common/SupplierSelector';
import { useAuthStore } from '../../store/authStore';

type CreateBatchScreenProps = ProcessingScreenProps<'CreateBatch'>;

/**
 * 创建批次页面
 */
export default function CreateBatchScreen() {
  const navigation = useNavigation<CreateBatchScreenProps['navigation']>();
  const { user } = useAuthStore();

  // 权限检查
  const userType = user?.userType || 'factory';
  const isPlatformAdmin = userType === 'platform';

  // 表单状态 - 只记录原料信息
  const [materialType, setMaterialType] = useState('');
  const [materialQuantity, setMaterialQuantity] = useState('');
  const [materialCost, setMaterialCost] = useState('');
  const [supplierName, setSupplierName] = useState('');  // 供应商名称
  const [supplierId, setSupplierId] = useState('');      // 供应商ID
  const [supervisorName, setSupervisorName] = useState('');
  const [supervisorId, setSupervisorId] = useState<number | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    // 表单验证
    if (!materialType.trim()) {
      Alert.alert('验证错误', '请输入原料类型');
      return;
    }
    if (!materialQuantity || Number(materialQuantity) <= 0) {
      Alert.alert('验证错误', '请输入有效的原料数量');
      return;
    }
    if (!materialCost || Number(materialCost) <= 0) {
      Alert.alert('验证错误', '请输入原料成本');
      return;
    }
    if (!supplierName.trim() || !supplierId) {
      Alert.alert('验证错误', '请选择供应商');
      return;
    }
    if (!supervisorName.trim()) {
      Alert.alert('验证错误', '请输入生产负责人');
      return;
    }

    try {
      setLoading(true);

      // 构建请求数据 - 发送原料入库信息（包含supplierId）
      const batchData = {
        rawMaterials: [
          {
            materialType: materialType.trim(),
            quantity: Number(materialQuantity),
            unit: 'kg',
            cost: Number(materialCost),
          },
        ],
        supplierId: supplierId,      // 添加供应商ID（必填）
        supervisorId: supervisorId,  // 发送supervisorId而不是supervisorName
        notes: notes.trim() || undefined,
      };

      console.log('📦 Creating batch:', batchData);

      // 调用API创建批次
      const result = await processingAPI.createBatch(batchData);

      console.log('✅ Batch created:', result);

      Alert.alert('创建成功', `批次 ${result.batchNumber} 创建成功！`, [
        {
          text: '查看详情',
          onPress: () => {
            navigation.replace('BatchDetail', { batchId: result.id.toString() });
          },
        },
        {
          text: '返回列表',
          onPress: () => {
            navigation.navigate('BatchList', {});
          },
        },
      ]);
    } catch (error: any) {
      console.error('❌ Failed to create batch:', error);
      Alert.alert('创建失败', error.message || '创建批次失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 平台管理员无权操作
  if (isPlatformAdmin) {
    return (
      <View style={styles.container}>
        <Appbar.Header elevated>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="原料入库" />
        </Appbar.Header>

        <View style={styles.blockedContainer}>
          <List.Icon icon="alert-circle-outline" color="#F44336" size={64} />
          <Text variant="headlineSmall" style={styles.blockedTitle}>
            无权操作
          </Text>
          <Text variant="bodyMedium" style={styles.blockedText}>
            平台管理员无权操作原料入库
          </Text>
          <Text variant="bodySmall" style={styles.blockedHint}>
            此功能仅限工厂用户使用
          </Text>
          <Button
            mode="contained"
            onPress={() => navigation.goBack()}
            style={styles.blockedButton}
          >
            返回
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="原料入库" />
        <Appbar.Action icon="check" onPress={handleCreate} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="bodyMedium" style={styles.hint}>
          记录原料入库信息，后续再决定生产什么产品
        </Text>

        <Card style={styles.card} mode="elevated">
          <Card.Title title="原料信息" />
          <Card.Content>
            <MaterialTypeSelector
              value={materialType}
              onSelect={setMaterialType}
              label="原料类型"
              placeholder="点击选择原料类型"
            />

            <TextInput
              label="原料数量 (kg) *"
              placeholder="例如: 1200"
              mode="outlined"
              keyboardType="numeric"
              value={materialQuantity}
              onChangeText={setMaterialQuantity}
              style={styles.input}
            />

            <TextInput
              label="原料成本 (元) *"
              placeholder="例如: 30000"
              mode="outlined"
              keyboardType="numeric"
              value={materialCost}
              onChangeText={setMaterialCost}
              style={styles.input}
            />

            <SupplierSelector
              value={supplierName}
              onSelect={(id, name) => {
                setSupplierId(id);
                setSupplierName(name);
                console.log('✅ Selected supplier:', id, name);
              }}
              label="供应商"
              placeholder="选择供应商"
            />
          </Card.Content>
        </Card>

        <Card style={styles.card} mode="elevated">
          <Card.Title title="负责人信息" />
          <Card.Content>
            <SupervisorSelector
              value={supervisorName}
              onSelect={(name, id) => {
                setSupervisorName(name);
                setSupervisorId(id);
              }}
              label="生产负责人"
              placeholder="点击选择负责人"
            />

            <TextInput
              label="备注"
              placeholder="选填"
              mode="outlined"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              style={styles.input}
            />
          </Card.Content>
        </Card>

        <Button
          mode="contained"
          onPress={handleCreate}
          loading={loading}
          disabled={loading}
          style={styles.submitButton}
        >
          {loading ? '创建中...' : '创建批次'}
        </Button>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    padding: 16,
  },
  hint: {
    color: '#757575',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  card: {
    marginBottom: 16,
  },
  input: {
    marginBottom: 12,
  },
  submitButton: {
    marginTop: 16,
    marginBottom: 32,
  },
  blockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#FAFAFA',
  },
  blockedTitle: {
    marginTop: 16,
    marginBottom: 8,
    color: '#F44336',
    fontWeight: '600',
  },
  blockedText: {
    marginBottom: 8,
    color: '#666',
    textAlign: 'center',
  },
  blockedHint: {
    marginBottom: 24,
    color: '#999',
    textAlign: 'center',
  },
  blockedButton: {
    minWidth: 120,
  },
});
