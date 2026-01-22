/**
 * Factory Admin 意图查看页面 (只读)
 * 显示工厂级别的所有意图配置，不允许编辑
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Card, Chip, List, Divider, Icon, Surface } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { intentConfigApiClient, type AIIntentConfig, type IntentCategoryConfig } from '../../../services/api/intentConfigApiClient';
import type { FAManagementStackParamList } from '../../../types/navigation';

// 兼容类型别名
type IntentConfig = AIIntentConfig & {
  isActive?: boolean;
  displayName?: string;
};

// ============ Fallback 默认配置（API 加载失败时使用）============

// 默认分组显示配置
const DEFAULT_GROUP_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  QUERY: { label: '查询类意图', icon: 'magnify', color: '#1890ff' },
  DATA_OP: { label: '数据操作类', icon: 'database-edit', color: '#52c41a' },
  EQUIPMENT: { label: '设备类', icon: 'cog', color: '#722ed1' },
  SHIPMENT: { label: '出货类', icon: 'truck-delivery', color: '#13c2c2' },
  CRM: { label: '客户类', icon: 'account-group', color: '#eb2f96' },
  QUALITY: { label: '质量类', icon: 'check-decagram', color: '#52c41a' },
  HR: { label: '人事类', icon: 'badge-account', color: '#fa8c16' },
  REPORT: { label: '报告/分析类', icon: 'chart-line', color: '#fa8c16' },
  ALERT: { label: '告警类意图', icon: 'alert-circle', color: '#f5222d' },
  FORM: { label: '表单类', icon: 'form-select', color: '#722ed1' },
  SCHEDULE: { label: '排程类', icon: 'calendar-clock', color: '#fa8c16' },
  SYSTEM: { label: '系统/配置类', icon: 'cog', color: '#8c8c8c' },
  OTHER: { label: '其他', icon: 'help-circle', color: '#bfbfbf' },
};

// 默认分类映射
const DEFAULT_CATEGORY_GROUP_MAP: Record<string, string> = {
  QUERY: 'QUERY', BATCH: 'QUERY', BATCH_QUERY: 'QUERY', MATERIAL_QUERY: 'QUERY',
  PLAN_QUERY: 'QUERY', EQUIPMENT_QUERY: 'QUERY', QUALITY_QUERY: 'QUERY', HR_QUERY: 'QUERY',
  DATA_OP: 'DATA_OP', MATERIAL: 'DATA_OP', PROCESSING: 'DATA_OP', BATCH_UPDATE: 'DATA_OP',
  MATERIAL_UPDATE: 'DATA_OP', PLAN_UPDATE: 'DATA_OP', EQUIPMENT_UPDATE: 'DATA_OP',
  QUALITY_UPDATE: 'DATA_OP', HR_UPDATE: 'DATA_OP',
  EQUIPMENT: 'EQUIPMENT', SCALE: 'EQUIPMENT', CAMERA: 'EQUIPMENT',
  SHIPMENT: 'SHIPMENT', CRM: 'CRM', QUALITY: 'QUALITY', HR: 'HR',
  REPORT: 'REPORT', ANALYSIS: 'REPORT', COST_ANALYSIS: 'REPORT', TREND_ANALYSIS: 'REPORT',
  ALERT: 'ALERT', ALERT_QUERY: 'ALERT', ALERT_UPDATE: 'ALERT',
  SYSTEM: 'SYSTEM', CONFIG: 'SYSTEM', USER: 'SYSTEM', PLATFORM: 'SYSTEM', META: 'SYSTEM',
  FORM: 'FORM', SCHEDULE: 'SCHEDULE', FLOOR: 'OTHER',
};

// 默认分组排序
const DEFAULT_GROUP_ORDER = ['QUERY', 'DATA_OP', 'EQUIPMENT', 'SHIPMENT', 'CRM', 'QUALITY', 'HR', 'REPORT', 'ALERT', 'FORM', 'SCHEDULE', 'SYSTEM', 'OTHER'];

/**
 * 从 API 配置构建分组映射
 */
function buildCategoryGroupMap(configs: IntentCategoryConfig[]): Record<string, string> {
  const map: Record<string, string> = {};
  configs.forEach(config => {
    // 主分类映射到自身
    map[config.enumCode] = config.enumCode;
    // 子分类映射到父分类
    const subCategories = config.metadata?.subCategories ?? [];
    subCategories.forEach(sub => {
      map[sub] = config.enumCode;
    });
  });
  return map;
}

/**
 * 从 API 配置构建分组显示配置
 */
function buildGroupConfig(configs: IntentCategoryConfig[]): Record<string, { label: string; icon: string; color: string }> {
  const result: Record<string, { label: string; icon: string; color: string }> = {};
  configs.forEach(config => {
    result[config.enumCode] = {
      label: config.enumLabel,
      icon: config.icon || 'help-circle',
      color: config.color || '#bfbfbf',
    };
  });
  return result;
}

/**
 * 从 API 配置构建分组排序
 */
function buildGroupOrder(configs: IntentCategoryConfig[]): string[] {
  return configs
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(c => c.enumCode);
}

// 优先级配置
const PRIORITY_CONFIG: Record<number, { label: string; color: string }> = {
  1: { label: 'P0 紧急', color: '#f5222d' },
  2: { label: 'P1 高', color: '#fa8c16' },
  3: { label: 'P2 中', color: '#1890ff' },
  4: { label: 'P3 低', color: '#8c8c8c' },
};

// 敏感度配置
const SENSITIVITY_CONFIG: Record<string, { label: string; color: string }> = {
  HIGH: { label: '高敏感', color: '#f5222d' },
  MEDIUM: { label: '中敏感', color: '#fa8c16' },
  LOW: { label: '低敏感', color: '#52c41a' },
};

interface GroupedIntents {
  [category: string]: IntentConfig[];
}

type NavigationProp = NativeStackNavigationProp<FAManagementStackParamList, 'IntentView'>;

export function FAIntentViewScreen() {
  const { t } = useTranslation('home');
  const navigation = useNavigation<NavigationProp>();
  const [intents, setIntents] = useState<IntentConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['QUERY', 'DATA_OP']));
  const [error, setError] = useState<string | null>(null);

  // 动态分类配置（从 API 加载）
  const [categoryGroupMap, setCategoryGroupMap] = useState<Record<string, string>>(DEFAULT_CATEGORY_GROUP_MAP);
  const [groupConfig, setGroupConfig] = useState<Record<string, { label: string; icon: string; color: string }>>(DEFAULT_GROUP_CONFIG);
  const [groupOrder, setGroupOrder] = useState<string[]>(DEFAULT_GROUP_ORDER);

  const loadData = useCallback(async () => {
    try {
      setError(null);

      // 并行加载意图和分类配置
      const [intentsData, categoryConfigs] = await Promise.all([
        intentConfigApiClient.getAllIntents(),
        intentConfigApiClient.getIntentCategoryConfigs().catch(() => []), // 分类配置加载失败不影响主流程
      ]);

      setIntents(intentsData);

      // 如果成功加载了分类配置，则使用动态配置
      if (categoryConfigs.length > 0) {
        setCategoryGroupMap(buildCategoryGroupMap(categoryConfigs));
        setGroupConfig(buildGroupConfig(categoryConfigs));
        setGroupOrder(buildGroupOrder(categoryConfigs));
        console.log('[FAIntentViewScreen] 已从 API 加载分类配置:', categoryConfigs.length, '个分类');
      } else {
        console.log('[FAIntentViewScreen] 使用默认分类配置');
      }
    } catch (err) {
      console.error('Failed to load intents:', err);
      setError('加载意图配置失败，请稍后重试');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // 按分类分组 - 使用动态组映射合并相似分类
  const groupedIntents: GroupedIntents = {};
  intents.forEach((intent) => {
    const rawCategory = intent.intentCategory || 'OTHER';
    // 使用动态组映射，未知分类归入 OTHER
    const groupKey = categoryGroupMap[rawCategory] || 'OTHER';
    if (!groupedIntents[groupKey]) {
      groupedIntents[groupKey] = [];
    }
    groupedIntents[groupKey].push(intent);
  });

  // 按动态配置顺序排序分组
  const sortedGroups = Object.entries(groupedIntents).sort(([a], [b]) => {
    const indexA = groupOrder.indexOf(a);
    const indexB = groupOrder.indexOf(b);
    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
  });

  // 按优先级排序各分类内的意图
  Object.keys(groupedIntents).forEach((category) => {
    groupedIntents[category]?.sort((a, b) => (a.priority || 4) - (b.priority || 4));
  });

  const renderKeywords = (keywords: string | string[] | undefined) => {
    if (!keywords) return null;
    const keywordList = Array.isArray(keywords) ? keywords :
      (typeof keywords === 'string' ? JSON.parse(keywords) : []);

    if (keywordList.length === 0) return null;

    return (
      <View style={styles.keywordsContainer}>
        {keywordList.slice(0, 5).map((kw: string, idx: number) => (
          <Chip key={idx} style={styles.keywordChip} textStyle={styles.keywordChipText}>
            {kw}
          </Chip>
        ))}
        {keywordList.length > 5 && (
          <Text style={styles.moreKeywords}>+{keywordList.length - 5}</Text>
        )}
      </View>
    );
  };

  const renderIntentItem = (intent: IntentConfig) => {
    // 安全获取配置，防止 undefined
    const defaultPriority = { label: 'P3 低', color: '#8c8c8c' };
    const defaultSensitivity = { label: '低敏感', color: '#52c41a' };
    const priority = intent.priority as keyof typeof PRIORITY_CONFIG | undefined;
    const priorityConfig = (priority ? PRIORITY_CONFIG[priority] : null) ?? defaultPriority;
    const sensitivityLevel = intent.sensitivityLevel as keyof typeof SENSITIVITY_CONFIG | undefined;
    const sensitivityConfig = (sensitivityLevel ? SENSITIVITY_CONFIG[sensitivityLevel] : null) ?? defaultSensitivity;

    // 兼容 isActive 和 enabled 字段
    const isActive = intent.isActive ?? intent.enabled ?? true;

    // 获取原始分类对应的分组配置
    const rawCategory = intent.intentCategory || 'OTHER';
    const mappedGroup = categoryGroupMap[rawCategory] || 'OTHER';
    const categoryConfig = groupConfig[mappedGroup];

    return (
      <TouchableOpacity
        key={intent.intentCode}
        onPress={() => navigation.navigate('IntentConfigDetail', { intentCode: intent.intentCode })}
        activeOpacity={0.7}
      >
        <Card style={styles.intentCard} mode="outlined">
          <Card.Content>
            {/* 标题行 */}
            <View style={styles.intentHeader}>
              <View style={styles.intentTitleRow}>
                <Text style={styles.intentName} numberOfLines={2}>
                  {intent.displayName || intent.intentName}
                </Text>
                {!isActive && (
                  <Chip style={styles.disabledChip} textStyle={styles.disabledChipText}>
                    已禁用
                  </Chip>
                )}
              </View>
              <View style={styles.intentCodeRow}>
                <Text style={styles.intentCode}>{intent.intentCode}</Text>
                {categoryConfig && (
                  <View style={[styles.categoryBadge, { backgroundColor: categoryConfig.color + '20' }]}>
                    <Text style={[styles.categoryBadgeText, { color: categoryConfig.color }]}>
                      {categoryConfig.label}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* 描述 */}
            {intent.description && (
              <Text style={styles.description} numberOfLines={2}>
                {intent.description}
              </Text>
            )}

            {/* 标签行 */}
            <View style={styles.tagsRow}>
              <Chip
                style={[styles.tagChip, { backgroundColor: priorityConfig.color + '15' }]}
                textStyle={[styles.tagChipText, { color: priorityConfig.color }]}
              >
                {priorityConfig.label}
              </Chip>
              <Chip
                style={[styles.tagChip, { backgroundColor: sensitivityConfig.color + '15' }]}
                textStyle={[styles.tagChipText, { color: sensitivityConfig.color }]}
              >
                {sensitivityConfig.label}
              </Chip>
              {(intent as unknown as { operationType?: string }).operationType && (
                <Chip style={styles.tagChip} textStyle={styles.tagChipText}>
                  {(intent as unknown as { operationType?: string }).operationType === 'READ' ? '只读' : '写入'}
                </Chip>
              )}
            </View>

            {/* 关键词 */}
            {renderKeywords(intent.keywords)}

            {/* 查看详情提示 */}
            <View style={styles.viewDetailHint}>
              <Icon source="chevron-right" size={16} color="#999" />
              <Text style={styles.viewDetailText}>点击查看详情</Text>
            </View>
          </Card.Content>
        </Card>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1890ff" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon source="alert-circle" size={48} color="#f5222d" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* 统计信息 */}
        <Surface style={styles.statsCard} elevation={1}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{intents.length}</Text>
              <Text style={styles.statLabel}>总意图数</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {intents.filter(i => i.isActive ?? i.enabled ?? true).length}
              </Text>
              <Text style={styles.statLabel}>已启用</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {Object.keys(groupedIntents).length}
              </Text>
              <Text style={styles.statLabel}>分类数</Text>
            </View>
          </View>
        </Surface>

        {/* 提示信息 */}
        <View style={styles.infoBox}>
          <Icon source="information" size={16} color="#1890ff" />
          <Text style={styles.infoText}>
            意图配置由平台管理员统一管理，此处仅供查看
          </Text>
        </View>

        {/* 分类列表 - 使用排序后的分组 */}
        {sortedGroups.map(([groupKey, categoryIntents]) => {
          const fallbackConfig = { label: groupKey, icon: 'help-circle', color: '#bfbfbf' };
          const currentGroupConfig = groupConfig[groupKey] ?? groupConfig.OTHER ?? DEFAULT_GROUP_CONFIG.OTHER ?? fallbackConfig;
          const isExpanded = expandedCategories.has(groupKey);

          return (
            <View key={groupKey} style={styles.categorySection}>
              <List.Accordion
                title={`${currentGroupConfig.label} (${categoryIntents.length})`}
                left={() => (
                  <Icon
                    source={currentGroupConfig.icon}
                    size={24}
                    color={currentGroupConfig.color}
                  />
                )}
                expanded={isExpanded}
                onPress={() => toggleCategory(groupKey)}
                style={styles.accordionHeader}
                titleStyle={styles.accordionTitle}
              >
                {categoryIntents.map(renderIntentItem)}
              </List.Accordion>
              <Divider />
            </View>
          );
        })}

        {intents.length === 0 && (
          <View style={styles.emptyContainer}>
            <Icon source="robot-off" size={64} color="#bfbfbf" />
            <Text style={styles.emptyText}>暂无意图配置</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 12,
    color: '#f5222d',
    textAlign: 'center',
  },
  statsCard: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1890ff',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e0e0e0',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#e6f7ff',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#1890ff',
  },
  infoText: {
    marginLeft: 8,
    color: '#1890ff',
    fontSize: 13,
  },
  categorySection: {
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  accordionHeader: {
    backgroundColor: '#fff',
  },
  accordionTitle: {
    fontWeight: '600',
  },
  intentCard: {
    marginHorizontal: 16,
    marginVertical: 6,
    backgroundColor: '#fafafa',
  },
  intentHeader: {
    marginBottom: 8,
  },
  intentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  intentName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  intentCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  intentCode: {
    fontSize: 11,
    color: '#999',
    fontFamily: 'monospace',
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  disabledChip: {
    backgroundColor: '#fff1f0',
    height: 24,
  },
  disabledChipText: {
    fontSize: 11,
    color: '#f5222d',
  },
  description: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
    lineHeight: 18,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  tagChip: {
    height: 28,
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 4,
  },
  tagChipText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 14,
  },
  keywordsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  keywordChip: {
    height: 26,
    backgroundColor: '#e6f7ff',
    paddingHorizontal: 2,
  },
  keywordChipText: {
    fontSize: 11,
    color: '#1890ff',
    lineHeight: 13,
  },
  moreKeywords: {
    fontSize: 11,
    color: '#999',
    alignSelf: 'center',
    marginLeft: 4,
  },
  emptyContainer: {
    padding: 60,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 12,
    color: '#999',
    fontSize: 14,
  },
  viewDetailHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  viewDetailText: {
    fontSize: 12,
    color: '#999',
  },
});

export default FAIntentViewScreen;
