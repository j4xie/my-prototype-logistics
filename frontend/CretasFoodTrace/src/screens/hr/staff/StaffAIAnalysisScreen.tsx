/**
 * 员工AI分析
 *
 * 功能:
 * - AI 智能分析员工表现
 * - 效率/质量/考勤评估
 * - 改进建议
 *
 * 对应原型: /docs/prd/prototype/hr-admin/staff-ai-analysis.html
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Text, Card, ActivityIndicator, Button, ProgressBar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { hrApiClient } from '../../../services/api/hrApiClient';
import { MarkdownRenderer } from '../../../components/common/MarkdownRenderer';
import { HR_THEME, type HRStackParamList } from '../../../types/hrNavigation';

type RouteParams = RouteProp<HRStackParamList, 'StaffAIAnalysis'>;

interface AIAnalysisResult {
  summary: string;
  scores: {
    efficiency: number;
    quality: number;
    attendance: number;
    teamwork: number;
    overall: number;
  };
  strengths: string[];
  improvements: string[];
  suggestions: string;
  analysisDate: string;
  // Alternative fields from API
  recommendations?: string[];
  performanceScore?: number;
  lastUpdated?: string;
}

export default function StaffAIAnalysisScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteParams>();
  const { staffId } = route.params;
  const { t } = useTranslation('hr');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);

  const loadData = useCallback(async () => {
    try {
      // getEmployeeAIAnalysis returns analysis object directly
      const res = await hrApiClient.getEmployeeAIAnalysis(staffId);
      if (res) {
        // Map to AIAnalysisResult format with default values for missing fields
        setAnalysis({
          summary: res.summary || '',
          strengths: res.strengths || [],
          improvements: res.improvements || [],
          suggestions: res.recommendations?.join('\n') || '',
          analysisDate: res.lastUpdated || new Date().toISOString().split('T')[0] || '',
          scores: {
            efficiency: res.performanceScore || 0,
            quality: res.performanceScore || 0,
            attendance: res.performanceScore || 0,
            teamwork: res.performanceScore || 0,
            overall: res.performanceScore || 0,
          },
          recommendations: res.recommendations,
          performanceScore: res.performanceScore,
          lastUpdated: res.lastUpdated,
        });
      }
    } catch (error) {
      console.error('加载AI分析失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [staffId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleReanalyze = async () => {
    setAnalyzing(true);
    try {
      // requestEmployeeAIAnalysis returns {success, message, analysisId}
      const res = await hrApiClient.requestEmployeeAIAnalysis(staffId);
      if (res.success) {
        // Reload data after successful analysis request
        await loadData();
      }
    } catch (error) {
      console.error('重新分析失败:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return HR_THEME.success;
    if (score >= 60) return HR_THEME.warning;
    return HR_THEME.danger;
  };

  const renderScoreItem = (label: string, score: number, icon: string) => (
    <View style={styles.scoreItem}>
      <View style={styles.scoreHeader}>
        <MaterialCommunityIcons name={icon as any} size={20} color={HR_THEME.primary} />
        <Text style={styles.scoreLabel}>{label}</Text>
        <Text style={[styles.scoreValue, { color: getScoreColor(score) }]}>{score}</Text>
      </View>
      <ProgressBar
        progress={score / 100}
        color={getScoreColor(score)}
        style={styles.progressBar}
      />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={HR_THEME.primary} />
        <Text style={styles.loadingText}>{t('staff.ai.loading')}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={HR_THEME.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('staff.ai.title')}</Text>
        <TouchableOpacity onPress={handleReanalyze} style={styles.refreshBtn} disabled={analyzing}>
          <MaterialCommunityIcons
            name="refresh"
            size={24}
            color={analyzing ? HR_THEME.textMuted : HR_THEME.primary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {!analysis ? (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <MaterialCommunityIcons
                name="robot-outline"
                size={64}
                color={HR_THEME.textMuted}
              />
              <Text style={styles.emptyTitle}>{t('staff.ai.noData')}</Text>
              <Text style={styles.emptyText}>{t('staff.ai.startHint')}</Text>
              <Button
                mode="contained"
                onPress={handleReanalyze}
                loading={analyzing}
                disabled={analyzing}
                style={styles.analyzeButton}
                buttonColor={HR_THEME.primary}
                icon="robot"
              >
                {t('staff.ai.startAnalysis')}
              </Button>
            </Card.Content>
          </Card>
        ) : (
          <>
            {/* 综合评分 */}
            <Card style={styles.overallCard}>
              <Card.Content style={styles.overallContent}>
                <View style={styles.overallScore}>
                  <Text style={styles.overallValue}>{analysis.scores.overall}</Text>
                  <Text style={styles.overallLabel}>{t('staff.ai.overallScore')}</Text>
                </View>
                <Text style={styles.analysisDate}>
                  {t('staff.ai.analysisDate')}: {analysis.analysisDate}
                </Text>
              </Card.Content>
            </Card>

            {/* 分项评分 */}
            <Card style={styles.sectionCard}>
              <Card.Content>
                <Text style={styles.sectionTitle}>{t('staff.ai.sections.ability')}</Text>
                {renderScoreItem(t('staff.ai.scores.efficiency'), analysis.scores.efficiency, 'speedometer')}
                {renderScoreItem(t('staff.ai.scores.quality'), analysis.scores.quality, 'check-decagram')}
                {renderScoreItem(t('staff.ai.scores.attendance'), analysis.scores.attendance, 'calendar-check')}
                {renderScoreItem(t('staff.ai.scores.teamwork'), analysis.scores.teamwork, 'account-group')}
              </Card.Content>
            </Card>

            {/* 优势 */}
            <Card style={styles.sectionCard}>
              <Card.Content>
                <View style={styles.listHeader}>
                  <MaterialCommunityIcons name="star" size={20} color={HR_THEME.success} />
                  <Text style={styles.sectionTitle}>{t('staff.ai.sections.strengths')}</Text>
                </View>
                {analysis.strengths.map((item, index) => (
                  <View key={index} style={styles.listItem}>
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={16}
                      color={HR_THEME.success}
                    />
                    <Text style={styles.listText}>{item}</Text>
                  </View>
                ))}
              </Card.Content>
            </Card>

            {/* 待改进 */}
            <Card style={styles.sectionCard}>
              <Card.Content>
                <View style={styles.listHeader}>
                  <MaterialCommunityIcons name="alert-circle" size={20} color={HR_THEME.warning} />
                  <Text style={styles.sectionTitle}>{t('staff.ai.sections.improvements')}</Text>
                </View>
                {analysis.improvements.map((item, index) => (
                  <View key={index} style={styles.listItem}>
                    <MaterialCommunityIcons
                      name="arrow-right-circle"
                      size={16}
                      color={HR_THEME.warning}
                    />
                    <Text style={styles.listText}>{item}</Text>
                  </View>
                ))}
              </Card.Content>
            </Card>

            {/* AI建议 */}
            <Card style={styles.sectionCard}>
              <Card.Content>
                <View style={styles.listHeader}>
                  <MaterialCommunityIcons name="lightbulb" size={20} color={HR_THEME.info} />
                  <Text style={styles.sectionTitle}>{t('staff.ai.sections.suggestions')}</Text>
                </View>
                <MarkdownRenderer content={analysis.suggestions} />
              </Card.Content>
            </Card>
          </>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: HR_THEME.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: HR_THEME.background,
  },
  loadingText: {
    marginTop: 12,
    color: HR_THEME.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: HR_THEME.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: HR_THEME.border,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: HR_THEME.textPrimary,
  },
  refreshBtn: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyCard: {
    borderRadius: 12,
    backgroundColor: HR_THEME.cardBackground,
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: HR_THEME.textPrimary,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: HR_THEME.textSecondary,
    marginTop: 8,
  },
  analyzeButton: {
    marginTop: 24,
    borderRadius: 8,
  },
  overallCard: {
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: HR_THEME.primary,
  },
  overallContent: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  overallScore: {
    alignItems: 'center',
  },
  overallValue: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#fff',
  },
  overallLabel: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  analysisDate: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 16,
  },
  sectionCard: {
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: HR_THEME.cardBackground,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: HR_THEME.textPrimary,
    marginBottom: 16,
    marginLeft: 8,
  },
  scoreItem: {
    marginBottom: 16,
  },
  scoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  scoreLabel: {
    flex: 1,
    fontSize: 14,
    color: HR_THEME.textSecondary,
    marginLeft: 8,
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: HR_THEME.border,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingLeft: 8,
  },
  listText: {
    flex: 1,
    fontSize: 14,
    color: HR_THEME.textPrimary,
    marginLeft: 8,
    lineHeight: 20,
  },
  bottomSpacer: {
    height: 40,
  },
});
