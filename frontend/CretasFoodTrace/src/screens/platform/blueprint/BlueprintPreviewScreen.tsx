/**
 * Blueprint Preview Screen
 *
 * Previews generated components from blueprint.
 * Platform admin can view product types, materials, departments, forms, and rules.
 *
 * @author Cretas Team
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Pressable,
} from 'react-native';
import {
  Appbar,
  Text,
  Card,
  Chip,
  ActivityIndicator,
  Divider,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

// Types
type PreviewTab = 'products' | 'materials' | 'departments' | 'forms' | 'rules';

interface ProductType {
  id: string;
  name: string;
  category: string;
  code: string;
  color: string;
  isDefault: boolean;
}

interface ConversionRate {
  id: string;
  from: string;
  to: string;
  rate: number;
}

interface RulePreview {
  type: string;
  count: number;
  color: string;
}

// TODO: 需要 API - 蓝图预览接口 (获取蓝图中定义的产品类型)
// 默认产品类型数据 - 蓝图预览展示
const defaultProducts: ProductType[] = [
  { id: '1', name: 'Fresh Hairtail Sections', category: 'Fresh', code: 'PT001', color: '#52c41a', isDefault: true },
  { id: '2', name: 'Fresh Yellow Croaker Fillets', category: 'Fresh', code: 'PT002', color: '#52c41a', isDefault: true },
  { id: '3', name: 'Frozen Squid Rings', category: 'Frozen', code: 'PT003', color: '#1890ff', isDefault: true },
  { id: '4', name: 'Ready-to-Eat Fish Paste', category: 'Ready-to-Eat', code: 'PT004', color: '#faad14', isDefault: true },
  { id: '5', name: 'Seasoned Fish Blocks', category: 'Seasoned', code: 'PT005', color: '#faad14', isDefault: true },
  { id: '6', name: 'Fish Meatballs', category: 'Meatball', code: 'PT006', color: '#722ed1', isDefault: true },
  { id: '7', name: 'Grilled Fish Fillets', category: 'Grilled', code: 'PT007', color: '#ff4d4f', isDefault: true },
  { id: '8', name: 'Fish Fillet', category: 'Sliced', code: 'PT008', color: '#52c41a', isDefault: true },
];

// TODO: 需要 API - 蓝图预览接口 (获取蓝图中定义的转换率)
const defaultConversionRates: ConversionRate[] = [
  { id: '1', from: 'Fresh Hairtail', to: 'Fresh Hairtail Sections', rate: 65 },
  { id: '2', from: 'Fresh Yellow Croaker', to: 'Fresh Yellow Croaker Fillets', rate: 60 },
  { id: '3', from: 'Fresh Squid', to: 'Frozen Squid Rings', rate: 55 },
  { id: '4', from: 'Fish Paste Raw Material', to: 'Ready-to-Eat Fish Paste', rate: 85 },
];

// TODO: 需要 API - 蓝图预览接口 (获取蓝图中定义的规则)
const defaultRulePreviews: RulePreview[] = [
  { type: 'Validation Rules', count: 4, color: '#1890ff' },
  { type: 'Quality Check Rules', count: 3, color: '#722ed1' },
  { type: 'Alert Rules', count: 2, color: '#ff4d4f' },
];

const ruleCodeExample = `rule "Temperature Check Rule"
when
  $batch : MaterialBatch(
    temperature > 4 ||
    temperature < -18
  )
then
  $batch.setStatus("REJECTED");
  alert("Temperature Anomaly");
end`;

type RootStackParamList = {
  BlueprintPreview: { blueprintId: string; blueprintName: string };
};

export function BlueprintPreviewScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'BlueprintPreview'>>();
  const { t } = useTranslation('platform');

  const blueprintId = route.params?.blueprintId || 'BP001';
  const blueprintName = route.params?.blueprintName || 'Seafood Processing Standard';
  const currentVersion = 'v2.0.1';

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<PreviewTab>('products');
  const [products, setProducts] = useState<ProductType[]>([]);
  const [conversionRates, setConversionRates] = useState<ConversionRate[]>([]);
  const [showAllProducts, setShowAllProducts] = useState(false);

  const tabs: { key: PreviewTab; label: string }[] = [
    { key: 'products', label: t('blueprint.productTypes') },
    { key: 'materials', label: t('blueprint.rawMaterials') },
    { key: 'departments', label: t('blueprint.departments') },
    { key: 'forms', label: t('blueprint.forms') },
    { key: 'rules', label: t('blueprint.rules') },
  ];

  const loadData = useCallback(async () => {
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 800));
      setProducts(defaultProducts);
      setConversionRates(defaultConversionRates);
    } catch (error) {
      Alert.alert(t('errors.loadFailed'), t('blueprint.loadPreviewFailed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const visibleProducts = showAllProducts ? products : products.slice(0, 8);
  const hiddenProductCount = products.length - 8;

  const getProductIcon = (category: string): string => {
    switch (category) {
      case 'Fresh':
        return 'Fish';
      case 'Frozen':
        return 'Frz';
      case 'Ready-to-Eat':
        return 'RTE';
      case 'Seasoned':
        return 'Ssn';
      case 'Meatball':
        return 'Ball';
      case 'Grilled':
        return 'Grl';
      case 'Sliced':
        return 'Slc';
      default:
        return category.charAt(0);
    }
  };

  const renderProductsTab = () => (
    <>
      {/* Product Types List */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {t('blueprint.productTypes')} ({products.length})
          </Text>
          <Text style={styles.sectionHint}>
            {t('blueprint.customizableAfterApply')}
          </Text>
        </View>

        <Card style={styles.contentCard}>
          <Card.Content>
            {visibleProducts.map((product, index) => (
              <View key={product.id}>
                {index > 0 && <Divider style={styles.itemDivider} />}
                <View style={styles.productItem}>
                  <View
                    style={[
                      styles.productIcon,
                      { backgroundColor: `${product.color}15` },
                    ]}
                  >
                    <Text style={[styles.productIconText, { color: product.color }]}>
                      {getProductIcon(product.category)}
                    </Text>
                  </View>
                  <View style={styles.productDetails}>
                    <Text style={styles.productName}>{product.name}</Text>
                    <Text style={styles.productMeta}>
                      {t('blueprint.productId')}: {product.code} - {product.category}
                    </Text>
                  </View>
                  {product.isDefault && (
                    <Chip
                      mode="flat"
                      compact
                      textStyle={{ color: '#1890ff', fontSize: 10 }}
                      style={styles.defaultChip}
                    >
                      {t('blueprint.default')}
                    </Chip>
                  )}
                </View>
              </View>
            ))}

            {hiddenProductCount > 0 && !showAllProducts && (
              <Pressable
                style={styles.showMoreButton}
                onPress={() => setShowAllProducts(true)}
              >
                <Text style={styles.showMoreText}>
                  {t('blueprint.viewMore', { count: hiddenProductCount })}
                </Text>
              </Pressable>
            )}
          </Card.Content>
        </Card>
      </View>

      {/* Default Conversion Rates */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('blueprint.defaultConversionRates')}</Text>
        </View>

        <Card style={styles.contentCard}>
          <Card.Content>
            <Text style={styles.conversionHint}>
              {t('blueprint.conversionHint')}
            </Text>

            <View style={styles.conversionList}>
              {conversionRates.map((rate) => (
                <View key={rate.id} style={styles.conversionItem}>
                  <Text style={styles.conversionText}>
                    {rate.from} -&gt; {rate.to}
                  </Text>
                  <Text style={styles.conversionRate}>{rate.rate}%</Text>
                </View>
              ))}
            </View>
          </Card.Content>
        </Card>
      </View>

      {/* Quality Check Rules Preview */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('blueprint.qualityRulesExample')}</Text>
        </View>

        <Card style={styles.contentCard}>
          <Card.Content>
            <Text style={styles.rulesHint}>
              {t('blueprint.droolsRulesHint')}
            </Text>

            {/* Code Preview */}
            <View style={styles.codeBlock}>
              <Text style={styles.codeText}>{ruleCodeExample}</Text>
            </View>

            <View style={styles.ruleTagsContainer}>
              {defaultRulePreviews.map((rule) => (
                <View
                  key={rule.type}
                  style={[styles.ruleTag, { backgroundColor: `${rule.color}15` }]}
                >
                  <Text style={[styles.ruleTagText, { color: rule.color }]}>
                    {rule.type} x{rule.count}
                  </Text>
                </View>
              ))}
            </View>
          </Card.Content>
        </Card>
      </View>
    </>
  );

  const renderMaterialsTab = () => (
    <View style={styles.section}>
      <Card style={styles.contentCard}>
        <Card.Content style={styles.placeholderContent}>
          <Text style={styles.placeholderIcon}>Raw</Text>
          <Text style={styles.placeholderTitle}>{t('blueprint.rawMaterials')}</Text>
          <Text style={styles.placeholderText}>
            {t('blueprint.rawMaterialsDesc')}
          </Text>
        </Card.Content>
      </Card>
    </View>
  );

  const renderDepartmentsTab = () => (
    <View style={styles.section}>
      <Card style={styles.contentCard}>
        <Card.Content style={styles.placeholderContent}>
          <Text style={styles.placeholderIcon}>Dept</Text>
          <Text style={styles.placeholderTitle}>{t('blueprint.departments')}</Text>
          <Text style={styles.placeholderText}>
            {t('blueprint.departmentsDesc')}
          </Text>
        </Card.Content>
      </Card>
    </View>
  );

  const renderFormsTab = () => (
    <View style={styles.section}>
      <Card style={styles.contentCard}>
        <Card.Content style={styles.placeholderContent}>
          <Text style={styles.placeholderIcon}>Form</Text>
          <Text style={styles.placeholderTitle}>{t('blueprint.forms')}</Text>
          <Text style={styles.placeholderText}>
            {t('blueprint.formsDesc')}
          </Text>
        </Card.Content>
      </Card>
    </View>
  );

  const renderRulesTab = () => (
    <View style={styles.section}>
      <Card style={styles.contentCard}>
        <Card.Content style={styles.placeholderContent}>
          <Text style={styles.placeholderIcon}>Rules</Text>
          <Text style={styles.placeholderTitle}>{t('blueprint.rules')}</Text>
          <Text style={styles.placeholderText}>
            {t('blueprint.rulesDesc')}
          </Text>
        </Card.Content>
      </Card>
    </View>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'products':
        return renderProductsTab();
      case 'materials':
        return renderMaterialsTab();
      case 'departments':
        return renderDepartmentsTab();
      case 'forms':
        return renderFormsTab();
      case 'rules':
        return renderRulesTab();
      default:
        return renderProductsTab();
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={t('blueprint.preview')} />
      </Appbar.Header>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarContent}
        >
          {tabs.map((tab) => (
            <Pressable
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.key && styles.tabTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Blueprint Info Header */}
        <LinearGradient
          colors={['#1890ff', '#096dd9']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.blueprintInfo}>
            <View style={styles.blueprintIcon}>
              <Text style={styles.blueprintIconText}>
                {blueprintName.charAt(0)}
              </Text>
            </View>
            <View>
              <Text style={styles.blueprintName}>{blueprintName}</Text>
              <Text style={styles.blueprintMeta}>
                {t('blueprint.version')} {currentVersion} - {t('blueprint.previewMode')}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {renderTabContent()}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    color: '#8c8c8c',
  },
  tabBar: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tabBarContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  tabActive: {
    backgroundColor: '#667eea',
  },
  tabText: {
    fontSize: 14,
    color: '#595959',
  },
  tabTextActive: {
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  headerGradient: {
    borderRadius: 16,
    padding: 16,
    margin: 16,
    marginBottom: 0,
  },
  blueprintInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  blueprintIcon: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blueprintIconText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  blueprintName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  blueprintMeta: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  section: {
    padding: 16,
    paddingTop: 20,
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
  sectionHint: {
    fontSize: 13,
    color: '#8c8c8c',
  },
  contentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  itemDivider: {
    marginVertical: 12,
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  productIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productIconText: {
    fontSize: 14,
    fontWeight: '600',
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#262626',
  },
  productMeta: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 2,
  },
  defaultChip: {
    backgroundColor: 'rgba(24, 144, 255, 0.1)',
    height: 22,
  },
  showMoreButton: {
    alignItems: 'center',
    paddingTop: 12,
  },
  showMoreText: {
    fontSize: 13,
    color: '#667eea',
  },
  conversionHint: {
    fontSize: 13,
    color: '#8c8c8c',
    marginBottom: 12,
  },
  conversionList: {
    gap: 10,
  },
  conversionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  conversionText: {
    fontSize: 14,
    color: '#262626',
  },
  conversionRate: {
    fontSize: 14,
    fontWeight: '500',
    color: '#667eea',
  },
  rulesHint: {
    fontSize: 13,
    color: '#8c8c8c',
    marginBottom: 12,
  },
  codeBlock: {
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    padding: 12,
  },
  codeText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#d4d4d4',
    lineHeight: 18,
  },
  ruleTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  ruleTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
  },
  ruleTagText: {
    fontSize: 12,
    fontWeight: '500',
  },
  placeholderContent: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  placeholderIcon: {
    fontSize: 24,
    fontWeight: '600',
    color: '#d9d9d9',
    marginBottom: 12,
  },
  placeholderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8c8c8c',
    marginBottom: 8,
  },
  placeholderText: {
    fontSize: 14,
    color: '#bfbfbf',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  bottomPadding: {
    height: 40,
  },
});

export default BlueprintPreviewScreen;
