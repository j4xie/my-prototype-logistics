import React, { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  Text,
  Card,
  Chip,
  Button,
  Divider,
  ActivityIndicator,
  Appbar,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Types
interface ProductType {
  id: string;
  name: string;
}

interface MaterialType {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
  description: string;
  color: string;
  abbreviation: string;
}

interface FormTemplate {
  id: string;
  name: string;
  fieldCount: number;
}

interface BusinessRule {
  type: string;
  count: number;
  color: string;
}

interface AIGeneratedConfig {
  factoryName: string;
  industryType: string;
  blueprintTemplate: string;
  aiQuota: number;
  productTypes: ProductType[];
  materialTypes: MaterialType[];
  departments: Department[];
  formTemplates: FormTemplate[];
  businessRules: BusinessRule[];
}

type RouteParams = {
  FactoryAIPreview: {
    factoryId?: string;
    factoryName?: string;
    config?: AIGeneratedConfig;
  };
};

type NavigationProp = NativeStackNavigationProp<RouteParams, 'FactoryAIPreview'>;

/**
 * AI Configuration Preview Screen
 * Displays AI-generated factory configuration for review before creation
 */
export default function FactoryAIPreviewScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp<RouteParams, 'FactoryAIPreview'>>();
  const { t } = useTranslation('platform');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Mock data - in production this would come from route.params.config or API
  const [config] = useState<AIGeneratedConfig>({
    factoryName: route.params?.factoryName || '海鲜加工三厂',
    industryType: '水产加工',
    blueprintTemplate: '水产加工标准版 v2.0.1',
    aiQuota: 500,
    productTypes: [
      { id: '1', name: '冰鲜带鱼段' },
      { id: '2', name: '冰鲜黄鱼片' },
      { id: '3', name: '冷冻鱿鱼圈' },
      { id: '4', name: '即食鱼糜制品' },
      { id: '5', name: '调味鱼块' },
      { id: '6', name: '鱼肉丸' },
      { id: '7', name: '烤鱼片' },
      { id: '8', name: '鱼柳' },
      { id: '9', name: '鱼排' },
      { id: '10', name: '海鲜礼盒' },
    ],
    materialTypes: [
      { id: '1', name: '新鲜带鱼' },
      { id: '2', name: '新鲜黄鱼' },
      { id: '3', name: '新鲜鱿鱼' },
      { id: '4', name: '鱼糜原料' },
      { id: '5', name: '调味料' },
      { id: '6', name: '食用盐' },
      { id: '7', name: '淀粉' },
      { id: '8', name: '食用油' },
      { id: '9', name: '包装材料' },
      { id: '10', name: '保鲜剂' },
    ],
    departments: [
      { id: '1', name: '原料收购部', description: '负责原材料采购入库', color: '#1890ff', abbreviation: '原' },
      { id: '2', name: '加工生产部', description: '负责产品加工生产', color: '#52c41a', abbreviation: '加' },
      { id: '3', name: '质量检测部', description: '负责质量检验', color: '#722ed1', abbreviation: '质' },
      { id: '4', name: '仓储物流部', description: '负责仓储和出货', color: '#faad14', abbreviation: '仓' },
    ],
    formTemplates: [
      { id: '1', name: '原材料入库表单', fieldCount: 12 },
      { id: '2', name: '生产加工记录表', fieldCount: 15 },
      { id: '3', name: '质量检验表单', fieldCount: 18 },
      { id: '4', name: '成品出货单', fieldCount: 10 },
      { id: '5', name: '设备维护记录', fieldCount: 8 },
    ],
    businessRules: [
      { type: '验证规则', count: 4, color: '#1890ff' },
      { type: '工作流规则', count: 3, color: '#52c41a' },
      { type: '质检规则', count: 3, color: '#722ed1' },
      { type: '告警规则', count: 2, color: '#ff4d4f' },
    ],
  });

  const handleRegenerate = useCallback(async () => {
    Alert.alert(
      '重新生成配置',
      '确定要重新生成 AI 配置吗？当前配置将被覆盖。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          onPress: async () => {
            setIsRegenerating(true);
            try {
              // TODO: Call AI regeneration API
              await new Promise((resolve) => setTimeout(resolve, 2000));
              Alert.alert('提示', '配置已重新生成');
            } catch (error) {
              Alert.alert('错误', '重新生成失败，请重试');
            } finally {
              setIsRegenerating(false);
            }
          },
        },
      ]
    );
  }, []);

  const handleConfirmCreate = useCallback(async () => {
    setIsSubmitting(true);
    try {
      // TODO: Call factory creation API
      await new Promise((resolve) => setTimeout(resolve, 1500));
      Alert.alert('成功', '工厂创建成功！', [
        {
          text: '确定',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      Alert.alert('错误', '创建失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  }, [navigation]);

  const handleEditSection = useCallback((section: string) => {
    Alert.alert('编辑', `编辑${section}功能开发中...`);
  }, []);

  const renderSectionHeader = (
    title: string,
    count?: number,
    actionLabel?: string,
    onAction?: () => void
  ) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>
        {title}
        {count !== undefined && ` (${count})`}
      </Text>
      {actionLabel && onAction && (
        <TouchableOpacity onPress={onAction}>
          <Text style={styles.actionLink}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderInfoRow = (label: string, value: string, showBorder = true) => (
    <View style={[styles.infoRow, showBorder && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );

  const totalMaterialTypes = 15;
  const displayedMaterialCount = 10;
  const remainingMaterialCount = totalMaterialTypes - displayedMaterialCount;

  const totalDepartments = 8;
  const displayedDepartmentCount = 4;
  const remainingDepartmentCount = totalDepartments - displayedDepartmentCount;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Appbar.Header elevated style={styles.header}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="配置预览" />
      </Appbar.Header>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Success Banner */}
        <LinearGradient
          colors={['#52c41a', '#73d13d']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.successBanner}
        >
          <View style={styles.bannerContent}>
            <View style={styles.bannerIconContainer}>
              <MaterialCommunityIcons name="check-circle" size={24} color="white" />
            </View>
            <View style={styles.bannerTextContainer}>
              <Text style={styles.bannerTitle}>AI 配置生成完成</Text>
              <Text style={styles.bannerSubtitle}>基于{config.industryType}行业模板</Text>
            </View>
          </View>
          <Text style={styles.bannerDescription}>
            已为"{config.factoryName}"生成完整配置，您可以预览并修改后确认创建。
          </Text>
        </LinearGradient>

        {/* Basic Info Section */}
        {renderSectionHeader('基本信息')}
        <Card style={styles.card} mode="elevated">
          <Card.Content style={styles.cardContent}>
            {renderInfoRow('工厂名称', config.factoryName)}
            {renderInfoRow('行业类型', config.industryType)}
            {renderInfoRow('蓝图模板', config.blueprintTemplate)}
            {renderInfoRow('AI配额', `${config.aiQuota} 次/周`, false)}
          </Card.Content>
        </Card>

        {/* Product Types Section */}
        {renderSectionHeader(
          '产品类型',
          config.productTypes.length,
          '编辑',
          () => handleEditSection('产品类型')
        )}
        <Card style={styles.card} mode="elevated">
          <Card.Content style={styles.cardContent}>
            <View style={styles.tagsContainer}>
              {config.productTypes.map((product) => (
                <Chip
                  key={product.id}
                  style={styles.infoChip}
                  textStyle={styles.infoChipText}
                  mode="flat"
                >
                  {product.name}
                </Chip>
              ))}
            </View>
            <Divider style={styles.sectionDivider} />
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => handleEditSection('产品类型')}
            >
              <MaterialCommunityIcons name="plus" size={14} color="#667eea" />
              <Text style={styles.addButtonText}>添加产品类型</Text>
            </TouchableOpacity>
          </Card.Content>
        </Card>

        {/* Material Types Section */}
        {renderSectionHeader(
          '原材料类型',
          totalMaterialTypes,
          '编辑',
          () => handleEditSection('原材料类型')
        )}
        <Card style={styles.card} mode="elevated">
          <Card.Content style={styles.cardContent}>
            <View style={styles.tagsContainer}>
              {config.materialTypes.map((material) => (
                <Chip
                  key={material.id}
                  style={styles.defaultChip}
                  textStyle={styles.defaultChipText}
                  mode="flat"
                >
                  {material.name}
                </Chip>
              ))}
              {remainingMaterialCount > 0 && (
                <Chip style={styles.moreChip} textStyle={styles.moreChipText} mode="flat">
                  + {remainingMaterialCount} 更多
                </Chip>
              )}
            </View>
          </Card.Content>
        </Card>

        {/* Department Structure Section */}
        {renderSectionHeader(
          '部门结构',
          totalDepartments,
          '编辑',
          () => handleEditSection('部门结构')
        )}
        <Card style={styles.card} mode="elevated">
          <Card.Content style={styles.cardContent}>
            {config.departments.map((dept) => (
              <View key={dept.id} style={styles.departmentRow}>
                <View
                  style={[
                    styles.departmentIcon,
                    { backgroundColor: `${dept.color}15` },
                  ]}
                >
                  <Text style={[styles.departmentAbbr, { color: dept.color }]}>
                    {dept.abbreviation}
                  </Text>
                </View>
                <View style={styles.departmentInfo}>
                  <Text style={styles.departmentName}>{dept.name}</Text>
                  <Text style={styles.departmentDesc}>{dept.description}</Text>
                </View>
              </View>
            ))}
            {remainingDepartmentCount > 0 && (
              <Text style={styles.moreText}>
                + {remainingDepartmentCount} 个更多部门
              </Text>
            )}
          </Card.Content>
        </Card>

        {/* Form Templates Section */}
        {renderSectionHeader(
          '表单模板',
          config.formTemplates.length,
          '预览',
          () => handleEditSection('表单模板')
        )}
        <Card style={styles.card} mode="elevated">
          <Card.Content style={styles.cardContent}>
            {config.formTemplates.map((template) => (
              <View key={template.id} style={styles.templateRow}>
                <Text style={styles.templateName}>{template.name}</Text>
                <Chip
                  style={styles.fieldCountChip}
                  textStyle={styles.fieldCountChipText}
                  mode="flat"
                >
                  {template.fieldCount}字段
                </Chip>
              </View>
            ))}
          </Card.Content>
        </Card>

        {/* Business Rules Section */}
        {renderSectionHeader(
          '业务规则',
          config.businessRules.reduce((sum, rule) => sum + rule.count, 0),
          '查看',
          () => handleEditSection('业务规则')
        )}
        <Card style={styles.card} mode="elevated">
          <Card.Content style={styles.cardContent}>
            <View style={styles.tagsContainer}>
              {config.businessRules.map((rule, index) => (
                <Chip
                  key={index}
                  style={[styles.ruleChip, { backgroundColor: `${rule.color}15` }]}
                  textStyle={[styles.ruleChipText, { color: rule.color }]}
                  mode="flat"
                >
                  {rule.type} x{rule.count}
                </Chip>
              ))}
            </View>
          </Card.Content>
        </Card>

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <Button
          mode="outlined"
          onPress={handleRegenerate}
          style={styles.secondaryButton}
          labelStyle={styles.secondaryButtonLabel}
          disabled={isSubmitting || isRegenerating}
          loading={isRegenerating}
        >
          重新生成
        </Button>
        <Button
          mode="contained"
          onPress={handleConfirmCreate}
          style={styles.primaryButton}
          labelStyle={styles.primaryButtonLabel}
          disabled={isSubmitting || isRegenerating}
          loading={isSubmitting}
        >
          确认创建工厂
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  successBanner: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  bannerIconContainer: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  bannerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  bannerDescription: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 18,
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
    color: '#262626',
  },
  actionLink: {
    fontSize: 13,
    color: '#667eea',
  },
  card: {
    marginBottom: 16,
    borderRadius: 12,
  },
  cardContent: {
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#8c8c8c',
  },
  infoValue: {
    fontSize: 14,
    color: '#262626',
    fontWeight: '500',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  infoChip: {
    backgroundColor: 'rgba(24, 144, 255, 0.1)',
    marginBottom: 4,
  },
  infoChipText: {
    fontSize: 13,
    color: '#1890ff',
  },
  defaultChip: {
    backgroundColor: '#f0f0f0',
    marginBottom: 4,
  },
  defaultChipText: {
    fontSize: 13,
    color: '#595959',
  },
  moreChip: {
    backgroundColor: '#f5f5f5',
    marginBottom: 4,
  },
  moreChipText: {
    fontSize: 13,
    color: '#8c8c8c',
  },
  sectionDivider: {
    marginTop: 12,
    marginBottom: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addButtonText: {
    fontSize: 13,
    color: '#667eea',
  },
  departmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  departmentIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  departmentAbbr: {
    fontSize: 12,
    fontWeight: '500',
  },
  departmentInfo: {
    flex: 1,
  },
  departmentName: {
    fontSize: 14,
    color: '#262626',
  },
  departmentDesc: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 2,
  },
  moreText: {
    textAlign: 'center',
    fontSize: 13,
    color: '#8c8c8c',
    marginTop: 4,
  },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 10,
  },
  templateName: {
    fontSize: 14,
    color: '#262626',
  },
  fieldCountChip: {
    backgroundColor: 'rgba(82, 196, 26, 0.1)',
    height: 24,
  },
  fieldCountChipText: {
    fontSize: 11,
    color: '#52c41a',
  },
  ruleChip: {
    marginBottom: 4,
  },
  ruleChipText: {
    fontSize: 13,
  },
  bottomSpacing: {
    height: 20,
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    borderColor: '#d9d9d9',
    borderRadius: 8,
  },
  secondaryButtonLabel: {
    color: '#595959',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#667eea',
    borderRadius: 8,
  },
  primaryButtonLabel: {
    color: '#fff',
  },
});
