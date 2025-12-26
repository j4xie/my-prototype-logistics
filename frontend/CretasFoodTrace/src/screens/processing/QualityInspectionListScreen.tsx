import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  Text,
  Appbar,
  FAB,
  Chip,
  Surface,
  Searchbar,
  Menu,
  ActivityIndicator,
  IconButton,
  Button,
} from 'react-native-paper';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { ProcessingScreenProps } from '../../types/navigation';
import {
  qualityInspectionApiClient,
  type QualityInspection,
  InspectionResult,
} from '../../services/api/qualityInspectionApiClient';
import { useAuthStore } from '../../store/authStore';
import { handleError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建QualityInspectionList专用logger
const qualityInspectionLogger = logger.createContextLogger('QualityInspectionList');

type QualityInspectionListScreenProps = ProcessingScreenProps<'QualityInspectionList'>;

// Use types from API client - now matches backend QualityInspection entity
interface QualityInspectionItem extends QualityInspection {
  // Optional display fields (may need to fetch from backend separately)
  inspectorName?: string; // From User.name via inspectorId
  batchNumber?: string; // From ProductionBatch.batchNumber via productionBatchId
}

/**
 * 质检列表页面
 * P1-002: 质检完整流程 - 质检列表
 *
 * 功能:
 * - 展示质检记录列表
 * - 搜索和筛选
 * - 快速创建质检记录
 * - 导航到质检详情
 */
export default function QualityInspectionListScreen() {
  const navigation = useNavigation<QualityInspectionListScreenProps['navigation']>();
  const route = useRoute<QualityInspectionListScreenProps['route']>();
  const { batchId } = route.params || {};

  // Get user context
  const { user } = useAuthStore();
  const factoryId = user?.factoryId || user?.factoryUser?.factoryId;

  // Data state
  const [inspections, setInspections] = useState<QualityInspectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<{ message: string; canRetry: boolean } | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMenuVisible, setFilterMenuVisible] = useState(false);
  const [resultFilter, setResultFilter] = useState<InspectionResult | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  useFocusEffect(
    useCallback(() => {
      fetchInspections();
    }, [batchId, resultFilter, currentPage])
  );

  const fetchInspections = async () => {
    setLoading(true);
    setError(null); // 清除之前的错误

    try {
      // API integration - GET /api/mobile/{factoryId}/processing/quality/inspections
      qualityInspectionLogger.debug('获取质检记录列表', { factoryId, batchId, resultFilter, page: currentPage });

      const response = await qualityInspectionApiClient.getInspections(
        {
          batchId: batchId ? Number(batchId) : undefined,
          page: currentPage,
          size: 20,
        },
        factoryId
      );

      // Extract data from paginated response
      if (response.success && response.data) {
        const pageData = response.data;
        setInspections(pageData.content ?? []);
        setTotalPages(pageData.totalPages ?? 0);

        qualityInspectionLogger.info('质检记录列表加载成功', {
          factoryId,
          batchId,
          recordCount: pageData.content?.length ?? 0,
          totalPages: pageData.totalPages ?? 0,
        });
      } else {
        setInspections([]);
      }

    } catch (error) {
      qualityInspectionLogger.error('获取质检记录列表失败', error as Error, {
        factoryId,
        batchId,
        resultFilter,
        page: currentPage,
      });

      // ✅ GOOD: 设置错误状态，不只是Alert
      handleError(error, {
        showAlert: false, // 使用内联错误UI
        logError: true,
      });

      setError({
        message: error instanceof Error ? error.message : '无法加载质检记录，请稍后重试',
        canRetry: true,
      });

      // Clear data on error
      setInspections([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchInspections();
    setRefreshing(false);
  };

  const handleItemPress = (inspectionId: string) => {
    navigation.navigate('QualityInspectionDetail', { inspectionId });
  };

  const handleCreateInspection = () => {
    // If batchId is provided, navigate directly to create screen
    if (batchId) {
      navigation.navigate('CreateQualityRecord', {
        batchId: String(batchId),
        inspectionType: 'process'
      });
    } else {
      // Otherwise, navigate to batch list to select a batch
      navigation.navigate('BatchList', {});
    }
  };

  // Helper functions (updated to match backend entity)
  const getResultLabel = (result?: InspectionResult): string => {
    if (!result) return '未评分';
    switch (result) {
      case InspectionResult.PASS:
        return '合格';
      case InspectionResult.CONDITIONAL:
        return '条件合格';
      case InspectionResult.FAIL:
        return '不合格';
      default:
        return '未知';
    }
  };

  const getResultColor = (result?: InspectionResult): string => {
    if (!result) return '#9E9E9E';
    switch (result) {
      case InspectionResult.PASS:
        return '#4CAF50';
      case InspectionResult.CONDITIONAL:
        return '#FF9800';
      case InspectionResult.FAIL:
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  const getPassRateColor = (passRate: number): string => {
    if (passRate >= 95) return '#4CAF50';
    if (passRate >= 80) return '#FF9800';
    return '#F44336';
  };

  const getQualityGradeColor = (grade?: string): string => {
    switch (grade) {
      case 'A': return '#4CAF50'; // 绿色
      case 'B': return '#8BC34A'; // 浅绿
      case 'C': return '#FF9800'; // 橙色
      case 'D': return '#F44336'; // 红色
      default: return '#9E9E9E';
    }
  };

  // Filter data based on search query
  const filteredInspections = inspections.filter((item) => {
    const searchLower = searchQuery.toLowerCase();
    const idMatch = item.id?.toString().includes(searchLower);
    const batchIdMatch = item.productionBatchId?.toString().includes(searchLower);
    const batchNumberMatch = item.batchNumber?.toLowerCase().includes(searchLower);
    const inspectorIdMatch = item.inspectorId?.toString().includes(searchLower);
    const inspectorNameMatch = item.inspectorName?.toLowerCase().includes(searchLower);

    // Apply result filter
    const resultMatch = resultFilter === 'all' || item.result === resultFilter;

    return (idMatch || batchIdMatch || batchNumberMatch || inspectorIdMatch || inspectorNameMatch) && resultMatch;
  });

  // Render item (updated to match backend entity fields)
  const renderItem = ({ item }: { item: QualityInspectionItem }) => (
    <TouchableOpacity onPress={() => item.id && handleItemPress(item.id)}>
      <Surface style={styles.card} elevation={1}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text variant="titleMedium" style={styles.inspectionId}>
              质检#{item.id}
            </Text>
            <Text variant="bodySmall" style={styles.batchId}>
              批次ID: {item.productionBatchId}
              {item.batchNumber && ` (${item.batchNumber})`}
            </Text>
          </View>
          <View style={styles.cardHeaderRight}>
            {item.qualityGrade && (
              <Chip
                mode="flat"
                style={[
                  styles.gradeChip,
                  { backgroundColor: getQualityGradeColor(item.qualityGrade) + '20' },
                ]}
                textStyle={[
                  styles.gradeChipText,
                  { color: getQualityGradeColor(item.qualityGrade) },
                ]}
              >
                {item.qualityGrade}级
              </Chip>
            )}
            <Chip
              mode="flat"
              style={[
                styles.resultChip,
                { backgroundColor: getResultColor(item.result) + '20' },
              ]}
              textStyle={[
                styles.resultChipText,
                { color: getResultColor(item.result) },
              ]}
            >
              {getResultLabel(item.result)}
            </Chip>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>检验员</Text>
            <Text style={styles.infoValue}>
              {item.inspectorName || `ID: ${item.inspectorId}`}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>检验日期</Text>
            <Text style={styles.infoValue}>{item.inspectionDate}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>样本数量</Text>
            <Text style={styles.infoValue}>{item.sampleSize} 个</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>合格/不合格</Text>
            <Text style={styles.infoValue}>
              {item.passCount} / {item.failCount}
            </Text>
          </View>

          {item.passRate !== undefined && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>合格率</Text>
              <Text
                style={[
                  styles.passRateValue,
                  { color: getPassRateColor(item.passRate) },
                ]}
              >
                {item.passRate.toFixed(1)}%
              </Text>
            </View>
          )}

          {item.notes && (
            <View style={styles.notesRow}>
              <Text style={styles.infoLabel}>备注</Text>
              <Text style={styles.notesValue} numberOfLines={2}>
                {item.notes}
              </Text>
            </View>
          )}
        </View>
      </Surface>
    </TouchableOpacity>
  );

  // Empty state
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      {/* ✅ 优先显示错误UI */}
      {error ? (
        <>
          <IconButton icon="alert-circle-outline" size={48} iconColor="#F44336" />
          <Text variant="bodyLarge" style={styles.errorText}>
            {error.message}
          </Text>
          {error.canRetry && (
            <Button
              mode="outlined"
              icon="refresh"
              onPress={fetchInspections}
              style={styles.retryButton}
            >
              重试
            </Button>
          )}
        </>
      ) : (
        <>
          <Text variant="bodyLarge" style={styles.emptyText}>
            暂无质检记录
          </Text>
          <Text variant="bodySmall" style={styles.emptyHint}>
            点击右下角按钮创建质检记录
          </Text>
        </>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="质检记录" />
        <Menu
          visible={filterMenuVisible}
          onDismiss={() => setFilterMenuVisible(false)}
          anchor={
            <Appbar.Action
              icon="filter-variant"
              onPress={() => setFilterMenuVisible(true)}
            />
          }
        >
          <Menu.Item
            onPress={() => {
              setResultFilter('all');
              setFilterMenuVisible(false);
            }}
            title="全部"
            leadingIcon={resultFilter === 'all' ? 'check' : undefined}
          />
          <Menu.Item
            onPress={() => {
              setResultFilter(InspectionResult.PASS);
              setFilterMenuVisible(false);
            }}
            title="合格"
            leadingIcon={resultFilter === InspectionResult.PASS ? 'check' : undefined}
          />
          <Menu.Item
            onPress={() => {
              setResultFilter(InspectionResult.CONDITIONAL);
              setFilterMenuVisible(false);
            }}
            title="条件合格"
            leadingIcon={resultFilter === InspectionResult.CONDITIONAL ? 'check' : undefined}
          />
          <Menu.Item
            onPress={() => {
              setResultFilter(InspectionResult.FAIL);
              setFilterMenuVisible(false);
            }}
            title="不合格"
            leadingIcon={resultFilter === InspectionResult.FAIL ? 'check' : undefined}
          />
        </Menu>
      </Appbar.Header>

      <Searchbar
        placeholder="搜索批次号、检验员、记录ID"
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchbar}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredInspections}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={renderEmpty}
        />
      )}

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={handleCreateInspection}
        label="新建质检"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  searchbar: {
    margin: 16,
    marginBottom: 8,
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
  listContent: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flex: 1,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inspectionId: {
    fontWeight: '600',
    color: '#212121',
  },
  batchId: {
    color: '#666',
    marginTop: 2,
  },
  gradeChip: {
    alignSelf: 'flex-start',
    marginRight: 6,
  },
  gradeChipText: {
    fontWeight: '700',
    fontSize: 11,
  },
  resultChip: {
    alignSelf: 'flex-start',
  },
  resultChipText: {
    fontWeight: '600',
    fontSize: 11,
  },
  cardBody: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 13,
    color: '#666',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#212121',
  },
  passRateValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  notesRow: {
    gap: 4,
  },
  notesValue: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    color: '#9E9E9E',
    marginBottom: 8,
  },
  emptyHint: {
    color: '#BDBDBD',
  },
  errorText: {
    color: '#F44336',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  retryButton: {
    borderColor: '#F44336',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});
