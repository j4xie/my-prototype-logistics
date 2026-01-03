/**
 * 意图配置管理界面
 *
 * 功能:
 * - 按分类显示意图列表
 * - 管理每个意图的关键词
 * - 配置优先级和敏感度
 * - 自动学习设置（置信度阈值、停用词等）
 *
 * 权限:
 * - 平台管理员: 全部功能
 * - 工厂超管: 关键词管理 + 本工厂自动学习配置
 *
 * @version 1.0.0
 * @since 2026-01-02
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  Appbar,
  Card,
  Text,
  Chip,
  Button,
  TextInput,
  Switch,
  Divider,
  List,
  Portal,
  Modal,
  IconButton,
  ActivityIndicator,
  useTheme,
  SegmentedButtons,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuthStore } from '../../store/authStore';
import intentConfigApiClient, {
  AIIntentConfig,
  IntentCategory,
  SensitivityLevel,
} from '../../services/api/intentConfigApiClient';

// ============ 类型定义 ============

interface AutoLearnConfig {
  autoLearnEnabled: boolean;
  confidenceThreshold: number;
  maxKeywordsPerIntent: number;
  stopwords: string[];
}

interface GroupedIntents {
  [category: string]: AIIntentConfig[];
}

// 分类名称映射
const CATEGORY_LABELS: Record<string, string> = {
  ANALYSIS: '📊 分析类意图',
  DATA_OP: '📝 数据操作类',
  FORM: '📋 表单类',
  SCHEDULE: '📅 排程类',
  SYSTEM: '⚙️ 系统类',
};

// 敏感度选项
const SENSITIVITY_OPTIONS: { label: string; value: SensitivityLevel }[] = [
  { label: '低', value: 'LOW' },
  { label: '中', value: 'MEDIUM' },
  { label: '高', value: 'HIGH' },
  { label: '关键', value: 'CRITICAL' },
];

// ============ 组件 ============

export default function IntentConfigScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { user } = useAuthStore();

  // 状态
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [intents, setIntents] = useState<AIIntentConfig[]>([]);
  const [groupedIntents, setGroupedIntents] = useState<GroupedIntents>({});
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedIntents, setExpandedIntents] = useState<Set<string>>(new Set());
  const [modifiedIntents, setModifiedIntents] = useState<Map<string, AIIntentConfig>>(new Map());

  // 自动学习配置
  const [autoLearnConfig, setAutoLearnConfig] = useState<AutoLearnConfig>({
    autoLearnEnabled: true,
    confidenceThreshold: 0.9,
    maxKeywordsPerIntent: 50,
    stopwords: ['的', '是', '了', '把', '我', '要'],
  });

  // 添加关键词弹窗
  const [keywordModalVisible, setKeywordModalVisible] = useState(false);
  const [currentIntentCode, setCurrentIntentCode] = useState<string | null>(null);
  const [newKeyword, setNewKeyword] = useState('');

  // 停用词弹窗
  const [stopwordModalVisible, setStopwordModalVisible] = useState(false);
  const [newStopword, setNewStopword] = useState('');

  // 权限判断
  const isPlatformAdmin = user?.userType === 'platform';
  const isFactorySuperAdmin = user?.factoryUser?.role === 'factory_super_admin';
  const canManage = isPlatformAdmin || isFactorySuperAdmin;

  // ============ 数据加载 ============

  const loadIntents = useCallback(async () => {
    try {
      const data = await intentConfigApiClient.getAllIntents();
      setIntents(data);

      // 按分类分组
      const grouped: GroupedIntents = {};
      data.forEach((intent) => {
        const category = intent.intentCategory || 'OTHER';
        if (!grouped[category]) {
          grouped[category] = [];
        }
        grouped[category].push(intent);
      });

      // 按优先级排序
      Object.keys(grouped).forEach((category) => {
        const categoryIntents = grouped[category];
        if (categoryIntents) {
          categoryIntents.sort((a, b) => (b.priority || 0) - (a.priority || 0));
        }
      });

      setGroupedIntents(grouped);

      // 默认展开第一个分类
      const categories = Object.keys(grouped);
      if (categories.length > 0 && categories[0]) {
        setExpandedCategories(new Set([categories[0]]));
      }
    } catch (error) {
      console.error('加载意图配置失败:', error);
      Alert.alert('加载失败', '无法加载意图配置，请检查网络连接');
    }
  }, []);

  const loadAutoLearnConfig = useCallback(async () => {
    // TODO: 从后端加载工厂级自动学习配置
    // 目前使用默认值
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([loadIntents(), loadAutoLearnConfig()]);
      setLoading(false);
    };
    load();
  }, [loadIntents, loadAutoLearnConfig]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadIntents();
    setRefreshing(false);
  }, [loadIntents]);

  // ============ 意图操作 ============

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

  const toggleIntent = (intentCode: string) => {
    setExpandedIntents((prev) => {
      const next = new Set(prev);
      if (next.has(intentCode)) {
        next.delete(intentCode);
      } else {
        next.add(intentCode);
      }
      return next;
    });
  };

  const getModifiedIntent = (intentCode: string): AIIntentConfig | undefined => {
    return modifiedIntents.get(intentCode) ?? intents.find((i) => i.intentCode === intentCode);
  };

  const updateIntentField = <K extends keyof AIIntentConfig>(
    intentCode: string,
    field: K,
    value: AIIntentConfig[K]
  ) => {
    const current = getModifiedIntent(intentCode);
    if (current) {
      const updated = { ...current, [field]: value };
      setModifiedIntents((prev) => new Map(prev).set(intentCode, updated));
    }
  };

  // ============ 关键词操作 ============

  const openAddKeywordModal = (intentCode: string) => {
    setCurrentIntentCode(intentCode);
    setNewKeyword('');
    setKeywordModalVisible(true);
  };

  const addKeyword = () => {
    if (!currentIntentCode || !newKeyword.trim()) return;

    const current = getModifiedIntent(currentIntentCode);
    if (current) {
      const keywords = [...(current.keywords || [])];
      if (!keywords.includes(newKeyword.trim())) {
        keywords.push(newKeyword.trim());
        updateIntentField(currentIntentCode, 'keywords', keywords);
      }
    }

    setKeywordModalVisible(false);
    setNewKeyword('');
  };

  const removeKeyword = (intentCode: string, keyword: string) => {
    const current = getModifiedIntent(intentCode);
    if (current) {
      const keywords = (current.keywords || []).filter((k) => k !== keyword);
      updateIntentField(intentCode, 'keywords', keywords);
    }
  };

  // ============ 停用词操作 ============

  const addStopword = () => {
    if (!newStopword.trim()) return;

    if (!autoLearnConfig.stopwords.includes(newStopword.trim())) {
      setAutoLearnConfig((prev) => ({
        ...prev,
        stopwords: [...prev.stopwords, newStopword.trim()],
      }));
    }

    setStopwordModalVisible(false);
    setNewStopword('');
  };

  const removeStopword = (word: string) => {
    setAutoLearnConfig((prev) => ({
      ...prev,
      stopwords: prev.stopwords.filter((w) => w !== word),
    }));
  };

  // ============ 保存 ============

  const saveChanges = async () => {
    if (modifiedIntents.size === 0) {
      Alert.alert('提示', '没有需要保存的修改');
      return;
    }

    setSaving(true);
    try {
      // 保存修改的意图
      for (const [intentCode, intent] of modifiedIntents) {
        await intentConfigApiClient.updateIntent(intentCode, intent);
      }

      // 刷新缓存
      await intentConfigApiClient.refreshCache();

      Alert.alert('成功', '配置已保存');
      setModifiedIntents(new Map());
      await loadIntents();
    } catch (error) {
      console.error('保存失败:', error);
      Alert.alert('保存失败', '无法保存配置，请重试');
    } finally {
      setSaving(false);
    }
  };

  // ============ 渲染 ============

  const renderKeywordChips = (intent: AIIntentConfig) => {
    const modified = getModifiedIntent(intent.intentCode);
    const keywords = modified?.keywords || [];

    return (
      <View style={styles.keywordsContainer}>
        {keywords.map((keyword) => (
          <Chip
            key={keyword}
            mode="outlined"
            style={styles.keywordChip}
            onClose={() => removeKeyword(intent.intentCode, keyword)}
          >
            {keyword}
          </Chip>
        ))}
        <IconButton
          icon="plus"
          size={20}
          mode="contained-tonal"
          onPress={() => openAddKeywordModal(intent.intentCode)}
        />
      </View>
    );
  };

  const renderIntentItem = (intent: AIIntentConfig) => {
    const isExpanded = expandedIntents.has(intent.intentCode);
    const modified = getModifiedIntent(intent.intentCode);
    const hasChanges = modifiedIntents.has(intent.intentCode);

    return (
      <Card
        key={intent.intentCode}
        style={[styles.intentCard, hasChanges && styles.intentCardModified]}
      >
        <List.Accordion
          title={
            <View style={styles.intentHeader}>
              <Text style={styles.intentCode}>{intent.intentCode}</Text>
              {hasChanges && (
                <Chip compact mode="flat" style={styles.modifiedChip}>
                  已修改
                </Chip>
              )}
            </View>
          }
          description={intent.intentName || intent.description}
          expanded={isExpanded}
          onPress={() => toggleIntent(intent.intentCode)}
          left={(props) => <List.Icon {...props} icon="tag-outline" />}
        >
          <View style={styles.intentContent}>
            {/* 关键词 */}
            <Text style={styles.sectionLabel}>关键词</Text>
            {renderKeywordChips(intent)}

            {/* 优先级和敏感度 */}
            <View style={styles.configRow}>
              <View style={styles.configItem}>
                <Text style={styles.configLabel}>优先级</Text>
                <TextInput
                  mode="outlined"
                  dense
                  keyboardType="numeric"
                  value={String(modified?.priority ?? intent.priority ?? 50)}
                  onChangeText={(text) => {
                    const num = parseInt(text, 10);
                    if (!isNaN(num) && num >= 1 && num <= 100) {
                      updateIntentField(intent.intentCode, 'priority', num);
                    }
                  }}
                  style={styles.priorityInput}
                />
              </View>

              <View style={styles.configItem}>
                <Text style={styles.configLabel}>敏感度</Text>
                <SegmentedButtons
                  value={modified?.sensitivityLevel ?? intent.sensitivityLevel ?? 'LOW'}
                  onValueChange={(value) => {
                    updateIntentField(intent.intentCode, 'sensitivityLevel', value as SensitivityLevel);
                  }}
                  buttons={SENSITIVITY_OPTIONS.map((opt) => ({
                    value: opt.value,
                    label: opt.label,
                  }))}
                  density="small"
                  style={styles.sensitivityButtons}
                />
              </View>
            </View>

            {/* 启用状态 */}
            <View style={styles.switchRow}>
              <Text>启用</Text>
              <Switch
                value={modified?.enabled ?? intent.enabled ?? true}
                onValueChange={(value) => {
                  updateIntentField(intent.intentCode, 'enabled', value);
                }}
              />
            </View>
          </View>
        </List.Accordion>
      </Card>
    );
  };

  const renderCategorySection = (category: string, categoryIntents: AIIntentConfig[]) => {
    const isExpanded = expandedCategories.has(category);
    const label = CATEGORY_LABELS[category] || `📁 ${category}`;

    return (
      <View key={category} style={styles.categorySection}>
        <List.Accordion
          title={label}
          description={`${categoryIntents.length} 个意图`}
          expanded={isExpanded}
          onPress={() => toggleCategory(category)}
          style={styles.categoryHeader}
          titleStyle={styles.categoryTitle}
        >
          {categoryIntents.map(renderIntentItem)}
        </List.Accordion>
      </View>
    );
  };

  const renderAutoLearnSection = () => {
    if (!canManage) return null;

    return (
      <Card style={styles.autoLearnCard}>
        <Card.Title
          title="🔧 自动学习设置"
          subtitle={isPlatformAdmin ? '平台全局配置' : '本工厂配置'}
        />
        <Card.Content>
          {/* 启用开关 */}
          <View style={styles.switchRow}>
            <Text>启用自动学习</Text>
            <Switch
              value={autoLearnConfig.autoLearnEnabled}
              onValueChange={(value) => {
                setAutoLearnConfig((prev) => ({ ...prev, autoLearnEnabled: value }));
              }}
            />
          </View>

          <Divider style={styles.divider} />

          {/* 置信度阈值 */}
          <View style={styles.configItem}>
            <Text style={styles.configLabel}>置信度阈值 (0.0 - 1.0)</Text>
            <TextInput
              mode="outlined"
              dense
              keyboardType="decimal-pad"
              value={String(autoLearnConfig.confidenceThreshold)}
              onChangeText={(text) => {
                const num = parseFloat(text);
                if (!isNaN(num) && num >= 0 && num <= 1) {
                  setAutoLearnConfig((prev) => ({ ...prev, confidenceThreshold: num }));
                }
              }}
              style={styles.thresholdInput}
            />
          </View>

          {/* 最大关键词数 */}
          <View style={styles.configItem}>
            <Text style={styles.configLabel}>每意图最大关键词数</Text>
            <TextInput
              mode="outlined"
              dense
              keyboardType="numeric"
              value={String(autoLearnConfig.maxKeywordsPerIntent)}
              onChangeText={(text) => {
                const num = parseInt(text, 10);
                if (!isNaN(num) && num > 0 && num <= 200) {
                  setAutoLearnConfig((prev) => ({ ...prev, maxKeywordsPerIntent: num }));
                }
              }}
              style={styles.thresholdInput}
            />
          </View>

          <Divider style={styles.divider} />

          {/* 停用词 */}
          <Text style={styles.configLabel}>停用词</Text>
          <View style={styles.keywordsContainer}>
            {autoLearnConfig.stopwords.map((word) => (
              <Chip
                key={word}
                mode="outlined"
                style={styles.keywordChip}
                onClose={() => removeStopword(word)}
              >
                {word}
              </Chip>
            ))}
            <IconButton
              icon="plus"
              size={20}
              mode="contained-tonal"
              onPress={() => {
                setNewStopword('');
                setStopwordModalVisible(true);
              }}
            />
          </View>
        </Card.Content>
      </Card>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="意图配置管理" />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="意图配置管理" />
        {canManage && (
          <Appbar.Action
            icon={saving ? 'loading' : 'content-save'}
            disabled={saving || modifiedIntents.size === 0}
            onPress={saveChanges}
          />
        )}
      </Appbar.Header>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* 意图列表 */}
        {Object.entries(groupedIntents).map(([category, categoryIntents]) =>
          renderCategorySection(category, categoryIntents)
        )}

        {/* 自动学习设置 */}
        {renderAutoLearnSection()}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* 添加关键词弹窗 */}
      <Portal>
        <Modal
          visible={keywordModalVisible}
          onDismiss={() => setKeywordModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <Text style={styles.modalTitle}>添加关键词</Text>
          <TextInput
            mode="outlined"
            label="新关键词"
            value={newKeyword}
            onChangeText={setNewKeyword}
            autoFocus
          />
          <View style={styles.modalActions}>
            <Button onPress={() => setKeywordModalVisible(false)}>取消</Button>
            <Button mode="contained" onPress={addKeyword} disabled={!newKeyword.trim()}>
              添加
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* 添加停用词弹窗 */}
      <Portal>
        <Modal
          visible={stopwordModalVisible}
          onDismiss={() => setStopwordModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <Text style={styles.modalTitle}>添加停用词</Text>
          <TextInput
            mode="outlined"
            label="新停用词"
            value={newStopword}
            onChangeText={setNewStopword}
            autoFocus
          />
          <View style={styles.modalActions}>
            <Button onPress={() => setStopwordModalVisible(false)}>取消</Button>
            <Button mode="contained" onPress={addStopword} disabled={!newStopword.trim()}>
              添加
            </Button>
          </View>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
}

// ============ 样式 ============

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
  categorySection: {
    marginBottom: 8,
  },
  categoryHeader: {
    backgroundColor: '#fff',
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  intentCard: {
    marginHorizontal: 16,
    marginVertical: 4,
  },
  intentCardModified: {
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
  },
  intentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  intentCode: {
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  modifiedChip: {
    backgroundColor: '#E3F2FD',
  },
  intentContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    marginTop: 8,
  },
  keywordsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  keywordChip: {
    marginBottom: 4,
  },
  configRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 16,
  },
  configItem: {
    flex: 1,
    marginBottom: 12,
  },
  configLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  priorityInput: {
    height: 40,
  },
  sensitivityButtons: {
    marginTop: 4,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  autoLearnCard: {
    margin: 16,
  },
  divider: {
    marginVertical: 12,
  },
  thresholdInput: {
    height: 40,
    maxWidth: 120,
  },
  bottomPadding: {
    height: 40,
  },
  modal: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
});
