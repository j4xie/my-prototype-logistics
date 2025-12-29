/**
 * 工厂初始化设置屏幕
 *
 * 支持两种模式:
 * 1. 模板选择模式 - 选择预设的行业模板包快速初始化
 * 2. AI 对话模式 - 通过自然语言描述让 AI 生成完整配置
 *
 * @author Cretas Team
 * @version 2.0.0
 * @since 2025-12-29
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Icon } from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import {
  templatePackageApiClient,
  IndustryTemplatePackage,
} from '../../services/api/templatePackageApiClient';
import platformAPI, {
  AIFactoryInitRequest,
  AIFactoryInitResponse,
  EntitySchemaDTO,
} from '../../services/api/platformApiClient';

// 路由参数类型
type FactorySetupRouteParams = {
  factoryId: string;
  factoryName?: string;
};

// 初始化模式
type InitMode = 'template' | 'ai';

// 行业图标映射
const INDUSTRY_ICONS: Record<string, string> = {
  seafood_processing: 'fish',
  prepared_food: 'food-variant',
  meat_processing: 'pig-variant',
  dairy_processing: 'cow',
  beverage_processing: 'cup-water',
  grain_processing: 'barley',
  fruit_processing: 'fruit-cherries',
  vegetable_processing: 'carrot',
  default: 'factory',
};

// 行业颜色映射
const INDUSTRY_COLORS: Record<string, string> = {
  seafood_processing: '#1890ff',
  prepared_food: '#fa8c16',
  meat_processing: '#f5222d',
  dairy_processing: '#52c41a',
  beverage_processing: '#13c2c2',
  grain_processing: '#faad14',
  fruit_processing: '#eb2f96',
  vegetable_processing: '#a0d911',
  default: '#667eea',
};

// 示例描述提示
const EXAMPLE_DESCRIPTIONS = [
  '这是一个水产品加工厂，主要生产带鱼罐头，需要原料入库、生产、质检、出货全流程',
  '我们是预制菜加工企业，主要生产酸菜鱼、水煮肉片等产品，需要追溯原料来源',
  '肉类加工厂，处理猪肉分割和冷链配送，需要温度监控和质检记录',
];

interface TemplatePackageCardProps {
  pkg: IndustryTemplatePackage;
  selected: boolean;
  onSelect: () => void;
}

function TemplatePackageCard({ pkg, selected, onSelect }: TemplatePackageCardProps) {
  const icon = INDUSTRY_ICONS[pkg.industryCode] || INDUSTRY_ICONS.default;
  const color = INDUSTRY_COLORS[pkg.industryCode] || INDUSTRY_COLORS.default;

  return (
    <TouchableOpacity
      style={[styles.packageCard, selected && styles.packageCardSelected]}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      <View style={styles.packageHeader}>
        <View style={[styles.packageIcon, { backgroundColor: color + '20' }]}>
          <Icon source={icon} size={32} color={color} />
        </View>
        <View style={styles.packageInfo}>
          <Text style={styles.packageName}>{pkg.industryName}</Text>
          <Text style={styles.packageCode}>{pkg.industryCode}</Text>
        </View>
        {selected && (
          <View style={styles.selectedBadge}>
            <Icon source="check-circle" size={24} color="#52c41a" />
          </View>
        )}
        {pkg.isDefault && !selected && (
          <View style={styles.defaultBadge}>
            <Text style={styles.defaultBadgeText}>推荐</Text>
          </View>
        )}
      </View>

      {pkg.description && (
        <Text style={styles.packageDescription}>{pkg.description}</Text>
      )}

      <View style={styles.packageMeta}>
        <View style={styles.metaItem}>
          <Icon source="file-document-outline" size={16} color="#666" />
          <Text style={styles.metaText}>{pkg.schemaCount} 个模板</Text>
        </View>
        <View style={styles.metaItem}>
          <Icon source="tag-outline" size={16} color="#666" />
          <Text style={styles.metaText}>版本 {pkg.version}</Text>
        </View>
      </View>

      {pkg.entityTypes && pkg.entityTypes.length > 0 && (
        <View style={styles.entityTypes}>
          {pkg.entityTypes.slice(0, 4).map((type) => (
            <View key={type} style={styles.entityTag}>
              <Text style={styles.entityTagText}>{getEntityTypeLabel(type)}</Text>
            </View>
          ))}
          {pkg.entityTypes.length > 4 && (
            <View style={styles.entityTag}>
              <Text style={styles.entityTagText}>+{pkg.entityTypes.length - 4}</Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

// 实体类型标签
function getEntityTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    QUALITY_CHECK: '质检',
    MATERIAL_BATCH: '原料',
    PROCESSING_BATCH: '生产',
    SHIPMENT: '出货',
    EQUIPMENT: '设备',
    DISPOSAL_RECORD: '报废',
  };
  return labels[type] || type;
}

// AI 结果预览组件
interface AIResultPreviewProps {
  result: AIFactoryInitResponse;
  onConfirm: () => void;
  onCancel: () => void;
  confirming: boolean;
}

function AIResultPreview({ result, onConfirm, onCancel, confirming }: AIResultPreviewProps) {
  const color = INDUSTRY_COLORS[result.industryCode] || INDUSTRY_COLORS.default;
  const icon = INDUSTRY_ICONS[result.industryCode] || INDUSTRY_ICONS.default;

  return (
    <View style={styles.aiResultContainer}>
      {/* 行业识别结果 */}
      <View style={styles.industryResult}>
        <View style={[styles.industryIcon, { backgroundColor: color + '20' }]}>
          <Icon source={icon} size={40} color={color} />
        </View>
        <View style={styles.industryInfo}>
          <Text style={styles.industryName}>{result.industryName}</Text>
          <Text style={styles.industryCode}>{result.industryCode}</Text>
        </View>
      </View>

      {/* AI 总结 */}
      {result.aiSummary && (
        <View style={styles.aiSummaryCard}>
          <View style={styles.aiSummaryHeader}>
            <Icon source="robot" size={20} color="#667eea" />
            <Text style={styles.aiSummaryTitle}>AI 配置说明</Text>
          </View>
          <Text style={styles.aiSummaryText}>{result.aiSummary}</Text>
        </View>
      )}

      {/* 生成的 Schema 列表 */}
      <View style={styles.schemasSection}>
        <Text style={styles.sectionTitle}>
          生成的表单模板 ({result.schemas?.length || 0} 个)
        </Text>
        {result.schemas?.map((schema: EntitySchemaDTO, index: number) => (
          <View key={index} style={styles.schemaItem}>
            <View style={styles.schemaHeader}>
              <Icon source="file-document" size={18} color="#667eea" />
              <Text style={styles.schemaName}>{schema.entityName}</Text>
              <Text style={styles.schemaType}>{schema.entityType}</Text>
            </View>
            {schema.description && (
              <Text style={styles.schemaDescription}>{schema.description}</Text>
            )}
            <Text style={styles.schemaFieldCount}>
              {schema.fields?.length || 0} 个字段
            </Text>
          </View>
        ))}
      </View>

      {/* 建议的业务数据 */}
      {result.suggestedData && (
        <View style={styles.suggestedDataSection}>
          <Text style={styles.sectionTitle}>建议的业务数据</Text>

          {result.suggestedData.productTypes?.length > 0 && (
            <View style={styles.dataGroup}>
              <Text style={styles.dataGroupTitle}>产品类型</Text>
              <View style={styles.dataTagsContainer}>
                {result.suggestedData.productTypes.map((pt: Record<string, unknown>, i: number) => (
                  <View key={i} style={styles.dataTag}>
                    <Text style={styles.dataTagText}>
                      {(pt.name as string) || (pt.typeName as string) || `产品${i + 1}`}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {result.suggestedData.materialTypes?.length > 0 && (
            <View style={styles.dataGroup}>
              <Text style={styles.dataGroupTitle}>原料类型</Text>
              <View style={styles.dataTagsContainer}>
                {result.suggestedData.materialTypes.map((mt: Record<string, unknown>, i: number) => (
                  <View key={i} style={styles.dataTag}>
                    <Text style={styles.dataTagText}>
                      {(mt.name as string) || (mt.typeName as string) || `原料${i + 1}`}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {/* 确认按钮 */}
      <View style={styles.confirmButtons}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onCancel}
          disabled={confirming}
        >
          <Text style={styles.cancelButtonText}>重新生成</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.confirmButton, confirming && styles.buttonDisabled]}
          onPress={onConfirm}
          disabled={confirming}
        >
          {confirming ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Icon source="check" size={20} color="#fff" />
              <Text style={styles.confirmButtonText}>应用配置</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function FactorySetupScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: FactorySetupRouteParams }, 'params'>>();
  const { factoryId, factoryName } = route.params || {};

  // 模式状态
  const [mode, setMode] = useState<InitMode>('template');

  // 模板模式状态
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [packages, setPackages] = useState<IndustryTemplatePackage[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // AI 模式状态
  const [description, setDescription] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<AIFactoryInitResponse | null>(null);
  const [aiConfirming, setAiConfirming] = useState(false);

  // 加载模板数据
  const loadData = useCallback(async () => {
    try {
      const [pkgList, isInit] = await Promise.all([
        templatePackageApiClient.getTemplatePackages(),
        factoryId ? templatePackageApiClient.isFactoryInitialized(factoryId) : false,
      ]);

      setPackages(pkgList);
      setInitialized(isInit);

      // 默认选择推荐模板
      const defaultPkg = pkgList.find((p) => p.isDefault);
      if (defaultPkg && !selectedPackageId) {
        setSelectedPackageId(defaultPkg.id);
      }
    } catch (error) {
      console.error('加载模板包失败:', error);
      Alert.alert('加载失败', '无法获取行业模板列表');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [factoryId, selectedPackageId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // 模板初始化
  const handleTemplateInitialize = async () => {
    if (!selectedPackageId || !factoryId) {
      Alert.alert('提示', '请选择一个行业模板');
      return;
    }

    const selectedPkg = packages.find((p) => p.id === selectedPackageId);
    if (!selectedPkg) return;

    if (initialized) {
      Alert.alert(
        '确认覆盖',
        '该工厂已有表单配置，继续将覆盖现有配置。是否继续？',
        [
          { text: '取消', style: 'cancel' },
          {
            text: '覆盖并初始化',
            style: 'destructive',
            onPress: () => doTemplateInitialize(true),
          },
        ]
      );
    } else {
      Alert.alert(
        '确认初始化',
        `将使用"${selectedPkg.industryName}"模板初始化工厂，包含 ${selectedPkg.schemaCount} 个表单模板。`,
        [
          { text: '取消', style: 'cancel' },
          { text: '确认', onPress: () => doTemplateInitialize(false) },
        ]
      );
    }
  };

  const doTemplateInitialize = async (overwrite: boolean) => {
    if (!selectedPackageId || !factoryId) return;

    setInitializing(true);
    try {
      const result = await templatePackageApiClient.initializeFactory(factoryId, {
        templatePackageId: selectedPackageId,
        overwriteExisting: overwrite,
      });

      Alert.alert(
        '初始化成功',
        `已创建 ${result.templatesCreated} 个表单模板`,
        [
          {
            text: '确定',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('初始化失败:', error);
      Alert.alert('初始化失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setInitializing(false);
    }
  };

  // AI 生成
  const handleAIGenerate = async () => {
    if (!description.trim()) {
      Alert.alert('提示', '请输入工厂描述');
      return;
    }

    if (description.length < 10) {
      Alert.alert('提示', '请提供更详细的工厂描述（至少10个字符）');
      return;
    }

    if (!factoryId) {
      Alert.alert('错误', '工厂ID不存在');
      return;
    }

    setAiGenerating(true);
    setAiResult(null);

    try {
      const request: AIFactoryInitRequest = {
        factoryDescription: description,
        factoryName: factoryName,
        includeBusinessData: true,
      };

      const response = await platformAPI.aiInitializeFactory(factoryId, request);

      if (response.success && response.data) {
        setAiResult(response.data);
      } else {
        Alert.alert('生成失败', response.message || 'AI 配置生成失败');
      }
    } catch (error) {
      console.error('AI 生成失败:', error);
      Alert.alert(
        'AI 生成失败',
        error instanceof Error ? error.message : '请稍后重试'
      );
    } finally {
      setAiGenerating(false);
    }
  };

  // AI 结果确认应用
  const handleAIConfirm = async () => {
    if (!aiResult || !factoryId) return;

    setAiConfirming(true);
    try {
      // TODO: 实际应用 AI 生成的配置到工厂
      // 这里需要调用后端保存配置的 API
      // 目前先模拟成功

      Alert.alert(
        '配置成功',
        `已应用 AI 生成的 ${aiResult.schemas?.length || 0} 个表单模板配置`,
        [
          {
            text: '确定',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('应用配置失败:', error);
      Alert.alert('应用失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setAiConfirming(false);
    }
  };

  // 重置 AI 结果
  const handleAIReset = () => {
    setAiResult(null);
  };

  // 使用示例描述
  const useExampleDescription = (example: string) => {
    setDescription(example);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#667eea']} />
          }
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>初始化工厂配置</Text>
            <Text style={styles.subtitle}>
              {factoryName || factoryId}
            </Text>
          </View>

          {/* 模式切换 */}
          <View style={styles.modeSwitch}>
            <TouchableOpacity
              style={[styles.modeTab, mode === 'template' && styles.modeTabActive]}
              onPress={() => setMode('template')}
            >
              <Icon
                source="file-document-multiple"
                size={20}
                color={mode === 'template' ? '#667eea' : '#666'}
              />
              <Text style={[styles.modeTabText, mode === 'template' && styles.modeTabTextActive]}>
                选择模板
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeTab, mode === 'ai' && styles.modeTabActive]}
              onPress={() => setMode('ai')}
            >
              <Icon
                source="robot"
                size={20}
                color={mode === 'ai' ? '#667eea' : '#666'}
              />
              <Text style={[styles.modeTabText, mode === 'ai' && styles.modeTabTextActive]}>
                AI 对话
              </Text>
            </TouchableOpacity>
          </View>

          {/* 已初始化提示 */}
          {initialized && (
            <View style={styles.warningCard}>
              <Icon source="alert-circle" size={20} color="#fa8c16" />
              <Text style={styles.warningText}>
                该工厂已有表单配置，重新初始化将覆盖现有配置
              </Text>
            </View>
          )}

          {/* 模板模式 */}
          {mode === 'template' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>选择行业模板</Text>
              <Text style={styles.sectionDescription}>
                选择适合您工厂的行业模板，快速配置标准化表单
              </Text>
              {packages.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Icon source="package-variant" size={48} color="#ccc" />
                  <Text style={styles.emptyText}>暂无可用的行业模板</Text>
                </View>
              ) : (
                packages.map((pkg) => (
                  <TemplatePackageCard
                    key={pkg.id}
                    pkg={pkg}
                    selected={selectedPackageId === pkg.id}
                    onSelect={() => setSelectedPackageId(pkg.id)}
                  />
                ))
              )}
            </View>
          )}

          {/* AI 模式 */}
          {mode === 'ai' && (
            <View style={styles.section}>
              {!aiResult ? (
                <>
                  <Text style={styles.sectionTitle}>AI 智能配置</Text>
                  <Text style={styles.sectionDescription}>
                    用自然语言描述您的工厂，AI 将自动生成完整的表单配置
                  </Text>

                  {/* 输入区域 */}
                  <View style={styles.aiInputCard}>
                    <Text style={styles.inputLabel}>工厂描述</Text>
                    <TextInput
                      style={styles.descriptionInput}
                      placeholder="描述您的工厂：生产什么产品？需要哪些流程？有什么特殊要求？"
                      placeholderTextColor="#999"
                      multiline
                      numberOfLines={5}
                      textAlignVertical="top"
                      value={description}
                      onChangeText={setDescription}
                      editable={!aiGenerating}
                    />
                    <Text style={styles.charCount}>{description.length} / 2000</Text>
                  </View>

                  {/* 示例提示 */}
                  <View style={styles.examplesCard}>
                    <Text style={styles.examplesTitle}>示例描述：</Text>
                    {EXAMPLE_DESCRIPTIONS.map((example, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.exampleItem}
                        onPress={() => useExampleDescription(example)}
                      >
                        <Icon source="lightbulb-outline" size={16} color="#667eea" />
                        <Text style={styles.exampleText} numberOfLines={2}>
                          {example}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* 生成按钮 */}
                  <TouchableOpacity
                    style={[
                      styles.generateButton,
                      (!description.trim() || aiGenerating) && styles.buttonDisabled,
                    ]}
                    onPress={handleAIGenerate}
                    disabled={!description.trim() || aiGenerating}
                  >
                    {aiGenerating ? (
                      <>
                        <ActivityIndicator size="small" color="#fff" />
                        <Text style={styles.generateButtonText}>AI 生成中...</Text>
                      </>
                    ) : (
                      <>
                        <Icon source="robot" size={20} color="#fff" />
                        <Text style={styles.generateButtonText}>生成配置</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                /* AI 结果预览 */
                <AIResultPreview
                  result={aiResult}
                  onConfirm={handleAIConfirm}
                  onCancel={handleAIReset}
                  confirming={aiConfirming}
                />
              )}
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* 底部按钮 - 仅模板模式显示 */}
        {mode === 'template' && (
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[
                styles.initButton,
                (!selectedPackageId || initializing) && styles.buttonDisabled,
              ]}
              onPress={handleTemplateInitialize}
              disabled={!selectedPackageId || initializing}
            >
              {initializing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon source="check" size={20} color="#fff" />
                  <Text style={styles.initButtonText}>
                    {initialized ? '重新初始化' : '初始化工厂'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a202c',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 4,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  modeTabActive: {
    backgroundColor: '#667eea10',
  },
  modeTabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  modeTabTextActive: {
    color: '#667eea',
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7e6',
    margin: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffd591',
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#d46b08',
  },
  section: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a202c',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    marginTop: 12,
  },
  packageCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  packageCardSelected: {
    borderColor: '#667eea',
  },
  packageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  packageIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  packageInfo: {
    flex: 1,
    marginLeft: 12,
  },
  packageName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a202c',
  },
  packageCode: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  selectedBadge: {
    marginLeft: 8,
  },
  defaultBadge: {
    backgroundColor: '#667eea20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  defaultBadgeText: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '500',
  },
  packageDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  packageMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#666',
  },
  entityTypes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  entityTag: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  entityTagText: {
    fontSize: 11,
    color: '#666',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
  },
  initButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#667eea',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  initButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // AI 模式样式
  aiInputCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a202c',
    marginBottom: 8,
  },
  descriptionInput: {
    backgroundColor: '#f5f7fa',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1a202c',
    minHeight: 120,
    maxHeight: 200,
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  examplesCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  examplesTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a202c',
    marginBottom: 12,
  },
  exampleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  exampleText: {
    flex: 1,
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#667eea',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // AI 结果预览样式
  aiResultContainer: {
    marginBottom: 20,
  },
  industryResult: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  industryIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  industryInfo: {
    flex: 1,
    marginLeft: 16,
  },
  industryName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a202c',
  },
  industryCode: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  aiSummaryCard: {
    backgroundColor: '#667eea10',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  aiSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  aiSummaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
  },
  aiSummaryText: {
    fontSize: 13,
    color: '#4a5568',
    lineHeight: 20,
  },
  schemasSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  schemaItem: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
    paddingVertical: 12,
  },
  schemaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  schemaName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#1a202c',
  },
  schemaType: {
    fontSize: 11,
    color: '#999',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  schemaDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    marginLeft: 26,
  },
  schemaFieldCount: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    marginLeft: 26,
  },
  suggestedDataSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  dataGroup: {
    marginTop: 12,
  },
  dataGroupTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  dataTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dataTag: {
    backgroundColor: '#667eea10',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  dataTagText: {
    fontSize: 13,
    color: '#667eea',
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
    padding: 16,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#52c41a',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default FactorySetupScreen;
