/**
 * 意图候选选择组件
 *
 * 当意图识别返回多个置信度相近的候选时，显示选择界面让用户确认
 *
 * 功能：
 * - 展示候选意图列表（带置信度百分比）
 * - 高亮显示匹配的关键词
 * - 显示澄清问题引导用户
 * - 支持选择、取消和自定义输入
 *
 * @version 1.0.0
 * @since 2026-01-02
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { IconButton } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import {
  CandidateIntent,
  IntentMatchResult,
  IntentSelectionCallbacks,
} from '../../types/intent';

export interface IntentCandidateSelectorProps {
  /** 是否可见 */
  visible: boolean;
  /** 意图匹配结果 */
  matchResult: IntentMatchResult;
  /** 选择回调 */
  callbacks: IntentSelectionCallbacks;
  /** 是否正在加载 */
  isLoading?: boolean;
}

/**
 * 获取意图分类图标
 */
function getCategoryIcon(category: string): string {
  const iconMap: Record<string, string> = {
    DATA_QUERY: 'database-search',
    DATA_CREATE: 'plus-circle',
    DATA_UPDATE: 'pencil',
    DATA_DELETE: 'delete',
    REPORT_GENERATION: 'chart-bar',
    FORM_GENERATION: 'form-select',
    ANALYSIS: 'brain',
  };
  return iconMap[category] ?? 'help-circle';
}

/**
 * 获取匹配方法显示文本
 */
function getMatchMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    REGEX: '精确匹配',
    KEYWORD: '关键词匹配',
    LLM: 'AI推理',
    NONE: '无匹配',
  };
  return labels[method] || method;
}

/**
 * 置信度颜色
 */
function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return '#52c41a';
  if (confidence >= 0.6) return '#1890ff';
  if (confidence >= 0.4) return '#faad14';
  return '#ff4d4f';
}

/**
 * 候选意图卡片
 */
function CandidateCard({
  candidate,
  index,
  isSelected,
  onSelect,
}: {
  candidate: CandidateIntent;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const confidencePercent = Math.round(candidate.confidence * 100);
  const confidenceColor = getConfidenceColor(candidate.confidence);

  return (
    <TouchableOpacity
      style={[
        styles.candidateCard,
        isSelected && styles.candidateCardSelected,
      ]}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>{index + 1}</Text>
          </View>
          <IconButton
            icon={getCategoryIcon(candidate.intentCategory)}
            size={20}
            iconColor="#667eea"
            style={styles.categoryIcon}
          />
          <Text style={styles.intentName} numberOfLines={1}>
            {candidate.intentName}
          </Text>
        </View>
        <View style={[styles.confidenceBadge, { backgroundColor: `${confidenceColor}15` }]}>
          <Text style={[styles.confidenceText, { color: confidenceColor }]}>
            {confidencePercent}%
          </Text>
        </View>
      </View>

      <Text style={styles.intentDescription} numberOfLines={2}>
        {candidate.description}
      </Text>

      {candidate.matchedKeywords.length > 0 && (
        <View style={styles.keywordsRow}>
          <Text style={styles.keywordsLabel}>匹配关键词: </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {candidate.matchedKeywords.slice(0, 5).map((keyword, i) => (
              <View key={i} style={styles.keywordTag}>
                <Text style={styles.keywordText}>{keyword}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.cardFooter}>
        <Text style={styles.matchMethodText}>
          {getMatchMethodLabel(candidate.matchMethod)}
        </Text>
        {isSelected && (
          <IconButton icon="check-circle" size={20} iconColor="#52c41a" />
        )}
      </View>
    </TouchableOpacity>
  );
}

/**
 * 意图候选选择组件
 */
export function IntentCandidateSelector({
  visible,
  matchResult,
  callbacks,
  isLoading = false,
}: IntentCandidateSelectorProps) {
  const { t } = useTranslation('common');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customText, setCustomText] = useState('');

  const handleSelect = (index: number) => {
    setSelectedIndex(index);
  };

  const handleConfirm = () => {
    if (selectedIndex !== null) {
      const selected = matchResult.topCandidates[selectedIndex];
      if (selected) {
        callbacks.onSelect(selected);
      }
    }
  };

  const handleCustomSubmit = () => {
    if (customText.trim() && callbacks.onCustom) {
      callbacks.onCustom(customText.trim());
      setShowCustomInput(false);
      setCustomText('');
    }
  };

  const handleCancel = () => {
    setSelectedIndex(null);
    setShowCustomInput(false);
    setCustomText('');
    callbacks.onCancel?.();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* 头部 */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.headerIconGradient}
              >
                <IconButton icon="robot" size={24} iconColor="#fff" />
              </LinearGradient>
            </View>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>请确认您的意图</Text>
              <Text style={styles.headerSubtitle}>
                检测到多个可能的匹配，请选择最符合您需求的选项
              </Text>
            </View>
            <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
              <IconButton icon="close" size={24} iconColor="#666" />
            </TouchableOpacity>
          </View>

          {/* 用户输入回显 */}
          <View style={styles.userInputContainer}>
            <Text style={styles.userInputLabel}>您的输入:</Text>
            <Text style={styles.userInputText}>{matchResult.userInput}</Text>
          </View>

          {/* 澄清问题 */}
          {matchResult.clarificationQuestion && (
            <View style={styles.clarificationContainer}>
              <IconButton icon="help-circle" size={18} iconColor="#1890ff" />
              <Text style={styles.clarificationText}>
                {matchResult.clarificationQuestion}
              </Text>
            </View>
          )}

          {/* 候选列表 */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#667eea" />
              <Text style={styles.loadingText}>正在分析...</Text>
            </View>
          ) : (
            <ScrollView style={styles.candidateList} showsVerticalScrollIndicator={false}>
              {matchResult.topCandidates.map((candidate, index) => (
                <CandidateCard
                  key={candidate.intentCode}
                  candidate={candidate}
                  index={index}
                  isSelected={selectedIndex === index}
                  onSelect={() => handleSelect(index)}
                />
              ))}

              {/* 自定义选项 */}
              {callbacks.onCustom && (
                <TouchableOpacity
                  style={[
                    styles.candidateCard,
                    styles.customCard,
                    showCustomInput && styles.candidateCardSelected,
                  ]}
                  onPress={() => setShowCustomInput(!showCustomInput)}
                >
                  <View style={styles.customCardHeader}>
                    <IconButton icon="pencil-plus" size={20} iconColor="#666" />
                    <Text style={styles.customCardTitle}>以上都不是，我要自定义描述</Text>
                  </View>
                </TouchableOpacity>
              )}

              {/* 自定义输入框 */}
              {showCustomInput && (
                <View style={styles.customInputContainer}>
                  <TextInput
                    style={styles.customInput}
                    placeholder="请详细描述您想要做什么..."
                    placeholderTextColor="#999"
                    value={customText}
                    onChangeText={setCustomText}
                    multiline
                    maxLength={200}
                  />
                  <TouchableOpacity
                    style={[
                      styles.customSubmitButton,
                      !customText.trim() && styles.customSubmitButtonDisabled,
                    ]}
                    onPress={handleCustomSubmit}
                    disabled={!customText.trim()}
                  >
                    <Text style={styles.customSubmitText}>提交</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          )}

          {/* 底部按钮 */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                selectedIndex === null && styles.confirmButtonDisabled,
              ]}
              onPress={handleConfirm}
              disabled={selectedIndex === null}
            >
              <LinearGradient
                colors={
                  selectedIndex !== null
                    ? ['#667eea', '#764ba2']
                    : ['#ccc', '#ccc']
                }
                style={styles.confirmButtonGradient}
              >
                <Text style={styles.confirmButtonText}>确认选择</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: 34, // Safe area for iPhone
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerIcon: {
    marginRight: 12,
  },
  headerIconGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  closeButton: {
    marginTop: -8,
    marginRight: -8,
  },
  userInputContainer: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
  },
  userInputLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  userInputText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  clarificationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#e6f7ff',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
  },
  clarificationText: {
    flex: 1,
    fontSize: 13,
    color: '#1890ff',
    marginLeft: 4,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  candidateList: {
    paddingHorizontal: 16,
    marginTop: 12,
    maxHeight: 400,
  },
  candidateCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  candidateCardSelected: {
    borderColor: '#667eea',
    backgroundColor: '#f8f9ff',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rankBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  rankText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  categoryIcon: {
    margin: 0,
    padding: 0,
  },
  intentName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confidenceText: {
    fontSize: 13,
    fontWeight: '600',
  },
  intentDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 8,
  },
  keywordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  keywordsLabel: {
    fontSize: 12,
    color: '#999',
  },
  keywordTag: {
    backgroundColor: '#f0f5ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  keywordText: {
    fontSize: 12,
    color: '#667eea',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  matchMethodText: {
    fontSize: 11,
    color: '#999',
  },
  customCard: {
    borderStyle: 'dashed',
  },
  customCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customCardTitle: {
    fontSize: 14,
    color: '#666',
  },
  customInputContainer: {
    marginTop: 10,
    marginBottom: 10,
  },
  customInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  customSubmitButton: {
    backgroundColor: '#667eea',
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 10,
    alignItems: 'center',
  },
  customSubmitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  customSubmitText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    marginRight: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  confirmButton: {
    flex: 2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
});
