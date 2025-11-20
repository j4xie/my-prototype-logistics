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
  Surface,
  Chip,
  Divider,
  ActivityIndicator,
  Button,
  IconButton,
  Menu,
} from 'react-native-paper';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ProcessingStackParamList } from '../../types/navigation';
import { qualityInspectionApiClient } from '../../services/api/qualityInspectionApiClient';
import { useAuthStore } from '../../store/authStore';
import { NotImplementedError } from '../../errors';

// Types
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
  scores: QualityScore;
  conclusion: InspectionConclusion;
  notes: string;
  photos: QualityPhoto[];
  status: InspectionStatus;
  reviewer?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 质检记录详情页面
 * P1-002-2: 完整质检流程 - 质检详情页
 *
 * 功能:
 * - 查看质检记录详情
 * - 编辑草稿状态的记录
 * - 审核提交的记录
 * - 删除记录（仅草稿状态）
 * - 导出PDF报告
 */
export default function QualityInspectionDetailScreen() {
  const navigation = useNavigation<QualityInspectionDetailScreenNavigationProp>();
  const route = useRoute<QualityInspectionDetailScreenRouteProp>();
  const { inspectionId } = route.params;

  // Get user context
  const { user } = useAuthStore();
  const factoryId = user?.factoryId || user?.factoryUser?.factoryId;

  // Data state
  const [inspection, setInspection] = useState<QualityInspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // UI state
  const [menuVisible, setMenuVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchInspectionDetail();
    }, [inspectionId])
  );

  const fetchInspectionDetail = async () => {
    setLoading(true);
    try {
      // API integration - GET /api/mobile/{factoryId}/processing/quality/inspections/:id
      console.log('🔍 Fetching quality inspection detail:', inspectionId);

      const response = await qualityInspectionApiClient.getInspectionById(inspectionId, factoryId);

      console.log('✅ Quality inspection detail loaded');
      setInspection(response.data);

    } catch (error: any) {
      console.error('❌ Failed to fetch quality inspection detail:', error);
      Alert.alert('加载失败', error.response?.data?.message || '无法加载质检详情，请稍后重试');

      // Mock data fallback for development
      const mockInspection: QualityInspection = {
        id: inspectionId,
        batchId: 'BATCH_20251118_001',
        inspectionType: 'final_product',
        inspector: '张三',
        inspectionDate: '2025-11-18',
        inspectionTime: '14:30',
        scores: {
          freshness: 92,
          appearance: 88,
          smell: 95,
          other: 90,
        },
        conclusion: 'pass',
        notes: '产品质量良好，符合出厂标准。外观稍有瑕疵但不影响食用。',
        photos: [
          {
            id: 'photo_1',
            uri: 'https://via.placeholder.com/300x200',
            timestamp: new Date(),
          },
          {
            id: 'photo_2',
            uri: 'https://via.placeholder.com/300x200',
            timestamp: new Date(),
          },
        ],
        status: 'submitted',
        createdAt: new Date('2025-11-18 14:30:00'),
        updatedAt: new Date('2025-11-18 14:35:00'),
      };

      setInspection(mockInspection);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchInspectionDetail();
    setRefreshing(false);
  };

  const handleEdit = () => {
    if (inspection?.status !== 'draft') {
      Alert.alert('提示', '只能编辑草稿状态的记录');
      return;
    }
    throw new NotImplementedError(
      '质检记录编辑',
      'Phase 4',
      '质检记录编辑功能尚未实现，请删除后重新创建。'
    );
  };

  const handleDelete = () => {
    if (inspection?.status !== 'draft') {
      Alert.alert('提示', '只能删除草稿状态的记录');
      return;
    }

    Alert.alert('删除确认', '确定要删除这条质检记录吗？此操作无法撤销。', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            // API integration - DELETE /api/mobile/{factoryId}/processing/quality/inspections/:id
            console.log('🗑️ Deleting quality inspection:', inspectionId);

            await qualityInspectionApiClient.deleteInspection(inspectionId, factoryId);

            console.log('✅ Quality inspection deleted');
            Alert.alert('成功', '质检记录已删除', [
              { text: '确定', onPress: () => navigation.goBack() },
            ]);
          } catch (error: any) {
            console.error('❌ Failed to delete quality inspection:', error);
            Alert.alert('错误', error.response?.data?.message || '删除失败，请重试');
          }
        },
      },
    ]);
  };

  const handleApprove = () => {
    if (inspection?.status !== 'submitted') {
      Alert.alert('提示', '只能审核已提交的记录');
      return;
    }

    Alert.alert('审核通过', '确定审核通过此质检记录吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '通过',
        onPress: async () => {
          try {
            // API integration - PUT /api/mobile/{factoryId}/processing/quality/inspections/:id
            console.log('✅ Approving quality inspection:', inspectionId);

            await qualityInspectionApiClient.updateInspection(inspectionId, {
              status: 'reviewed',
              conclusion: 'pass',
              reviewer: user?.fullName || user?.username,
              reviewDate: new Date().toISOString(),
              reviewNotes: '审核通过',
            }, factoryId);

            console.log('✅ Quality inspection approved');
            Alert.alert('成功', '质检记录已审核通过');
            fetchInspectionDetail();
          } catch (error: any) {
            console.error('❌ Failed to approve quality inspection:', error);
            Alert.alert('错误', error.response?.data?.message || '审核失败，请重试');
          }
        },
      },
    ]);
  };

  const handleReject = () => {
    if (inspection?.status !== 'submitted') {
      Alert.alert('提示', '只能审核已提交的记录');
      return;
    }

    throw new NotImplementedError(
      '质检记录审核拒绝',
      'Phase 4',
      '质检记录审核拒绝功能尚未实现，请联系管理员处理。'
    );
  };

  const handleExportPDF = () => {
    Alert.alert('导出PDF', 'PDF导出功能开发中');
  };

  // Helper functions
  const getInspectionTypeLabel = (type: InspectionType): string => {
    switch (type) {
      case 'raw_material':
        return '原材料检验';
      case 'process':
        return '过程检验';
      case 'final_product':
        return '成品检验';
    }
  };

  const getConclusionLabel = (conclusion: InspectionConclusion): string => {
    switch (conclusion) {
      case 'pass':
        return '合格';
      case 'conditional_pass':
        return '条件合格';
      case 'fail':
        return '不合格';
    }
  };

  const getConclusionColor = (conclusion: InspectionConclusion): string => {
    switch (conclusion) {
      case 'pass':
        return '#4CAF50';
      case 'conditional_pass':
        return '#FF9800';
      case 'fail':
        return '#F44336';
    }
  };

  const getStatusLabel = (status: InspectionStatus): string => {
    switch (status) {
      case 'draft':
        return '草稿';
      case 'submitted':
        return '已提交';
      case 'reviewed':
        return '已审核';
    }
  };

  const getStatusColor = (status: InspectionStatus): string => {
    switch (status) {
      case 'draft':
        return '#9E9E9E';
      case 'submitted':
        return '#2196F3';
      case 'reviewed':
        return '#4CAF50';
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 90) return '#4CAF50';
    if (score >= 70) return '#FF9800';
    return '#F44336';
  };

  const averageScore = inspection
    ? Math.round(
        (inspection.scores.freshness +
          inspection.scores.appearance +
          inspection.scores.smell +
          inspection.scores.other) /
          4
      )
    : 0;

  // Loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <Appbar.Header elevated>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="质检详情" />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (!inspection) {
    return (
      <View style={styles.container}>
        <Appbar.Header elevated>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="质检详情" />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>未找到质检记录</Text>
          <Button mode="contained" onPress={fetchInspectionDetail} style={{ marginTop: 16 }}>
            重试
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="质检详情" />
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
          {inspection.status === 'draft' && (
            <>
              <Menu.Item onPress={handleEdit} title="编辑" leadingIcon="pencil" />
              <Menu.Item
                onPress={handleDelete}
                title="删除"
                leadingIcon="delete"
              />
              <Divider />
            </>
          )}
          <Menu.Item
            onPress={handleExportPDF}
            title="导出PDF"
            leadingIcon="file-pdf-box"
          />
        </Menu>
      </Appbar.Header>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header with Status */}
        <Surface style={styles.section} elevation={1}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text variant="titleLarge" style={styles.inspectionId}>
                {inspection.id}
              </Text>
              <Text variant="bodyMedium" style={styles.batchId}>
                批次: {inspection.batchId}
              </Text>
            </View>
            <View style={styles.headerRight}>
              <Chip
                mode="flat"
                style={[
                  styles.statusChip,
                  { backgroundColor: getStatusColor(inspection.status) + '20' },
                ]}
                textStyle={[
                  styles.statusChipText,
                  { color: getStatusColor(inspection.status) },
                ]}
              >
                {getStatusLabel(inspection.status)}
              </Chip>
              <Chip
                mode="flat"
                style={styles.typeChip}
                textStyle={{ fontSize: 12 }}
              >
                {getInspectionTypeLabel(inspection.inspectionType)}
              </Chip>
            </View>
          </View>
        </Surface>

        {/* Basic Information */}
        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            检验信息
          </Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>检验员</Text>
            <Text style={styles.infoValue}>{inspection.inspector}</Text>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>检验时间</Text>
            <Text style={styles.infoValue}>
              {inspection.inspectionDate} {inspection.inspectionTime}
            </Text>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>创建时间</Text>
            <Text style={styles.infoValue}>
              {inspection.createdAt.toLocaleString('zh-CN')}
            </Text>
          </View>
        </Surface>

        {/* Quality Scores */}
        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            质量评分
          </Text>

          <View style={styles.scoreGrid}>
            <View style={styles.scoreCard}>
              <Text style={styles.scoreCardLabel}>新鲜度</Text>
              <Text
                style={[
                  styles.scoreCardValue,
                  { color: getScoreColor(inspection.scores.freshness) },
                ]}
              >
                {inspection.scores.freshness}
              </Text>
            </View>

            <View style={styles.scoreCard}>
              <Text style={styles.scoreCardLabel}>外观</Text>
              <Text
                style={[
                  styles.scoreCardValue,
                  { color: getScoreColor(inspection.scores.appearance) },
                ]}
              >
                {inspection.scores.appearance}
              </Text>
            </View>

            <View style={styles.scoreCard}>
              <Text style={styles.scoreCardLabel}>气味</Text>
              <Text
                style={[
                  styles.scoreCardValue,
                  { color: getScoreColor(inspection.scores.smell) },
                ]}
              >
                {inspection.scores.smell}
              </Text>
            </View>

            <View style={styles.scoreCard}>
              <Text style={styles.scoreCardLabel}>其他</Text>
              <Text
                style={[
                  styles.scoreCardValue,
                  { color: getScoreColor(inspection.scores.other) },
                ]}
              >
                {inspection.scores.other}
              </Text>
            </View>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.averageScore}>
            <Text variant="titleMedium">综合评分</Text>
            <Text
              variant="headlineMedium"
              style={[
                styles.averageScoreValue,
                { color: getScoreColor(averageScore) },
              ]}
            >
              {averageScore}
            </Text>
          </View>
        </Surface>

        {/* Conclusion */}
        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            检验结论
          </Text>

          <View style={styles.conclusionRow}>
            <Text style={styles.infoLabel}>检验结果</Text>
            <Chip
              mode="flat"
              style={[
                styles.conclusionChip,
                { backgroundColor: getConclusionColor(inspection.conclusion) + '20' },
              ]}
              textStyle={[
                styles.conclusionChipText,
                { color: getConclusionColor(inspection.conclusion) },
              ]}
            >
              {getConclusionLabel(inspection.conclusion)}
            </Chip>
          </View>

          {inspection.notes && (
            <>
              <Divider style={styles.divider} />
              <View style={styles.notesSection}>
                <Text style={styles.notesLabel}>备注说明</Text>
                <Text style={styles.notesText}>{inspection.notes}</Text>
              </View>
            </>
          )}
        </Surface>

        {/* Photos */}
        {inspection.photos.length > 0 && (
          <Surface style={styles.section} elevation={1}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              检验照片
            </Text>

            <View style={styles.photoGrid}>
              {inspection.photos.map((photo) => (
                <View key={photo.id} style={styles.photoItem}>
                  <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                </View>
              ))}
            </View>
          </Surface>
        )}

        {/* Review Information */}
        {inspection.status === 'reviewed' && inspection.reviewer && (
          <Surface style={styles.section} elevation={1}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              审核信息
            </Text>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>审核人</Text>
              <Text style={styles.infoValue}>{inspection.reviewer}</Text>
            </View>

            <Divider style={styles.divider} />

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>审核时间</Text>
              <Text style={styles.infoValue}>
                {inspection.reviewedAt?.toLocaleString('zh-CN')}
              </Text>
            </View>

            {inspection.reviewNotes && (
              <>
                <Divider style={styles.divider} />
                <View style={styles.notesSection}>
                  <Text style={styles.notesLabel}>审核意见</Text>
                  <Text style={styles.notesText}>{inspection.reviewNotes}</Text>
                </View>
              </>
            )}
          </Surface>
        )}

        {/* Action Buttons */}
        {inspection.status === 'submitted' && (
          <View style={styles.actions}>
            <Button
              mode="outlined"
              icon="close-circle"
              onPress={handleReject}
              style={styles.actionButton}
              buttonColor="#FFEBEE"
              textColor="#F44336"
            >
              不通过
            </Button>
            <Button
              mode="contained"
              icon="check-circle"
              onPress={handleApprove}
              style={styles.actionButton}
            >
              审核通过
            </Button>
          </View>
        )}
      </ScrollView>
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
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
  },
  errorText: {
    color: '#F44336',
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    marginBottom: 16,
    fontWeight: '600',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  inspectionId: {
    fontWeight: '700',
    color: '#212121',
  },
  batchId: {
    color: '#666',
    marginTop: 4,
  },
  statusChip: {
    alignSelf: 'flex-end',
  },
  statusChipText: {
    fontWeight: '600',
    fontSize: 12,
  },
  typeChip: {
    backgroundColor: '#E3F2FD',
    alignSelf: 'flex-end',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#212121',
  },
  divider: {
    marginVertical: 8,
  },
  scoreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  scoreCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  scoreCardLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  scoreCardValue: {
    fontSize: 32,
    fontWeight: '700',
  },
  averageScore: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  averageScoreValue: {
    fontWeight: '700',
  },
  conclusionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  conclusionChip: {},
  conclusionChipText: {
    fontWeight: '600',
  },
  notesSection: {
    paddingTop: 8,
  },
  notesLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  notesText: {
    fontSize: 14,
    color: '#212121',
    lineHeight: 22,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoItem: {
    width: '48%',
    aspectRatio: 3 / 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
  },
});
