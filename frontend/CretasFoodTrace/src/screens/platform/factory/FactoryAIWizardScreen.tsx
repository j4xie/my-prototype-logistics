/**
 * AI 详细配置向导屏幕
 *
 * 4步骤向导：基本信息 -> 行业配置 -> AI生成 -> 确认
 * 提供更多高级选项，精细控制 AI 生成的内容
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-03
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput as RNTextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Text, Checkbox } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Icon } from 'react-native-paper';

// AI 配额预设值
const AI_QUOTA_PRESETS = [100, 300, 500, 1000, 2000];

// 路由参数类型
type RouteParams = {
  factoryName?: string;
  selectedIndustry?: string;
};

// 步骤状态类型
type StepStatus = 'completed' | 'active' | 'pending';

// 步骤定义
interface WizardStep {
  id: number;
  label: string;
  status: StepStatus;
}

// 行业类型定义
interface IndustryType {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
}

// 生成选项
interface GenerateOption {
  id: string;
  title: string;
  description: string;
  checked: boolean;
}

// 蓝图模板
interface BlueprintTemplate {
  id: string;
  name: string;
}

// 行业模板数据
const INDUSTRY_TYPES: IndustryType[] = [
  {
    id: 'seafood',
    name: '水产加工',
    description: '海鲜类水产品加工',
    icon: 'fish',
    color: '#1890ff',
    bgColor: 'rgba(24, 144, 255, 0.1)',
  },
  {
    id: 'frozen',
    name: '速冻食品',
    description: '冷冻食品生产加工',
    icon: 'snowflake',
    color: '#03a9f4',
    bgColor: 'rgba(3, 169, 244, 0.1)',
  },
  {
    id: 'meat',
    name: '肉类加工',
    description: '肉类屠宰分割加工',
    icon: 'food-steak',
    color: '#e91e63',
    bgColor: 'rgba(233, 30, 99, 0.1)',
  },
  {
    id: 'dairy',
    name: '乳制品',
    description: '乳制品加工生产',
    icon: 'cow',
    color: '#ff9800',
    bgColor: 'rgba(255, 152, 0, 0.1)',
  },
];

// 蓝图模板列表
const BLUEPRINT_TEMPLATES: BlueprintTemplate[] = [
  { id: 'auto', name: '自动选择（推荐）' },
  { id: 'seafood-std', name: '水产加工标准版 v2.0.1' },
  { id: 'frozen-std', name: '速冻食品标准版 v2.1.0' },
];

// 初始生成选项
const INITIAL_OPTIONS: GenerateOption[] = [
  {
    id: 'productType',
    title: '生成产品类型',
    description: '根据行业自动生成产品类型',
    checked: true,
  },
  {
    id: 'materialType',
    title: '生成原材料类型',
    description: '根据产品自动推断原材料',
    checked: true,
  },
  {
    id: 'department',
    title: '生成部门结构',
    description: '根据行业规模生成部门',
    checked: true,
  },
  {
    id: 'formTemplate',
    title: '生成表单模板',
    description: '入库/加工/出货等表单',
    checked: true,
  },
  {
    id: 'businessRule',
    title: '生成业务规则',
    description: '验证规则、工作流、质检规则',
    checked: true,
  },
];

export function FactoryAIWizardScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const { t } = useTranslation('platform');

  // 从路由获取初始值
  const initialFactoryName = route.params?.factoryName || '';
  const initialIndustry = route.params?.selectedIndustry || 'seafood';

  // 状态
  const [currentStep, setCurrentStep] = useState(2); // 从步骤2开始（行业配置）
  const [selectedIndustry, setSelectedIndustry] = useState<string>(initialIndustry);
  const [businessDescription, setBusinessDescription] = useState(
    '主要加工带鱼、黄鱼等海产品，需要严格的冷链管理，产品需要符合出口标准。'
  );
  const [advancedExpanded, setAdvancedExpanded] = useState(true);
  const [selectedBlueprint, setSelectedBlueprint] = useState<string>('auto');
  const [generateOptions, setGenerateOptions] = useState<GenerateOption[]>(INITIAL_OPTIONS);
  const [aiQuota, setAiQuota] = useState(500);
  const [generating, setGenerating] = useState(false);
  const [showBlueprintPicker, setShowBlueprintPicker] = useState(false);

  // 计算步骤状态
  const steps: WizardStep[] = useMemo(
    () => [
      {
        id: 1,
        label: '基本信息',
        status: currentStep > 1 ? 'completed' : currentStep === 1 ? 'active' : 'pending',
      },
      {
        id: 2,
        label: '行业配置',
        status: currentStep > 2 ? 'completed' : currentStep === 2 ? 'active' : 'pending',
      },
      {
        id: 3,
        label: 'AI生成',
        status: currentStep > 3 ? 'completed' : currentStep === 3 ? 'active' : 'pending',
      },
      {
        id: 4,
        label: '确认',
        status: currentStep > 4 ? 'completed' : currentStep === 4 ? 'active' : 'pending',
      },
    ],
    [currentStep]
  );

  // 处理行业选择
  const handleIndustrySelect = useCallback((industryId: string) => {
    setSelectedIndustry(industryId);
  }, []);

  // 处理生成选项切换
  const handleOptionToggle = useCallback((optionId: string) => {
    setGenerateOptions((prev) =>
      prev.map((option) =>
        option.id === optionId ? { ...option, checked: !option.checked } : option
      )
    );
  }, []);

  // 处理上一步
  const handlePrevious = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      navigation.goBack();
    }
  }, [currentStep, navigation]);

  // 处理开始生成
  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      // TODO: 调用 API 生成工厂配置
      // 模拟 API 调用
      await new Promise((resolve) => setTimeout(resolve, 3000));

      Alert.alert(
        t('success.title'),
        t('factoryAIWizard.generateSuccess', { defaultValue: '工厂配置生成成功' }),
        [
          {
            text: t('aiQuota.confirmAction'),
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('生成失败:', error);
      Alert.alert(
        t('errors.createFailed'),
        error instanceof Error ? error.message : t('errors.loadFailed')
      );
    } finally {
      setGenerating(false);
    }
  }, [selectedIndustry, businessDescription, generateOptions, aiQuota, navigation, t]);

  // 获取选中的蓝图名称
  const selectedBlueprintName = useMemo(() => {
    const blueprint = BLUEPRINT_TEMPLATES.find((b) => b.id === selectedBlueprint);
    return blueprint?.name || '自动选择（推荐）';
  }, [selectedBlueprint]);

  // 渲染步骤指示器
  const renderStepIndicator = useCallback(() => {
    return (
      <View style={styles.stepsContainer}>
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            {/* 步骤点 */}
            <View style={styles.stepItem}>
              <View
                style={[
                  styles.stepDot,
                  step.status === 'completed' && styles.stepDotCompleted,
                  step.status === 'active' && styles.stepDotActive,
                ]}
              >
                {step.status === 'completed' ? (
                  <Icon source="check" size={12} color="#fff" />
                ) : (
                  <Text
                    style={[
                      styles.stepDotText,
                      step.status === 'active' && styles.stepDotTextActive,
                    ]}
                  >
                    {step.id}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  step.status === 'active' && styles.stepLabelActive,
                  step.status === 'completed' && styles.stepLabelCompleted,
                ]}
              >
                {step.label}
              </Text>
            </View>
            {/* 连接线 */}
            {index < steps.length - 1 && (
              <View
                style={[
                  styles.stepLine,
                  step.status === 'completed' && styles.stepLineCompleted,
                ]}
              />
            )}
          </React.Fragment>
        ))}
      </View>
    );
  }, [steps]);

  // 渲染行业卡片
  const renderIndustryCard = useCallback(
    (industry: IndustryType) => {
      const isSelected = selectedIndustry === industry.id;
      return (
        <TouchableOpacity
          key={industry.id}
          style={[styles.industryCard, isSelected && styles.industryCardSelected]}
          onPress={() => handleIndustrySelect(industry.id)}
          activeOpacity={0.7}
        >
          <View style={[styles.industryIcon, { backgroundColor: industry.bgColor }]}>
            <Icon source={industry.icon} size={28} color={industry.color} />
          </View>
          <Text style={styles.industryName}>{industry.name}</Text>
          <Text style={styles.industryDesc}>{industry.description}</Text>
          {isSelected && (
            <View style={styles.checkBadge}>
              <Icon source="check" size={14} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      );
    },
    [selectedIndustry, handleIndustrySelect]
  );

  // 渲染生成选项
  const renderGenerateOption = useCallback(
    (option: GenerateOption) => (
      <TouchableOpacity
        key={option.id}
        style={styles.optionItem}
        onPress={() => handleOptionToggle(option.id)}
        activeOpacity={0.7}
      >
        <Checkbox
          status={option.checked ? 'checked' : 'unchecked'}
          onPress={() => handleOptionToggle(option.id)}
          color="#667eea"
        />
        <View style={styles.optionContent}>
          <Text style={styles.optionTitle}>{option.title}</Text>
          <Text style={styles.optionDesc}>{option.description}</Text>
        </View>
      </TouchableOpacity>
    ),
    [handleOptionToggle]
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* 步骤指示器 */}
      {renderStepIndicator()}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 行业类型选择 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>行业类型选择</Text>
          <View style={styles.industryGrid}>
            {INDUSTRY_TYPES.map(renderIndustryCard)}
          </View>
        </View>

        {/* 业务描述 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>业务描述</Text>
            <Text style={styles.sectionHint}>可选，帮助AI更精准配置</Text>
          </View>
          <View style={styles.descriptionCard}>
            <RNTextInput
              style={styles.descriptionInput}
              placeholder={`请描述您的工厂业务特点，例如：
- 主要加工哪些产品？
- 有哪些特殊的质检要求？
- 有哪些特殊的存储要求？
- 需要追溯哪些关键信息？`}
              placeholderTextColor="#999"
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              value={businessDescription}
              onChangeText={setBusinessDescription}
            />
            <View style={styles.charCountContainer}>
              <Text style={styles.charCount}>{businessDescription.length} / 500 字</Text>
            </View>
          </View>
        </View>

        {/* 高级选项 */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => setAdvancedExpanded(!advancedExpanded)}
            activeOpacity={0.7}
          >
            <Text style={styles.sectionTitle}>高级选项</Text>
            <Icon
              source={advancedExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#8c8c8c"
            />
          </TouchableOpacity>

          {advancedExpanded && (
            <View style={styles.advancedCard}>
              {/* 蓝图模板选择 */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>基础蓝图模板</Text>
                <TouchableOpacity
                  style={styles.selectField}
                  onPress={() => setShowBlueprintPicker(!showBlueprintPicker)}
                >
                  <Text style={styles.selectValue}>{selectedBlueprintName}</Text>
                  <Icon source="chevron-down" size={20} color="#8c8c8c" />
                </TouchableOpacity>
                {showBlueprintPicker && (
                  <View style={styles.pickerDropdown}>
                    {BLUEPRINT_TEMPLATES.map((template) => (
                      <TouchableOpacity
                        key={template.id}
                        style={[
                          styles.pickerItem,
                          selectedBlueprint === template.id && styles.pickerItemSelected,
                        ]}
                        onPress={() => {
                          setSelectedBlueprint(template.id);
                          setShowBlueprintPicker(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.pickerItemText,
                            selectedBlueprint === template.id && styles.pickerItemTextSelected,
                          ]}
                        >
                          {template.name}
                        </Text>
                        {selectedBlueprint === template.id && (
                          <Icon source="check" size={18} color="#667eea" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* 生成选项 */}
              <View style={styles.optionsGroup}>
                {generateOptions.map(renderGenerateOption)}
              </View>
            </View>
          )}
        </View>

        {/* AI 配额预设 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI配额预设</Text>
          <View style={styles.quotaCard}>
            <View style={styles.quotaPresetsRow}>
              {AI_QUOTA_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset}
                  style={[
                    styles.quotaPresetButton,
                    aiQuota === preset && styles.quotaPresetButtonActive,
                  ]}
                  onPress={() => setAiQuota(preset)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.quotaPresetText,
                      aiQuota === preset && styles.quotaPresetTextActive,
                    ]}
                  >
                    {preset}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.quotaSelectedValue}>{aiQuota}次/周</Text>
            <Text style={styles.quotaHint}>可在创建后随时调整配额设置</Text>
          </View>
        </View>

        {/* 底部留白 */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 底部操作栏 */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.secondaryButton} onPress={handlePrevious}>
          <Text style={styles.secondaryButtonText}>上一步</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, generating && styles.buttonDisabled]}
          onPress={handleGenerate}
          disabled={generating}
        >
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.primaryButtonGradient}
          >
            {generating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon source="lightbulb-on" size={16} color="#fff" />
                <Text style={styles.primaryButtonText}>开始生成</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },

  // 步骤指示器
  stepsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  stepItem: {
    alignItems: 'center',
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  stepDotActive: {
    backgroundColor: '#667eea',
  },
  stepDotCompleted: {
    backgroundColor: '#52c41a',
  },
  stepDotText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8c8c8c',
  },
  stepDotTextActive: {
    color: '#fff',
  },
  stepLabel: {
    fontSize: 11,
    color: '#8c8c8c',
  },
  stepLabelActive: {
    color: '#667eea',
    fontWeight: '500',
  },
  stepLabelCompleted: {
    color: '#52c41a',
  },
  stepLine: {
    width: 32,
    height: 2,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 8,
    marginBottom: 20,
  },
  stepLineCompleted: {
    backgroundColor: '#52c41a',
  },

  // 滚动区域
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },

  // 通用部分
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#262626',
  },
  sectionHint: {
    fontSize: 12,
    color: '#8c8c8c',
    marginLeft: 8,
  },

  // 行业网格
  industryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  industryCard: {
    width: '48%',
    marginHorizontal: '1%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  industryCardSelected: {
    borderColor: '#667eea',
  },
  industryIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  industryName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#262626',
    marginBottom: 4,
  },
  industryDesc: {
    fontSize: 12,
    color: '#8c8c8c',
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 业务描述
  descriptionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  descriptionInput: {
    fontSize: 14,
    color: '#262626',
    lineHeight: 22,
    padding: 12,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 8,
    minHeight: 120,
  },
  charCountContainer: {
    alignItems: 'flex-end',
    marginTop: 8,
  },
  charCount: {
    fontSize: 12,
    color: '#8c8c8c',
  },

  // 高级选项
  advancedCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    color: '#262626',
    marginBottom: 8,
  },
  selectField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 8,
  },
  selectValue: {
    fontSize: 14,
    color: '#262626',
  },
  pickerDropdown: {
    marginTop: 8,
    backgroundColor: '#fafafa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  pickerItemSelected: {
    backgroundColor: '#667eea10',
  },
  pickerItemText: {
    fontSize: 14,
    color: '#262626',
  },
  pickerItemTextSelected: {
    color: '#667eea',
    fontWeight: '500',
  },
  optionsGroup: {
    gap: 4,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  optionContent: {
    flex: 1,
    marginLeft: 4,
  },
  optionTitle: {
    fontSize: 14,
    color: '#262626',
  },
  optionDesc: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 2,
  },

  // 配额设置
  quotaCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  quotaPresetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  quotaPresetButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  quotaPresetButtonActive: {
    backgroundColor: '#667eea15',
    borderColor: '#667eea',
  },
  quotaPresetText: {
    fontSize: 14,
    color: '#595959',
  },
  quotaPresetTextActive: {
    color: '#667eea',
    fontWeight: '600',
  },
  quotaSelectedValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#262626',
    textAlign: 'center',
    marginBottom: 8,
  },
  quotaHint: {
    fontSize: 12,
    color: '#8c8c8c',
  },

  // 底部操作栏
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    paddingBottom: 32,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#595959',
  },
  primaryButton: {
    flex: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  primaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default FactoryAIWizardScreen;
