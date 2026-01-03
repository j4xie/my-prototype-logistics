/**
 * AI 快速创建工厂屏幕
 *
 * 一键选择行业模板，AI 自动生成完整工厂配置
 * 包含产品类型、原材料类型、部门结构、表单模板、业务规则等
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-03
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput as RNTextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Text, Card, TextInput, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Icon } from 'react-native-paper';

// 行业类型定义
interface IndustryType {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
}

// 预计生成内容项
interface PreviewItem {
  id: string;
  title: string;
  description: string;
  iconColor: string;
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
  {
    id: 'fruit_vegetable',
    name: '果蔬加工',
    description: '水果蔬菜深加工',
    icon: 'fruit-cherries',
    color: '#4caf50',
    bgColor: 'rgba(76, 175, 80, 0.1)',
  },
  {
    id: 'custom',
    name: '自定义',
    description: '其他行业类型',
    icon: 'plus',
    color: '#8c8c8c',
    bgColor: 'rgba(140, 140, 140, 0.1)',
  },
];

// 预计生成内容
const PREVIEW_ITEMS: PreviewItem[] = [
  {
    id: 'product',
    title: '产品类型配置',
    description: '约 8-12 种产品类型',
    iconColor: '#52c41a',
  },
  {
    id: 'material',
    title: '原材料类型',
    description: '约 15-20 种原材料',
    iconColor: '#1890ff',
  },
  {
    id: 'department',
    title: '部门结构',
    description: '约 8-10 个部门',
    iconColor: '#faad14',
  },
  {
    id: 'form',
    title: '表单模板',
    description: '入库/加工/出货等表单',
    iconColor: '#722ed1',
  },
  {
    id: 'rule',
    title: '业务规则',
    description: '验证/工作流/质检规则',
    iconColor: '#ff4d4f',
  },
];

// 创建模式
type CreateMode = 'quick' | 'detailed';

export function FactoryAIQuickScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation('platform');

  // 状态
  const [factoryName, setFactoryName] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState<string>('seafood');
  const [createMode, setCreateMode] = useState<CreateMode>('quick');
  const [generating, setGenerating] = useState(false);

  // 处理行业选择
  const handleIndustrySelect = useCallback((industryId: string) => {
    setSelectedIndustry(industryId);
  }, []);

  // 切换到详细配置模式
  const handleSwitchToDetailed = useCallback(() => {
    // @ts-expect-error - Navigation type not fully defined
    navigation.navigate('FactoryAIWizard', {
      factoryName,
      selectedIndustry,
    });
  }, [navigation, factoryName, selectedIndustry]);

  // 处理 AI 生成
  const handleGenerate = useCallback(async () => {
    if (!factoryName.trim()) {
      Alert.alert(
        t('dialogs.validationFailed'),
        t('factoryAIQuick.pleaseEnterFactoryName', { defaultValue: '请输入工厂名称' })
      );
      return;
    }

    setGenerating(true);
    try {
      // TODO: 调用 API 生成工厂配置
      // 模拟 API 调用
      await new Promise((resolve) => setTimeout(resolve, 2000));

      Alert.alert(
        t('success.title'),
        t('factoryAIQuick.generateSuccess', { defaultValue: '工厂配置生成成功' }),
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
  }, [factoryName, selectedIndustry, navigation, t]);

  // 处理手动创建
  const handleManualCreate = useCallback(() => {
    // @ts-expect-error - Navigation type not fully defined
    navigation.navigate('FactoryCreate');
  }, [navigation]);

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

  // 渲染预览项
  const renderPreviewItem = useCallback(
    (item: PreviewItem, index: number, isLast: boolean) => (
      <View
        key={item.id}
        style={[styles.previewItem, !isLast && styles.previewItemBorder]}
      >
        <View style={[styles.previewIcon, { backgroundColor: item.iconColor + '15' }]}>
          <Icon source="check" size={18} color={item.iconColor} />
        </View>
        <View style={styles.previewContent}>
          <Text style={styles.previewTitle}>{item.title}</Text>
          <Text style={styles.previewDesc}>{item.description}</Text>
        </View>
      </View>
    ),
    []
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* AI 介绍卡片 */}
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.aiIntroCard}
        >
          <View style={styles.aiIntroHeader}>
            <View style={styles.aiIconContainer}>
              <Icon source="lightbulb-on" size={24} color="#fff" />
            </View>
            <View style={styles.aiIntroTitleContainer}>
              <Text style={styles.aiIntroTitle}>AI 智能创建</Text>
              <Text style={styles.aiIntroSubtitle}>一键生成工厂配置</Text>
            </View>
          </View>
          <Text style={styles.aiIntroDescription}>
            选择行业模板，AI将自动为您生成：产品类型、原材料配置、部门结构、表单模板、业务规则等完整配置。
          </Text>
        </LinearGradient>

        {/* 工厂名称输入 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>工厂名称</Text>
          <View style={styles.inputCard}>
            <RNTextInput
              style={styles.textInput}
              placeholder="请输入工厂名称，如：海鲜加工三厂"
              placeholderTextColor="#999"
              value={factoryName}
              onChangeText={setFactoryName}
            />
          </View>
        </View>

        {/* 行业模板选择 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>选择行业模板</Text>
          <View style={styles.industryGrid}>
            {INDUSTRY_TYPES.map(renderIndustryCard)}
          </View>
        </View>

        {/* 快速/详细模式切换 */}
        <View style={styles.modeSwitch}>
          <TouchableOpacity
            style={[styles.modeTab, createMode === 'quick' && styles.modeTabActive]}
            onPress={() => setCreateMode('quick')}
          >
            <Text
              style={[styles.modeTabText, createMode === 'quick' && styles.modeTabTextActive]}
            >
              一键创建
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeTab, createMode === 'detailed' && styles.modeTabActive]}
            onPress={handleSwitchToDetailed}
          >
            <Text
              style={[
                styles.modeTabText,
                createMode === 'detailed' && styles.modeTabTextActive,
              ]}
            >
              详细配置
            </Text>
          </TouchableOpacity>
        </View>

        {/* 预计生成内容 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>预计生成内容</Text>
          <View style={styles.previewCard}>
            {PREVIEW_ITEMS.map((item, index) =>
              renderPreviewItem(item, index, index === PREVIEW_ITEMS.length - 1)
            )}
          </View>
        </View>

        {/* 底部留白 */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 底部操作栏 */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleManualCreate}>
          <Text style={styles.secondaryButtonText}>手动创建</Text>
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
                <Text style={styles.primaryButtonText}>AI 生成配置</Text>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },

  // AI 介绍卡片
  aiIntroCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  aiIntroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  aiIconContainer: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiIntroTitleContainer: {
    marginLeft: 12,
  },
  aiIntroTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  aiIntroSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  aiIntroDescription: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 20,
  },

  // 通用部分
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#262626',
    marginBottom: 12,
  },

  // 输入卡片
  inputCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  textInput: {
    fontSize: 15,
    color: '#262626',
    padding: 14,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 8,
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

  // 模式切换
  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modeTabActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  modeTabText: {
    fontSize: 14,
    color: '#8c8c8c',
  },
  modeTabTextActive: {
    fontWeight: '500',
    color: '#262626',
  },

  // 预览卡片
  previewCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  previewItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  previewIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewContent: {
    flex: 1,
    marginLeft: 12,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#262626',
  },
  previewDesc: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 2,
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

export default FactoryAIQuickScreen;
