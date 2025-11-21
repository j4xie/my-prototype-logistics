import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, TextInput as RNTextInput } from 'react-native';
import { Text, Appbar, TextInput, ActivityIndicator } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ProcessingScreenProps } from '../../types/navigation';
import { processingAPI } from '../../services/api/processingApiClient';
import { MaterialTypeSelector, SupervisorSelector } from '../../components/processing';
import { SupplierSelector } from '../../components/common/SupplierSelector';
import { useAuthStore } from '../../store/authStore';
import { handleError } from '../../utils/errorHandler';
import { NeoCard, NeoButton, ScreenWrapper } from '../../components/ui';
import { theme } from '../../theme';

type CreateBatchScreenProps = ProcessingScreenProps<'CreateBatch'>;
type EditBatchScreenProps = ProcessingScreenProps<'EditBatch'>;

export default function CreateBatchScreen() {
  const navigation = useNavigation<CreateBatchScreenProps['navigation']>();
  const route = useRoute<EditBatchScreenProps['route'] | CreateBatchScreenProps['route']>();
  const { user } = useAuthStore();

  const batchId = route.params && 'batchId' in route.params ? route.params.batchId : undefined;
  const isEditMode = !!batchId;
  const userType = user?.userType || 'factory';
  const isPlatformAdmin = userType === 'platform';

  const [materialType, setMaterialType] = useState('');
  const [materialQuantity, setMaterialQuantity] = useState('');
  const [materialCost, setMaterialCost] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [supervisorName, setSupervisorName] = useState('');
  const [supervisorId, setSupervisorId] = useState<number | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditMode);

  useEffect(() => {
    if (isEditMode && batchId) {
      loadBatchData(batchId);
    }
  }, [isEditMode, batchId]);

  const loadBatchData = async (id: string) => {
    try {
      setInitialLoading(true);
      const batch = await processingAPI.getBatchDetail(id);

      if (batch.rawMaterials && batch.rawMaterials.length > 0) {
        const firstMaterial = batch.rawMaterials[0];
        setMaterialType(firstMaterial.materialType ?? firstMaterial.type ?? '');
        setMaterialQuantity(firstMaterial.quantity?.toString() ?? '');
        setMaterialCost(firstMaterial.cost?.toString() ?? '');
      }

      if (batch.supplier) {
        setSupplierId(batch.supplier.id?.toString() ?? '');
        setSupplierName(batch.supplier.name ?? '');
      }

      if (batch.supervisor) {
        setSupervisorId(batch.supervisor.id);
        setSupervisorName(batch.supervisor.fullName ?? batch.supervisor.username ?? '');
      }

      setNotes(batch.notes ?? '');
    } catch (error) {
      handleError(error, { showAlert: true, title: '加载失败', logError: true });
      navigation.goBack();
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!materialType.trim()) return Alert.alert('验证错误', '请输入原料类型');
    if (!materialQuantity || Number(materialQuantity) <= 0) return Alert.alert('验证错误', '请输入有效的原料数量');
    if (!materialCost || Number(materialCost) <= 0) return Alert.alert('验证错误', '请输入原料成本');
    if (!supplierName.trim() || !supplierId) return Alert.alert('验证错误', '请选择供应商');
    if (!supervisorName.trim()) return Alert.alert('验证错误', '请输入生产负责人');

    try {
      setLoading(true);
      const batchData = {
        rawMaterials: [{ materialType: materialType.trim(), quantity: Number(materialQuantity), unit: 'kg', cost: Number(materialCost) }],
        supplierId: supplierId,
        supervisorId: supervisorId,
        notes: notes.trim() || undefined,
      };

      if (isEditMode) {
        const result = await processingAPI.updateBatch(batchId, batchData);
        Alert.alert('成功', '批次信息已更新！', [{ text: '查看详情', onPress: () => navigation.replace('BatchDetail', { batchId: result.id.toString() }) }]);
      } else {
        const result = await processingAPI.createBatch(batchData);
        Alert.alert('成功', `批次 ${result.batchNumber} 创建成功！`, [
          { text: '查看详情', onPress: () => navigation.replace('BatchDetail', { batchId: result.id.toString() }) },
          { text: '返回列表', onPress: () => navigation.navigate('BatchList', {}) },
        ]);
      }
    } catch (error) {
      handleError(error, { showAlert: true, title: isEditMode ? '更新失败' : '创建失败', logError: true });
    } finally {
      setLoading(false);
    }
  };

  if (isPlatformAdmin) {
    return (
      <ScreenWrapper edges={['top']} backgroundColor={theme.colors.background}>
        <Appbar.Header elevated style={{ backgroundColor: theme.colors.surface }}>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title={isEditMode ? '编辑批次' : '原料入库'} />
        </Appbar.Header>
        <View style={styles.centerContainer}>
          <Text variant="headlineSmall" style={styles.errorText}>无权操作</Text>
          <Text style={styles.hint}>仅限工厂用户使用</Text>
          <NeoButton onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>返回</NeoButton>
        </View>
      </ScreenWrapper>
    );
  }

  if (initialLoading) {
    return (
      <ScreenWrapper edges={['top']} backgroundColor={theme.colors.background}>
        <Appbar.Header elevated style={{ backgroundColor: theme.colors.surface }}>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="加载中" />
        </Appbar.Header>
        <View style={styles.centerContainer}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper edges={['top']} backgroundColor={theme.colors.background}>
      <Appbar.Header elevated style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={isEditMode ? '编辑批次' : '原料入库'} titleStyle={{ fontWeight: '600' }} />
        <Appbar.Action icon="check" onPress={handleSubmit} color={theme.colors.primary} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.content}>
        {!isEditMode && (
          <NeoCard style={styles.card} padding="m" variant="flat">
            <Text style={styles.hint}>记录原料入库信息，后续再决定生产什么产品</Text>
          </NeoCard>
        )}

        <NeoCard style={styles.card} padding="l">
          <Text variant="titleMedium" style={styles.sectionTitle}>原料信息</Text>
          
          <View style={styles.inputGroup}>
            <MaterialTypeSelector
                value={materialType}
                onSelect={setMaterialType}
                label="原料类型"
                placeholder="点击选择原料类型"
            />
          </View>

          <View style={styles.inputGroup}>
            <TextInput
                label="原料数量 (kg)"
                placeholder="例如: 1200"
                mode="outlined"
                keyboardType="numeric"
                value={materialQuantity}
                onChangeText={setMaterialQuantity}
                style={styles.input}
                activeOutlineColor={theme.colors.primary}
            />
          </View>

          <View style={styles.inputGroup}>
            <TextInput
                label="原料成本 (元)"
                placeholder="例如: 30000"
                mode="outlined"
                keyboardType="numeric"
                value={materialCost}
                onChangeText={setMaterialCost}
                style={styles.input}
                activeOutlineColor={theme.colors.primary}
            />
          </View>

          <View style={styles.inputGroup}>
            <SupplierSelector
                value={supplierName}
                onSelect={(id, name) => { setSupplierId(id); setSupplierName(name); }}
                label="供应商"
                placeholder="选择供应商"
            />
          </View>
        </NeoCard>

        <NeoCard style={styles.card} padding="l">
          <Text variant="titleMedium" style={styles.sectionTitle}>负责人信息</Text>
          
          <View style={styles.inputGroup}>
            <SupervisorSelector
                value={supervisorName}
                onSelect={(name, id) => { setSupervisorName(name); setSupervisorId(id); }}
                label="生产负责人"
                placeholder="点击选择负责人"
            />
          </View>

          <View style={styles.inputGroup}>
            <TextInput
                label="备注"
                placeholder="选填"
                mode="outlined"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                style={styles.input}
                activeOutlineColor={theme.colors.primary}
            />
          </View>
        </NeoCard>

        <NeoButton
          variant="primary"
          size="large"
          onPress={handleSubmit}
          loading={loading}
          disabled={loading}
          style={styles.submitButton}
        >
          {isEditMode ? '更新批次' : '创建批次'}
        </NeoButton>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 16,
    color: theme.colors.text,
  },
  hint: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  inputGroup: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: 'white',
  },
  submitButton: {
    marginTop: 8,
    marginBottom: 32,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    color: theme.colors.error,
    marginBottom: 8,
  },
});
