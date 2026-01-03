import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Share,
  Alert,
} from 'react-native';
import {
  Text,
  Appbar,
  Card,
  Divider,
  Chip,
  ActivityIndicator,
  IconButton,
  Menu,
} from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import { ProcessingScreenProps } from '../../types/navigation';
import { aiApiClient, AICostAnalysisResponse } from '../../services/api/aiApiClient';
import { MarkdownRenderer } from '../../components/common/MarkdownRenderer';
import { useAuthStore } from '../../store/authStore';
import { getFactoryId } from '../../types/auth';
import { handleError, getErrorMsg } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建AIAnalysisDetail专用logger
const aiAnalysisLogger = logger.createContextLogger('AIAnalysisDetail');

type AIAnalysisDetailScreenProps = ProcessingScreenProps<'AIAnalysisDetail'>;

/**
 * AI分析详情页
 *
 * 功能:
 * - 展示完整的AI分析报告内容
 * - 显示报告元数据(类型、生成时间、会话ID)
 * - 支持分享报告内容
 * - 支持查看关联批次详情
 * - 展示分析统计信息
 *
 * @version 1.0.0
 * @since 2025-11-05
 */
export default function AIAnalysisDetailScreen() {
  const { t } = useTranslation('processing');
  const navigation = useNavigation<AIAnalysisDetailScreenProps['navigation']>();
  const route = useRoute<AIAnalysisDetailScreenProps['route']>();
  const { user } = useAuthStore();
  const factoryId = getFactoryId(user);

  const { reportId, reportType, title } = route.params;

  /**
   * 从Markdown内容提取干净的标题
   */
  const extractCleanTitle = (rawTitle: string | undefined): string => {
    const getDefaultTitle = (type: string): string => {
      const titleKeys: Record<string, string> = {
        batch: 'aiAnalysisDetail.defaultTitles.batch',
        weekly: 'aiAnalysisDetail.defaultTitles.weekly',
        monthly: 'aiAnalysisDetail.defaultTitles.monthly',
        custom: 'aiAnalysisDetail.defaultTitles.custom',
      };
      return t(titleKeys[type] || 'aiAnalysisDetail.defaultTitles.default');
    };

    if (!rawTitle) {
      return getDefaultTitle(reportType);
    }

    // 移除 Markdown 标记
    let cleanTitle = rawTitle
      .replace(/^#+\s*/gm, '')           // 移除 ### 标题标记
      .replace(/\*\*([^*]+)\*\*/g, '$1') // 移除粗体标记
      .replace(/\*([^*]+)\*/g, '$1')     // 移除斜体标记
      .replace(/>\s*/g, '')              // 移除引用标记
      .replace(/[🎯📊💡🔴🔍📈✅❌⚠️🔧📋]/g, '') // 移除常用emoji
      .trim();

    // 提取第一行有意义的内容
    const lines = cleanTitle.split('\n').filter(line => line.trim().length > 0);
    if (lines.length > 0 && lines[0]) {
      cleanTitle = lines[0].trim();
    }

    // 如果标题太长，截断
    if (cleanTitle.length > 25) {
      cleanTitle = cleanTitle.substring(0, 25) + '...';
    }

    // 如果标题为空或无意义，返回默认
    if (!cleanTitle || cleanTitle.length < 2) {
      return getDefaultTitle(reportType);
    }

    return cleanTitle;
  };

  // 计算清理后的标题
  const cleanedTitle = extractCleanTitle(title);

  // 状态管理
  const [report, setReport] = useState<AICostAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);

  // 页面加载时获取报告详情
  useEffect(() => {
    fetchReportDetail();
  }, [reportId]);

  /**
   * 获取报告详情
   */
  const fetchReportDetail = async () => {
    try {
      setLoading(true);

      const factoryId = user?.factoryUser?.factoryId;
      if (!factoryId) {
        Alert.alert(t('common.error') || 'Error', t('aiAnalysisDetail.userInfoIncomplete'));
        return;
      }

      aiAnalysisLogger.debug('获取AI报表详情', { reportId, reportType, factoryId });

      const response = await aiApiClient.getReportDetail(reportId, factoryId);

      if (response) {
        aiAnalysisLogger.info('AI报表详情加载成功', {
          reportId,
          reportType,
          hasAnalysis: !!response.analysis,
          hasSessionId: !!response.session_id,
          messageCount: response.messageCount,
        });
        setReport(response);
      }
    } catch (error) {
      aiAnalysisLogger.error('获取AI报表详情失败', error as Error, {
        reportId,
        reportType,
        factoryId: factoryId,
        errorStatus: (error as any).response?.status,
      });
      Alert.alert(t('aiAnalysisDetail.loadFailed'), getErrorMsg(error) || t('aiAnalysisDetail.messages.retryMessage'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * 分享报告
   */
  const handleShareReport = async () => {
    try {
      if (!report) return;

      const shareContent = `
${t('aiAnalysisDetail.shareTemplate.header')}

${t('aiAnalysisDetail.shareTemplate.reportTitle', { title })}
${t('aiAnalysisDetail.shareTemplate.reportType', { type: getReportTypeLabel(reportType) })}
${t('aiAnalysisDetail.shareTemplate.generatedAt', { time: report.generatedAt ? new Date(report.generatedAt).toLocaleString() : t('aiAnalysisDetail.unknown') })}

${t('aiAnalysisDetail.shareTemplate.analysisContent')}
${report.analysis}

---
${t('aiAnalysisDetail.shareTemplate.sessionId', { id: report.session_id || 'N/A' })}
${report.expiresAt ? t('aiAnalysisDetail.shareTemplate.expiresAt', { time: new Date(report.expiresAt).toLocaleString() }) : ''}
`;

      await Share.share({
        message: shareContent,
        title: t('aiAnalysisDetail.shareTitle'),
      });

      aiAnalysisLogger.info('AI报表已分享', { reportId, reportType });
      setMenuVisible(false);
    } catch (error) {
      aiAnalysisLogger.error('分享AI报表失败', error as Error, { reportId, reportType });
    }
  };

  /**
   * 获取报告类型标签
   */
  const getReportTypeLabel = (type: string) => {
    const typeKeys: Record<string, string> = {
      batch: 'aiAnalysisDetail.reportType.batch',
      weekly: 'aiAnalysisDetail.reportType.weekly',
      monthly: 'aiAnalysisDetail.reportType.monthly',
      custom: 'aiAnalysisDetail.reportType.custom',
    };
    return t(typeKeys[type] || type);
  };

  /**
   * 获取报告类型配置
   */
  const getReportTypeChip = (type: string) => {
    const typeConfig: Record<string, { labelKey: string; icon: string; color: string }> = {
      batch: { labelKey: 'aiAnalysisDetail.reportType.batch', icon: 'package-variant', color: '#2196F3' },
      weekly: { labelKey: 'aiAnalysisDetail.reportType.weekly', icon: 'calendar-week', color: '#4CAF50' },
      monthly: { labelKey: 'aiAnalysisDetail.reportType.monthly', icon: 'calendar-month', color: '#FF9800' },
      custom: { labelKey: 'aiAnalysisDetail.reportType.custom', icon: 'tune', color: '#9C27B0' },
    };

    const config = typeConfig[type] || typeConfig.custom;

    return (
      <Chip
        icon={config.icon}
        mode="flat"
        style={[styles.typeChip, { backgroundColor: config.color }]}
        textStyle={{ color: '#FFFFFF' }}
      >
        {t(config.labelKey)}
      </Chip>
    );
  };

  /**
   * 格式化时间
   */
  const formatDateTime = (dateString?: string) => {
    if (!dateString) return t('aiAnalysisDetail.unknown');
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <View style={styles.container}>
      {/* 顶部导航栏 */}
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={cleanedTitle} />
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <Appbar.Action
              icon="dots-vertical"
              onPress={() => setMenuVisible(true)}
            />
          }
        >
          <Menu.Item
            onPress={handleShareReport}
            title={t('aiAnalysisDetail.shareReport')}
            leadingIcon="share-variant"
          />
        </Menu>
      </Appbar.Header>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text variant="bodyMedium" style={styles.loadingText}>{t('aiAnalysisDetail.loading')}</Text>
        </View>
      ) : report ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* 报告元数据卡片 */}
          <Card style={styles.metadataCard} mode="elevated">
            <Card.Content>
              <View style={styles.metadataHeader}>
                <Text variant="titleLarge" style={styles.reportTitle} numberOfLines={2}>
                  {cleanedTitle}
                </Text>
                {getReportTypeChip(reportType)}
              </View>

              <Divider style={styles.divider} />

              <View style={styles.metadataGrid}>
                {/* 生成时间 */}
                {report.generatedAt && (
                  <View style={styles.metadataItem}>
                    <Text variant="bodySmall" style={styles.metadataLabel}>{t('aiAnalysisDetail.generatedAt')}</Text>
                    <Text variant="bodyMedium" style={styles.metadataValue}>
                      {formatDateTime(report.generatedAt)}
                    </Text>
                  </View>
                )}

                {/* 过期时间 */}
                {report.expiresAt && (
                  <View style={styles.metadataItem}>
                    <Text variant="bodySmall" style={styles.metadataLabel}>{t('aiAnalysisDetail.expiresAt')}</Text>
                    <Text variant="bodyMedium" style={styles.metadataValue}>
                      {formatDateTime(report.expiresAt)}
                    </Text>
                  </View>
                )}

                {/* 会话ID */}
                {report.session_id && (
                  <View style={styles.metadataItem}>
                    <Text variant="bodySmall" style={styles.metadataLabel}>{t('aiAnalysisDetail.sessionId')}</Text>
                    <Text variant="bodyMedium" style={styles.metadataValue} numberOfLines={1}>
                      {report.session_id}
                    </Text>
                  </View>
                )}

                {/* 消息数量 */}
                {report.messageCount !== undefined && (
                  <View style={styles.metadataItem}>
                    <Text variant="bodySmall" style={styles.metadataLabel}>{t('aiAnalysisDetail.messageCount')}</Text>
                    <Text variant="bodyMedium" style={styles.metadataValue}>
                      {report.messageCount} {t('aiAnalysisDetail.messages')}
                    </Text>
                  </View>
                )}
              </View>

              {/* 性能信息 */}
              {(report.cacheHit !== undefined || report.responseTimeMs !== undefined) && (
                <>
                  <Divider style={styles.divider} />
                  <View style={styles.performanceRow}>
                    {report.cacheHit !== undefined && (
                      <Chip
                        icon={report.cacheHit ? 'flash' : 'flash-off'}
                        mode="outlined"
                        compact
                        style={styles.performanceChip}
                      >
                        {report.cacheHit ? t('aiAnalysisDetail.cacheHit') : t('aiAnalysisDetail.realTimeGenerated')}
                      </Chip>
                    )}
                    {report.responseTimeMs !== undefined && (
                      <Chip
                        icon="timer-outline"
                        mode="outlined"
                        compact
                        style={styles.performanceChip}
                      >
                        {report.responseTimeMs}ms
                      </Chip>
                    )}
                  </View>
                </>
              )}
            </Card.Content>
          </Card>

          {/* 分析内容卡片 */}
          <Card style={styles.contentCard} mode="elevated">
            <Card.Content>
              <View style={styles.contentHeader}>
                <Text variant="titleMedium" style={styles.sectionTitle}>{t('aiAnalysisDetail.analysisContent')}</Text>
                <IconButton
                  icon="content-copy"
                  size={20}
                  onPress={async () => {
                    try {
                      if (report?.analysis) {
                        await Clipboard.setStringAsync(report.analysis);
                        Alert.alert(t('common.hint') || 'Hint', t('aiAnalysisDetail.copySuccess'));
                      }
                    } catch (error) {
                      aiAnalysisLogger.error('复制AI分析内容失败', error as Error, { reportId });
                      Alert.alert(t('common.error') || 'Error', t('aiAnalysisDetail.copyFailed'));
                    }
                  }}
                />
              </View>

              <Divider style={styles.divider} />

              {/* 使用 Markdown 渲染器显示 AI 分析结果 */}
              {/* 优先使用 analysis，如果为空则使用 title（title 可能包含完整分析内容）*/}
              <MarkdownRenderer content={report.analysis || title || ''} />
            </Card.Content>
          </Card>

          {/* 错误信息 */}
          {report.errorMessage && (
            <Card style={styles.errorCard} mode="elevated">
              <Card.Content>
                <View style={styles.errorHeader}>
                  <Text variant="titleMedium" style={styles.errorTitle}>{t('aiAnalysisDetail.errorInfo')}</Text>
                </View>
                <Text variant="bodyMedium" style={styles.errorText}>
                  {report.errorMessage}
                </Text>
              </Card.Content>
            </Card>
          )}

          {/* 配额信息 */}
          {report.quota && (
            <Card style={styles.quotaCard} mode="outlined">
              <Card.Content>
                <View style={styles.quotaRow}>
                  <Text variant="bodyMedium" style={styles.quotaLabel}>{t('aiAnalysisDetail.aiQuota')}</Text>
                  <Text variant="bodyMedium" style={styles.quotaValue}>
                    {t('aiAnalysisDetail.quotaUsed', { used: report.quota.usedQuota, limit: report.quota.weeklyQuota })}
                  </Text>
                </View>
                <View style={styles.quotaProgressBar}>
                  <View
                    style={[
                      styles.quotaProgress,
                      {
                        width: `${report.quota.usagePercentage}%`,
                        backgroundColor: report.quota.remainingQuota > 0 ? '#4CAF50' : '#F44336',
                      },
                    ]}
                  />
                </View>
                <Text variant="bodySmall" style={styles.quotaHint}>
                  {t('aiAnalysisDetail.resetTime')}: {report.quota.resetDate}
                </Text>
              </Card.Content>
            </Card>
          )}
        </ScrollView>
      ) : (
        <View style={styles.emptyContainer}>
          <Text variant="titleMedium" style={styles.emptyText}>{t('aiAnalysisDetail.reportNotFound')}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#757575',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80,
  },
  metadataCard: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  metadataHeader: {
    gap: 12,
  },
  reportTitle: {
    fontWeight: '700',
    color: '#212121',
  },
  typeChip: {
    alignSelf: 'flex-start',
  },
  divider: {
    marginVertical: 16,
    backgroundColor: '#E0E0E0',
  },
  metadataGrid: {
    gap: 12,
  },
  metadataItem: {
    gap: 4,
  },
  metadataLabel: {
    color: '#757575',
    fontWeight: '500',
  },
  metadataValue: {
    color: '#424242',
  },
  performanceRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  performanceChip: {
    marginRight: 0,
  },
  contentCard: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  contentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontWeight: '700',
    color: '#212121',
  },
  analysisText: {
    color: '#424242',
    lineHeight: 24,
  },
  errorCard: {
    marginBottom: 16,
    backgroundColor: '#FFEBEE',
  },
  errorHeader: {
    marginBottom: 12,
  },
  errorTitle: {
    fontWeight: '700',
    color: '#C62828',
  },
  errorText: {
    color: '#D32F2F',
    lineHeight: 20,
  },
  quotaCard: {
    marginBottom: 16,
    backgroundColor: '#F5F5F5',
  },
  quotaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  quotaLabel: {
    color: '#424242',
    fontWeight: '600',
  },
  quotaValue: {
    color: '#2196F3',
    fontWeight: '600',
  },
  quotaProgressBar: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    marginBottom: 8,
    overflow: 'hidden',
  },
  quotaProgress: {
    height: '100%',
    borderRadius: 3,
  },
  quotaHint: {
    color: '#757575',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    color: '#9E9E9E',
    textAlign: 'center',
  },
});
