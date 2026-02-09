/**
 * DynamicAnalysisScreen
 *
 * Main screen for multi-sheet dynamic data analysis.
 * Supports:
 * - Dataset selection from uploaded Excel files
 * - Multi-sheet parallel analysis
 * - Sheet tab navigation
 * - Dynamic chart rendering with dimension switching
 * - AI insights display
 *
 * @version 1.0.0
 * @since 2026-01-30
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  Text,
  ActivityIndicator,
  Surface,
  FAB,
  Portal,
  Modal,
  Searchbar,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { smartBIApi } from '../../services/api/smartbi';
import { useAuthStore } from '../../store/authStore';

import type {
  SmartBIStackParamList,
  ExcelUploadRecord,
  MultiSheetAnalysisResult,
  SheetAnalysisResult,
  DynamicChartConfig,
} from '../../types/smartbi';

import SheetTabBar from '../../components/smartbi/SheetTabBar';
import MetricCardGrid from '../../components/smartbi/MetricCardGrid';
import DynamicChartRenderer from '../../components/smartbi/DynamicChartRenderer';
import IndexPageView from '../../components/smartbi/IndexPageView';

type NavigationProp = NativeStackNavigationProp<SmartBIStackParamList, 'DynamicAnalysis'>;
type DynamicAnalysisRouteProp = RouteProp<SmartBIStackParamList, 'DynamicAnalysis'>;

// Theme colors
const THEME = {
  primary: '#3B82F6',
  background: '#F5F7FA',
  cardBackground: '#FFFFFF',
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
};

/**
 * Dataset Selector Component
 */
interface DatasetSelectorProps {
  datasets: ExcelUploadRecord[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  visible: boolean;
  onDismiss: () => void;
}

function DatasetSelector({
  datasets,
  selectedId,
  onSelect,
  visible,
  onDismiss,
}: DatasetSelectorProps): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDatasets = datasets.filter((d) =>
    d.fileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modalContent}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>选择数据集</Text>
          <TouchableOpacity onPress={onDismiss}>
            <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <Searchbar
          placeholder="搜索文件名..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchBar}
        />

        <ScrollView style={styles.datasetList}>
          {filteredDatasets.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons
                name="file-document-outline"
                size={48}
                color="#9CA3AF"
              />
              <Text style={styles.emptyText}>暂无数据集</Text>
            </View>
          ) : (
            filteredDatasets.map((dataset) => (
              <TouchableOpacity
                key={dataset.id}
                style={[
                  styles.datasetItem,
                  selectedId === dataset.id && styles.datasetItemSelected,
                ]}
                onPress={() => {
                  onSelect(dataset.id);
                  onDismiss();
                }}
              >
                <View style={styles.datasetIcon}>
                  <MaterialCommunityIcons
                    name="file-excel"
                    size={24}
                    color={selectedId === dataset.id ? THEME.primary : '#10B981'}
                  />
                </View>
                <View style={styles.datasetInfo}>
                  <Text
                    style={[
                      styles.datasetName,
                      selectedId === dataset.id && styles.datasetNameSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {dataset.fileName}
                  </Text>
                  <Text style={styles.datasetMeta}>
                    {dataset.sheetCount} 个Sheet · {dataset.rowCount}行 · {dataset.createdAt}
                  </Text>
                </View>
                {selectedId === dataset.id && (
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={24}
                    color={THEME.primary}
                  />
                )}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </Modal>
    </Portal>
  );
}

/**
 * Analysis Summary Header
 */
interface AnalysisSummaryProps {
  result: MultiSheetAnalysisResult;
  datasetName: string;
}

function AnalysisSummary({ result, datasetName }: AnalysisSummaryProps): React.ReactElement {
  return (
    <Surface style={styles.summaryCard} elevation={1}>
      <View style={styles.summaryHeader}>
        <MaterialCommunityIcons name="file-chart" size={24} color={THEME.primary} />
        <View style={styles.summaryTitleContainer}>
          <Text style={styles.summaryTitle} numberOfLines={1}>
            {datasetName}
          </Text>
          <Text style={styles.summarySubtitle}>
            分析完成 · {(result.processingTimeMs / 1000).toFixed(1)}秒
          </Text>
        </View>
      </View>

      <View style={styles.summaryStats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{result.totalSheets}</Text>
          <Text style={styles.statLabel}>总Sheet数</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: THEME.success }]}>
            {result.successCount}
          </Text>
          <Text style={styles.statLabel}>分析成功</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: THEME.warning }]}>
            {result.cacheHitCount}
          </Text>
          <Text style={styles.statLabel}>缓存命中</Text>
        </View>
      </View>
    </Surface>
  );
}

/**
 * DynamicAnalysisScreen Component
 */
export default function DynamicAnalysisScreen(): React.ReactElement {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<DynamicAnalysisRouteProp>();
  const { getFactoryId } = useAuthStore();

  // State
  const [datasets, setDatasets] = useState<ExcelUploadRecord[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(
    route.params?.uploadId ?? null
  );
  const [multiSheetResult, setMultiSheetResult] = useState<MultiSheetAnalysisResult | null>(null);
  const [activeSheetIndex, setActiveSheetIndex] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isDimensionSwitching, setIsDimensionSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectorVisible, setSelectorVisible] = useState(false);

  // Current sheet result
  const currentSheetResult = multiSheetResult?.sheetResults[activeSheetIndex] ?? null;

  // Selected dataset info
  const selectedDataset = datasets.find((d) => d.id === selectedDatasetId) ?? null;

  // Load datasets on mount
  useEffect(() => {
    loadDatasets();
  }, []);

  // Analyze when dataset is selected
  useEffect(() => {
    if (selectedDatasetId && !multiSheetResult) {
      analyzeAllSheets(selectedDatasetId);
    }
  }, [selectedDatasetId]);

  /**
   * Load datasets list
   */
  const loadDatasets = useCallback(async () => {
    try {
      setLoading(true);
      const factoryId = getFactoryId();
      const response = await smartBIApi.getDatasets(factoryId || undefined);

      if (response.success && response.data) {
        setDatasets(response.data);
      } else {
        setError(response.message || '加载数据集失败');
      }
    } catch (err) {
      console.error('Load datasets failed:', err);
      setError('加载数据集失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getFactoryId]);

  /**
   * Analyze all sheets in selected dataset
   */
  const analyzeAllSheets = useCallback(async (uploadId: number) => {
    try {
      setAnalyzing(true);
      setError(null);
      const factoryId = getFactoryId();

      const response = await smartBIApi.analyzeAllSheets(uploadId, factoryId || undefined);

      if (response.success && response.data) {
        setMultiSheetResult(response.data);
        setActiveSheetIndex(0);
      } else {
        setError(response.message || '分析失败');
      }
    } catch (err) {
      console.error('Analyze sheets failed:', err);
      setError('分析数据失败，请重试');
    } finally {
      setAnalyzing(false);
    }
  }, [getFactoryId]);

  /**
   * Handle dataset selection
   */
  const handleDatasetSelect = useCallback((id: number) => {
    if (id !== selectedDatasetId) {
      setSelectedDatasetId(id);
      setMultiSheetResult(null);
      setActiveSheetIndex(0);
    }
  }, [selectedDatasetId]);

  /**
   * Handle dimension change for a chart
   */
  const handleDimensionChange = useCallback(
    async (chartIndex: number, newDimension: string) => {
      if (!selectedDatasetId || !currentSheetResult) return;

      setIsDimensionSwitching(true);
      try {
        const factoryId = getFactoryId();
        const response = await smartBIApi.switchChartDimension(
          selectedDatasetId,
          activeSheetIndex,
          chartIndex,
          newDimension,
          factoryId || undefined
        );

        if (response.success && response.data) {
          // Update the chart config in the result
          setMultiSheetResult((prev) => {
            if (!prev) return null;
            const currentSheet = prev.sheetResults[activeSheetIndex];
            if (!currentSheet) return prev;
            const newCharts = [...currentSheet.charts];
            newCharts[chartIndex] = response.data;
            const newResults = [...prev.sheetResults];
            newResults[activeSheetIndex] = {
              ...currentSheet,
              charts: newCharts,
            };
            return { ...prev, sheetResults: newResults };
          });
        }
      } catch (err) {
        console.error('Switch dimension failed:', err);
        Alert.alert('提示', '切换维度失败');
      } finally {
        setIsDimensionSwitching(false);
      }
    },
    [selectedDatasetId, activeSheetIndex, currentSheetResult, getFactoryId]
  );

  /**
   * Refresh handler
   */
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDatasets();
    if (selectedDatasetId) {
      setMultiSheetResult(null);
      analyzeAllSheets(selectedDatasetId);
    }
  }, [loadDatasets, selectedDatasetId, analyzeAllSheets]);

  // Loading state
  if (loading && datasets.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.primary} />
          <Text style={styles.loadingText}>加载数据集...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[THEME.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Dataset Selector Button */}
        <TouchableOpacity
          style={styles.selectorButton}
          onPress={() => setSelectorVisible(true)}
        >
          <MaterialCommunityIcons
            name="file-document-multiple-outline"
            size={20}
            color={THEME.primary}
          />
          <Text style={styles.selectorButtonText}>
            {selectedDataset?.fileName || '选择数据集'}
          </Text>
          <MaterialCommunityIcons
            name="chevron-down"
            size={20}
            color="#6B7280"
          />
        </TouchableOpacity>

        {/* Error Banner */}
        {error && (
          <View style={styles.errorBanner}>
            <MaterialCommunityIcons name="alert-circle" size={20} color={THEME.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Analyzing State */}
        {analyzing && (
          <View style={styles.analyzingContainer}>
            <ActivityIndicator size="large" color={THEME.primary} />
            <Text style={styles.analyzingText}>正在分析所有 Sheet...</Text>
            <Text style={styles.analyzingHint}>
              首次分析可能需要较长时间，后续将使用缓存加速
            </Text>
          </View>
        )}

        {/* Analysis Results */}
        {multiSheetResult && selectedDataset && !analyzing && (
          <>
            {/* Summary Header */}
            <AnalysisSummary
              result={multiSheetResult}
              datasetName={selectedDataset.fileName}
            />

            {/* Sheet Tab Bar */}
            <SheetTabBar
              sheets={multiSheetResult.sheetResults.map((s, idx) => {
                // Get display name from index metadata if available
                const indexMapping = multiSheetResult.indexMetadata?.sheetMappings?.find(
                  (m) => m.index === s.sheetIndex
                );
                const displayName = indexMapping?.reportName || s.sheetName;

                // Index sheets should not be marked as error
                const isIndexSheet = s.tableType === 'index' ||
                  s.sheetIndex === multiSheetResult.indexMetadata?.indexSheetIndex;
                const hasError = !isIndexSheet &&
                  s.charts.length === 0 && s.metrics.length === 0;

                return {
                  name: displayName,
                  fromCache: s.fromCache,
                  hasError,
                  isIndex: isIndexSheet,
                };
              })}
              activeIndex={activeSheetIndex}
              onTabPress={setActiveSheetIndex}
              loading={analyzing}
            />

            {/* Current Sheet Content */}
            {currentSheetResult && (
              // Check if this is an index sheet
              currentSheetResult.tableType === 'index' ||
              currentSheetResult.sheetIndex === multiSheetResult?.indexMetadata?.indexSheetIndex ? (
                // Index Page View - show report directory
                <IndexPageView
                  mappings={multiSheetResult?.indexMetadata?.sheetMappings}
                  onNavigate={(idx) => {
                    // Find the actual array index for the target sheet
                    const targetIndex = multiSheetResult?.sheetResults.findIndex(
                      (s) => s.sheetIndex === idx
                    );
                    if (targetIndex !== undefined && targetIndex >= 0) {
                      setActiveSheetIndex(targetIndex);
                    }
                  }}
                  activeIndex={currentSheetResult.sheetIndex}
                />
              ) : (
                // Normal sheet content view
                <View style={styles.sheetContent}>
                  {/* Sheet Info */}
                  <View style={styles.sheetInfo}>
                    <Text style={styles.sheetInfoText}>
                      {currentSheetResult.rowCount}行 · {currentSheetResult.columnCount}列 ·
                      场景: {currentSheetResult.scenario.scenarioType}
                      {currentSheetResult.fromCache && ' · 来自缓存'}
                    </Text>
                  </View>

                  {/* 编制说明 - Description from Index Sheet */}
                  {currentSheetResult.scenario.description && (
                    <View style={styles.descriptionCard}>
                      <View style={styles.descriptionHeader}>
                        <MaterialCommunityIcons
                          name="information-outline"
                          size={16}
                          color="#6366F1"
                        />
                        <Text style={styles.descriptionTitle}>编制说明</Text>
                      </View>
                      <Text style={styles.descriptionText}>
                        {currentSheetResult.scenario.description}
                      </Text>
                    </View>
                  )}

                  {/* Metrics */}
                  {currentSheetResult.metrics.length > 0 && (
                    <MetricCardGrid metrics={currentSheetResult.metrics} columns={2} />
                  )}

                  {/* Charts */}
                  {currentSheetResult.charts.map((chart, index) => (
                    <View key={`chart-${activeSheetIndex}-${index}`} style={styles.chartWrapper}>
                      {isDimensionSwitching && (
                        <View style={styles.dimensionSwitchingOverlay}>
                          <ActivityIndicator size="small" color={THEME.primary} />
                        </View>
                      )}
                      <DynamicChartRenderer
                        chartConfig={chart}
                        onDimensionChange={(dim) => handleDimensionChange(index, dim)}
                        showDimensionSwitcher
                        showMeasureSwitcher
                      />
                    </View>
                  ))}

                  {/* AI Insights */}
                  {currentSheetResult.insights.length > 0 && (
                    <View style={styles.insightsSection}>
                      <Text style={styles.sectionTitle}>AI 洞察</Text>
                      <Surface style={styles.insightsCard} elevation={1}>
                        {currentSheetResult.insights.map((insight, idx) => (
                          <View key={`insight-${idx}`} style={styles.insightItem}>
                            <View style={[
                              styles.insightBadge,
                              { backgroundColor: insight.level === 'green' ? '#D1FAE5' : insight.level === 'yellow' ? '#FEF3C7' : '#FEE2E2' }
                            ]}>
                              <MaterialCommunityIcons
                                name={insight.level === 'green' ? 'check-circle' : insight.level === 'yellow' ? 'alert-circle' : 'close-circle'}
                                size={16}
                                color={insight.level === 'green' ? '#10B981' : insight.level === 'yellow' ? '#F59E0B' : '#EF4444'}
                              />
                            </View>
                            <View style={styles.insightContent}>
                              <Text style={styles.insightCategory}>{insight.category}</Text>
                              <Text style={styles.insightText}>{insight.text}</Text>
                            </View>
                          </View>
                        ))}
                      </Surface>
                    </View>
                  )}

                  {/* Empty State */}
                  {currentSheetResult.charts.length === 0 &&
                    currentSheetResult.metrics.length === 0 && (
                      <View style={styles.emptySheet}>
                        <MaterialCommunityIcons
                          name="chart-box-outline"
                          size={48}
                          color="#9CA3AF"
                        />
                        <Text style={styles.emptySheetText}>
                          该 Sheet 暂无可分析的数据
                        </Text>
                      </View>
                    )}
                </View>
              )
            )}
          </>
        )}

        {/* Initial Empty State */}
        {!selectedDatasetId && !analyzing && (
          <View style={styles.initialEmpty}>
            <MaterialCommunityIcons
              name="chart-timeline-variant"
              size={64}
              color="#9CA3AF"
            />
            <Text style={styles.initialEmptyTitle}>动态数据分析</Text>
            <Text style={styles.initialEmptyText}>
              选择一个已上传的 Excel 数据集，开始智能分析
            </Text>
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => setSelectorVisible(true)}
            >
              <Text style={styles.selectButtonText}>选择数据集</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Dataset Selector Modal */}
      <DatasetSelector
        datasets={datasets}
        selectedId={selectedDatasetId}
        onSelect={handleDatasetSelect}
        visible={selectorVisible}
        onDismiss={() => setSelectorVisible(false)}
      />

      {/* FAB for uploading new dataset */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate('SmartBIDataAnalysis')}
        label="上传新数据"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: THEME.textSecondary,
  },
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  selectorButtonText: {
    flex: 1,
    fontSize: 15,
    color: THEME.textPrimary,
    fontWeight: '500',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: THEME.danger,
  },
  analyzingContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  analyzingText: {
    marginTop: 16,
    fontSize: 16,
    color: THEME.textPrimary,
    fontWeight: '500',
  },
  analyzingHint: {
    marginTop: 8,
    fontSize: 13,
    color: THEME.textSecondary,
    textAlign: 'center',
  },
  summaryCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryTitleContainer: {
    marginLeft: 12,
    flex: 1,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.textPrimary,
  },
  summarySubtitle: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
  },
  sheetContent: {
    flex: 1,
  },
  sheetInfo: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sheetInfoText: {
    fontSize: 12,
    color: THEME.textSecondary,
  },
  descriptionCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 12,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#6366F1',
  },
  descriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  descriptionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366F1',
    marginLeft: 6,
  },
  descriptionText: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 20,
  },
  chartWrapper: {
    marginHorizontal: 16,
    marginVertical: 8,
    position: 'relative',
  },
  dimensionSwitchingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderRadius: 12,
  },
  insightsSection: {
    marginHorizontal: 16,
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.textPrimary,
    marginBottom: 12,
  },
  emptySheet: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptySheetText: {
    marginTop: 12,
    fontSize: 14,
    color: THEME.textSecondary,
  },
  initialEmpty: {
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  initialEmptyTitle: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '600',
    color: THEME.textPrimary,
  },
  initialEmptyText: {
    marginTop: 8,
    fontSize: 14,
    color: THEME.textSecondary,
    textAlign: 'center',
  },
  selectButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: THEME.primary,
    borderRadius: 8,
  },
  selectButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bottomSpacer: {
    height: 100,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: THEME.primary,
  },
  // Modal styles
  modalContent: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.textPrimary,
  },
  searchBar: {
    marginHorizontal: 16,
    marginVertical: 12,
    elevation: 0,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  datasetList: {
    maxHeight: 400,
  },
  datasetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  datasetItemSelected: {
    backgroundColor: '#EBF5FF',
  },
  datasetIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  datasetInfo: {
    flex: 1,
    marginLeft: 12,
  },
  datasetName: {
    fontSize: 15,
    fontWeight: '500',
    color: THEME.textPrimary,
  },
  datasetNameSelected: {
    color: THEME.primary,
  },
  datasetMeta: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: THEME.textSecondary,
  },
  // Insight styles
  insightsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  insightBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  insightContent: {
    flex: 1,
  },
  insightCategory: {
    fontSize: 11,
    color: THEME.textSecondary,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  insightText: {
    fontSize: 14,
    color: THEME.textPrimary,
    lineHeight: 20,
  },
});
