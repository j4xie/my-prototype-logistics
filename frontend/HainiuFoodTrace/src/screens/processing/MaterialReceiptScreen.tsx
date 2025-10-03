import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  BigButton,
  NumberPad,
  FishTypeSelector,
} from '../../components/processing';
import { processingApiClient } from '../../services/api/processingApiClient';
import { FishType, ProductCategory } from '../../types/costAccounting';

interface MaterialReceiptScreenProps {
  navigation: any;
}

/**
 * 原材料接收界面
 * 工作流程1: 记录原材料进货信息
 */
export const MaterialReceiptScreen: React.FC<MaterialReceiptScreenProps> = ({ navigation }) => {
  const [inputMethod, setInputMethod] = useState<'scan' | 'manual'>('manual');
  const [fishType, setFishType] = useState<FishType | null>(null);
  const [weight, setWeight] = useState('');
  const [cost, setCost] = useState('');
  const [productCategory, setProductCategory] = useState<ProductCategory>('fresh');
  const [expectedPrice, setExpectedPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // 计算预估总成本
  const estimatedTotalCost = weight && cost ? (parseFloat(weight) * parseFloat(cost)).toFixed(2) : '0.00';

  // 计算单位成本
  const unitCost = cost && weight ? (parseFloat(cost) / parseFloat(weight)).toFixed(2) : '0.00';

  // 扫码功能(暂时模拟)
  const handleScan = () => {
    Alert.alert('扫码功能', '扫码功能正在开发中，请使用手动录入');
    setInputMethod('manual');
  };

  // 提交数据
  const handleSubmit = async () => {
    // 验证必填项
    if (!fishType) {
      Alert.alert('提示', '请选择鱼类品种');
      return;
    }

    if (!weight || parseFloat(weight) <= 0) {
      Alert.alert('提示', '请输入有效的进货重量');
      return;
    }

    if (!cost || parseFloat(cost) <= 0) {
      Alert.alert('提示', '请输入有效的进货成本');
      return;
    }

    try {
      setLoading(true);

      const response = await processingApiClient.createMaterialReceipt({
        rawMaterialCategory: fishType.name,
        rawMaterialWeight: parseFloat(weight),
        rawMaterialCost: parseFloat(cost),
        productCategory,
        expectedPrice: expectedPrice ? parseFloat(expectedPrice) : undefined,
        notes: notes || undefined,
      });

      if (response.success) {
        Alert.alert(
          '成功',
          `原材料接收记录创建成功！\n批次号: ${response.data.batchNumber}`,
          [
            {
              text: '查看详情',
              onPress: () => navigation.navigate('BatchDetail', { batchId: response.data.id }),
            },
            {
              text: '继续录入',
              onPress: () => resetForm(),
            },
          ]
        );
      } else {
        Alert.alert('失败', response.message || '创建失败，请重试');
      }
    } catch (error: any) {
      console.error('创建原材料接收记录失败:', error);
      Alert.alert('错误', error.message || '网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 重置表单
  const resetForm = () => {
    setFishType(null);
    setWeight('');
    setCost('');
    setProductCategory('fresh');
    setExpectedPrice('');
    setNotes('');
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>原材料接收</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 录入方式选择 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>录入方式</Text>
          <View style={styles.methodButtons}>
            <BigButton
              title="扫码录入"
              icon="scan"
              variant={inputMethod === 'scan' ? 'primary' : 'secondary'}
              onPress={handleScan}
              size="medium"
              style={{ flex: 1, marginRight: 8 }}
            />
            <BigButton
              title="手动录入"
              icon="create"
              variant={inputMethod === 'manual' ? 'primary' : 'secondary'}
              onPress={() => setInputMethod('manual')}
              size="medium"
              style={{ flex: 1, marginLeft: 8 }}
            />
          </View>
        </View>

        {/* 鱼类品种选择 */}
        <View style={styles.section}>
          <FishTypeSelector
            value={fishType?.name}
            onValueChange={setFishType}
            label="鱼类品种"
            placeholder="请选择鱼类品种"
          />
          {fishType?.averagePrice && (
            <Text style={styles.hint}>
              参考价格: ¥{fishType.averagePrice}/kg
            </Text>
          )}
        </View>

        {/* 进货重量 */}
        <View style={styles.section}>
          <NumberPad
            value={weight}
            onValueChange={setWeight}
            label="进货重量"
            placeholder="0"
            unit="kg"
            allowDecimal={true}
            quickButtons={[10, 50, 100]}
          />
        </View>

        {/* 进货成本 */}
        <View style={styles.section}>
          <NumberPad
            value={cost}
            onValueChange={setCost}
            label="进货成本"
            placeholder="0"
            unit="元"
            allowDecimal={true}
            quickButtons={[100, 500, 1000]}
          />
          {weight && cost && (
            <View style={styles.costInfo}>
              <Text style={styles.costInfoLabel}>单位成本:</Text>
              <Text style={styles.costInfoValue}>¥{unitCost}/kg</Text>
            </View>
          )}
        </View>

        {/* 产品类型选择 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>产品类型</Text>
          <View style={styles.categoryButtons}>
            <TouchableOpacity
              style={[
                styles.categoryButton,
                productCategory === 'fresh' && styles.categoryButtonActive,
              ]}
              onPress={() => setProductCategory('fresh')}
            >
              <Ionicons
                name="fish"
                size={32}
                color={productCategory === 'fresh' ? '#10B981' : '#6B7280'}
              />
              <Text
                style={[
                  styles.categoryButtonText,
                  productCategory === 'fresh' && styles.categoryButtonTextActive,
                ]}
              >
                鲜鱼
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.categoryButton,
                productCategory === 'frozen' && styles.categoryButtonActive,
              ]}
              onPress={() => setProductCategory('frozen')}
            >
              <Ionicons
                name="snow"
                size={32}
                color={productCategory === 'frozen' ? '#3B82F6' : '#6B7280'}
              />
              <Text
                style={[
                  styles.categoryButtonText,
                  productCategory === 'frozen' && styles.categoryButtonTextActive,
                ]}
              >
                冻鱼
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 预期售价(可选) */}
        <View style={styles.section}>
          <NumberPad
            value={expectedPrice}
            onValueChange={setExpectedPrice}
            label="预期售价 (可选)"
            placeholder="0"
            unit="元/kg"
            allowDecimal={true}
          />
        </View>

        {/* 成本预览 */}
        {weight && cost && (
          <View style={styles.previewCard}>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>预估总成本:</Text>
              <Text style={styles.previewValue}>¥{estimatedTotalCost}</Text>
            </View>
            {expectedPrice && (
              <>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>预期收入:</Text>
                  <Text style={styles.previewValue}>
                    ¥{(parseFloat(weight) * parseFloat(expectedPrice)).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>预期利润:</Text>
                  <Text
                    style={[
                      styles.previewValue,
                      {
                        color:
                          parseFloat(weight) * parseFloat(expectedPrice) -
                            parseFloat(cost) >
                          0
                            ? '#10B981'
                            : '#EF4444',
                      },
                    ]}
                  >
                    ¥
                    {(
                      parseFloat(weight) * parseFloat(expectedPrice) -
                      parseFloat(cost)
                    ).toFixed(2)}
                  </Text>
                </View>
              </>
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 底部提交按钮 */}
      <View style={styles.footer}>
        <BigButton
          title={loading ? '提交中...' : '确认录入'}
          icon="checkmark-circle"
          variant="success"
          onPress={handleSubmit}
          disabled={loading || !fishType || !weight || !cost}
          loading={loading}
          size="xlarge"
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  methodButtons: {
    flexDirection: 'row',
  },
  hint: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    fontStyle: 'italic',
  },
  costInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    padding: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
  },
  costInfoLabel: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '500',
  },
  costInfoValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3B82F6',
  },
  categoryButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  categoryButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  categoryButtonActive: {
    backgroundColor: '#D1FAE5',
    borderColor: '#10B981',
  },
  categoryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 8,
  },
  categoryButtonTextActive: {
    color: '#10B981',
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewLabel: {
    fontSize: 16,
    color: '#6B7280',
  },
  previewValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
});
