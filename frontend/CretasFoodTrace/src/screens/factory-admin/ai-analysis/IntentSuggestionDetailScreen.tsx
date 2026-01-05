/**
 * 意图建议详情页面
 * 查看建议详情并进行审批操作
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
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon, Chip, Button, Dialog, Portal, Provider } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { FAAIStackParamList } from '../../../types/navigation';
import {
  intentAnalysisApiClient,
  IntentOptimizationSuggestion,
  ApproveCreateIntentRequest,
  ApproveUpdateIntentRequest,
} from '../../../services/api/intentAnalysisApiClient';

type NavigationProp = NativeStackNavigationProp<FAAIStackParamList, 'IntentSuggestionDetail'>;
type RouteParams = RouteProp<FAAIStackParamList, 'IntentSuggestionDetail'>;

interface InfoRowProps {
  label: string;
  value: string | React.ReactNode;
  icon?: string;
}

function InfoRow({ label, value, icon }: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLabel}>
        {icon && <Icon source={icon} size={16} color="#666" />}
        <Text style={styles.infoLabelText}>{label}</Text>
      </View>
      {typeof value === 'string' ? (
        <Text style={styles.infoValue}>{value}</Text>
      ) : (
        value
      )}
    </View>
  );
}

export function IntentSuggestionDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteParams>();
  const { suggestionId } = route.params;
  const { t } = useTranslation('home');

  const [loading, setLoading] = useState(true);
  const [suggestion, setSuggestion] = useState<IntentOptimizationSuggestion | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [rejectDialogVisible, setRejectDialogVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // 可编辑的审批字段
  const [editedCode, setEditedCode] = useState('');
  const [editedName, setEditedName] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [editedKeywords, setEditedKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');

  const loadSuggestion = useCallback(async () => {
    try {
      setLoading(true);
      const data = await intentAnalysisApiClient.getSuggestionDetail(suggestionId);
      setSuggestion(data);
      // 初始化编辑字段
      setEditedCode(data.suggestedIntentCode || data.intentCode);
      setEditedName(data.suggestedIntentName || '');
      setEditedDescription(data.suggestedDescription || '');
      setEditedKeywords(data.suggestedKeywords || []);
    } catch (err) {
      console.error('Load suggestion failed:', err);
      Alert.alert('加载失败', '无法加载建议详情');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [suggestionId, navigation]);

  useEffect(() => {
    loadSuggestion();
  }, [loadSuggestion]);

  const handleAddKeyword = useCallback(() => {
    const keyword = newKeyword.trim();
    if (keyword && !editedKeywords.includes(keyword)) {
      setEditedKeywords(prev => [...prev, keyword]);
      setNewKeyword('');
    }
  }, [newKeyword, editedKeywords]);

  const handleRemoveKeyword = useCallback((keyword: string) => {
    setEditedKeywords(prev => prev.filter(k => k !== keyword));
  }, []);

  const handleApprove = useCallback(async () => {
    if (!suggestion) return;

    // 验证必填字段
    if (suggestion.suggestionType === 'CREATE_INTENT') {
      if (!editedCode.trim()) {
        Alert.alert('验证失败', '意图代码不能为空');
        return;
      }
      if (!editedName.trim()) {
        Alert.alert('验证失败', '意图名称不能为空');
        return;
      }
      if (editedKeywords.length === 0) {
        Alert.alert('验证失败', '至少需要一个关键词');
        return;
      }
    }

    Alert.alert(
      '确认审批',
      suggestion.suggestionType === 'CREATE_INTENT'
        ? `确定要创建新意图「${editedName}」吗？`
        : '确定要更新该意图的配置吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          onPress: async () => {
            try {
              setSubmitting(true);
              if (suggestion.suggestionType === 'CREATE_INTENT') {
                const request: ApproveCreateIntentRequest = {
                  intentCode: editedCode.trim(),
                  intentName: editedName.trim(),
                  keywords: editedKeywords,
                  description: editedDescription.trim() || undefined,
                  category: suggestion.suggestedCategory || undefined,
                };
                await intentAnalysisApiClient.approveCreateIntent(suggestionId, request);
              } else {
                const request: ApproveUpdateIntentRequest = {
                  keywords: editedKeywords.length > 0 ? editedKeywords : undefined,
                  description: editedDescription.trim() || undefined,
                };
                await intentAnalysisApiClient.approveUpdateIntent(suggestionId, request);
              }
              Alert.alert('成功', '建议已审批通过', [
                { text: '确定', onPress: () => navigation.goBack() },
              ]);
            } catch (err) {
              console.error('Approve failed:', err);
              Alert.alert('审批失败', '请稍后重试');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  }, [suggestion, suggestionId, editedCode, editedName, editedKeywords, editedDescription, navigation]);

  const handleReject = useCallback(async () => {
    try {
      setSubmitting(true);
      await intentAnalysisApiClient.rejectSuggestion(
        suggestionId,
        rejectReason.trim() || undefined
      );
      setRejectDialogVisible(false);
      Alert.alert('成功', '建议已拒绝', [
        { text: '确定', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      console.error('Reject failed:', err);
      Alert.alert('拒绝失败', '请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }, [suggestionId, rejectReason, navigation]);

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

  if (!suggestion) {
    return null;
  }

  const isCreateIntent = suggestion.suggestionType === 'CREATE_INTENT';

  return (
    <Provider>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* 类型标签 */}
            <View style={styles.typeHeader}>
              <View style={[
                styles.typeBadge,
                { backgroundColor: isCreateIntent ? '#52c41a20' : '#1890ff20' }
              ]}>
                <Icon
                  source={isCreateIntent ? 'plus-circle' : 'pencil'}
                  size={20}
                  color={isCreateIntent ? '#52c41a' : '#1890ff'}
                />
                <Text style={[
                  styles.typeBadgeText,
                  { color: isCreateIntent ? '#52c41a' : '#1890ff' }
                ]}>
                  {isCreateIntent ? '新建意图' : '更新意图'}
                </Text>
              </View>
              <View style={styles.confidenceContainer}>
                <Text style={styles.confidenceLabel}>LLM 置信度</Text>
                <Text style={styles.confidenceValue}>
                  {Math.round(suggestion.llmConfidence * 100)}%
                </Text>
              </View>
            </View>

            {/* LLM 推理说明 */}
            {suggestion.llmReasoning && (
              <View style={styles.reasoningCard}>
                <View style={styles.reasoningHeader}>
                  <Icon source="robot" size={18} color="#667eea" />
                  <Text style={styles.reasoningTitle}>AI 分析说明</Text>
                </View>
                <Text style={styles.reasoningText}>{suggestion.llmReasoning}</Text>
              </View>
            )}

            {/* 原始输入 */}
            {suggestion.originalInput && (
              <View style={styles.originalCard}>
                <View style={styles.cardHeader}>
                  <Icon source="format-quote-open" size={18} color="#fa8c16" />
                  <Text style={styles.cardTitle}>触发输入</Text>
                  <View style={styles.frequencyBadge}>
                    <Icon source="fire" size={14} color="#fa8c16" />
                    <Text style={styles.frequencyText}>{suggestion.frequency} 次</Text>
                  </View>
                </View>
                <Text style={styles.originalText}>{suggestion.originalInput}</Text>
              </View>
            )}

            {/* 可编辑字段 */}
            <View style={styles.editSection}>
              <Text style={styles.sectionTitle}>
                {isCreateIntent ? '新意图配置' : '更新配置'}
              </Text>

              {/* 意图代码（仅新建时可编辑） */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>意图代码 *</Text>
                <TextInput
                  style={[styles.input, !isCreateIntent && styles.inputDisabled]}
                  value={editedCode}
                  onChangeText={setEditedCode}
                  placeholder="如: MATERIAL_BATCH_QUERY"
                  editable={isCreateIntent}
                />
              </View>

              {/* 意图名称（仅新建时显示） */}
              {isCreateIntent && (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>意图名称 *</Text>
                  <TextInput
                    style={styles.input}
                    value={editedName}
                    onChangeText={setEditedName}
                    placeholder="如: 原料批次查询"
                  />
                </View>
              )}

              {/* 描述 */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>描述</Text>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={editedDescription}
                  onChangeText={setEditedDescription}
                  placeholder="意图的详细描述..."
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* 关键词 */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  关键词 {isCreateIntent && '*'}
                </Text>
                <View style={styles.keywordsContainer}>
                  {editedKeywords.map((keyword, index) => (
                    <Chip
                      key={index}
                      onClose={() => handleRemoveKeyword(keyword)}
                      style={styles.keywordChip}
                      textStyle={styles.keywordChipText}
                    >
                      {keyword}
                    </Chip>
                  ))}
                </View>
                <View style={styles.addKeywordRow}>
                  <TextInput
                    style={[styles.input, styles.keywordInput]}
                    value={newKeyword}
                    onChangeText={setNewKeyword}
                    placeholder="输入关键词"
                    onSubmitEditing={handleAddKeyword}
                  />
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={handleAddKeyword}
                  >
                    <Icon source="plus" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* 元信息 */}
            <View style={styles.metaSection}>
              <Text style={styles.sectionTitle}>其他信息</Text>
              <View style={styles.metaCard}>
                <InfoRow
                  label="建议ID"
                  value={suggestion.id.substring(0, 8) + '...'}
                  icon="identifier"
                />
                <InfoRow
                  label="工厂ID"
                  value={suggestion.factoryId}
                  icon="factory"
                />
                <InfoRow
                  label="创建时间"
                  value={new Date(suggestion.createdAt).toLocaleString('zh-CN')}
                  icon="clock-outline"
                />
                {suggestion.suggestedCategory && (
                  <InfoRow
                    label="建议分类"
                    value={suggestion.suggestedCategory}
                    icon="tag"
                  />
                )}
              </View>
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>

          {/* 底部操作按钮 */}
          <View style={styles.actionBar}>
            <Button
              mode="outlined"
              onPress={() => setRejectDialogVisible(true)}
              disabled={submitting}
              style={styles.rejectButton}
              labelStyle={styles.rejectButtonLabel}
              icon="close"
            >
              拒绝
            </Button>
            <Button
              mode="contained"
              onPress={handleApprove}
              loading={submitting}
              disabled={submitting}
              style={styles.approveButton}
              labelStyle={styles.approveButtonLabel}
              icon="check"
            >
              批准
            </Button>
          </View>

          {/* 拒绝对话框 */}
          <Portal>
            <Dialog
              visible={rejectDialogVisible}
              onDismiss={() => setRejectDialogVisible(false)}
            >
              <Dialog.Title>拒绝建议</Dialog.Title>
              <Dialog.Content>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={rejectReason}
                  onChangeText={setRejectReason}
                  placeholder="请输入拒绝原因（可选）"
                  multiline
                  numberOfLines={3}
                />
              </Dialog.Content>
              <Dialog.Actions>
                <Button onPress={() => setRejectDialogVisible(false)}>取消</Button>
                <Button
                  onPress={handleReject}
                  loading={submitting}
                  disabled={submitting}
                  textColor="#e53e3e"
                >
                  确认拒绝
                </Button>
              </Dialog.Actions>
            </Dialog>
          </Portal>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Provider>
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
  typeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  typeBadgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  confidenceContainer: {
    alignItems: 'flex-end',
  },
  confidenceLabel: {
    fontSize: 12,
    color: '#999',
  },
  confidenceValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#667eea',
  },
  reasoningCard: {
    margin: 16,
    marginBottom: 0,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#667eea',
  },
  reasoningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  reasoningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
  },
  reasoningText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
  },
  originalCard: {
    margin: 16,
    marginBottom: 0,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  cardTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1a202c',
  },
  frequencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fa8c1620',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
  },
  frequencyText: {
    fontSize: 12,
    color: '#fa8c16',
    fontWeight: '500',
  },
  originalText: {
    fontSize: 15,
    color: '#333',
    fontStyle: 'italic',
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
  },
  editSection: {
    margin: 16,
    marginBottom: 0,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a202c',
    marginBottom: 16,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#fff',
  },
  inputDisabled: {
    backgroundColor: '#f5f5f5',
    color: '#999',
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  keywordsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  keywordChip: {
    backgroundColor: '#e3f2fd',
  },
  keywordChipText: {
    color: '#1976d2',
  },
  addKeywordRow: {
    flexDirection: 'row',
    gap: 8,
  },
  keywordInput: {
    flex: 1,
  },
  addButton: {
    width: 44,
    height: 44,
    backgroundColor: '#667eea',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metaSection: {
    margin: 16,
  },
  metaCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoLabelText: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    color: '#1a202c',
    fontWeight: '500',
  },
  actionBar: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 24,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
    gap: 12,
  },
  rejectButton: {
    flex: 1,
    borderColor: '#e53e3e',
  },
  rejectButtonLabel: {
    color: '#e53e3e',
  },
  approveButton: {
    flex: 1,
    backgroundColor: '#52c41a',
  },
  approveButtonLabel: {
    color: '#fff',
  },
});

export default IntentSuggestionDetailScreen;
