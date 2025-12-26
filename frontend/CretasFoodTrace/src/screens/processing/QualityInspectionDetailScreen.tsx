import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  RefreshControl,
} from 'react-native';
import {
  Text,
  Appbar,
  Divider,
  ActivityIndicator,
  Menu,
} from 'react-native-paper';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ProcessingStackParamList } from '../../types/navigation';
import { qualityInspectionApiClient } from '../../services/api/qualityInspectionApiClient';
import { useAuthStore } from '../../store/authStore';
import { NotImplementedError } from '../../errors';
import { NeoCard, NeoButton, ScreenWrapper, StatusBadge } from '../../components/ui';
import { theme } from '../../theme';
import { handleError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建QualityInspectionDetail专用logger
const qualityDetailLogger = logger.createContextLogger('QualityInspectionDetail');

// Types (unchanged)
type QualityInspectionDetailScreenNavigationProp = NativeStackNavigationProp<
  ProcessingStackParamList,
  'QualityInspectionDetail'
>;
type QualityInspectionDetailScreenRouteProp = RouteProp<
  ProcessingStackParamList,
  'QualityInspectionDetail'
>;

type InspectionType = 'raw_material' | 'process' | 'final_product';
type InspectionConclusion = 'pass' | 'conditional_pass' | 'fail';
type InspectionStatus = 'draft' | 'submitted' | 'reviewed';

interface QualityScore {
  freshness: number;
  appearance: number;
  smell: number;
  other: number;
}

interface QualityPhoto {
  id: string;
  uri: string;
  timestamp: Date;
}

interface QualityInspection {
  id: string;
  batchId: string;
  inspectionType: InspectionType;
  inspector: string;
  inspectionDate: string;
  inspectionTime: string;
  scores?: QualityScore | null;  // API 可能返回 null
  conclusion: InspectionConclusion;
  notes?: string | null;
  photos?: QualityPhoto[] | null;  // API 可能返回 null
  status: InspectionStatus;
  reviewer?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  createdAt: Date;
  updatedAt: Date;
  // 新增计算字段
  qualityGrade?: string | null;  // A, B, C, D 质量等级
  defectRate?: number | null;    // 不合格率
  passRate?: number | null;      // 合格率
}

export default function QualityInspectionDetailScreen() {
  const navigation = useNavigation<QualityInspectionDetailScreenNavigationProp>();
  const route = useRoute<QualityInspectionDetailScreenRouteProp>();
  const { inspectionId } = route.params;
  const { user } = useAuthStore();
  const factoryId = user?.factoryId || user?.factoryUser?.factoryId;

  // Data state
  const [inspection, setInspection] = useState<QualityInspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchInspectionDetail();
    }, [inspectionId])
  );

  const fetchInspectionDetail = async () => {
    setLoading(true);
    try {
      const response = await qualityInspectionApiClient.getInspectionById(inspectionId, factoryId);
      setInspection(response.data ? { ...response.data } as unknown as QualityInspection : null);
    } catch (error) {
      // ✅ GOOD: 不返回假数据，使用统一错误处理
      handleError(error, {
        title: '加载失败',
        customMessage: '无法加载质检详情，请稍后重试',
      });
      setInspection(null); // 不显示假数据
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchInspectionDetail();
    setRefreshing(false);
  };

  // Action Handlers (unchanged logic)
  const handleEdit = () => {
    if (inspection?.status !== 'draft') return;
    throw new NotImplementedError('编辑功能开发中', 'Phase 4');
  };

  const handleDelete = () => {
    if (inspection?.status !== 'draft') return;
    Alert.alert('删除确认', '确定要删除这条质检记录吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
            try {
                await qualityInspectionApiClient.deleteInspection(inspectionId, factoryId);
                qualityDetailLogger.info('质检记录删除成功', { inspectionId, factoryId });
                navigation.goBack();
            } catch (e) {
                qualityDetailLogger.error('删除质检记录失败', e as Error, { inspectionId, factoryId });
            }
        }
      },
    ]);
  };

  const handleApprove = async () => {
      try {
        await qualityInspectionApiClient.updateInspection(inspectionId, {
            conclusion: 'pass',
            reviewer: user?.fullName,
            reviewDate: new Date().toISOString(),
            reviewNotes: '审核通过'
        } as any, factoryId);
        Alert.alert('成功', '已审核通过');
        qualityDetailLogger.info('质检审核通过', { inspectionId, factoryId, reviewer: user?.fullName });
        fetchInspectionDetail();
      } catch (e) {
          qualityDetailLogger.error('质检审核失败', e as Error, { inspectionId, factoryId });
      }
  };

  const handleReject = () => {
     throw new NotImplementedError('拒绝功能开发中', 'Phase 4');
  };

  // Helper functions for UI
  const getStatusVariant = (status: InspectionStatus) => {
    switch (status) {
      case 'draft': return 'default';
      case 'submitted': return 'info';
      case 'reviewed': return 'success';
    }
  };

  const getConclusionVariant = (conclusion: InspectionConclusion) => {
    switch (conclusion) {
      case 'pass': return 'success';
      case 'conditional_pass': return 'warning';
      case 'fail': return 'error';
    }
  };

  const getInspectionTypeLabel = (type: InspectionType) => {
      const map: Record<string, string> = {
          raw_material: '原材料检验',
          process: '过程检验',
          final_product: '成品检验'
      };
      return map[type] || type;
  };

  // 质量等级颜色
  const getQualityGradeColor = (grade: string | null | undefined) => {
    switch (grade) {
      case 'A': return theme.colors.success;
      case 'B': return theme.colors.primary;
      case 'C': return theme.colors.warning;
      case 'D': return theme.colors.error;
      default: return theme.colors.textSecondary;
    }
  };

  const getQualityGradeVariant = (grade: string | null | undefined) => {
    switch (grade) {
      case 'A': return 'success';
      case 'B': return 'info';
      case 'C': return 'warning';
      case 'D': return 'error';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <ScreenWrapper>
        <Appbar.Header elevated style={{ backgroundColor: theme.colors.surface }}>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="质检详情" />
        </Appbar.Header>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </ScreenWrapper>
    );
  }

  if (!inspection) {
      return (
        <ScreenWrapper>
            <Appbar.Header elevated>
                <Appbar.BackAction onPress={() => navigation.goBack()} />
                <Appbar.Content title="质检详情" />
            </Appbar.Header>
            <View style={styles.centerContainer}>
                <Text>未找到记录</Text>
            </View>
        </ScreenWrapper>
      );
  }

  // 安全地计算平均分数，处理 scores 可能为 null/undefined 的情况
  const scores = inspection.scores ?? { freshness: 0, appearance: 0, smell: 0, other: 0 };
  const averageScore = Math.round(
    (scores.freshness + scores.appearance + scores.smell + scores.other) / 4
  );

  return (
    <ScreenWrapper>
      <Appbar.Header elevated style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="质检详情" titleStyle={styles.headerTitle} />
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={<Appbar.Action icon="dots-vertical" onPress={() => setMenuVisible(true)} />}
        >
          {inspection.status === 'draft' && (
            <>
              <Menu.Item onPress={handleEdit} title="编辑" leadingIcon="pencil" />
              <Menu.Item onPress={handleDelete} title="删除" leadingIcon="delete" />
              <Divider />
            </>
          )}
          <Menu.Item onPress={() => Alert.alert('提示', '功能开发中')} title="导出PDF" leadingIcon="file-pdf-box" />
        </Menu>
      </Appbar.Header>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Header Card */}
        <NeoCard style={styles.section}>
          <View style={styles.rowBetween}>
            <View>
              <Text variant="titleLarge" style={styles.idText}>{inspection.id}</Text>
              <Text variant="bodyMedium" style={styles.metaText}>批次: {inspection.batchId}</Text>
            </View>
            <View style={styles.statusColumn}>
              <StatusBadge status={getStatusVariant(inspection.status) === 'default' ? '草稿' : (inspection.status === 'submitted' ? '已提交' : '已审核')} variant={getStatusVariant(inspection.status)} />
              <View style={styles.spacer4} />
              <StatusBadge status={getInspectionTypeLabel(inspection.inspectionType)} variant="default" />
            </View>
          </View>
        </NeoCard>

        {/* Info Card */}
        <NeoCard style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>检验信息</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.label}>检验员</Text>
            <Text style={styles.value}>{inspection.inspector}</Text>
          </View>
          <Divider style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.label}>检验时间</Text>
            <Text style={styles.value}>{inspection.inspectionDate} {inspection.inspectionTime}</Text>
          </View>
        </NeoCard>

        {/* Score Card */}
        <NeoCard style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>质量评分</Text>
          <View style={styles.scoreGrid}>
            {Object.entries(scores).map(([key, value]) => (
              <View key={key} style={styles.scoreItem}>
                <Text style={styles.scoreLabel}>
                   {{freshness: '新鲜度', appearance: '外观', smell: '气味', other: '其他'}[key]}
                </Text>
                <Text style={[styles.scoreValue, { color: value >= 90 ? theme.colors.success : (value >= 70 ? theme.colors.warning : theme.colors.error) }]}>
                  {value}
                </Text>
              </View>
            ))}
          </View>
          <Divider style={styles.divider} />
          <View style={styles.rowBetween}>
            <Text variant="titleMedium">综合评分</Text>
            <Text variant="headlineMedium" style={{ fontWeight: '700', color: theme.colors.primary }}>
              {averageScore}
            </Text>
          </View>
        </NeoCard>

        {/* Conclusion Card */}
        <NeoCard style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>检验结论</Text>
            <View style={styles.rowBetween}>
                <Text style={styles.label}>检验结果</Text>
                <StatusBadge
                    status={{pass: '合格', conditional_pass: '条件合格', fail: '不合格'}[inspection.conclusion]}
                    variant={getConclusionVariant(inspection.conclusion)}
                />
            </View>
            <Divider style={styles.divider} />
            {/* 质量等级显示 */}
            <View style={styles.rowBetween}>
                <Text style={styles.label}>质量等级</Text>
                {inspection.qualityGrade ? (
                  <View style={[styles.gradeBox, { backgroundColor: getQualityGradeColor(inspection.qualityGrade) + '20' }]}>
                    <Text style={[styles.gradeText, { color: getQualityGradeColor(inspection.qualityGrade) }]}>
                      {inspection.qualityGrade}级
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.value}>-</Text>
                )}
            </View>
            <Divider style={styles.divider} />
            {/* 合格率/不合格率显示 */}
            <View style={styles.rateRow}>
                <View style={styles.rateItem}>
                    <Text style={styles.label}>合格率</Text>
                    <Text style={[styles.rateValue, { color: theme.colors.success }]}>
                      {inspection.passRate != null ? `${inspection.passRate}%` : '-'}
                    </Text>
                </View>
                <View style={styles.rateItem}>
                    <Text style={styles.label}>不合格率</Text>
                    <Text style={[styles.rateValue, { color: theme.colors.error }]}>
                      {inspection.defectRate != null ? `${inspection.defectRate}%` : '-'}
                    </Text>
                </View>
            </View>
            {inspection.notes && (
                <View style={styles.noteBox}>
                    <Text style={styles.noteText}>{inspection.notes}</Text>
                </View>
            )}
        </NeoCard>

        {/* Photos */}
        {(inspection.photos?.length ?? 0) > 0 && (
             <NeoCard style={styles.section}>
                <Text variant="titleMedium" style={styles.sectionTitle}>现场照片</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {inspection.photos?.map(photo => (
                        <Image key={photo.id} source={{ uri: photo.uri }} style={styles.photo} />
                    ))}
                </ScrollView>
             </NeoCard>
        )}

        {/* Actions */}
        {inspection.status === 'submitted' && (
            <View style={styles.actionRow}>
                <NeoButton variant="danger" onPress={handleReject} style={styles.flex1}>不通过</NeoButton>
                <View style={styles.spacer16} />
                <NeoButton variant="primary" onPress={handleApprove} style={styles.flex1}>审核通过</NeoButton>
            </View>
        )}
        
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center'
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  headerTitle: {
      fontWeight: '600',
  },
  section: {
    marginBottom: 16,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusColumn: {
      alignItems: 'flex-end',
  },
  idText: {
      fontWeight: '700',
      color: theme.colors.text,
  },
  metaText: {
      color: theme.colors.textSecondary,
      marginTop: 4,
  },
  sectionTitle: {
      marginBottom: 16,
      fontWeight: '600',
      color: theme.colors.text,
  },
  infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 8,
  },
  label: {
      color: theme.colors.textSecondary,
      fontSize: 14,
  },
  value: {
      color: theme.colors.text,
      fontWeight: '500',
      fontSize: 14,
  },
  divider: {
      marginVertical: 12,
  },
  scoreGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
  },
  scoreItem: {
      flex: 1,
      minWidth: '40%',
      backgroundColor: theme.colors.background,
      padding: 12,
      borderRadius: 8,
      alignItems: 'center',
  },
  scoreLabel: {
      color: theme.colors.textSecondary,
      marginBottom: 4,
  },
  scoreValue: {
      fontSize: 24,
      fontWeight: '700',
  },
  noteBox: {
      marginTop: 12,
      backgroundColor: theme.colors.background,
      padding: 12,
      borderRadius: 8,
  },
  noteText: {
      color: theme.colors.text,
      lineHeight: 20,
  },
  photo: {
      width: 120,
      height: 80,
      borderRadius: 8,
      marginRight: 12,
      backgroundColor: '#eee',
  },
  actionRow: {
      flexDirection: 'row',
      marginTop: 8,
  },
  flex1: {
      flex: 1,
  },
  spacer4: { height: 4 },
  spacer16: { width: 16 },
  bottomSpacer: { height: 32 },
  // 质量等级样式
  gradeBox: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  gradeText: {
    fontSize: 16,
    fontWeight: '700',
  },
  rateRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  rateItem: {
    alignItems: 'center',
  },
  rateValue: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 4,
  },
});
