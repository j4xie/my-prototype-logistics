/**
 * AI 业务数据初始化界面
 * 通过自然语言描述，AI 自动生成产品类型、原材料类型和转换率配置
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Icon, Chip, Card, Button, Divider, Portal, Modal } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import aiBusinessDataApi, {
  FactoryBatchInitResponse,
  AIBusinessDataResponse,
  ProductTypeData,
  MaterialTypeData,
  ConversionRateData,
} from '../../../services/api/aiBusinessDataApiClient';

// ==================== 行业模板 ====================

const INDUSTRY_TEMPLATES = [
  {
    id: 'seafood',
    name: '水产加工',
    icon: 'fish',
    color: '#1890ff',
    description: '水产品加工厂，生产鱼罐头、虾仁、鱼片等',
    prompt: '水产品加工厂',
  },
  {
    id: 'prepared_food',
    name: '预制菜',
    icon: 'food-variant',
    color: '#52c41a',
    description: '预制菜加工厂，生产酸菜鱼、红烧肉等',
    prompt: '预制菜加工厂',
  },
  {
    id: 'meat',
    name: '肉类加工',
    icon: 'food-steak',
    color: '#f5222d',
    description: '肉类加工厂，生产香肠、腊肉、肉丸等',
    prompt: '肉类加工厂',
  },
  {
    id: 'dairy',
    name: '乳制品',
    icon: 'cow',
    color: '#faad14',
    description: '乳制品加工厂，生产牛奶、酸奶、奶酪等',
    prompt: '乳制品加工厂',
  },
  {
    id: 'beverage',
    name: '饮料加工',
    icon: 'cup',
    color: '#722ed1',
    description: '饮料加工厂，生产果汁、茶饮、矿泉水等',
    prompt: '饮料加工厂',
  },
  {
    id: 'custom',
    name: '自定义',
    icon: 'pencil',
    color: '#8c8c8c',
    description: '自定义描述您的工厂和产品',
    prompt: '',
  },
];

// ==================== 组件 ====================

export default function AIBusinessInitScreen() {
  const navigation = useNavigation();

  // 状态
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [customDescription, setCustomDescription] = useState('');
  const [factoryName, setFactoryName] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'input' | 'preview' | 'result'>('input');

  // AI 响应
  const [aiResponse, setAiResponse] = useState<FactoryBatchInitResponse | null>(null);
  const [initResult, setInitResult] = useState<AIBusinessDataResponse | null>(null);

  // 编辑状态
  const [editedProductTypes, setEditedProductTypes] = useState<ProductTypeData[]>([]);
  const [editedMaterialTypes, setEditedMaterialTypes] = useState<MaterialTypeData[]>([]);
  const [editedConversionRates, setEditedConversionRates] = useState<ConversionRateData[]>([]);

  // 详情弹窗
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<{
    type: 'product' | 'material' | 'conversion';
    data: ProductTypeData | MaterialTypeData | ConversionRateData;
  } | null>(null);

  // 获取完整描述
  const getFullDescription = useCallback(() => {
    if (selectedTemplate === 'custom') {
      return customDescription;
    }
    const template = INDUSTRY_TEMPLATES.find((t) => t.id === selectedTemplate);
    if (template && customDescription) {
      return `${template.prompt}，${customDescription}`;
    }
    return template?.prompt || customDescription;
  }, [selectedTemplate, customDescription]);

  // 调用 AI 生成
  const handleGenerate = async () => {
    const description = getFullDescription();
    if (!description.trim()) {
      Alert.alert('提示', '请输入工厂描述或选择行业模板');
      return;
    }

    setLoading(true);
    try {
      const response = await aiBusinessDataApi.batchInitializeFactory({
        factoryDescription: description,
        factoryName: factoryName || undefined,
        industryHint: selectedTemplate !== 'custom' ? selectedTemplate || undefined : undefined,
        includeBusinessData: true,
      });

      if (response.success && response.suggestedData) {
        setAiResponse(response);
        setEditedProductTypes(response.suggestedData.productTypes || []);
        setEditedMaterialTypes(response.suggestedData.materialTypes || []);
        setEditedConversionRates(response.suggestedData.conversionRates || []);
        setStep('preview');
      } else {
        Alert.alert('生成失败', response.message || '请稍后重试');
      }
    } catch (error) {
      console.error('AI 生成失败:', error);
      Alert.alert('错误', '生成失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  // 确认初始化
  const handleConfirmInit = async () => {
    setLoading(true);
    try {
      const result = await aiBusinessDataApi.initializeBusinessData({
        productTypes: editedProductTypes,
        materialTypes: editedMaterialTypes,
        conversionRates: editedConversionRates,
      });

      setInitResult(result);
      setStep('result');

      if (result.success) {
        Alert.alert('成功', result.message);
      } else {
        Alert.alert('部分失败', result.message);
      }
    } catch (error) {
      console.error('初始化失败:', error);
      Alert.alert('错误', '初始化失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 删除产品类型
  const handleRemoveProductType = (index: number) => {
    setEditedProductTypes((prev) => prev.filter((_, i) => i !== index));
  };

  // 删除原材料类型
  const handleRemoveMaterialType = (index: number) => {
    setEditedMaterialTypes((prev) => prev.filter((_, i) => i !== index));
  };

  // 删除转换率
  const handleRemoveConversion = (index: number) => {
    setEditedConversionRates((prev) => prev.filter((_, i) => i !== index));
  };

  // 重新开始
  const handleRestart = () => {
    setStep('input');
    setAiResponse(null);
    setInitResult(null);
    setEditedProductTypes([]);
    setEditedMaterialTypes([]);
    setEditedConversionRates([]);
  };

  // ==================== 渲染 ====================

  // 输入步骤
  const renderInputStep = () => (
    <>
      {/* 工厂名称 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>工厂名称（可选）</Text>
        <TextInput
          style={styles.input}
          placeholder="请输入工厂名称"
          value={factoryName}
          onChangeText={setFactoryName}
        />
      </View>

      {/* 行业模板 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>选择行业模板</Text>
        <View style={styles.templateGrid}>
          {INDUSTRY_TEMPLATES.map((template) => (
            <TouchableOpacity
              key={template.id}
              style={[
                styles.templateItem,
                selectedTemplate === template.id && styles.templateItemSelected,
              ]}
              onPress={() => setSelectedTemplate(template.id)}
            >
              <View
                style={[
                  styles.templateIcon,
                  { backgroundColor: template.color + '20' },
                ]}
              >
                <Icon source={template.icon} size={24} color={template.color} />
              </View>
              <Text style={styles.templateName}>{template.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 详细描述 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {selectedTemplate === 'custom' ? '工厂描述' : '补充描述（可选）'}
        </Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder={
            selectedTemplate === 'custom'
              ? '请描述您的工厂类型和主要产品...\n例如：水产品加工厂，主要生产带鱼罐头、黄花鱼罐头'
              : '补充更多细节...\n例如：主要生产带鱼罐头、酸菜鱼预制菜'
          }
          value={customDescription}
          onChangeText={setCustomDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>

      {/* 生成按钮 */}
      <View style={styles.buttonContainer}>
        <Button
          mode="contained"
          onPress={handleGenerate}
          loading={loading}
          disabled={loading || (!selectedTemplate && !customDescription.trim())}
          icon="robot"
          style={styles.generateButton}
        >
          AI 智能生成
        </Button>
      </View>
    </>
  );

  // 预览步骤
  const renderPreviewStep = () => (
    <>
      {/* AI 摘要 */}
      {aiResponse?.aiSummary && (
        <Card style={styles.summaryCard}>
          <Card.Content>
            <View style={styles.summaryHeader}>
              <Icon source="robot" size={20} color="#667eea" />
              <Text style={styles.summaryTitle}>AI 分析</Text>
            </View>
            <Text style={styles.summaryText}>{aiResponse.aiSummary}</Text>
            <View style={styles.industryBadge}>
              <Chip icon="factory" compact>
                {aiResponse.industryName}
              </Chip>
            </View>
          </Card.Content>
        </Card>
      )}

      {/* 产品类型 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>产品类型</Text>
          <Chip compact>{editedProductTypes.length} 项</Chip>
        </View>
        {editedProductTypes.map((pt, index) => (
          <View key={index} style={styles.dataItem}>
            <View style={styles.dataItemContent}>
              <Icon source="cube-outline" size={20} color="#1890ff" />
              <View style={styles.dataItemText}>
                <Text style={styles.dataItemName}>{pt.name}</Text>
                <Text style={styles.dataItemCode}>{pt.code}</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => handleRemoveProductType(index)}
              style={styles.removeButton}
            >
              <Icon source="close-circle" size={20} color="#ff4d4f" />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* 原材料类型 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>原材料类型</Text>
          <Chip compact>{editedMaterialTypes.length} 项</Chip>
        </View>
        {editedMaterialTypes.map((mt, index) => (
          <View key={index} style={styles.dataItem}>
            <View style={styles.dataItemContent}>
              <Icon source="package-variant" size={20} color="#52c41a" />
              <View style={styles.dataItemText}>
                <Text style={styles.dataItemName}>{mt.name}</Text>
                <Text style={styles.dataItemCode}>
                  {mt.code} | {mt.unit || 'kg'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => handleRemoveMaterialType(index)}
              style={styles.removeButton}
            >
              <Icon source="close-circle" size={20} color="#ff4d4f" />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* 转换率 */}
      {editedConversionRates.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>转换率配置</Text>
            <Chip compact>{editedConversionRates.length} 项</Chip>
          </View>
          {editedConversionRates.map((cr, index) => (
            <View key={index} style={styles.dataItem}>
              <View style={styles.dataItemContent}>
                <Icon source="swap-horizontal" size={20} color="#722ed1" />
                <View style={styles.dataItemText}>
                  <Text style={styles.dataItemName}>
                    {cr.materialTypeCode} → {cr.productTypeCode}
                  </Text>
                  <Text style={styles.dataItemCode}>转换率: {cr.rate}</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => handleRemoveConversion(index)}
                style={styles.removeButton}
              >
                <Icon source="close-circle" size={20} color="#ff4d4f" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* 操作按钮 */}
      <View style={styles.buttonRow}>
        <Button
          mode="outlined"
          onPress={handleRestart}
          style={styles.halfButton}
        >
          重新生成
        </Button>
        <Button
          mode="contained"
          onPress={handleConfirmInit}
          loading={loading}
          disabled={loading}
          style={styles.halfButton}
          icon="check"
        >
          确认创建
        </Button>
      </View>
    </>
  );

  // 结果步骤
  const renderResultStep = () => (
    <>
      {/* 成功卡片 */}
      <Card style={[styles.resultCard, initResult?.success && styles.successCard]}>
        <Card.Content>
          <View style={styles.resultHeader}>
            <Icon
              source={initResult?.success ? 'check-circle' : 'alert-circle'}
              size={48}
              color={initResult?.success ? '#52c41a' : '#faad14'}
            />
            <Text style={styles.resultTitle}>
              {initResult?.success ? '初始化完成' : '部分完成'}
            </Text>
          </View>
          <Text style={styles.resultMessage}>{initResult?.message}</Text>
        </Card.Content>
      </Card>

      {/* 统计信息 */}
      {initResult?.stats && (
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Icon source="cube-outline" size={24} color="#1890ff" />
            <Text style={styles.statValue}>
              {initResult.stats.productTypesCreated}
            </Text>
            <Text style={styles.statLabel}>产品类型</Text>
            {initResult.stats.productTypesSkipped > 0 && (
              <Text style={styles.statSkipped}>
                ({initResult.stats.productTypesSkipped} 已存在)
              </Text>
            )}
          </View>
          <View style={styles.statItem}>
            <Icon source="package-variant" size={24} color="#52c41a" />
            <Text style={styles.statValue}>
              {initResult.stats.materialTypesCreated}
            </Text>
            <Text style={styles.statLabel}>原材料类型</Text>
            {initResult.stats.materialTypesSkipped > 0 && (
              <Text style={styles.statSkipped}>
                ({initResult.stats.materialTypesSkipped} 已存在)
              </Text>
            )}
          </View>
          <View style={styles.statItem}>
            <Icon source="swap-horizontal" size={24} color="#722ed1" />
            <Text style={styles.statValue}>
              {initResult.stats.conversionsCreated}
            </Text>
            <Text style={styles.statLabel}>转换率</Text>
            {initResult.stats.conversionsSkipped > 0 && (
              <Text style={styles.statSkipped}>
                ({initResult.stats.conversionsSkipped} 已存在)
              </Text>
            )}
          </View>
        </View>
      )}

      {/* 操作按钮 */}
      <View style={styles.buttonContainer}>
        <Button
          mode="contained"
          onPress={() => navigation.goBack()}
          icon="check"
          style={styles.generateButton}
        >
          完成
        </Button>
        <Button
          mode="text"
          onPress={handleRestart}
          style={{ marginTop: 12 }}
        >
          继续添加
        </Button>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Icon source="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>AI 智能初始化</Text>
          <Text style={styles.headerSubtitle}>
            {step === 'input'
              ? '描述您的工厂，AI 自动生成配置'
              : step === 'preview'
              ? '确认生成的业务数据'
              : '初始化完成'}
          </Text>
        </View>
      </View>

      {/* Steps Indicator */}
      <View style={styles.stepsContainer}>
        <View style={[styles.step, step === 'input' && styles.stepActive]}>
          <View
            style={[
              styles.stepDot,
              step === 'input' && styles.stepDotActive,
              step !== 'input' && styles.stepDotCompleted,
            ]}
          >
            {step !== 'input' ? (
              <Icon source="check" size={12} color="#fff" />
            ) : (
              <Text style={styles.stepNumber}>1</Text>
            )}
          </View>
          <Text style={[styles.stepText, step === 'input' && styles.stepTextActive]}>
            描述工厂
          </Text>
        </View>
        <View style={styles.stepLine} />
        <View style={[styles.step, step === 'preview' && styles.stepActive]}>
          <View
            style={[
              styles.stepDot,
              step === 'preview' && styles.stepDotActive,
              step === 'result' && styles.stepDotCompleted,
            ]}
          >
            {step === 'result' ? (
              <Icon source="check" size={12} color="#fff" />
            ) : (
              <Text style={styles.stepNumber}>2</Text>
            )}
          </View>
          <Text style={[styles.stepText, step === 'preview' && styles.stepTextActive]}>
            确认数据
          </Text>
        </View>
        <View style={styles.stepLine} />
        <View style={[styles.step, step === 'result' && styles.stepActive]}>
          <View
            style={[
              styles.stepDot,
              step === 'result' && styles.stepDotActive,
            ]}
          >
            <Text style={styles.stepNumber}>3</Text>
          </View>
          <Text style={[styles.stepText, step === 'result' && styles.stepTextActive]}>
            完成
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {step === 'input' && renderInputStep()}
        {step === 'preview' && renderPreviewStep()}
        {step === 'result' && renderResultStep()}
      </ScrollView>

      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>
            {step === 'input' ? 'AI 正在分析...' : '正在创建...'}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

// ==================== 样式 ====================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  stepsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  step: {
    alignItems: 'center',
  },
  stepActive: {},
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  stepDotActive: {
    backgroundColor: '#667eea',
  },
  stepDotCompleted: {
    backgroundColor: '#52c41a',
  },
  stepNumber: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
  },
  stepText: {
    fontSize: 12,
    color: '#999',
  },
  stepTextActive: {
    color: '#667eea',
    fontWeight: '600',
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 8,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 12,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#fafafa',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  templateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  templateItem: {
    width: '33.33%',
    padding: 6,
  },
  templateItemSelected: {},
  templateIcon: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  templateName: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
    marginTop: 6,
  },
  buttonContainer: {
    padding: 16,
  },
  generateButton: {
    paddingVertical: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  halfButton: {
    flex: 1,
  },
  summaryCard: {
    margin: 12,
    backgroundColor: '#f6f8ff',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
    marginLeft: 6,
  },
  summaryText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  industryBadge: {
    marginTop: 12,
    alignItems: 'flex-start',
  },
  dataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dataItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dataItemText: {
    marginLeft: 12,
    flex: 1,
  },
  dataItemName: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  dataItemCode: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  removeButton: {
    padding: 8,
  },
  resultCard: {
    margin: 12,
  },
  successCard: {
    backgroundColor: '#f6ffed',
  },
  resultHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
  },
  resultMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    margin: 12,
    padding: 20,
    borderRadius: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statSkipped: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
});
