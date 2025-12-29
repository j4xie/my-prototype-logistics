/**
 * 检验记录详情页面
 * Quality Inspector - Record Detail Screen
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  QI_COLORS,
  QualityInspectorStackParamList,
  QualityRecord,
  GRADE_COLORS,
  GRADE_LABELS,
  formatDateTime,
} from '../../types/qualityInspector';
import { qualityInspectorApi } from '../../services/api/qualityInspectorApi';

type NavigationProp = NativeStackNavigationProp<QualityInspectorStackParamList>;
type RouteProps = RouteProp<QualityInspectorStackParamList, 'QIRecordDetail'>;

const SCORE_ITEMS = [
  { key: 'appearance', label: '外观', icon: 'eye-outline' },
  { key: 'smell', label: '气味', icon: 'flower-outline' },
  { key: 'specification', label: '规格', icon: 'resize-outline' },
  { key: 'weight', label: '重量', icon: 'scale-outline' },
  { key: 'packaging', label: '包装', icon: 'cube-outline' },
];

export default function QIRecordDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();
  const { recordId } = route.params;

  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<QualityRecord | null>(null);

  useEffect(() => {
    loadRecord();
  }, [recordId]);

  const loadRecord = async () => {
    try {
      setLoading(true);
      const data = await qualityInspectorApi.getRecordDetail(recordId);
      setRecord(data);
    } catch (error) {
      console.error('加载记录失败:', error);
      Alert.alert('错误', '无法加载记录详情');
    } finally {
      setLoading(false);
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

  if (!record) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={QI_COLORS.disabled} />
        <Text style={styles.errorText}>记录不存在</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
    >
      {/* 结果头部 */}
      <View style={[styles.resultHeader, record.passed ? styles.headerPass : styles.headerFail]}>
        <View style={[styles.gradeBadge, { backgroundColor: GRADE_COLORS[record.grade] }]}>
          <Text style={styles.gradeText}>{record.grade}</Text>
        </View>
        <View style={styles.resultInfo}>
          <Text style={styles.resultLabel}>{GRADE_LABELS[record.grade]}</Text>
          <Text style={styles.resultScore}>{record.totalScore}/100分</Text>
        </View>
        <View style={[styles.statusTag, record.passed ? styles.tagPass : styles.tagFail]}>
          <Ionicons
            name={record.passed ? 'checkmark-circle' : 'close-circle'}
            size={16}
            color="#fff"
          />
          <Text style={styles.statusTagText}>{record.passed ? '合格' : '不合格'}</Text>
        </View>
      </View>

      {/* 批次信息 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>批次信息</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>批次编号</Text>
            <Text style={styles.infoValue}>{record.batchNumber}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>产品名称</Text>
            <Text style={styles.infoValue}>{record.productName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>抽样数量</Text>
            <Text style={styles.infoValue}>{record.sampleSize} 件</Text>
          </View>
        </View>
      </View>

      {/* 评分详情 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>评分详情</Text>
        <View style={styles.scoreGrid}>
          {SCORE_ITEMS.map((item) => {
            const scoreData = record[item.key as keyof QualityRecord] as { score: number; notes: string[] } | undefined;
            const score = scoreData?.score ?? 0;
            const notes = scoreData?.notes ?? [];

            return (
              <View key={item.key} style={styles.scoreCard}>
                <View style={styles.scoreHeader}>
                  <Ionicons name={item.icon as any} size={20} color={QI_COLORS.primary} />
                  <Text style={styles.scoreLabel}>{item.label}</Text>
                </View>
                <Text style={styles.scoreValue}>{score}<Text style={styles.scoreMax}>/20</Text></Text>
                {notes.length > 0 && (
                  <View style={styles.notesTags}>
                    {notes.slice(0, 2).map((note, index) => (
                      <Text key={index} style={styles.noteTag}>{note}</Text>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* 照片证据 */}
      {record.photos && record.photos.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>照片证据</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {record.photos.map((photo, index) => (
              <TouchableOpacity key={index} style={styles.photoItem}>
                <Image source={{ uri: photo }} style={styles.photoImage} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* 检验信息 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>检验信息</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>检验员</Text>
            <Text style={styles.infoValue}>{record.inspector.name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>检验时间</Text>
            <Text style={styles.infoValue}>{formatDateTime(record.inspectedAt)}</Text>
          </View>
          {record.reviewedBy && (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>审核人</Text>
                <Text style={styles.infoValue}>{record.reviewedBy.name}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>审核时间</Text>
                <Text style={styles.infoValue}>
                  {record.reviewedAt ? formatDateTime(record.reviewedAt) : '-'}
                </Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* 备注 */}
      {record.remarks && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>检验备注</Text>
          <View style={styles.remarksCard}>
            <Text style={styles.remarksText}>{record.remarks}</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: QI_COLORS.background,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: QI_COLORS.background,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: QI_COLORS.textSecondary,
  },

  // 结果头部
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  headerPass: {
    backgroundColor: '#E8F5E9',
  },
  headerFail: {
    backgroundColor: '#FFEBEE',
  },
  gradeBadge: {
    width: 56,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  gradeText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  resultInfo: {
    flex: 1,
  },
  resultLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: QI_COLORS.text,
    marginBottom: 4,
  },
  resultScore: {
    fontSize: 14,
    color: QI_COLORS.textSecondary,
  },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  tagPass: {
    backgroundColor: QI_COLORS.success,
  },
  tagFail: {
    backgroundColor: QI_COLORS.danger,
  },
  statusTagText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },

  // 区块
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: QI_COLORS.text,
    marginBottom: 12,
  },

  // 信息卡片
  infoCard: {
    backgroundColor: QI_COLORS.card,
    borderRadius: 12,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: QI_COLORS.border,
  },
  infoLabel: {
    fontSize: 14,
    color: QI_COLORS.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    color: QI_COLORS.text,
    fontWeight: '500',
  },

  // 评分详情
  scoreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  scoreCard: {
    width: '47%',
    backgroundColor: QI_COLORS.card,
    borderRadius: 12,
    padding: 14,
  },
  scoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  scoreLabel: {
    fontSize: 14,
    color: QI_COLORS.text,
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: '700',
    color: QI_COLORS.text,
  },
  scoreMax: {
    fontSize: 14,
    fontWeight: '400',
    color: QI_COLORS.textSecondary,
  },
  notesTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 8,
  },
  noteTag: {
    fontSize: 11,
    color: QI_COLORS.primary,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },

  // 照片
  photoItem: {
    marginRight: 12,
  },
  photoImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },

  // 备注
  remarksCard: {
    backgroundColor: QI_COLORS.card,
    borderRadius: 12,
    padding: 16,
  },
  remarksText: {
    fontSize: 14,
    color: QI_COLORS.text,
    lineHeight: 22,
  },
});
