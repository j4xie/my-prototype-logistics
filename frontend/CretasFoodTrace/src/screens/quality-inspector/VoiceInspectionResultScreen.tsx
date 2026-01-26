/**
 * 语音质检结果页面
 * Voice Inspection Result Screen
 *
 * 功能：
 * - 显示语音识别转写文本
 * - 显示AI分析的质检项提取结果
 * - 显示质检判定结果（合格/不合格）
 * - 播放原始语音录音
 * - 支持人工修正识别结果
 * - 确认并保存质检记录
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Audio } from 'expo-av';

import {
  QI_COLORS,
  QualityInspectorStackParamList,
  GRADE_COLORS,
  GRADE_LABELS,
  QualityGrade,
  calculateGrade,
  isPassed,
} from '../../types/qualityInspector';
import { apiClient } from '../../services/api/apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';

type NavigationProp = NativeStackNavigationProp<QualityInspectorStackParamList>;
type RouteProps = RouteProp<QualityInspectorStackParamList, 'QIVoiceResult'>;

// ============================================
// 类型定义
// ============================================

interface ExtractedCheckItem {
  category: string;          // 检查类别: appearance, smell, specification, weight, packaging
  categoryLabel: string;     // 类别显示名称
  score: number;             // 评分 0-20
  notes: string[];           // 备注
  confidence: number;        // AI 识别置信度 0-1
}

interface VoiceAnalysisResult {
  transcribedText: string;                  // 转写文本
  extractedItems: ExtractedCheckItem[];     // 提取的质检项
  totalScore: number;                       // 总分
  grade: QualityGrade;                      // 等级
  passed: boolean;                          // 是否合格
  suggestions: string[];                    // AI 建议
  processingTime: number;                   // 处理耗时(ms)
}

interface VoiceRecord {
  id: string;
  audioUri?: string;
  audioDuration?: number;
  transcribedText: string;
  analysisResult?: VoiceAnalysisResult;
  status: 'pending' | 'confirmed' | 'rejected';
  createdAt: string;
}

// ============================================
// 常量
// ============================================

const CHECK_CATEGORIES = [
  { key: 'appearance', label: '外观', icon: 'eye-outline' },
  { key: 'smell', label: '气味', icon: 'flower-outline' },
  { key: 'specification', label: '规格', icon: 'resize-outline' },
  { key: 'weight', label: '重量', icon: 'scale-outline' },
  { key: 'packaging', label: '包装', icon: 'cube-outline' },
];

// ============================================
// 组件
// ============================================

export default function VoiceInspectionResultScreen() {
  const { t } = useTranslation('quality');
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();

  const { batchId, batchNumber, recordId, audioUri } = route.params;

  // 状态
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [record, setRecord] = useState<VoiceRecord | null>(null);
  const [editingText, setEditingText] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [extractedItems, setExtractedItems] = useState<ExtractedCheckItem[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);

  // 音频
  const soundRef = useRef<Audio.Sound | null>(null);
  const playbackAnimRef = useRef(new Animated.Value(0)).current;

  // ============================================
  // 生命周期
  // ============================================

  useEffect(() => {
    loadVoiceRecord();

    return () => {
      // 清理音频
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, [recordId]);

  // ============================================
  // API 调用
  // ============================================

  const loadVoiceRecord = async () => {
    try {
      setLoading(true);
      const factoryId = getCurrentFactoryId();

      if (recordId) {
        // 获取已有记录
        const response = await apiClient.get<{ success: boolean; data: VoiceRecord }>(
          `/api/mobile/${factoryId}/voice/records/${recordId}`
        );

        if (response.success && response.data) {
          setRecord(response.data);
          setTranscribedText(response.data.transcribedText);
          if (response.data.analysisResult) {
            setExtractedItems(response.data.analysisResult.extractedItems);
          }
        }
      } else if (audioUri) {
        // 新录音，进行转写和分析
        await transcribeAndAnalyze(audioUri);
      }
    } catch (error) {
      console.error('加载语音记录失败:', error);
      Alert.alert(t('voiceResult.error'), t('voiceResult.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const transcribeAndAnalyze = async (uri: string) => {
    try {
      const factoryId = getCurrentFactoryId();

      // Step 1: 语音转文字
      // 读取音频文件并转为 base64
      const response = await fetch(uri);
      const blob = await response.blob();
      const reader = new FileReader();
      const audioBase64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1] ?? '';
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      // 调用转写 API
      const transcribeResponse = await apiClient.post<{
        success: boolean;
        data: { text: string; sid: string };
      }>(`/api/mobile/${factoryId}/voice/recognize`, {
        audioData: audioBase64,
        format: 'raw',
        encoding: 'raw',
        sampleRate: 16000,
        language: 'zh_cn',
      });

      if (!transcribeResponse.success) {
        throw new Error(t('voiceResult.transcribeFailed'));
      }

      const recognizedText = transcribeResponse.data.text;
      setTranscribedText(recognizedText);

      // Step 2: AI 分析提取质检项
      const analyzeResponse = await apiClient.post<{
        success: boolean;
        data: VoiceAnalysisResult;
      }>(`/api/mobile/${factoryId}/voice/analyze`, {
        text: recognizedText,
        batchId,
        context: 'quality_inspection',
      });

      if (analyzeResponse.success && analyzeResponse.data) {
        setExtractedItems(analyzeResponse.data.extractedItems);
        setRecord({
          id: '',
          audioUri: uri,
          transcribedText: recognizedText,
          analysisResult: analyzeResponse.data,
          status: 'pending',
          createdAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('转写分析失败:', error);
      // 即使分析失败，也允许用户手动输入
      setTranscribedText('');
      setExtractedItems(getDefaultExtractedItems());
    }
  };

  const getDefaultExtractedItems = (): ExtractedCheckItem[] => {
    return CHECK_CATEGORIES.map((cat) => ({
      category: cat.key,
      categoryLabel: cat.label,
      score: 15,
      notes: [],
      confidence: 0,
    }));
  };

  const confirmAndSave = async () => {
    try {
      setSaving(true);
      const factoryId = getCurrentFactoryId();

      // 计算总分和等级
      const totalScore = extractedItems.reduce((sum, item) => sum + item.score, 0);
      const grade = calculateGrade(totalScore);
      const passed = isPassed(grade);

      // 构建提交数据
      const inspectionData = {
        batchId,
        transcribedText,
        extractedItems,
        totalScore,
        grade,
        passed,
        audioUri: record?.audioUri || audioUri,
      };

      if (recordId) {
        // 更新现有记录
        await apiClient.put(`/api/mobile/${factoryId}/voice/records/${recordId}/confirm`, inspectionData);
      } else {
        // 创建新记录
        await apiClient.post(`/api/mobile/${factoryId}/voice/records`, inspectionData);
      }

      // 跳转到结果页
      navigation.replace('QIResult', {
        recordId: recordId || `VR-${Date.now()}`,
        passed,
      });
    } catch (error) {
      console.error('保存失败:', error);
      Alert.alert(t('voiceResult.error'), t('voiceResult.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  // ============================================
  // 音频播放
  // ============================================

  const togglePlayback = async () => {
    const uri = record?.audioUri || audioUri;
    if (!uri) return;

    try {
      if (isPlaying) {
        // 暂停
        if (soundRef.current) {
          await soundRef.current.pauseAsync();
        }
        setIsPlaying(false);
      } else {
        // 播放
        if (!soundRef.current) {
          const { sound } = await Audio.Sound.createAsync(
            { uri },
            { shouldPlay: true },
            onPlaybackStatusUpdate
          );
          soundRef.current = sound;
        } else {
          await soundRef.current.playAsync();
        }
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('播放失败:', error);
      Alert.alert(t('voiceResult.error'), t('voiceResult.playbackFailed'));
    }
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setPlaybackPosition(status.positionMillis || 0);
      setPlaybackDuration(status.durationMillis || 0);

      if (status.didJustFinish) {
        setIsPlaying(false);
        setPlaybackPosition(0);
      }
    }
  };

  // ============================================
  // 编辑功能
  // ============================================

  const updateItemScore = (category: string, score: number) => {
    setExtractedItems((prev) =>
      prev.map((item) =>
        item.category === category ? { ...item, score: Math.max(0, Math.min(20, score)) } : item
      )
    );
  };

  const reAnalyze = async () => {
    if (!transcribedText.trim()) {
      Alert.alert(t('voiceResult.error'), t('voiceResult.noTextToAnalyze'));
      return;
    }

    try {
      setLoading(true);
      const factoryId = getCurrentFactoryId();

      const analyzeResponse = await apiClient.post<{
        success: boolean;
        data: VoiceAnalysisResult;
      }>(`/api/mobile/${factoryId}/voice/analyze`, {
        text: transcribedText,
        batchId,
        context: 'quality_inspection',
      });

      if (analyzeResponse.success && analyzeResponse.data) {
        setExtractedItems(analyzeResponse.data.extractedItems);
        Alert.alert(t('voiceResult.success'), t('voiceResult.reAnalyzeSuccess'));
      }
    } catch (error) {
      console.error('重新分析失败:', error);
      Alert.alert(t('voiceResult.error'), t('voiceResult.reAnalyzeFailed'));
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // 计算
  // ============================================

  const totalScore = extractedItems.reduce((sum, item) => sum + item.score, 0);
  const grade = calculateGrade(totalScore);
  const passed = isPassed(grade);

  // ============================================
  // 渲染
  // ============================================

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={QI_COLORS.primary} />
        <Text style={styles.loadingText}>{t('voiceResult.analyzing')}</Text>
        <Text style={styles.loadingSubtext}>{t('voiceResult.analyzingSubtext')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 批次信息 */}
        <View style={styles.batchHeader}>
          <View style={styles.batchInfo}>
            <Text style={styles.batchLabel}>{t('voiceResult.batch')}</Text>
            <Text style={styles.batchNumber}>{batchNumber}</Text>
          </View>
          <View style={[styles.resultBadge, passed ? styles.badgePass : styles.badgeFail]}>
            <Ionicons
              name={passed ? 'checkmark-circle' : 'close-circle'}
              size={16}
              color="#fff"
            />
            <Text style={styles.resultBadgeText}>
              {passed ? t('voiceResult.qualified') : t('voiceResult.unqualified')}
            </Text>
          </View>
        </View>

        {/* 音频播放器 */}
        {(record?.audioUri || audioUri) && (
          <View style={styles.audioPlayerCard}>
            <View style={styles.audioPlayerHeader}>
              <Ionicons name="mic" size={20} color={QI_COLORS.primary} />
              <Text style={styles.audioPlayerTitle}>{t('voiceResult.originalRecording')}</Text>
            </View>
            <View style={styles.audioPlayerContent}>
              <TouchableOpacity style={styles.playButton} onPress={togglePlayback}>
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={24}
                  color="#fff"
                />
              </TouchableOpacity>
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <Animated.View
                    style={[
                      styles.progressFill,
                      {
                        width: playbackDuration
                          ? `${(playbackPosition / playbackDuration) * 100}%`
                          : '0%',
                      },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {formatTime(playbackPosition)} / {formatTime(playbackDuration)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* 转写文本 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('voiceResult.transcribedText')}</Text>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setEditingText(!editingText)}
            >
              <Ionicons
                name={editingText ? 'checkmark' : 'pencil'}
                size={18}
                color={QI_COLORS.primary}
              />
              <Text style={styles.editButtonText}>
                {editingText ? t('voiceResult.done') : t('voiceResult.edit')}
              </Text>
            </TouchableOpacity>
          </View>
          {editingText ? (
            <TextInput
              style={styles.textInput}
              value={transcribedText}
              onChangeText={setTranscribedText}
              multiline
              textAlignVertical="top"
              placeholder={t('voiceResult.enterText')}
            />
          ) : (
            <View style={styles.textCard}>
              <Text style={styles.transcribedText}>
                {transcribedText || t('voiceResult.noTranscription')}
              </Text>
            </View>
          )}
          {editingText && (
            <TouchableOpacity style={styles.reAnalyzeButton} onPress={reAnalyze}>
              <Ionicons name="refresh" size={16} color={QI_COLORS.primary} />
              <Text style={styles.reAnalyzeText}>{t('voiceResult.reAnalyze')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 质检项提取结果 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('voiceResult.extractedItems')}</Text>
          <View style={styles.itemsGrid}>
            {extractedItems.map((item) => {
              const categoryInfo = CHECK_CATEGORIES.find((c) => c.key === item.category);
              return (
                <View key={item.category} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <Ionicons
                      name={categoryInfo?.icon as any || 'ellipse'}
                      size={18}
                      color={QI_COLORS.primary}
                    />
                    <Text style={styles.itemLabel}>{item.categoryLabel}</Text>
                    {item.confidence > 0 && (
                      <View style={styles.confidenceBadge}>
                        <Text style={styles.confidenceText}>
                          {Math.round(item.confidence * 100)}%
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.scoreRow}>
                    <TouchableOpacity
                      style={styles.scoreAdjustBtn}
                      onPress={() => updateItemScore(item.category, item.score - 1)}
                    >
                      <Ionicons name="remove" size={18} color={QI_COLORS.textSecondary} />
                    </TouchableOpacity>
                    <View style={styles.scoreDisplay}>
                      <Text style={styles.scoreValue}>{item.score}</Text>
                      <Text style={styles.scoreMax}>/20</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.scoreAdjustBtn}
                      onPress={() => updateItemScore(item.category, item.score + 1)}
                    >
                      <Ionicons name="add" size={18} color={QI_COLORS.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  {item.notes.length > 0 && (
                    <View style={styles.notesContainer}>
                      {item.notes.map((note, idx) => (
                        <Text key={idx} style={styles.noteText}>{note}</Text>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* 判定结果汇总 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('voiceResult.judgmentResult')}</Text>
          <View style={[styles.resultCard, passed ? styles.resultCardPass : styles.resultCardFail]}>
            <View style={styles.resultRow}>
              <View style={styles.resultItem}>
                <Text style={styles.resultItemLabel}>{t('voiceResult.totalScore')}</Text>
                <Text style={styles.resultItemValue}>{totalScore}/100</Text>
              </View>
              <View style={styles.resultDivider} />
              <View style={styles.resultItem}>
                <Text style={styles.resultItemLabel}>{t('voiceResult.grade')}</Text>
                <View style={[styles.gradeBadge, { backgroundColor: GRADE_COLORS[grade] }]}>
                  <Text style={styles.gradeText}>{grade}</Text>
                </View>
              </View>
              <View style={styles.resultDivider} />
              <View style={styles.resultItem}>
                <Text style={styles.resultItemLabel}>{t('voiceResult.result')}</Text>
                <Text
                  style={[
                    styles.resultItemValue,
                    { color: passed ? QI_COLORS.success : QI_COLORS.danger },
                  ]}
                >
                  {GRADE_LABELS[grade]}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* AI 建议 */}
        {record?.analysisResult?.suggestions && record.analysisResult.suggestions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('voiceResult.aiSuggestions')}</Text>
            <View style={styles.suggestionsCard}>
              {record.analysisResult.suggestions.map((suggestion, idx) => (
                <View key={idx} style={styles.suggestionItem}>
                  <Ionicons name="bulb-outline" size={16} color={QI_COLORS.warning} />
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* 底部操作栏 */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.cancelButtonText}>{t('voiceResult.cancel')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.confirmButton, saving && styles.buttonDisabled]}
          onPress={confirmAndSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.confirmButtonText}>{t('voiceResult.confirmSave')}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============================================
// 工具函数
// ============================================

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// ============================================
// 样式
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: QI_COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: QI_COLORS.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: QI_COLORS.text,
    fontWeight: '500',
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: QI_COLORS.textSecondary,
  },

  // 批次信息
  batchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: QI_COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  batchInfo: {
    flex: 1,
  },
  batchLabel: {
    fontSize: 13,
    color: QI_COLORS.textSecondary,
    marginBottom: 4,
  },
  batchNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: QI_COLORS.text,
  },
  resultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  badgePass: {
    backgroundColor: QI_COLORS.success,
  },
  badgeFail: {
    backgroundColor: QI_COLORS.danger,
  },
  resultBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },

  // 音频播放器
  audioPlayerCard: {
    backgroundColor: QI_COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  audioPlayerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  audioPlayerTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: QI_COLORS.text,
  },
  audioPlayerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: QI_COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    flex: 1,
  },
  progressBar: {
    height: 4,
    backgroundColor: QI_COLORS.border,
    borderRadius: 2,
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: QI_COLORS.primary,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: QI_COLORS.textSecondary,
  },

  // 区块
  section: {
    marginBottom: 20,
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
    color: QI_COLORS.text,
    marginBottom: 12,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editButtonText: {
    fontSize: 14,
    color: QI_COLORS.primary,
  },

  // 转写文本
  textCard: {
    backgroundColor: QI_COLORS.card,
    borderRadius: 12,
    padding: 16,
  },
  transcribedText: {
    fontSize: 15,
    color: QI_COLORS.text,
    lineHeight: 24,
  },
  textInput: {
    backgroundColor: QI_COLORS.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: QI_COLORS.text,
    lineHeight: 24,
    minHeight: 120,
    borderWidth: 1,
    borderColor: QI_COLORS.primary,
  },
  reAnalyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
  },
  reAnalyzeText: {
    fontSize: 14,
    color: QI_COLORS.primary,
  },

  // 质检项网格
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  itemCard: {
    width: '47%',
    backgroundColor: QI_COLORS.card,
    borderRadius: 12,
    padding: 14,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  itemLabel: {
    flex: 1,
    fontSize: 14,
    color: QI_COLORS.text,
    fontWeight: '500',
  },
  confidenceBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: 10,
    color: QI_COLORS.secondary,
    fontWeight: '500',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scoreAdjustBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: QI_COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: '700',
    color: QI_COLORS.text,
  },
  scoreMax: {
    fontSize: 14,
    color: QI_COLORS.textSecondary,
    marginLeft: 2,
  },
  notesContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: QI_COLORS.border,
  },
  noteText: {
    fontSize: 12,
    color: QI_COLORS.textSecondary,
    lineHeight: 18,
  },

  // 判定结果
  resultCard: {
    borderRadius: 12,
    padding: 16,
  },
  resultCardPass: {
    backgroundColor: '#E8F5E9',
  },
  resultCardFail: {
    backgroundColor: '#FFEBEE',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultItem: {
    flex: 1,
    alignItems: 'center',
  },
  resultItemLabel: {
    fontSize: 13,
    color: QI_COLORS.textSecondary,
    marginBottom: 6,
  },
  resultItemValue: {
    fontSize: 18,
    fontWeight: '600',
    color: QI_COLORS.text,
  },
  resultDivider: {
    width: 1,
    height: 40,
    backgroundColor: QI_COLORS.border,
    marginHorizontal: 8,
  },
  gradeBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },

  // AI 建议
  suggestionsCard: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 16,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    color: QI_COLORS.text,
    lineHeight: 20,
  },

  // 底部栏
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: QI_COLORS.card,
    borderTopWidth: 1,
    borderTopColor: QI_COLORS.border,
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: QI_COLORS.background,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    color: QI_COLORS.text,
    fontWeight: '500',
  },
  confirmButton: {
    flex: 2,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: QI_COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 6,
  },
  confirmButtonText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
