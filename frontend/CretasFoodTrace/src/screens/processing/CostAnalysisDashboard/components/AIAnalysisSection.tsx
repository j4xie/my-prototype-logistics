import React, { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { Text, Card, Button, ActivityIndicator, IconButton, TextInput, Divider } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { AIQuota } from '../../../../types/processing';
import { QUICK_QUESTIONS } from '../constants';
import { styles } from '../styles';
import { MarkdownRenderer } from '../../../../components/common/MarkdownRenderer';

interface AIAnalysisSectionProps {
  batchId: string | number;

  // AI分析状态
  analysis: string;
  loading: boolean;
  showSection: boolean;
  quota: AIQuota | null;

  // Session状态
  sessionId: string;
  lastAnalysis: string;
  isSessionRestored: boolean;

  // 自定义问题
  customQuestion: string;
  showQuestionInput: boolean;

  // 操作方法
  handleAIAnalysis: (question?: string) => Promise<void>;
  setCustomQuestion: (question: string) => void;
  toggleQuestionInput: () => void;
  closeAISection: () => void;
}

/**
 * AI分析区域组件
 * - 初始状态：显示AI分析按钮和配额
 * - 加载状态：显示Loading
 * - 结果状态：显示AI分析结果 + Follow-up问题
 */
export const AIAnalysisSection = React.memo<AIAnalysisSectionProps>((props) => {
  const { t } = useTranslation('processing');
  const {
    batchId,
    analysis,
    loading,
    showSection,
    quota,
    sessionId,
    customQuestion,
    showQuestionInput,
    handleAIAnalysis,
    setCustomQuestion,
    toggleQuestionInput,
    closeAISection,
  } = props;

  // 使用useCallback包装事件处理，避免每次渲染都重新创建
  const handleQuickQuestion = useCallback(
    (question: string) => {
      handleAIAnalysis(question);
    },
    [handleAIAnalysis]
  );

  const handleCustomQuestionSubmit = useCallback(() => {
    if (customQuestion.trim()) {
      handleAIAnalysis(customQuestion.trim());
    }
  }, [customQuestion, handleAIAnalysis]);

  // 使用useMemo缓存配额重置文本计算
  const getResetText = useMemo(() => {
    if (!quota?.resetDate) return '';

    const reset = new Date(quota.resetDate);
    const now = new Date();
    const days = Math.ceil((reset.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

    if (days === 0) return t('costAnalysisDashboard.aiAnalysis.resetTomorrow');
    if (days === 1) return t('costAnalysisDashboard.aiAnalysis.resetIn1Day');
    return t('costAnalysisDashboard.aiAnalysis.resetInDays', { days });
  }, [quota?.resetDate, t]);

  // 检查是否超过配额
  // ✅ 修复: 显式转换为boolean类型 (2025-11-20)
  const isQuotaExceeded = quota ? quota.remaining <= 0 : false;

  return (
    <Card style={styles.aiCard} mode="elevated">
      <Card.Content>
        {/* AI分析标题和配额显示 */}
        <View style={styles.aiHeader}>
          <View style={styles.aiTitleRow}>
            <View style={{ flex: 1 }}>
              <Text variant="titleLarge" style={styles.aiTitle}>
                {t('costAnalysisDashboard.aiAnalysis.title')}
              </Text>
              <Text variant="bodySmall" style={{ color: '#64748B', marginTop: 4 }}>
                {t('costAnalysisDashboard.aiAnalysis.subtitle')}
              </Text>
            </View>

            {quota && (
              <View style={styles.quotaBadge}>
                <Text variant="bodySmall" style={styles.quotaText}>
                  {t('costAnalysisDashboard.aiAnalysis.quotaRemaining', { remaining: quota.remaining, limit: quota.limit })}
                </Text>
                <Text variant="bodySmall" style={styles.resetText}>
                  {getResetText}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* 初始状态：未开始分析 */}
        {!showSection && (
          <View style={styles.aiInitial}>
            <Text variant="bodyMedium" style={styles.aiDescription}>
              {t('costAnalysisDashboard.aiAnalysis.description')}
            </Text>
            <Button
              mode="contained"
              onPress={() => handleAIAnalysis()}
              loading={loading}
              disabled={loading || isQuotaExceeded}
              style={styles.aiButton}
              contentStyle={styles.aiButtonContent}
              icon="sparkles"
            >
              {isQuotaExceeded ? t('costAnalysisDashboard.aiAnalysis.quotaExhausted') : t('costAnalysisDashboard.aiAnalysis.getAISuggestions')}
            </Button>
            {isQuotaExceeded && (
              <Text variant="bodySmall" style={styles.limitHint}>
                {t('costAnalysisDashboard.aiAnalysis.quotaExhaustedHint')}
              </Text>
            )}
          </View>
        )}

        {/* 分析中状态 */}
        {showSection && loading && !analysis && (
          <View style={styles.aiLoadingContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text variant="bodyMedium" style={styles.aiLoadingText}>
              {t('costAnalysisDashboard.aiAnalysis.analyzing')}
            </Text>
          </View>
        )}

        {/* 分析结果状态 */}
        {showSection && analysis && (
          <View style={styles.aiResultSection}>
            {/* AI分析结果卡片 */}
            <View style={styles.aiResultCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="titleMedium" style={styles.aiResultTitle}>
                  {t('costAnalysisDashboard.aiAnalysis.analysisResult')}
                </Text>
                <IconButton
                  icon="close"
                  size={20}
                  onPress={closeAISection}
                />
              </View>

              <Divider style={styles.aiDivider} />

              {/* 使用 Markdown 渲染器显示 AI 分析结果 */}
              <MarkdownRenderer content={analysis} />

              {sessionId && (
                <Text variant="bodySmall" style={{ color: '#64748B', marginTop: 12 }}>
                  {t('costAnalysisDashboard.aiAnalysis.sessionId')}: {sessionId.substring(0, 8)}...
                </Text>
              )}
            </View>

            {/* 快速问题 */}
            {!isQuotaExceeded && (
              <View style={styles.quickQuestions}>
                <Text variant="bodyMedium" style={styles.quickQuestionsTitle}>
                  {t('costAnalysisDashboard.aiAnalysis.continueAsking')}
                </Text>

                {QUICK_QUESTIONS.map((question, index) => (
                  <Button
                    key={index}
                    mode="outlined"
                    onPress={() => handleQuickQuestion(question)}
                    disabled={loading}
                    style={styles.quickQuestionButton}
                    contentStyle={styles.quickQuestionContent}
                    icon="comment-question"
                  >
                    {question}
                  </Button>
                ))}
              </View>
            )}

            {/* 自定义问题输入 */}
            {!isQuotaExceeded && (
              <View style={styles.customQuestionSection}>
                {!showQuestionInput ? (
                  <Button
                    mode="text"
                    onPress={toggleQuestionInput}
                    icon="plus"
                  >
                    {t('costAnalysisDashboard.aiAnalysis.customQuestion')}
                  </Button>
                ) : (
                  <View style={styles.questionInputContainer}>
                    <TextInput
                      mode="outlined"
                      label={t('costAnalysisDashboard.aiAnalysis.enterQuestion')}
                      value={customQuestion}
                      onChangeText={setCustomQuestion}
                      multiline
                      numberOfLines={3}
                      placeholder={t('costAnalysisDashboard.aiAnalysis.questionPlaceholder')}
                      style={styles.questionInput}
                    />
                    <View style={styles.questionActions}>
                      <Button
                        mode="outlined"
                        onPress={toggleQuestionInput}
                        disabled={loading}
                        style={{ flex: 1 }}
                      >
                        {t('common.cancel')}
                      </Button>
                      <Button
                        mode="contained"
                        onPress={handleCustomQuestionSubmit}
                        disabled={loading || !customQuestion.trim()}
                        loading={loading}
                        style={{ flex: 1 }}
                      >
                        {t('costAnalysisDashboard.aiAnalysis.ask')}
                      </Button>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* 配额提示 */}
            {quota && quota.remaining <= 3 && quota.remaining > 0 && (
              <Text variant="bodySmall" style={{ color: '#F59E0B', marginTop: 12, textAlign: 'center' }}>
                {t('costAnalysisDashboard.aiAnalysis.quotaHint', { remaining: quota.remaining })}
              </Text>
            )}
          </View>
        )}
      </Card.Content>
    </Card>
  );
});

AIAnalysisSection.displayName = 'AIAnalysisSection';
