/**
 * 质检表单页面
 * Quality Inspector - Inspection Form Screen
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  QI_COLORS,
  QualityInspectorStackParamList,
  QIBatch,
  ScoreItem,
  QualityGrade,
  GRADE_COLORS,
  GRADE_LABELS,
  calculateGrade,
  calculateTotalScore,
  isPassed,
} from '../../types/qualityInspector';
import { qualityInspectorApi } from '../../services/api/qualityInspectorApi';

type NavigationProp = NativeStackNavigationProp<QualityInspectorStackParamList>;
type RouteProps = RouteProp<QualityInspectorStackParamList, 'QIForm'>;

interface CheckItem {
  id: string;
  name: string;
  maxScore: number;
  options: string[];
  color: string;
}

const CHECK_ITEMS: CheckItem[] = [
  {
    id: 'appearance',
    name: '外观',
    maxScore: 20,
    options: ['色泽正常', '形态完整', '有瑕疵'],
    color: '#4CAF50',
  },
  {
    id: 'smell',
    name: '气味',
    maxScore: 20,
    options: ['正常', '轻微异味', '明显异味'],
    color: '#2196F3',
  },
  {
    id: 'specification',
    name: '规格',
    maxScore: 20,
    options: ['符合标准尺寸', '尺寸偏小', '尺寸偏大'],
    color: '#9C27B0',
  },
  {
    id: 'weight',
    name: '重量',
    maxScore: 20,
    options: ['符合标准', '偏轻', '偏重'],
    color: '#FF9800',
  },
  {
    id: 'packaging',
    name: '包装',
    maxScore: 20,
    options: ['包装完整', '标签清晰', '有破损'],
    color: '#F44336',
  },
];

export default function QIFormScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();
  const { batchId, batchNumber } = route.params;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [batch, setBatch] = useState<QIBatch | null>(null);
  const [sampleSize, setSampleSize] = useState('10');
  const [remarks, setRemarks] = useState('');

  // 评分数据
  const [scores, setScores] = useState<Record<string, ScoreItem>>({
    appearance: { score: 18, notes: ['色泽正常', '形态完整'] },
    smell: { score: 20, notes: ['正常'] },
    specification: { score: 16, notes: ['符合标准尺寸'] },
    weight: { score: 19, notes: ['符合标准'] },
    packaging: { score: 20, notes: ['包装完整', '标签清晰'] },
  });

  // 照片
  const [photos, setPhotos] = useState<string[]>([]);

  useEffect(() => {
    loadBatchDetail();
  }, [batchId]);

  const loadBatchDetail = async () => {
    try {
      setLoading(true);
      const data = await qualityInspectorApi.getBatchDetail(batchId);
      setBatch(data);
    } catch (error) {
      console.error('加载批次失败:', error);
      Alert.alert('错误', '无法加载批次信息');
    } finally {
      setLoading(false);
    }
  };

  const updateScore = (itemId: string, score: number) => {
    setScores(prev => {
      const current = prev[itemId] ?? { score: 0, notes: [] };
      return {
        ...prev,
        [itemId]: { ...current, score: Math.min(20, Math.max(0, score)) },
      };
    });
  };

  const toggleNote = (itemId: string, note: string) => {
    setScores(prev => {
      const current = prev[itemId] ?? { score: 0, notes: [] };
      const notes = current.notes.includes(note)
        ? current.notes.filter(n => n !== note)
        : [...current.notes, note];
      return {
        ...prev,
        [itemId]: { ...current, notes },
      };
    });
  };

  const totalScore = calculateTotalScore({
    appearance: scores.appearance,
    smell: scores.smell,
    specification: scores.specification,
    weight: scores.weight,
    packaging: scores.packaging,
  });

  const grade = calculateGrade(totalScore);
  const passed = isPassed(grade);

  const handleVoicePress = () => {
    navigation.navigate('QIVoice', { batchId, batchNumber });
  };

  const handleCameraPress = (itemId: string) => {
    navigation.navigate('QICamera', { batchId, batchNumber });
  };

  const handleSubmit = async () => {
    if (!batch) return;

    try {
      setSubmitting(true);

      const defaultScore: ScoreItem = { score: 0, notes: [] };
      const formData = {
        batchId: batch.id,
        sampleSize: parseInt(sampleSize, 10) || 10,
        appearance: scores.appearance ?? defaultScore,
        smell: scores.smell ?? defaultScore,
        specification: scores.specification ?? defaultScore,
        weight: scores.weight ?? defaultScore,
        packaging: scores.packaging ?? defaultScore,
        totalScore,
        grade,
        passed,
        photos,
        inspectorId: 0, // 由后端从 token 获取
        inspectedAt: new Date().toISOString(),
        remarks: remarks || undefined,
      };

      const record = await qualityInspectorApi.submitInspection(batch.id, formData);

      navigation.replace('QIResult', {
        recordId: record.id,
        passed,
      });
    } catch (error) {
      console.error('提交失败:', error);
      Alert.alert('提交失败', '请检查网络连接后重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={QI_COLORS.primary} />
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* 语音助手悬浮按钮 */}
      <TouchableOpacity style={styles.voiceFab} onPress={handleVoicePress}>
        <Ionicons name="mic" size={20} color="#fff" />
        <Text style={styles.voiceFabText}>AI语音</Text>
      </TouchableOpacity>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* 批次信息 */}
        <View style={styles.batchCard}>
          <Text style={styles.batchNumber}>{batchNumber}</Text>
          <Text style={styles.batchInfo}>
            {batch?.productName} | 来源: {batch?.sourceProcess || '未知'} | 数量: {batch?.quantity}{batch?.unit}
          </Text>
        </View>

        {/* 抽样设置 */}
        <View style={styles.sampleSection}>
          <View style={styles.sampleHeader}>
            <Ionicons name="book" size={18} color={QI_COLORS.primary} />
            <Text style={styles.sampleTitle}>抽样检验</Text>
          </View>
          <View style={styles.sampleInputRow}>
            <Text style={styles.sampleLabel}>抽样数量:</Text>
            <TextInput
              style={styles.sampleInput}
              value={sampleSize}
              onChangeText={setSampleSize}
              keyboardType="number-pad"
              maxLength={4}
            />
            <Text style={styles.sampleUnit}>件</Text>
          </View>
        </View>

        {/* HACCP检查清单 */}
        <View style={styles.checkSection}>
          <View style={styles.checkHeader}>
            <Ionicons name="checkmark-circle" size={18} color={QI_COLORS.text} />
            <Text style={styles.checkTitle}>HACCP检查清单</Text>
          </View>

          {CHECK_ITEMS.map((item, index) => (
            <View key={item.id} style={styles.checkCard}>
              <View style={styles.checkCardHeader}>
                <View style={styles.checkCardTitle}>
                  <View style={[styles.checkNumber, { backgroundColor: item.color }]}>
                    <Text style={styles.checkNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.checkName}>{item.name} (0-{item.maxScore}分)</Text>
                </View>
                <Text style={styles.checkMax}>满分 {item.maxScore}</Text>
              </View>

              {/* 选项 */}
              <View style={styles.checkOptions}>
                {item.options.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.checkOption,
                      scores[item.id]?.notes.includes(option) && styles.checkOptionSelected,
                    ]}
                    onPress={() => toggleNote(item.id, option)}
                  >
                    <Ionicons
                      name={scores[item.id]?.notes.includes(option) ? 'checkbox' : 'square-outline'}
                      size={18}
                      color={scores[item.id]?.notes.includes(option) ? QI_COLORS.primary : QI_COLORS.textSecondary}
                    />
                    <Text
                      style={[
                        styles.checkOptionText,
                        scores[item.id]?.notes.includes(option) && styles.checkOptionTextSelected,
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* 评分 */}
              <View style={styles.scoreRow}>
                <Text style={styles.scoreLabel}>评分:</Text>
                <TextInput
                  style={styles.scoreInput}
                  value={String(scores[item.id]?.score ?? 0)}
                  onChangeText={(text) => updateScore(item.id, parseInt(text, 10) || 0)}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <Text style={styles.scoreMax}>/ {item.maxScore}</Text>
                {(item.id === 'appearance' || item.id === 'packaging') && (
                  <TouchableOpacity
                    style={styles.cameraBtn}
                    onPress={() => handleCameraPress(item.id)}
                  >
                    <Ionicons name="camera" size={14} color={QI_COLORS.primary} />
                    <Text style={styles.cameraBtnText}>拍照</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* 检验汇总 */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Ionicons name="bar-chart" size={18} color={QI_COLORS.primary} />
            <Text style={styles.summaryTitle}>检验汇总</Text>
          </View>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>总分</Text>
              <Text style={styles.summaryValue}>{totalScore}/100</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>合格数</Text>
              <Text style={[styles.summaryValue, { color: QI_COLORS.success }]}>
                {parseInt(sampleSize, 10) - 1}/{sampleSize}件
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>合格率</Text>
              <Text style={[styles.summaryValue, { color: QI_COLORS.success }]}>
                {Math.round(((parseInt(sampleSize, 10) - 1) / parseInt(sampleSize, 10)) * 100)}%
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>建议等级</Text>
              <View style={[styles.gradeBadge, { backgroundColor: GRADE_COLORS[grade] }]}>
                <Text style={styles.gradeBadgeText}>{grade}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 检验备注 */}
        <View style={styles.remarksSection}>
          <Text style={styles.remarksLabel}>检验备注 (可选)</Text>
          <TextInput
            style={styles.remarksInput}
            value={remarks}
            onChangeText={setRemarks}
            placeholder="输入备注信息..."
            placeholderTextColor={QI_COLORS.disabled}
            multiline
            numberOfLines={3}
          />
        </View>
      </ScrollView>

      {/* 底部操作栏 */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={styles.submitBtnText}>提交检验结果</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

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
    marginTop: 12,
    color: QI_COLORS.textSecondary,
    fontSize: 14,
  },

  // 语音悬浮按钮
  voiceFab: {
    position: 'absolute',
    top: 12,
    right: 16,
    backgroundColor: QI_COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  voiceFabText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },

  // 批次信息
  batchCard: {
    backgroundColor: QI_COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: QI_COLORS.primary,
  },
  batchNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: QI_COLORS.text,
    marginBottom: 6,
  },
  batchInfo: {
    fontSize: 14,
    color: QI_COLORS.textSecondary,
  },

  // 抽样设置
  sampleSection: {
    backgroundColor: QI_COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sampleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sampleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: QI_COLORS.text,
  },
  sampleInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sampleLabel: {
    fontSize: 14,
    color: QI_COLORS.textSecondary,
    marginRight: 12,
  },
  sampleInput: {
    width: 60,
    height: 40,
    borderWidth: 1,
    borderColor: QI_COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    textAlign: 'center',
    color: QI_COLORS.text,
    backgroundColor: QI_COLORS.background,
  },
  sampleUnit: {
    fontSize: 14,
    color: QI_COLORS.textSecondary,
    marginLeft: 8,
  },

  // 检查清单
  checkSection: {
    marginBottom: 16,
  },
  checkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  checkTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: QI_COLORS.text,
  },
  checkCard: {
    backgroundColor: QI_COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  checkCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkCardTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkNumberText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  checkName: {
    fontSize: 15,
    fontWeight: '500',
    color: QI_COLORS.text,
  },
  checkMax: {
    fontSize: 12,
    color: QI_COLORS.textSecondary,
  },
  checkOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  checkOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: QI_COLORS.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  checkOptionSelected: {
    backgroundColor: '#E8F5E9',
  },
  checkOptionText: {
    fontSize: 13,
    color: QI_COLORS.textSecondary,
  },
  checkOptionTextSelected: {
    color: QI_COLORS.primary,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: QI_COLORS.border,
  },
  scoreLabel: {
    fontSize: 14,
    color: QI_COLORS.textSecondary,
    marginRight: 8,
  },
  scoreInput: {
    width: 50,
    height: 36,
    borderWidth: 1,
    borderColor: QI_COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    fontSize: 16,
    textAlign: 'center',
    color: QI_COLORS.text,
    backgroundColor: QI_COLORS.background,
  },
  scoreMax: {
    fontSize: 14,
    color: QI_COLORS.textSecondary,
    marginLeft: 4,
    flex: 1,
  },
  cameraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  cameraBtnText: {
    fontSize: 13,
    color: QI_COLORS.primary,
  },

  // 汇总
  summaryCard: {
    backgroundColor: QI_COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: QI_COLORS.text,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  summaryItem: {
    width: '50%',
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 13,
    color: QI_COLORS.textSecondary,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '600',
    color: QI_COLORS.text,
  },
  gradeBadge: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradeBadgeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // 备注
  remarksSection: {
    marginBottom: 16,
  },
  remarksLabel: {
    fontSize: 14,
    color: QI_COLORS.textSecondary,
    marginBottom: 8,
  },
  remarksInput: {
    backgroundColor: QI_COLORS.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: QI_COLORS.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },

  // 底部栏
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: QI_COLORS.card,
    borderTopWidth: 1,
    borderTopColor: QI_COLORS.border,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  submitBtn: {
    backgroundColor: QI_COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
